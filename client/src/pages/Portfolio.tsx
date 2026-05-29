import { useWallet } from "@solana/wallet-adapter-react";
import { useUserVault } from "../hooks/useUserVault";
import { useTriggerConfig } from "../hooks/useTriggerConfig";
import { useAegisProgram } from "../hooks/useAegisProgram";
import { deriveVaultPda, deriveTriggerPda } from "../lib/pdas";
import { formatUsdc, formatBps } from "../lib/format";
import TxButton from "../components/shared/TxButton";
import AddressDisplay from "../components/shared/AddressDisplay";
import StatusDot from "../components/shared/StatusDot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

export default function Portfolio() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { vault } = useUserVault();
  const { trigger } = useTriggerConfig();

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
    return program.methods
      .cancelTrigger()
      .accounts({ triggerConfig: triggerPda, owner: publicKey })
      .rpc();
  };

  const handleWithdraw = async (): Promise<string> => {
    if (!publicKey || !program || !vault) throw new Error("No vault found");
    const vaultPda = deriveVaultPda(publicKey);
    const triggerPda = deriveTriggerPda(publicKey);
    // vaultTokenPda is usually a separate PDA but we can use deriveVaultTokenPda(publicKey) if needed.
    // Wait, the plan had vaultTokenPda commented out. Let's use the deriveVaultTokenPda helper.
    // Actually, I didn't import it. I'll just leave it out if we don't have it, but wait: the signature needs it.
    // I'll import deriveVaultTokenPda
    const { deriveVaultTokenPda } = await import("../lib/pdas");
    const vaultTokenPda = deriveVaultTokenPda(publicKey);

    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const USDC_MINT = new PublicKey(
      import.meta.env.VITE_USDC_MINT || import.meta.env.VITE_MARGINFI_BANK,
    );
    const userAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);

    return program.methods
      .withdraw(new BN(vault.usdcDeposited))
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: userAta,
        owner: publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      {/* Position summary */}
      <div className="bg-surface border border-border rounded-xl p-5">
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
            <div className="flex justify-between">
              <span className="text-secondary text-sm">Currently in</span>
              <span className="text-primary text-sm font-medium">
                {vault.currentProtocol.idle
                  ? "Vault (idle)"
                  : vault.currentProtocol.marginFi
                    ? "MarginFi"
                    : "Kamino"}
              </span>
            </div>
            <div className="flex justify-between">
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
                <StatusDot status={trigger.isActive ? "safe" : "idle"} />
                <span className="text-primary text-sm">
                  {trigger.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-sm">Mode</span>
              <span className="text-primary text-sm">
                {trigger.mode.defense ? "Defense" : "Offense"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-sm">Threshold</span>
              <span className="font-mono text-primary text-sm">
                {trigger.mode.defense
                  ? formatBps(trigger.defenseThresholdBps.toNumber())
                  : formatBps(trigger.offenseThresholdBps.toNumber())}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-sm">Times fired</span>
              <span className="font-mono text-primary text-sm">
                {trigger.executionCount.toNumber()}
              </span>
            </div>
            {trigger.isActive && (
              <TxButton
                onClick={handleCancelTrigger}
                className="mt-2 bg-surface border border-border text-secondary hover:text-primary hover:border-muted"
              >
                Cancel Trigger
              </TxButton>
            )}
          </div>
        ) : (
          <p className="text-secondary text-sm">No trigger configured.</p>
        )}
      </div>

      {/* Withdraw */}
      {vault && !trigger?.isActive && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-secondary mb-4">Withdraw</h2>
          <TxButton onClick={handleWithdraw}>Withdraw all USDC</TxButton>
        </div>
      )}
    </div>
  );
}
