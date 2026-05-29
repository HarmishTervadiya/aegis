// Format USDC amount from raw u64 (6 decimals) to display string
export function formatUsdc(raw: number | bigint): string {
  const value = Number(raw) / 1_000_000;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format basis points as percentage string
export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

// Truncate a pubkey for display: "Abc1...xyz9"
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Format unix timestamp to readable string
export function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}
