// @ts-nocheck
import { logger } from "../utils/logger.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import BN from "bn.js";

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

const idlPath = path.resolve(
  __dirname,
  "../../../mock-lending/target/idl/mock_lending.json",
);
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
const program = new Program(idl, provider);

const marginfiMarket = new PublicKey(process.env.MOCK_MARGINFI_MARKET!);
const kaminoMarket = new PublicKey(process.env.MOCK_KAMINO_MARKET!);

// Global state
const ASSETS = 10_000_000_000; // 10k USDC
let currentMarginfiUtil = 50; // start at 50%
let currentKaminoUtil = 50; // start at 50%
let isUpdating = false;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

async function updateMarkets(mfiUtil: number, kamUtil: number, type: string) {
  if (isUpdating) {
    logger.info(`[Fluctuate] Skipping ${type} update - collision prevented`);
    return;
  }
  isUpdating = true;

  try {
    const marginfiLiabilities = Math.floor((ASSETS * mfiUtil) / 100);
    const kaminoLiabilities = Math.floor((ASSETS * kamUtil) / 100);

    logger.info(
      `[Fluctuate ${type}] MarginFi: ${mfiUtil}%, Kamino: ${kamUtil}%`,
    );

    const tx1 = await program.methods
      .updateMarket(new BN(ASSETS), new BN(marginfiLiabilities))
      .accounts({ market: marginfiMarket, authority: authority.publicKey })
      .rpc();

    const tx2 = await program.methods
      .updateMarket(new BN(ASSETS), new BN(kaminoLiabilities))
      .accounts({ market: kaminoMarket, authority: authority.publicKey })
      .rpc();

    // logger.info(`  -> TXs: ${tx1.slice(0,8)}... / ${tx2.slice(0,8)}...`);
  } catch (err: any) {
    logger.error(`Error updating markets (${type}):`, err.message);
  } finally {
    isUpdating = false;
  }
}

// Minor fluctuation: +/- 2%
async function runMinorFluctuation() {
  currentMarginfiUtil = clamp(
    currentMarginfiUtil + (Math.random() * 4 - 2),
    10,
    90,
  );
  currentKaminoUtil = clamp(
    currentKaminoUtil + (Math.random() * 4 - 2),
    10,
    90,
  );
  await updateMarkets(currentMarginfiUtil, currentKaminoUtil, "Minor");
}

// Major fluctuation: +/- 30%
async function runMajorFluctuation() {
  currentMarginfiUtil = clamp(
    currentMarginfiUtil + (Math.random() * 60 - 30),
    10,
    90,
  );
  currentKaminoUtil = clamp(
    currentKaminoUtil + (Math.random() * 60 - 30),
    10,
    90,
  );
  await updateMarkets(currentMarginfiUtil, currentKaminoUtil, "MAJOR");
}

logger.info("Starting devnet mock market fluctuation service...");

// Run minor fluctuations every 3 seconds
setInterval(runMinorFluctuation, 3_000);

// Run major fluctuations every 12 seconds
setInterval(runMajorFluctuation, 12_000);

// Initial update
runMinorFluctuation();
