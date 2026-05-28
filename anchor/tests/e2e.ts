import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import { Aegis } from "../target/types/aegis";
import {
  buildRemainingAccounts,
  fixtureHasInitializedUserState,
  kaminoObligationPubkey,
  marginfiAccountPubkey,
} from "./cpi_fixtures";
import { assertRouteShapeLengths } from "./cpi_route_matrix";

function protocolVariant(value: any): "Idle" | "Kamino" | "MarginFi" | "Unknown" {
  if (!value || typeof value !== "object") return "Unknown";
  if ("idle" in value) return "Idle";
  if ("kamino" in value) return "Kamino";
  if ("marginFi" in value || "marginfi" in value) return "MarginFi";
  return "Unknown";
}

describe("Aegis E2E Layer 2 (CPI bindings)", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.Aegis as Program<Aegis>;

  const owner = Keypair.generate();
  let vaultPda: PublicKey;
  let vaultTokenPda: PublicKey;
  let triggerPda: PublicKey;
  let usdcMint: PublicKey;
  let ownerTokenAccount: PublicKey;

  before(async () => {
    assertRouteShapeLengths();
    if (!fixtureHasInitializedUserState()) {
      throw new Error(
        "CPI user-state precondition is missing. Populate scripts/cpi_fixture_manifest.json userState via build_cpi_fixture_manifest.ts before running e2e tests."
      );
    }

    const sig = await provider.connection.requestAirdrop(owner.publicKey, 10 * 1e9);
    await provider.connection.confirmTransaction(sig, "confirmed");

    usdcMint = await createMint(provider.connection, owner, owner.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      usdcMint,
      owner.publicKey
    );
    ownerTokenAccount = ata.address;
    await mintTo(provider.connection, owner, usdcMint, ownerTokenAccount, owner, 1_000_000_000);

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );
    [vaultTokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), owner.publicKey.toBuffer()],
      program.programId
    );
    [triggerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trigger"), owner.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeVault()
      .accounts({
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        usdcMint,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    await program.methods
      .deposit(new anchor.BN(5_000_000))
      .accounts({
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: ownerTokenAccount,
        owner: owner.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    await program.methods
      .setProtocolAccounts(marginfiAccountPubkey(), kaminoObligationPubkey())
      .accounts({ userVault: vaultPda, owner: owner.publicKey })
      .signers([owner])
      .rpc();
  });

  it("rejects malformed utilization-owner account shape", async () => {
    await program.methods
      .setTrigger({ offense: {} }, new anchor.BN(9000), new anchor.BN(1))
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const [logPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("log"), owner.publicKey.toBuffer(), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const malformed = buildRemainingAccounts("idle_to_kamino", vaultPda, vaultTokenPda);
    const tmp = malformed[0];
    malformed[0] = malformed[1];
    malformed[1] = tmp;

    try {
      await program.methods
        .executeTrigger(new anchor.BN(0))
        .accounts({
          triggerConfig: triggerPda,
          userVault: vaultPda,
          vaultTokenAccount: vaultTokenPda,
          triggerLog: logPda,
          owner: owner.publicKey,
          crank: owner.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(malformed)
        .signers([owner])
        .rpc();
      assert.fail("Expected InvalidAccountOwner");
    } catch (err: any) {
      assert.include(String(err?.message ?? err), "InvalidAccountOwner");
    }
  });

  it("executes Idle->(Kamino|MarginFi) CPI path and writes trigger log", async () => {
    await program.methods
      .setTrigger({ offense: {} }, new anchor.BN(9000), new anchor.BN(1))
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const [logPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("log"), owner.publicKey.toBuffer(), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // In offense mode, destination protocol depends on live utilization values.
    // idle_to_kamino bundle is a strict superset for shared prefix + Kamino deposit path.
    const remaining = buildRemainingAccounts("idle_to_kamino", vaultPda, vaultTokenPda);

    await program.methods
      .executeTrigger(new anchor.BN(0))
      .accounts({
        triggerConfig: triggerPda,
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        triggerLog: logPda,
        owner: owner.publicKey,
        crank: owner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remaining)
      .signers([owner])
      .rpc();

    const vault = await program.account.userVault.fetch(vaultPda);
    const log = await program.account.triggerLog.fetch(logPda);

    assert.equal(log.owner.toString(), owner.publicKey.toString());
    assert.equal(log.amountMoved.toString(), "5000000");
    assert.equal(log.marginfiUtilizationBps.toNumber() >= 0, true);
    assert.equal(log.kaminoUtilizationBps.toNumber() >= 0, true);
    assert.notEqual(protocolVariant(vault.currentProtocol), "Idle");
  });

  it("executes Defense route back to Idle after funds are deployed", async () => {
    await program.methods
      .setTrigger({ defense: {} }, new anchor.BN(1), new anchor.BN(1))
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const [logPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("log"), owner.publicKey.toBuffer(), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const vaultBefore = await program.account.userVault.fetch(vaultPda);
    const isKamino = protocolVariant(vaultBefore.currentProtocol) === "Kamino";
    const route = isKamino ? "kamino_to_idle" : "marginfi_to_idle";
    const remaining = buildRemainingAccounts(route, vaultPda, vaultTokenPda);

    await program.methods
      .executeTrigger(new anchor.BN(1))
      .accounts({
        triggerConfig: triggerPda,
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        triggerLog: logPda,
        owner: owner.publicKey,
        crank: owner.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remaining)
      .signers([owner])
      .rpc();

    const vaultAfter = await program.account.userVault.fetch(vaultPda);
    assert.equal(protocolVariant(vaultAfter.currentProtocol), "Idle");
  });
});
