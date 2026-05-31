import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { useAegisProgram } from "../hooks/useAegisProgram";
import { useUserVault } from "../hooks/useUserVault";
import { useTriggerConfig } from "../hooks/useTriggerConfig";
import {
  deriveVaultPda,
  deriveVaultTokenPda,
  deriveTriggerPda,
} from "../lib/pdas";
import { ActivityFeed } from "../components/ActivityFeed";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";
import api from "../lib/api";

const USDC_MINT = new PublicKey(
  import.meta.env.VITE_USDC_MINT || import.meta.env.VITE_MARGINFI_BANK,
);

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

/* ── Protocol color helpers ── */
function protocolRingColor(proto: string) {
  if (proto === "MarginFi") return "ring-marginfi/30 bg-marginfi/5";
  if (proto === "Kamino") return "ring-kamino/30 bg-kamino/5";
  return "ring-border bg-bg";
}
function protocolInnerColor(proto: string) {
  if (proto === "MarginFi") return "bg-marginfi/15 text-marginfi";
  if (proto === "Kamino") return "bg-kamino/15 text-kamino";
  return "bg-surface text-muted";
}

/* ── Page Component ── */

export default function Deposit() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useAegisProgram();
  const { vault, refreshVault } = useUserVault();
  const { trigger, refreshTrigger } = useTriggerConfig();

  const handleAirdrop = async () => {
    if (!publicKey) return;
    try {
      const sig = await connection.requestAirdrop(publicKey, 10 * 1e9);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight,
      });
      toast.success("Airdropped 10 SOL!");
    } catch (err: any) {
      toast.error("Devnet airdrop failed or rate limited: " + err.message);
    }
  };

  const handleMintUsdc = async () => {
    if (!publicKey) return;
    try {
      toast.loading("Minting 1,000,000 Mock USDC...", { id: "mint-usdc" });
      await api.post("/api/mint-usdc", { address: publicKey.toBase58() });
      toast.success("Minted 1,000,000 Mock USDC! You can now deposit.", {
        id: "mint-usdc",
      });
    } catch (err: any) {
      toast.error("Mint failed: " + err.message, { id: "mint-usdc" });
    }
  };

  const [amount, setAmount] = useState("");
  const [defThresh, setDefThresh] = useState("9000");
  const [offThresh, setOffThresh] = useState("200");

  // Sync threshold inputs from on-chain values when trigger loads
  useEffect(() => {
    if (!trigger) return;
    if (trigger.defenseThresholdBps !== undefined)
      setDefThresh(trigger.defenseThresholdBps.toString());
    if (trigger.offenseThresholdBps !== undefined)
      setOffThresh(trigger.offenseThresholdBps.toString());
  }, [trigger]);

  const vaultExists = !!vault;

  const handleInitVault = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const vaultPda = deriveVaultPda(publicKey);
    const vaultTokenPda = deriveVaultTokenPda(publicKey);

    const tx = await program.methods
      .initializeVault()
      .accounts({
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        usdcMint: USDC_MINT,
        owner: publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    setTimeout(refreshVault, 1000);
    setTimeout(refreshVault, 3000);
    setTimeout(refreshVault, 5000);
    return tx;
  };

  const handleDeposit = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const usdcAmount = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(usdcAmount) || usdcAmount <= 0) throw new Error("Invalid amount");

    const vaultPda = deriveVaultPda(publicKey);
    const vaultTokenPda = deriveVaultTokenPda(publicKey);
    const userAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);

    const tx = await program.methods
      .deposit(new BN(usdcAmount))
      .accounts({
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: userAta,
        owner: publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    setTimeout(refreshVault, 1000);
    setTimeout(refreshVault, 3000);
    setTimeout(refreshVault, 5000);
    return tx;
  };

  const handleSetTrigger = async (
    targetMode: "Defense" | "Offense",
    isActive: boolean,
  ): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const vaultPda = deriveVaultPda(publicKey);
    const triggerPda = deriveTriggerPda(publicKey);
    const modeArg =
      targetMode === "Defense" ? { defense: {} } : { offense: {} };
    const thresh = targetMode === "Defense" ? defThresh : offThresh;

    const tx = await program.methods
      .setTrigger(modeArg as any, isActive, new BN(parseInt(thresh)))
      .accounts({
        triggerConfig: triggerPda,
        userVault: vaultPda,
        owner: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    setTimeout(refreshTrigger, 1000);
    setTimeout(refreshTrigger, 3000);
    setTimeout(refreshTrigger, 5000);
    return tx;
  };

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-secondary text-lg">
          Connect your wallet to access the Aegis Dashboard.
        </p>
      </div>
    );
  }

  // Derive Current Protocol from the vault state
  let currentProtocolStr = "Idle";
  if (vault?.currentProtocol) {
    if (vault.currentProtocol.marginFi !== undefined)
      currentProtocolStr = "MarginFi";
    if (vault.currentProtocol.kamino !== undefined)
      currentProtocolStr = "Kamino";
    if (vault.currentProtocol.idle !== undefined) currentProtocolStr = "Idle";
  }

  let defActive = false;
  let offActive = false;
  if (trigger) {
    defActive = trigger.defenseActive;
    offActive = trigger.offenseActive;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6 transition-opacity duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Controls */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-medium text-secondary mb-1">
                Localnet / Devnet Testing
              </h2>
              <p className="text-primary font-medium">
                Need test funds to use Aegis?
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleAirdrop}
                className="flex-1 px-4 py-2 rounded-lg bg-border text-primary text-sm hover:bg-border/80 transition-colors"
              >
                Airdrop 10 SOL
              </button>
              <button
                data-tour="mint-usdc"
                onClick={handleMintUsdc}
                className="flex-1 px-4 py-2 rounded-lg bg-border text-primary text-sm hover:bg-border/80 transition-colors"
              >
                Mint Mock USDC
              </button>
            </div>
          </div>

          {/* Step 1: Initialize vault — hidden once vault exists */}
          {!vaultExists && (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                Step 1
              </h2>
              <p className="text-primary font-medium mb-4">
                Initialize your Aegis vault
              </p>
              <TxButton data-tour="init-vault" onClick={handleInitVault}>Create Vault</TxButton>
            </div>
          )}

          <div
            className={`bg-surface border border-border rounded-xl p-5 shadow-sm ${!vaultExists ? "opacity-40 pointer-events-none" : ""}`}
          >
            {/* Only show "Step 2" label when vault doesn't exist yet */}
            {!vaultExists && (
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
                Step 2
              </h2>
            )}
            <p className="text-primary font-medium mb-4">
              {vaultExists ? "Deposit USDC" : "Fund your automation vault"}
            </p>
            <div className="flex gap-2">
              <div data-tour="deposit-amount" className="relative flex-1">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-primary font-mono text-sm focus:outline-none focus:border-purple/50 placeholder:text-muted"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  USDC
                </span>
              </div>
              <TxButton onClick={handleDeposit} disabled={!amount}>
                Deposit
              </TxButton>
            </div>
          </div>

          <div
            className={`bg-surface border border-border rounded-xl p-5 shadow-sm ${!vaultExists ? "opacity-40 pointer-events-none" : ""}`}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-medium text-secondary mb-1">
                  Automated Trigger Configuration
                </h2>
                <p className="text-primary font-medium">
                  Protect and optimize your yield
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Defense Trigger Box */}
              <div data-tour="defense-trigger" className="bg-bg rounded-lg p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Defense Mode</h3>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${defActive ? "bg-green/20 text-green" : "bg-muted/20 text-muted"}`}
                  >
                    {defActive ? "Active" : "Inactive"}
                  </div>
                </div>
                <p className="text-xs text-muted mb-4">
                  Pull funds to Idle when risk is high.
                </p>
                <div className="mb-4">
                  <label className="text-xs text-secondary block mb-1">
                    Threshold (bps)
                  </label>
                  <input
                    type="number"
                    value={defThresh}
                    onChange={(e) => setDefThresh(e.target.value)}
                    placeholder="9000"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-primary font-mono text-xs focus:outline-none focus:border-purple/50"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Fires when util &gt;{" "}
                    {(parseInt(defThresh || "0") / 100).toFixed(2)}%
                  </p>
                </div>
                {defActive ? (
                  <div className="flex gap-2">
                    <TxButton
                      onClick={() => handleSetTrigger("Defense", true)}
                      className="flex-1 text-xs"
                    >
                      Update
                    </TxButton>
                    <TxButton
                      onClick={() => handleSetTrigger("Defense", false)}
                      className="flex-1 !bg-surface border border-border !text-secondary hover:!text-red text-xs"
                    >
                      Deactivate
                    </TxButton>
                  </div>
                ) : (
                  <TxButton
                    onClick={() => handleSetTrigger("Defense", true)}
                    className="w-full text-xs"
                  >
                    Activate Defense
                  </TxButton>
                )}
              </div>

              {/* Offense Trigger Box */}
              <div data-tour="offense-trigger" className="bg-bg rounded-lg p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Offense Mode</h3>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${offActive ? "bg-purple/20 text-purple" : "bg-muted/20 text-muted"}`}
                  >
                    {offActive ? "Active" : "Inactive"}
                  </div>
                </div>
                <p className="text-xs text-muted mb-4">
                  Chase yield across protocols.
                </p>
                <div className="mb-4">
                  <label className="text-xs text-secondary block mb-1">
                    Yield Gap (bps)
                  </label>
                  <input
                    type="number"
                    value={offThresh}
                    onChange={(e) => setOffThresh(e.target.value)}
                    placeholder="200"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-primary font-mono text-xs focus:outline-none focus:border-purple/50"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Fires when gap &gt;{" "}
                    {(parseInt(offThresh || "0") / 100).toFixed(2)}%
                  </p>
                </div>
                {offActive ? (
                  <div className="flex gap-2">
                    <TxButton
                      onClick={() => handleSetTrigger("Offense", true)}
                      className="flex-1 text-xs"
                    >
                      Update
                    </TxButton>
                    <TxButton
                      onClick={() => handleSetTrigger("Offense", false)}
                      className="flex-1 !bg-surface border border-border !text-secondary hover:!text-red text-xs"
                    >
                      Deactivate
                    </TxButton>
                  </div>
                ) : (
                  <TxButton
                    onClick={() => handleSetTrigger("Offense", true)}
                    className="w-full text-xs"
                  >
                    Activate Offense
                  </TxButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deployment Status */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <h2 className="text-sm font-medium text-secondary uppercase tracking-widest mb-6">
              Current Deployment
            </h2>

            {/* Outer ring */}
            <div
              className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 ring-2 ${protocolRingColor(currentProtocolStr)}`}
            >
              {/* Inner circle */}
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${protocolInnerColor(currentProtocolStr)}`}
              >
                {currentProtocolStr === "MarginFi" && (
                  <span className="font-bold text-lg leading-tight">
                    Margin
                    <br />
                    Fi
                  </span>
                )}
                {currentProtocolStr === "Kamino" && (
                  <span className="font-bold text-xl">Kamino</span>
                )}
                {currentProtocolStr === "Idle" && (
                  <span className="font-bold text-xl">Idle</span>
                )}
              </div>
            </div>

            <div className="w-full bg-bg rounded-lg p-4 border border-border">
              <p className="text-xs text-muted mb-1">Vault Balance</p>
              <p className="font-mono text-xl text-primary font-semibold">
                {vault
                  ? (vault.usdcDeposited.toNumber() / 1_000_000).toFixed(2)
                  : "0.00"}{" "}
                <span className="text-sm">USDC</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Activity Feed Widget */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm mt-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg text-primary">
            Recent Crank Executions
          </h2>
        </div>
        <ActivityFeed limit={5} />
      </div>
    </div>
  );
}
