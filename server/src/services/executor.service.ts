import { logger } from "../utils/logger.js";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { program, crankKeypair } from "../rpc.js";
import { cache } from "../cache.js";
import { prisma } from "../db.js";
import { deriveVaultPda } from "../utils/pda.js";
import { formatMode } from "../utils/triggerMode.js";

import { MARGINFI_BANK, KAMINO_RESERVE } from "../utils/constants.js";

const inFlight = new Set<string>();

const KNOWN_ERRORS: Record<string, string> = {
  ConditionNotMet: "on-chain guard rejected (correct behaviour)",
  TriggerNotActive: "trigger was deactivated between eval and fire",
  InsufficientFunds: "crank wallet needs topping up",
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

    // Build the transaction
    const txSig = await (program.methods as any)
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
      .signers([crankKeypair])
      .rpc();

    logger.info(`Executor: Fired trigger for ${key.slice(0, 8)}! Tx: ${txSig}`);

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
        }
      }),
      prisma.triggerConfig.update({
        where: { triggerPda: trigger.triggerPda.toString() },
        data: {
          executionCount: { increment: 1 },
          lastExecuted: now
        }
      })
    ]);

    return { success: true, txSig };
  } catch (err: any) {
    const explanation = classifyError(err);
    if (explanation) {
      logger.info(
        `Executor: expected failure for ${key.slice(0, 8)} — ${explanation}`,
      );
    } else {
      logger.error(`Executor: execution failed for ${key.slice(0, 8)}`, err);
    }
    return { success: false, error: err.message };
  } finally {
    inFlight.delete(key);
  }
}
