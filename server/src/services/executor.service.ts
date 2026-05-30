import { logger } from "../utils/logger.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { program, crankKeypair, connection } from "../rpc.js";
import { cache } from "../cache.js";
import { prisma } from "../db.js";
import { deriveVaultPda } from "../utils/pda.js";
import { formatMode } from "../utils/triggerMode.js";
import { calculateApyFromUtil } from "./watcher.service.js";

import { MARGINFI_BANK, KAMINO_RESERVE } from "../utils/constants.js";

const inFlight = new Set<string>();

const KNOWN_ERRORS: Record<string, string> = {
  ConditionNotMet: "on-chain guard rejected (correct behaviour)",
  TriggerNotActive: "trigger was deactivated between eval and fire",
  InsufficientFunds: "crank wallet needs topping up",
  CooldownActive: "trigger on cooldown — will retry next cycle",
  // Vault was created before the deposit_timestamp upgrade — user must re-init their vault
  AccountDidNotDeserialize:
    "vault layout mismatch — user must close and re-create vault",
};

export function classifyError(err: any): string | null {
  if (!err || !err.message) return null;
  for (const [code, explanation] of Object.entries(KNOWN_ERRORS)) {
    if (err.message.includes(code)) return explanation;
  }
  return null;
}

export async function fireExecuteTrigger(task: {
  trigger: any;
  modeArgs: any;
}) {
  const { trigger, modeArgs } = task;
  const key = trigger.owner.toString();
  if (inFlight.has(key)) {
    logger.info(`Executor: skipping ${key.slice(0, 8)} — tx already in flight`);
    return { success: false, reason: "AlreadyInFlight" };
  }

  inFlight.add(key);
  try {
    const ownerPubkey = new anchor.web3.PublicKey(trigger.owner);
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), ownerPubkey.toBuffer()],
      program.programId,
    );
    const [vaultTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), ownerPubkey.toBuffer()],
      program.programId,
    );
    const [triggerLog] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("log"),
        ownerPubkey.toBuffer(),
        new anchor.BN(trigger.executionCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    const remainingAccounts = [
      { pubkey: MARGINFI_BANK, isSigner: false, isWritable: false },
      { pubkey: KAMINO_RESERVE, isSigner: false, isWritable: false },
    ];

    // --- Devnet mock: compute expected yield and pre-mint tokens into the vault ---
    // The deploy keypair is the USDC mint authority, so we bundle a MintTo ix
    // in the same transaction so the contract sees the correct balance surplus.
    const USDC_MINT_STR = process.env.USDC_MINT || process.env.VITE_USDC_MINT;
    let mockYieldAmount = 0;
    let mintToIx: anchor.web3.TransactionInstruction | null = null;

    if (USDC_MINT_STR && process.env.VITE_NETWORK === "devnet") {
      try {
        const usdcMint = new anchor.web3.PublicKey(USDC_MINT_STR);
        // Fetch current vault state to get principal + deposit_timestamp
        const vaultAcc = await (program.account as any).userVault.fetch(
          vaultPda,
        );
        const principal: number = vaultAcc.usdcDeposited.toNumber();

        // depositTimestamp field only exists in the upgraded vault layout.
        // Old vaults (pre-upgrade) won't have it — treat as 0 (use 1s elapsed).
        let depositTs = 0;
        try {
          depositTs = vaultAcc.depositTimestamp?.toNumber?.() ?? 0;
        } catch {
          // Old vault layout — depositTimestamp field not present, skip yield mint
          logger.info(
            `Executor: Skipping mock yield for ${key.slice(0, 8)} — pre-upgrade vault (user must re-init)`,
          );
        }

        const currentProtocol = Object.keys(vaultAcc.currentProtocol)[0];

        if (currentProtocol !== "idle" && principal > 0) {
          const nowSec = Math.floor(Date.now() / 1000);
          const elapsedSecs = Math.max(
            depositTs === 0 ? 1 : nowSec - depositTs,
            1,
          );
          const utilBps =
            currentProtocol === "marginFi"
              ? cache.marginfi.utilizationBps
              : cache.kamino.utilizationBps;
          const apyBps =
            utilBps <= 8000
              ? Math.floor((utilBps * 500) / 8000)
              : 500 + Math.floor(((utilBps - 8000) * 1500) / 2000);

          // yield = principal * apy_bps * elapsed / (10000 * 31_536_000)
          mockYieldAmount = Math.floor(
            (principal * apyBps * elapsedSecs) / (10000 * 31_536_000),
          );

          if (mockYieldAmount > 0) {
            mintToIx = splToken.createMintToInstruction(
              usdcMint,
              vaultTokenAccount,
              crankKeypair.publicKey, // mint authority = deploy keypair
              BigInt(mockYieldAmount),
            );
            logger.info(
              `Executor: Bundling MintTo(${mockYieldAmount} micro-USDC) for ${key.slice(0, 8)}`,
            );
          }
        }
      } catch (e: any) {
        // AccountDidNotDeserialize = old vault layout — will be caught as KNOWN_ERROR below
        if (
          !e.message?.includes("AccountDidNotDeserialize") &&
          !e.message?.includes("offset")
        ) {
          logger.warn(
            `Executor: Mock yield pre-mint calc failed: ${e.message}`,
          );
        }
      }
    }

    // Build the executeTrigger transaction
    const tx = await (program.methods as any)
      .executeTrigger(new anchor.BN(trigger.executionCount), modeArgs)
      .accounts({
        triggerConfig: trigger.triggerPda,
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenAccount,
        triggerLog: triggerLog,
        owner: ownerPubkey,
        crank: crankKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: new anchor.web3.PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ),
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    // Prepend MintTo if available (atomically funds the vault before execute reads balances)
    if (mintToIx) {
      tx.instructions.unshift(mintToIx);
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = crankKeypair.publicKey;
    tx.sign(crankKeypair);

    const txSig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    logger.info(`Executor: Fired trigger for ${key.slice(0, 8)}! Tx: ${txSig}`);

    // Wait a brief moment for the RPC to finalize the new log account
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch the written trigger log to get the yieldEarned
    let yieldEarned = 0;
    try {
      const logData = await (program.account as any).triggerLog.fetch(
        triggerLog,
      );
      yieldEarned = logData.yieldEarned.toNumber();
    } catch (e) {
      logger.warn(
        `Executor: Failed to fetch triggerLog for yield extraction -> ${e}`,
      );
    }

    // Update the database
    const now = Math.floor(Date.now() / 1000);

    await prisma.$transaction([
      prisma.executionRecord.create({
        data: {
          userWallet: key,
          mode: formatMode(modeArgs),
          marginfiUtil: cache.marginfi.utilizationBps,
          kaminoUtil: cache.kamino.utilizationBps,
          txSignature: txSig,
          yieldEarned: yieldEarned,
        },
      }),
      prisma.triggerConfig.update({
        where: { triggerPda: trigger.triggerPda.toString() },
        data: {
          executionCount: { increment: 1 },
          lastExecuted: now,
        },
      }),
    ]);

    // Update UserVault DB row: fresh yield + reset depositedAt for next hop
    try {
      const freshVault = await (program.account as any).userVault.fetch(
        vaultPda,
      );
      const freshProtocol = Object.keys(
        freshVault.currentProtocol,
      )[0] as string;
      const freshApyUtilBps =
        freshProtocol === "marginFi"
          ? cache.marginfi.utilizationBps
          : freshProtocol === "kamino"
            ? cache.kamino.utilizationBps
            : 0;
      const freshApyAtEntry = calculateApyFromUtil(freshApyUtilBps);

      await prisma.userVault.upsert({
        where: { vaultPda: vaultPda.toString() },
        update: {
          currentProtocol: freshProtocol,
          usdcDeposited: BigInt(freshVault.usdcDeposited.toString()),
          lifetimeYield: BigInt(freshVault.lifetimeYield.toString()),
          depositedAt: new Date(),
          apyAtEntry: freshApyAtEntry,
        },
        create: {
          vaultPda: vaultPda.toString(),
          userWallet: key,
          currentProtocol: freshProtocol,
          usdcDeposited: BigInt(freshVault.usdcDeposited.toString()),
          lifetimeYield: BigInt(freshVault.lifetimeYield.toString()),
          depositedAt: new Date(),
          apyAtEntry: freshApyAtEntry,
        },
      });
    } catch (e: any) {
      logger.warn(
        `Executor: Failed to update UserVault DB row post-trigger: ${e.message}`,
      );
    }

    return { success: true, txSig };
  } catch (err: any) {
    const explanation = classifyError(err);
    if (explanation) {
      logger.info(
        `Executor: expected failure for ${key.slice(0, 8)} — ${explanation}`,
      );
    } else {
      logger.error(
        `Executor: execution failed for ${key.slice(0, 8)} -> ${err.message}`,
      );

      // Auto-heal: If execution failed (e.g. 6003 executionCount mismatch),
      // fetch the latest state from the blockchain to resync the database.
      try {
        const acc = await (program.account as any).triggerConfig.fetch(
          trigger.triggerPda,
        );
        await prisma.triggerConfig.update({
          where: { triggerPda: trigger.triggerPda.toString() },
          data: {
            executionCount: acc.executionCount.toNumber(),
            lastExecuted: acc.lastExecuted.toNumber(),
            defenseActive: acc.defenseActive,
            offenseActive: acc.offenseActive,
          },
        });
        logger.info(
          `Executor: Auto-healed state for ${key.slice(0, 8)} from chain.`,
        );
      } catch (healErr) {
        logger.error(`Executor: Auto-heal failed for ${key.slice(0, 8)}`);
      }
    }
    return { success: false, error: err.message };
  } finally {
    inFlight.delete(key);
  }
}
