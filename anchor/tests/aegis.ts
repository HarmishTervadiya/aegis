import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
// Import the correct generated type (will be generated on your next anchor build)
import { Aegis } from "../target/types/aegis";

describe("aegis", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Aegis as Program<Aegis>;

  let usdcMint: PublicKey;
  const owner = provider.wallet as anchor.Wallet;

  it("Initializes the user vault", async () => {
    // 1. Create a dummy USDC mint for local testing purposes
    usdcMint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      6
    );

    // 2. Derive the PDAs for user vault and the vault's token account
    const [userVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );

    const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), owner.publicKey.toBuffer()],
      program.programId
    );

    // 3. Send the transaction to initialize the vault
    const tx = await program.methods
      .initializeVault()
      .accounts({
        userVault: userVaultPda,
        vaultTokenAccount: vaultTokenAccountPda,
        usdcMint: usdcMint,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Transaction signature", tx);

    // 4. Fetch the vault account and assert its initial state
    const vaultAccount = await program.account.userVault.fetch(userVaultPda);

    assert.ok(vaultAccount.owner.equals(owner.publicKey));
    assert.equal(vaultAccount.usdcDeposited.toNumber(), 0);
    
    // Check that currentProtocol is Protocol::Idle
    assert.isOk(vaultAccount.currentProtocol.idle !== undefined);
  });
});
