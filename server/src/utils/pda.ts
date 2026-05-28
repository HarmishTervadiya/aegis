import { PublicKey } from "@solana/web3.js";

export function deriveVaultPda(
  ownerPubkey: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerPubkey.toBuffer()],
    programId,
  );
  return pda;
}
