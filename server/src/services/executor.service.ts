import { PublicKey } from "@solana/web3.js";
import { program, crankKeypair } from "../rpc.js";
import { cache } from "../cache.js";
import type { CachedTrigger } from "../cache.js";
import { deriveVaultPda } from "../utils/pda.js";
import { formatMode } from "../utils/triggerMode.js";

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

export async function fireExecuteTrigger(trigger: CachedTrigger) {
  const key = trigger.owner.toString();
  if (inFlight.has(key)) {
    console.log(`Executor: skipping ${key.slice(0, 8)} — tx already in flight`);
    return { success: false, reason: "AlreadyInFlight" };
  }

  inFlight.add(key);
  try {
    const vaultPda = deriveVaultPda(
      new PublicKey(trigger.owner),
      program.programId,
    );

    // Build the transaction
    // Note: If executeTrigger requires specific protocol accounts like MarginFi and Kamino,
    // they should be appended here. Anchor might automatically resolve some if defined in IDL.
    const txSig = await (program.methods as any)
      .executeTrigger()
      .accounts({
        crank: crankKeypair.publicKey,
        vault: vaultPda,
        triggerConfig: trigger.triggerPda,
      } as any)
      .signers([crankKeypair])
      .rpc();

    console.log(`Executor: Fired trigger for ${key.slice(0, 8)}! Tx: ${txSig}`);

    // Add to recent executions cache
    cache.recentExecutions.unshift({
      owner: key,
      mode: formatMode(trigger.mode),
      marginfiUtil: cache.marginfi.utilizationBps,
      kaminoUtil: cache.kamino.utilizationBps,
      firedAt: new Date().toISOString(),
      txSignature: txSig,
    });

    if (cache.recentExecutions.length > 50) {
      cache.recentExecutions.pop();
    }

    return { success: true, txSig };
  } catch (err: any) {
    const explanation = classifyError(err);
    if (explanation) {
      console.log(
        `Executor: expected failure for ${key.slice(0, 8)} — ${explanation}`,
      );
    } else {
      console.error(`Executor: execution failed for ${key.slice(0, 8)}`, err);
    }
    return { success: false, error: err.message };
  } finally {
    inFlight.delete(key);
  }
}
