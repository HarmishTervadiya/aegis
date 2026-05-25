import { Connection, PublicKey } from "@solana/web3.js";

// Use mainnet directly since we're just reading account data for validation
// Switch to http://127.0.0.1:8899 when running against local validator
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");

const ACCOUNTS = {
  MARGINFI_PROGRAM:  new PublicKey("MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA"),
  MARGINFI_BANK:     new PublicKey("2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB"),
  MARGINFI_GROUP:    new PublicKey("4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8"),
  KAMINO_PROGRAM:    new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"),
  KAMINO_RESERVE:    new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"),
  USDC_MINT:         new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
};

function readU128LE(data: Buffer, offset: number): bigint {
  const lo = data.readBigUInt64LE(offset);
  const hi = data.readBigUInt64LE(offset + 8);
  return lo + (hi << 64n);
}

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

// Scans account data and prints all u128 values that look like
// plausible token amounts (I80F48 scale: divide by 2^48)
function scanForTokenAmounts(data: Buffer, label: string) {
  console.log(`\n  Scanning ${label} for plausible I80F48 token amounts:`);
  const scale = Number(2n ** 48n);
  for (let offset = 8; offset < Math.min(data.length - 16, 800); offset += 8) {
    try {
      const raw = readU128LE(data, offset);
      const asFloat = Number(raw) / scale;
      // A USDC pool with meaningful TVL: between $1000 and $10 billion
      if (asFloat > 1000 && asFloat < 10_000_000_000) {
        console.log(`    offset=${offset}: I80F48=${asFloat.toFixed(2)} USDC`);
      }
    } catch (_) {}
  }
}

async function checkAccount(
  name: string,
  address: PublicKey,
  expectedOwner: PublicKey
): Promise<Buffer | null> {
  const info = await connection.getAccountInfo(address);
  if (!info) {
    console.log(`  FAIL: ${name} not found`);
    return null;
  }
  const ownerMatch = info.owner.equals(expectedOwner);
  console.log(`  ${ownerMatch ? "OK" : "FAIL"}: owner ${ownerMatch ? "matches" : "MISMATCH"}`);
  console.log(`  data length: ${info.data.length} bytes`);
  console.log(`  discriminator: ${Buffer.from(info.data.slice(0, 8)).toString("hex")}`);
  return Buffer.from(info.data);
}

async function validateMarginFi() {
  console.log("\n=== MarginFi Bank ===");
  const data = await checkAccount(
    "MarginFi Bank",
    ACCOUNTS.MARGINFI_BANK,
    ACCOUNTS.MARGINFI_PROGRAM
  );
  if (!data) return;

  // Read utilization using known I80F48 offsets
  // Offsets determined by scanning all plausible I80F48 values and finding the pair
  // that produces utilization between 10-100%. Cross-check against app.marginfi.com
  const ASSETS_OFFSET = 182;
  const LIABILITIES_OFFSET = 240;

  const assetsRaw = readU128LE(data, ASSETS_OFFSET);
  const liabilitiesRaw = readU128LE(data, LIABILITIES_OFFSET);
  const scale = Number(2n ** 48n);
  const assets = Number(assetsRaw) / scale;
  const liabilities = Number(liabilitiesRaw) / scale;

  console.log(`  total_assets (I80F48): ${assets.toFixed(2)}`);
  console.log(`  total_liabilities (I80F48): ${liabilities.toFixed(2)}`);

  if (assets > 0) {
    const utilPct = (liabilities / assets) * 100;
    const utilBps = Math.round(utilPct * 100);
    console.log(`  Utilization: ${utilPct.toFixed(2)}% (${utilBps} bps)`);
    console.log(`  Cross-check against: https://app.marginfi.com`);

    if (utilPct < 10 || utilPct > 100) {
      console.log(`  WARNING: utilization looks wrong. Running offset scan...`);
      scanForTokenAmounts(data, "MarginFi Bank");
      console.log(`  Update ASSETS_OFFSET and LIABILITIES_OFFSET above with correct values.`);
    } else {
      console.log(`  Offsets look correct.`);
    }
  }
}

async function validateKamino() {
  console.log("\n=== Kamino Reserve ===");
  const data = await checkAccount(
    "Kamino Reserve",
    ACCOUNTS.KAMINO_RESERVE,
    ACCOUNTS.KAMINO_PROGRAM
  );
  if (!data) return;

  // available_amount at offset 137 (u64)
  // borrowed_amount_sf at offset 145 (u128 scaled fraction, scale = 2^60)
  const AVAILABLE_OFFSET = 137;
  const BORROWED_OFFSET = 145;

  const available = readU64LE(data, AVAILABLE_OFFSET);
  const borrowedSf = readU128LE(data, BORROWED_OFFSET);

  const sfScale = Number(2n ** 60n);
  const availableTokens = Number(available);
  const borrowedTokens = Number(borrowedSf) / sfScale;
  const total = availableTokens + borrowedTokens;

  console.log(`  available_amount: ${availableTokens.toFixed(2)} raw units`);
  console.log(`  borrowed_amount_sf (as tokens): ${borrowedTokens.toFixed(2)}`);

  if (total > 0) {
    const utilPct = (borrowedTokens / total) * 100;
    const utilBps = Math.round(utilPct * 100);
    console.log(`  Utilization: ${utilPct.toFixed(2)}% (${utilBps} bps)`);
    console.log(`  Cross-check against: https://app.kamino.finance`);

    if (utilPct < 10 || utilPct > 100) {
      console.log(`  WARNING: utilization looks wrong. Running offset scan...`);
      scanForTokenAmounts(data, "Kamino Reserve");
    } else {
      console.log(`  Offsets look correct.`);
    }
  }
}

async function main() {
  console.log(`Connecting to: ${RPC_URL}`);
  const slot = await connection.getSlot();
  console.log(`Current slot: ${slot}`);

  await validateMarginFi();
  await validateKamino();

  console.log("\n=== Summary ===");
  console.log("If both accounts printed OK and utilization is plausible:");
  console.log("  -> Account reads are confirmed feasible.");
  console.log("  -> The offsets are correct for use in execute_trigger.rs.");
  console.log("  -> Proceed to Phase 2 (writing state and instructions).");
}

main().catch(console.error);