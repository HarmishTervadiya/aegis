import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useUserVault } from "../hooks/useUserVault";
import { useTriggerConfig } from "../hooks/useTriggerConfig";
import { useAegisProgram } from "../hooks/useAegisProgram";
import { deriveVaultPda, deriveTriggerPda } from "../lib/pdas";
import { formatUsdc, formatBps } from "../lib/format";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import toast from "react-hot-toast";
import { YieldGraph } from "../components/YieldGraph";

interface AddressDisplayProps {
  address: string;
}
function AddressDisplay({ address }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-muted">
        {address.slice(0, 4)}...{address.slice(-4)}
      </span>
      <button
        onClick={copy}
        title="Copy address"
        className="text-muted hover:text-secondary transition-colors text-[11px]"
      >
        {copied ? "✓" : "⎘"}
      </button>
    </span>
  );
}

interface StatusDotProps {
  status: "safe" | "idle";
}
function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={`w-2 h-2 rounded-full inline-block ${
        status === "safe" ? "bg-green" : "bg-amber"
      }`}
    />
  );
}

interface TxButtonProps {
  onClick: () => Promise<string>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}
function TxButton({
  onClick,
  children,
  className = "",
  disabled,
}: TxButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const sig = await onClick();
      toast.success(
        <span>
          Transaction confirmed!{" "}
          <a
            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View
          </a>
        </span>,
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
        bg-purple text-bg hover:bg-purple/80 disabled:opacity-50 disabled:cursor-not-allowed
        ${className}`}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

/* ── Page Component ── */

export default function Portfolio() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { vault, refreshVault } = useUserVault();
  const { trigger, refreshTrigger } = useTriggerConfig();

  if (!publicKey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-secondary">
          Connect your wallet to view your portfolio.
        </p>
      </div>
    );
  }

  const handleCancelTrigger = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const triggerPda = deriveTriggerPda(publicKey);
    const sig = await program.methods
      .cancelTrigger()
      .accounts({ triggerConfig: triggerPda, owner: publicKey })
      .rpc();

    // Automatically refresh trigger state so the withdraw button shows up
    await refreshTrigger();
    return sig;
  };

  const handleWithdraw = async (): Promise<string> => {
    if (!publicKey || !program || !vault) throw new Error("No vault found");
    const vaultPda = deriveVaultPda(publicKey);
    const triggerPda = deriveTriggerPda(publicKey);
    const { deriveVaultTokenPda } = await import("../lib/pdas");
    const vaultTokenPda = deriveVaultTokenPda(publicKey);

    if (!vault.currentProtocol.idle) {
      throw new Error(
        "Your funds are currently deployed in a protocol! The automated crank must move them back to the Vault (Idle) before you can withdraw.",
      );
    }
    if (!trigger) {
      throw new Error(
        "Missing on-chain trigger account! Please go to the Deposit page and set up a trigger (you can deactivate it right after) to initialize the necessary account for withdrawal.",
      );
    }

    const { getAssociatedTokenAddress, getAccount } =
      await import("@solana/spl-token");
    const USDC_MINT = new PublicKey(
      import.meta.env.VITE_USDC_MINT || import.meta.env.VITE_MARGINFI_BANK,
    );
    const userAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);

    // Fetch actual vault token account balance to avoid precision loss errors
    let actualBalance = vault.usdcDeposited;
    try {
      const vaultTokenAccountData = await getAccount(
        program.provider.connection,
        vaultTokenPda,
      );
      actualBalance = new BN(vaultTokenAccountData.amount.toString());
    } catch (e) {
      console.warn("Failed to fetch vault token account", e);
    }

    // Clamp the withdrawal amount to whatever is actually in the token account
    const withdrawAmount = vault.usdcDeposited.lt(actualBalance)
      ? vault.usdcDeposited
      : actualBalance;

    const sig = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: userAta,
        owner: publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();

    // Automatically refresh vault state after withdrawal
    await refreshVault();
    return sig;
  };

  const triggersActive = trigger?.defenseActive || trigger?.offenseActive;

  return (
    <div className="md:grid md:grid-cols-[2.5fr_1fr] md:max-w-6xl max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6 transition-opacity duration-200">
      {/* Left Column */}
      <div className="flex flex-col">
        {/* Yield History Graph (placed at top as requested) */}
        <div data-tour="yield-graph">
          <YieldGraph />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-6">
        {/* Protocol Exposure */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-secondary mb-4">
            Protocol Exposure
          </h2>
          {vault ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-secondary text-sm">
                  Active Allocation
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      vault.currentProtocol.marginFi
                        ? "bg-marginfi"
                        : vault.currentProtocol.kamino
                          ? "bg-kamino"
                          : "bg-muted"
                    }`}
                  />
                  <span className="text-primary text-sm font-medium">
                    {vault.currentProtocol.idle
                      ? "Vault (idle)"
                      : vault.currentProtocol.marginFi
                        ? "MarginFi"
                        : "Kamino"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-secondary text-sm">
              No vault found. Deposit to get started.
            </p>
          )}
        </div>

        {/* Position summary */}
        <div data-tour="position-card" className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-secondary mb-4">
            Your Position
          </h2>
          {vault ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-secondary text-sm">Deposited</span>
                <span className="font-mono text-primary">
                  {formatUsdc(vault.usdcDeposited.toNumber())} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary text-sm">Vault address</span>
                <AddressDisplay address={vault.pda.toString()} />
              </div>
            </div>
          ) : (
            <p className="text-secondary text-sm">
              No vault found. Deposit to get started.
            </p>
          )}
        </div>

        {/* Trigger status */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-secondary mb-4">
            Trigger Status
          </h2>
          {trigger ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-secondary text-sm">Status</span>
                <div className="flex items-center gap-2">
                  <StatusDot status={triggersActive ? "safe" : "idle"} />
                  <span className="text-primary text-sm">
                    {triggersActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {trigger.defenseActive && (
                <div className="flex justify-between">
                  <span className="text-secondary text-sm">
                    Defense Threshold
                  </span>
                  <span className="font-mono text-primary text-sm">
                    {formatBps(trigger.defenseThresholdBps.toNumber())}
                  </span>
                </div>
              )}

              {trigger.offenseActive && (
                <div className="flex justify-between">
                  <span className="text-secondary text-sm">
                    Offense Threshold
                  </span>
                  <span className="font-mono text-primary text-sm">
                    {formatBps(trigger.offenseThresholdBps.toNumber())}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-secondary text-sm">Times fired</span>
                <span className="font-mono text-primary text-sm">
                  {trigger.executionCount.toNumber()}
                </span>
              </div>
              {triggersActive && (
                <TxButton
                  onClick={handleCancelTrigger}
                  className="mt-2 !bg-surface border border-border !text-secondary hover:!text-primary hover:border-muted"
                >
                  Deactivate All Triggers
                </TxButton>
              )}
            </div>
          ) : (
            <p className="text-secondary text-sm">No trigger configured.</p>
          )}
        </div>

        {/* Withdraw */}
        {vault && !triggersActive && (
          <div data-tour="withdraw-btn" className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-secondary mb-4">
              Withdraw
            </h2>
            <TxButton onClick={handleWithdraw}>Withdraw all USDC</TxButton>
          </div>
        )}

        {/* Withdraw blocked notice */}
        {vault && triggersActive && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-secondary mb-3">
              Withdraw
            </h2>
            <div className="flex items-start gap-3 bg-amber/5 border border-amber/20 rounded-lg p-4">
              <span className="text-amber text-base mt-0.5">⚠</span>
              <div>
                <p className="text-amber text-sm font-medium">
                  Withdrawal unavailable while triggers are active
                </p>
                <p className="text-muted text-xs mt-1 leading-relaxed">
                  Your Defense or Offense triggers are currently active and
                  managing your funds autonomously. Cancel all triggers above
                  before withdrawing to prevent conflicts with in-flight
                  rebalancing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
