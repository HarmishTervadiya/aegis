import { Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

type FixtureManifest = {
  programIds: Record<string, string>;
  core: Record<string, string>;
  userState: Record<string, string>;
};

const manifestPath = path.resolve(__dirname, "cpi_fixture_manifest.json");
const rpcUrl = process.env.CPI_RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(rpcUrl, "confirmed");

function readManifest(): FixtureManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as FixtureManifest;
}

function isPlaceholder(value: string): boolean {
  return value.startsWith("REPLACE_WITH_");
}

async function expectOwned(
  label: string,
  pubkeyString: string,
  expectedOwner: PublicKey,
): Promise<void> {
  const pubkey = new PublicKey(pubkeyString);
  const info = await connection.getAccountInfo(pubkey);
  if (!info) {
    throw new Error(
      `[preflight] Missing account: ${label} (${pubkey.toBase58()})`,
    );
  }
  if (!info.owner.equals(expectedOwner)) {
    throw new Error(
      `[preflight] Wrong owner for ${label}. expected=${expectedOwner.toBase58()} actual=${info.owner.toBase58()}`,
    );
  }
}

async function main(): Promise<void> {
  const manifest = readManifest();
  const marginfiProgram = new PublicKey(manifest.programIds.marginfi);
  const kaminoProgram = new PublicKey(manifest.programIds.kamino);

  // Core protocol accounts cloned into local validator.
  await expectOwned(
    "marginfiBank",
    manifest.core.marginfiBank,
    marginfiProgram,
  );
  await expectOwned(
    "kaminoReserve",
    manifest.core.kaminoReserve,
    kaminoProgram,
  );

  // Critical user-state prerequisite for true CPI execution.
  if (isPlaceholder(manifest.userState.marginfiAccount)) {
    throw new Error(
      "[preflight] userState.marginfiAccount is not configured. Set CPI_MARGINFI_ACCOUNT and rerun build_cpi_fixture_manifest.ts.",
    );
  }
  if (isPlaceholder(manifest.userState.kaminoObligation)) {
    throw new Error(
      "[preflight] userState.kaminoObligation is not configured. Set CPI_KAMINO_OBLIGATION and rerun build_cpi_fixture_manifest.ts.",
    );
  }

  await expectOwned(
    "marginfiAccount",
    manifest.userState.marginfiAccount,
    marginfiProgram,
  );
  await expectOwned(
    "kaminoObligation",
    manifest.userState.kaminoObligation,
    kaminoProgram,
  );

  console.log("[preflight] CPI fixture accounts are valid.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
