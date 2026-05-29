import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

export function deriveVaultPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function deriveVaultTokenPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function deriveTriggerPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trigger"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function deriveTriggerLogPda(owner: PublicKey, logIndex: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("log"),
      owner.toBuffer(),
      new BN(logIndex).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  return pda;
}
