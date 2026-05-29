import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Deterministic seed generation
const mfiSeed = new Uint8Array(32).fill(1);
const kamSeed = new Uint8Array(32).fill(2);
const mfiKeypair = Keypair.fromSeed(mfiSeed);
const kamKeypair = Keypair.fromSeed(kamSeed);

const MARGINFI_BANK = mfiKeypair.publicKey;
const KAMINO_RESERVE = kamKeypair.publicKey;

const PROGRAM_ID = new PublicKey(
  "5f3FSmoxZ6fpiQtdBoaPdAyCwUXmqFSRGBpSpRP9C4iU",
);

async function main() {
  console.log("Mock Pools script started.");
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // Use a local keypair for the payer
  const idJSON = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.HOME || process.env.USERPROFILE || "",
        ".config/solana/id.json",
      ),
      "utf-8",
    ),
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(idJSON));

  // Airdrop SOL to payer
  try {
    const sig = await connection.requestAirdrop(payer.publicKey, 1000 * 1e9);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    });
    console.log("Airdropped 1000 SOL to", payer.publicKey.toBase58());
  } catch (e) {
    console.log("Airdrop failed or not needed.");
  }

  // Check if accounts exist
  const mfiInfo = await connection.getAccountInfo(MARGINFI_BANK);
  const kamInfo = await connection.getAccountInfo(KAMINO_RESERVE);

  const tx = new Transaction();
  let needsTx = false;

  if (!mfiInfo) {
    console.log("Creating mock MarginFi bank account...");
    const lamports = await connection.getMinimumBalanceForRentExemption(500);
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: MARGINFI_BANK,
        lamports,
        space: 500,
        programId: PROGRAM_ID,
      }),
    );
    needsTx = true;
  }

  if (!kamInfo) {
    console.log("Creating mock Kamino reserve account...");
    const lamports = await connection.getMinimumBalanceForRentExemption(500);
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: KAMINO_RESERVE,
        lamports,
        space: 500,
        programId: PROGRAM_ID,
      }),
    );
    needsTx = true;
  }

  if (needsTx) {
    await sendAndConfirmTransaction(connection, tx, [
      payer,
      mfiKeypair,
      kamKeypair,
    ]);
    console.log("Mock accounts created.");
  }

  console.log("Starting data pump...");

  // Simulate fluctuating utilization
  // MarginFi: 40% to 90%
  // Kamino: 20% to 70%

  let mfiBaseAssets = 100000000n; // 100M
  let kamBaseAvail = 50000000n; // 50M

  setInterval(async () => {
    try {
      const mfiUtilBps = 4000 + Math.floor(Math.random() * 5000); // 40%-90%
      const mfiLiab = (mfiBaseAssets * BigInt(mfiUtilBps)) / 10000n;

      const kamUtilBps = 2000 + Math.floor(Math.random() * 5000); // 20%-70%
      const kamBorrowSf =
        (kamBaseAvail * BigInt(kamUtilBps)) / (10000n - BigInt(kamUtilBps)); // Roughly

      // Construct instruction data manually
      // Discriminator: [70, 252, 233, 122, 171, 150, 114, 105]
      const data = Buffer.alloc(8 + 16 + 16 + 8 + 16);
      data.set(new Uint8Array([70, 252, 233, 122, 171, 150, 114, 105]), 0);
      data.writeBigUInt64LE(mfiBaseAssets & 0xffffffffffffffffn, 8);
      data.writeBigUInt64LE(mfiBaseAssets >> 64n, 16);
      data.writeBigUInt64LE(mfiLiab & 0xffffffffffffffffn, 24);
      data.writeBigUInt64LE(mfiLiab >> 64n, 32);
      data.writeBigUInt64LE(kamBaseAvail, 40);
      data.writeBigUInt64LE(kamBorrowSf & 0xffffffffffffffffn, 48);
      data.writeBigUInt64LE(kamBorrowSf >> 64n, 56);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: MARGINFI_BANK, isSigner: false, isWritable: true },
          { pubkey: KAMINO_RESERVE, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        data,
      });

      const tx = new Transaction().add(ix);
      await sendAndConfirmTransaction(connection, tx, [payer]);

      console.log(
        `Pumped -> MFI: ${mfiUtilBps / 100}% | KAM: ${kamUtilBps / 100}%`,
      );
    } catch (err: any) {
      console.error("Failed to pump data:", err.message);
    }
  }, 5000);
}

main().catch(console.error);
