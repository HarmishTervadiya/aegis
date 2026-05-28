import * as fs from "fs";
import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY, AccountMeta } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { RouteName } from "./cpi_route_matrix";

type FixtureManifest = {
  programIds: Record<string, string>;
  core: Record<string, string>;
  userState: Record<string, string>;
};

const fixtureManifest = JSON.parse(
  fs.readFileSync("./scripts/cpi_fixture_manifest.json", "utf8")
) as FixtureManifest;

function pk(value: string): PublicKey {
  return new PublicKey(value);
}

export function fixtureHasInitializedUserState(): boolean {
  return (
    !fixtureManifest.userState.marginfiAccount.startsWith("REPLACE_WITH_") &&
    !fixtureManifest.userState.kaminoObligation.startsWith("REPLACE_WITH_")
  );
}

export function marginfiAccountPubkey(): PublicKey {
  return pk(fixtureManifest.userState.marginfiAccount);
}

export function kaminoObligationPubkey(): PublicKey {
  return pk(fixtureManifest.userState.kaminoObligation);
}

function m(pubkey: PublicKey, isWritable: boolean): AccountMeta {
  return { pubkey, isWritable, isSigner: false };
}

export function buildRemainingAccounts(
  route: RouteName,
  vaultPda: PublicKey,
  vaultTokenPda: PublicKey
): AccountMeta[] {
  const marginfiProgram = pk(fixtureManifest.programIds.marginfi);
  const kaminoProgram = pk(fixtureManifest.programIds.kamino);
  const marginfiGroup = pk(fixtureManifest.core.marginfiGroup);
  const marginfiBank = pk(fixtureManifest.core.marginfiBank);
  const marginfiVaultAuthority = pk(fixtureManifest.core.marginfiBankLiquidityVaultAuthority);
  const marginfiLiquidityVault = pk(fixtureManifest.core.marginfiBankLiquidityVault);
  const kaminoMarket = pk(fixtureManifest.core.kaminoLendingMarket);
  const kaminoMarketAuthority = pk(fixtureManifest.core.kaminoLendingMarketAuthority);
  const kaminoReserve = pk(fixtureManifest.core.kaminoReserve);
  const kaminoReserveLiquidityMint = pk(fixtureManifest.core.kaminoReserveLiquidityMint);
  const kaminoReserveLiquiditySupply = pk(fixtureManifest.core.kaminoReserveLiquiditySupply);
  const kaminoReserveCollateralMint = pk(fixtureManifest.core.kaminoReserveCollateralMint);
  const kaminoReserveSourceCollateral = pk(fixtureManifest.core.kaminoReserveSourceCollateral);
  const kaminoReserveDestinationDepositCollateral = pk(
    fixtureManifest.core.kaminoReserveDestinationDepositCollateral
  );

  const marginfiAccount = pk(fixtureManifest.userState.marginfiAccount);
  const kaminoObligation = pk(fixtureManifest.userState.kaminoObligation);

  const prefix: AccountMeta[] = [
    m(marginfiBank, false),
    m(kaminoReserve, false),
    m(vaultPda, false),
    m(vaultTokenPda, true),
  ];

  const marginfiDeposit: AccountMeta[] = [
    m(marginfiProgram, false),
    m(marginfiGroup, false),
    m(marginfiAccount, true),
    m(marginfiBank, true),
    m(vaultTokenPda, true),
    m(marginfiLiquidityVault, true),
    m(TOKEN_PROGRAM_ID, false),
  ];

  const marginfiWithdraw: AccountMeta[] = [
    m(marginfiProgram, false),
    m(marginfiGroup, false),
    m(marginfiAccount, true),
    m(marginfiBank, true),
    m(marginfiVaultAuthority, false),
    m(marginfiLiquidityVault, true),
    m(TOKEN_PROGRAM_ID, false),
  ];

  const kaminoDeposit: AccountMeta[] = [
    m(kaminoProgram, false),
    m(kaminoObligation, true),
    m(kaminoMarket, false),
    m(kaminoMarketAuthority, false),
    m(kaminoReserve, true),
    m(kaminoReserveLiquidityMint, false),
    m(kaminoReserveLiquiditySupply, true),
    m(kaminoReserveCollateralMint, true),
    m(kaminoReserveDestinationDepositCollateral, true),
    m(vaultTokenPda, true),
    m(TOKEN_PROGRAM_ID, false),
    m(TOKEN_PROGRAM_ID, false),
    m(SYSVAR_INSTRUCTIONS_PUBKEY, false),
  ];

  const kaminoWithdraw: AccountMeta[] = [
    m(kaminoProgram, false),
    m(kaminoObligation, true),
    m(kaminoMarket, false),
    m(kaminoMarketAuthority, false),
    m(kaminoReserve, true),
    m(kaminoReserveLiquidityMint, false),
    m(kaminoReserveSourceCollateral, true),
    m(kaminoReserveCollateralMint, true),
    m(kaminoReserveLiquiditySupply, true),
    m(vaultTokenPda, true),
    m(TOKEN_PROGRAM_ID, false),
    m(TOKEN_PROGRAM_ID, false),
    m(SYSVAR_INSTRUCTIONS_PUBKEY, false),
  ];

  switch (route) {
    case "idle_to_marginfi":
      return [...prefix, ...marginfiDeposit];
    case "idle_to_kamino":
      return [...prefix, ...kaminoDeposit];
    case "marginfi_to_kamino":
      return [...prefix, ...marginfiWithdraw, ...kaminoDeposit];
    case "kamino_to_marginfi":
      return [...prefix, ...kaminoWithdraw, ...marginfiDeposit];
    case "marginfi_to_idle":
      return [...prefix, ...marginfiWithdraw];
    case "kamino_to_idle":
      return [...prefix, ...kaminoWithdraw];
  }
}
