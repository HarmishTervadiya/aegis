import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

async function main() {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  const walletAddressStr = process.argv[2];
  if (!walletAddressStr) {
    console.error(
      "Usage: bun run scripts/setup-local-usdc.ts <your-phantom-wallet-address>",
    );
    process.exit(1);
  }

  const userPubkey = new PublicKey(walletAddressStr);

  // Use a deterministic keypair for the mint so it stays the same across runs if we want, or just generate new.
  // Actually, generating a new one is fine.
  const mintAuthority = Keypair.generate();

  console.log("Airdropping 1 SOL to mint authority...");
  const airdropSig = await connection.requestAirdrop(
    mintAuthority.publicKey,
    1000000000,
  );
  await connection.confirmTransaction(airdropSig);

  console.log("Creating mock USDC mint...");
  const usdcMint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
  );
  console.log(`✅ Mock USDC Mint: ${usdcMint.toBase58()}`);

  console.log(`Creating ATA for ${userPubkey.toBase58()}...`);
  const userAta = await createAssociatedTokenAccount(
    connection,
    mintAuthority,
    usdcMint,
    userPubkey,
  );

  console.log("Minting 10,000 Mock USDC to your wallet...");
  await mintTo(
    connection,
    mintAuthority,
    usdcMint,
    userAta,
    mintAuthority.publicKey,
    10_000 * 1_000_000, // 10k USDC
  );

  console.log("✅ Minted successfully.");

  // Update .env file
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  if (envContent.includes("VITE_USDC_MINT=")) {
    envContent = envContent.replace(
      /VITE_USDC_MINT=.*/,
      `VITE_USDC_MINT=${usdcMint.toBase58()}`,
    );
  } else {
    envContent += `\nVITE_USDC_MINT=${usdcMint.toBase58()}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Updated ${envPath} with VITE_USDC_MINT.`);
}

main().catch(console.error);
