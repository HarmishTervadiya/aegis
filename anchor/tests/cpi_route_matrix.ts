import { PublicKey } from "@solana/web3.js";

export type RouteName =
  | "idle_to_marginfi"
  | "idle_to_kamino"
  | "marginfi_to_kamino"
  | "kamino_to_marginfi"
  | "marginfi_to_idle"
  | "kamino_to_idle";

export type AccountMetaShape = {
  label: string;
  isWritable: boolean;
  isSigner: boolean;
};

export type RouteSpec = {
  name: RouteName;
  from: "Idle" | "MarginFi" | "Kamino";
  to: "Idle" | "MarginFi" | "Kamino";
  accountSliceStart: number;
  accountSliceEndExclusive: number;
  shape: AccountMetaShape[];
};

const sharedPrefix: AccountMetaShape[] = [
  { label: "marginfi_bank_read", isWritable: false, isSigner: false }, // [0]
  { label: "kamino_reserve_read", isWritable: false, isSigner: false }, // [1]
  { label: "vault_pda", isWritable: false, isSigner: false }, // [2] signer via PDA seeds inside program
  { label: "vault_token_account", isWritable: true, isSigner: false }, // [3]
];

const marginfiWithdrawShape: AccountMetaShape[] = [
  { label: "marginfi_program", isWritable: false, isSigner: false },
  { label: "marginfi_group", isWritable: false, isSigner: false },
  { label: "marginfi_account", isWritable: true, isSigner: false },
  { label: "marginfi_bank", isWritable: true, isSigner: false },
  {
    label: "marginfi_bank_liquidity_vault_authority",
    isWritable: false,
    isSigner: false,
  },
  { label: "marginfi_bank_liquidity_vault", isWritable: true, isSigner: false },
  { label: "token_program", isWritable: false, isSigner: false },
];

const marginfiDepositShape: AccountMetaShape[] = [
  { label: "marginfi_program", isWritable: false, isSigner: false },
  { label: "marginfi_group", isWritable: false, isSigner: false },
  { label: "marginfi_account", isWritable: true, isSigner: false },
  { label: "marginfi_bank", isWritable: true, isSigner: false },
  {
    label: "vault_token_as_signer_token_account",
    isWritable: true,
    isSigner: false,
  },
  { label: "marginfi_bank_liquidity_vault", isWritable: true, isSigner: false },
  { label: "token_program", isWritable: false, isSigner: false },
];

const kaminoWithdrawShape: AccountMetaShape[] = [
  { label: "kamino_program", isWritable: false, isSigner: false },
  { label: "kamino_obligation", isWritable: true, isSigner: false },
  { label: "kamino_lending_market", isWritable: false, isSigner: false },
  {
    label: "kamino_lending_market_authority",
    isWritable: false,
    isSigner: false,
  },
  { label: "kamino_withdraw_reserve", isWritable: true, isSigner: false },
  {
    label: "kamino_reserve_liquidity_mint",
    isWritable: false,
    isSigner: false,
  },
  {
    label: "kamino_reserve_source_collateral",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "kamino_reserve_collateral_mint",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "kamino_reserve_liquidity_supply",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "vault_token_as_user_destination_liquidity",
    isWritable: true,
    isSigner: false,
  },
  { label: "collateral_token_program", isWritable: false, isSigner: false },
  { label: "liquidity_token_program", isWritable: false, isSigner: false },
  { label: "instruction_sysvar", isWritable: false, isSigner: false },
];

const kaminoDepositShape: AccountMetaShape[] = [
  { label: "kamino_program", isWritable: false, isSigner: false },
  { label: "kamino_obligation", isWritable: true, isSigner: false },
  { label: "kamino_lending_market", isWritable: false, isSigner: false },
  {
    label: "kamino_lending_market_authority",
    isWritable: false,
    isSigner: false,
  },
  { label: "kamino_reserve", isWritable: true, isSigner: false },
  {
    label: "kamino_reserve_liquidity_mint",
    isWritable: false,
    isSigner: false,
  },
  {
    label: "kamino_reserve_liquidity_supply",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "kamino_reserve_collateral_mint",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "kamino_reserve_destination_deposit_collateral",
    isWritable: true,
    isSigner: false,
  },
  {
    label: "vault_token_as_user_source_liquidity",
    isWritable: true,
    isSigner: false,
  },
  { label: "collateral_token_program", isWritable: false, isSigner: false },
  { label: "liquidity_token_program", isWritable: false, isSigner: false },
  { label: "instruction_sysvar", isWritable: false, isSigner: false },
];

export const ROUTE_SPECS: RouteSpec[] = [
  {
    name: "idle_to_marginfi",
    from: "Idle",
    to: "MarginFi",
    accountSliceStart: 4,
    accountSliceEndExclusive: 11,
    shape: [...sharedPrefix, ...marginfiDepositShape],
  },
  {
    name: "idle_to_kamino",
    from: "Idle",
    to: "Kamino",
    accountSliceStart: 4,
    accountSliceEndExclusive: 17,
    shape: [...sharedPrefix, ...kaminoDepositShape],
  },
  {
    name: "marginfi_to_kamino",
    from: "MarginFi",
    to: "Kamino",
    accountSliceStart: 4,
    accountSliceEndExclusive: 25,
    shape: [...sharedPrefix, ...marginfiWithdrawShape, ...kaminoDepositShape],
  },
  {
    name: "kamino_to_marginfi",
    from: "Kamino",
    to: "MarginFi",
    accountSliceStart: 4,
    accountSliceEndExclusive: 24,
    shape: [...sharedPrefix, ...kaminoWithdrawShape, ...marginfiDepositShape],
  },
  {
    name: "marginfi_to_idle",
    from: "MarginFi",
    to: "Idle",
    accountSliceStart: 4,
    accountSliceEndExclusive: 12,
    shape: [...sharedPrefix, ...marginfiWithdrawShape],
  },
  {
    name: "kamino_to_idle",
    from: "Kamino",
    to: "Idle",
    accountSliceStart: 4,
    accountSliceEndExclusive: 17,
    shape: [...sharedPrefix, ...kaminoWithdrawShape],
  },
];

export function assertRouteShapeLengths(): void {
  for (const route of ROUTE_SPECS) {
    if (route.shape.length !== route.accountSliceEndExclusive) {
      throw new Error(
        `Route ${route.name} shape length mismatch: got ${route.shape.length}, expected ${route.accountSliceEndExclusive}`,
      );
    }
  }
}

export function parsePublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (err) {
    throw new Error(`Invalid pubkey for ${label}: ${value} (${String(err)})`);
  }
}
