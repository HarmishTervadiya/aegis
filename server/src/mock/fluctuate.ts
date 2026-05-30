import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const keypairPath = path.resolve(
  process.env.HOME || process.env.USERPROFILE || "",
  "deploy-key.json",
);
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
const wallet = new Wallet(authority);
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const idl = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../mock-lending/target/idl/mock_lending.json",
    ),
    "utf8",
  ),
);
const program = new Program(idl, provider);

const marginfiMarket = new PublicKey(process.env.MOCK_MARGINFI_MARKET!);
const kaminoMarket = new PublicKey(process.env.MOCK_KAMINO_MARKET!);

import BN from "bn.js";

async function fluctuate() {
  const assets = 10_000_000_000; // 10k USDC
  const marginfiUtil = Math.floor(Math.random() * 80) + 10;
  const kaminoUtil = Math.floor(Math.random() * 80) + 10;

  const marginfiLiabilities = Math.floor((assets * marginfiUtil) / 100);
  const kaminoLiabilities = Math.floor((assets * kaminoUtil) / 100);

  console.log(`[Fluctuate] MarginFi: ${marginfiUtil}%, Kamino: ${kaminoUtil}%`);

  try {
    const tx1 = await program.methods
      .updateMarket(new BN(assets), new BN(marginfiLiabilities))
      .accounts({
        market: marginfiMarket,
        authority: authority.publicKey,
      })
      .rpc();
    console.log(`MarginFi updated: ${tx1}`);

    const tx2 = await program.methods
      .updateMarket(new BN(assets), new BN(kaminoLiabilities))
      .accounts({
        market: kaminoMarket,
        authority: authority.publicKey,
      })
      .rpc();
    console.log(`Kamino updated: ${tx2}`);
  } catch (err: any) {
    console.error("Error updating markets:", err.message);
  }
}

console.log("Starting devnet mock market fluctuation service...");
setInterval(fluctuate, 30_000);
fluctuate();
