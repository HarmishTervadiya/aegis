import { useState, useEffect } from "react";

/**
 * Live-ticking unrealized yield counter.
 *
 * Returns the estimated unrealized yield in raw USDC units (6 decimals)
 * based on the vault's depositedAt timestamp and apyAtEntry (in bps).
 * Resets to 0 if vault is null, idle, or has no principal.
 *
 * Formula:
 *   yield = principal * apyBps * elapsedSecs / (10000 * 31_536_000)
 */
export function useUnrealizedYield(dbVault: any): number {
  const [unrealized, setUnrealized] = useState(0);

  useEffect(() => {
    if (
      !dbVault ||
      !dbVault.depositedAt ||
      !dbVault.apyAtEntry ||
      dbVault.currentProtocol.toLowerCase() === "idle" ||
      !dbVault.usdcDeposited
    ) {
      setUnrealized(0);
      return;
    }

    const principal = Number(dbVault.usdcDeposited);
    const apyBps = Number(dbVault.apyAtEntry);
    const enteredAtSec = new Date(dbVault.depositedAt).getTime() / 1000;

    const tick = () => {
      const nowSec = Date.now() / 1000;
      const elapsed = Math.max(nowSec - enteredAtSec, 0);
      // yield = principal * apyBps * elapsed / (10000 * 31_536_000)
      const y = (principal * apyBps * elapsed) / (10000 * 31_536_000);
      setUnrealized(Math.floor(y));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dbVault]);

  return unrealized;
}
