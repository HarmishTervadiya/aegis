import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createMint, createAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
// Import the correct generated type (will be generated on your next anchor build)
import { Aegis } from "../target/types/aegis";

describe("aegis", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Aegis as Program<Aegis>;

  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let userVaultPda: PublicKey;
  let vaultTokenAccountPda: PublicKey;
  let triggerConfigPda: PublicKey;
  
  // Note: we must cast to anchor.Wallet to satisfy types, but at runtime it has `.payer`
  const owner = provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair };

  before(async () => {
    // 1. Create a dummy USDC mint for local testing purposes
    usdcMint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      6
    );

    // 2. Derive the PDAs for user vault and the vault's token account
    [userVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );

    [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), owner.publicKey.toBuffer()],
      program.programId
    );

    [triggerConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trigger"), owner.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the user vault", async () => {
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

  it("Deposits USDC into the vault", async () => {
    // 1. Create a token account for the owner
    userTokenAccount = await createAccount(
      provider.connection,
      owner.payer,
      usdcMint,
      owner.publicKey
    );

    // 2. Mint some dummy USDC to the owner's token account (e.g., 100 USDC)
    const mintAmount = 100_000_000; // 100 USDC (6 decimals)
    await mintTo(
      provider.connection,
      owner.payer,
      usdcMint,
      userTokenAccount,
      owner.publicKey,
      mintAmount
    );

    // 3. Define the deposit amount (e.g., 50 USDC)
    const depositAmount = new anchor.BN(50_000_000);

    // 4. Call the deposit instruction
    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        userVault: userVaultPda,
        vaultTokenAccount: vaultTokenAccountPda,
        userTokenAccount: userTokenAccount,
        owner: owner.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Deposit transaction signature", tx);

    // 5. Verify the Vault's state was updated
    const vaultAccount = await program.account.userVault.fetch(userVaultPda);
    assert.equal(vaultAccount.usdcDeposited.toNumber(), depositAmount.toNumber());
    assert.isOk(vaultAccount.currentProtocol.idle !== undefined);

    // 6. Verify the token transfer actually occurred
    const vaultTokenAccountData = await getAccount(
      provider.connection,
      vaultTokenAccountPda
    );
    
    assert.equal(Number(vaultTokenAccountData.amount), depositAmount.toNumber());
  });

  it("Sets a trigger", async () => {
    const tx = await program.methods
      .setTrigger({ defense: {} })
      .accounts({
        triggerConfig: triggerConfigPda,
        userVault: userVaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Set Trigger transaction signature", tx);

    const triggerAccount = await program.account.triggerConfig.fetch(triggerConfigPda);
    assert.ok(triggerAccount.owner.equals(owner.publicKey));
    assert.isTrue(triggerAccount.isActive);
    assert.isOk(triggerAccount.mode.defense !== undefined);
  });

  it("Cancels a trigger", async () => {
    const tx = await program.methods
      .cancelTrigger()
      .accounts({
        triggerConfig: triggerConfigPda,
        owner: owner.publicKey,
      })
      .rpc();

    console.log("Cancel Trigger transaction signature", tx);

    const triggerAccount = await program.account.triggerConfig.fetch(triggerConfigPda);
    assert.isFalse(triggerAccount.isActive);
  });

});
