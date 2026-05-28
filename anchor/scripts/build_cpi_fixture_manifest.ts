import * as fs from "fs";
import * as path from "path";

type FixtureManifest = {
  programIds: Record<string, string>;
  core: Record<string, string>;
  userState: Record<string, string>;
};

const manifestPath = path.resolve(__dirname, "cpi_fixture_manifest.json");

function readManifest(): FixtureManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as FixtureManifest;
}

function writeManifest(manifest: FixtureManifest): void {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function main(): void {
  const manifest = readManifest();

  // Deterministic update path: callers can inject known preinitialized user-state pubkeys.
  // This keeps the manifest static/reproducible while allowing route tests to be fully strict.
  const marginfiAccount = process.env.CPI_MARGINFI_ACCOUNT;
  const kaminoObligation = process.env.CPI_KAMINO_OBLIGATION;

  if (marginfiAccount) {
    manifest.userState.marginfiAccount = marginfiAccount;
  }
  if (kaminoObligation) {
    manifest.userState.kaminoObligation = kaminoObligation;
  }

  writeManifest(manifest);
  console.log(`Updated fixture manifest: ${manifestPath}`);
}

main();
