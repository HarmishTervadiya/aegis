import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const MARGINFI_BANK = new PublicKey("2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB");

function readI80F48(data: Buffer, offset: number): number {
  // I80F48 is stored as a 16-byte little-endian value
  // Bottom 48 bits are fractional, top 80 bits are integer
  const lo = data.readBigUInt64LE(offset);
  const hi = data.readBigUInt64LE(offset + 8);
  const raw = lo + (hi << 64n);
  return Number(raw) / Number(2n ** 48n);
}

async function main() {
  const info = await connection.getAccountInfo(MARGINFI_BANK);
  if (!info) { console.log("Account not found"); return; }
  const data = Buffer.from(info.data);
  console.log(`Data length: ${data.length} bytes`);
  
  // MarginFi Bank struct layout (from marginfi-v2 source):
  // 8 bytes discriminator
  // 32 bytes: mint
  // 1 byte: mint_decimals
  // 32 bytes: group
  // ... then various I80F48 fields for interest rates
  // The key fields we need are total_asset_shares and total_liability_shares
  
  // Let's scan ALL I80F48 values at every possible offset
  const results: {offset: number, value: number}[] = [];
  for (let offset = 8; offset <= data.length - 16; offset += 1) {
    try {
      const val = readI80F48(data, offset);
      // Only keep values in reasonable USDC range (shares)
      if (val > 100_000 && val < 1_000_000_000) {
        results.push({offset, value: val});
      }
    } catch(_) {}
  }
  
  console.log("\nAll plausible I80F48 values:");
  for (const r of results) {
    console.log(`  offset=${r.offset} (0x${r.offset.toString(16)}): ${r.value.toFixed(2)}`);
  }
  
  // Now try every pair where ratio is between 1% and 99%
  console.log("\nPlausible utilization pairs (assets/liabilities):");
  for (const assets of results) {
    for (const liab of results) {
      if (liab.offset <= assets.offset) continue;
      if (liab.offset - assets.offset > 64) continue; // They should be close
      const util = (liab.value / assets.value) * 100;
      if (util > 1 && util < 99) {
        console.log(`  assets@${assets.offset}=${assets.value.toFixed(2)}, liab@${liab.offset}=${liab.value.toFixed(2)}, util=${util.toFixed(2)}%`);
      }
    }
  }
}

main().catch(console.error);
