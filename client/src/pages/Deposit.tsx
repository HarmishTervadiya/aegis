import { useState } from "react";
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
import TxButton from "../components/shared/TxButton";
import { ActivityFeed } from "../components/ActivityFeed";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";
import api from "../lib/api";

const USDC_MINT = new PublicKey(
  import.meta.env.VITE_USDC_MINT || import.meta.env.VITE_MARGINFI_BANK,
);

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
      toast.success("Minted Mock USDC! You can now deposit.", {
        id: "mint-usdc",
      });
    } catch (err: any) {
      toast.error("Mint failed: " + err.message, { id: "mint-usdc" });
    }
  };

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"Defense" | "Offense">("Defense");
  const [defThresh, setDefThresh] = useState("9000");
  const [offThresh, setOffThresh] = useState("200");
  const [showTriggerForm, setShowTriggerForm] = useState(false);

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
    return tx;
  };

  const handleSetTrigger = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const vaultPda = deriveVaultPda(publicKey);
    const triggerPda = deriveTriggerPda(publicKey);
    const modeArg = mode === "Defense" ? { defense: {} } : { offense: {} };

    const tx = await program.methods
      .setTrigger(
        modeArg as any,
        new BN(parseInt(defThresh)),
        new BN(parseInt(offThresh)),
      )
      .accounts({
        triggerConfig: triggerPda,
        userVault: vaultPda,
        owner: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    setTimeout(() => {
      refreshTrigger();
      setShowTriggerForm(false);
    }, 1000);
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

  // Derive active trigger status
  let activeTriggerMode = null;
  if (trigger?.mode) {
    if (trigger.mode.defense !== undefined) activeTriggerMode = "Defense";
    if (trigger.mode.offense !== undefined) activeTriggerMode = "Offense";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">
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
                onClick={handleMintUsdc}
                className="flex-1 px-4 py-2 rounded-lg bg-border text-primary text-sm hover:bg-border/80 transition-colors"
              >
                Mint Mock USDC
              </button>
            </div>
          </div>

          {!vaultExists && (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-medium text-secondary mb-1">
                Step 1
              </h2>
              <p className="text-primary font-medium mb-4">
                Initialize your Aegis vault
              </p>
              <TxButton onClick={handleInitVault}>Create Vault</TxButton>
            </div>
          )}

          <div
            className={`bg-surface border border-border rounded-xl p-5 shadow-sm ${!vaultExists ? "opacity-40 pointer-events-none" : ""}`}
          >
            <h2 className="text-sm font-medium text-secondary mb-1">
              {!vaultExists ? "Step 2" : "Deposit USDC"}
            </h2>
            <p className="text-primary font-medium mb-4">
              Fund your automation vault
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              {trigger && !showTriggerForm && (
                <button
                  onClick={() => setShowTriggerForm(true)}
                  className="btn btn-sm btn-outline text-secondary"
                >
                  Update Trigger
                </button>
              )}
            </div>

            {trigger && !showTriggerForm ? (
              <div className="bg-bg rounded-lg p-4 border border-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-medium text-sm">
                      Active Trigger: {activeTriggerMode} Mode
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {activeTriggerMode === "Defense"
                      ? `Moves funds to Idle when MarginFi utilization > ${(trigger.defenseThresholdBps.toNumber() / 100).toFixed(2)}%`
                      : `Moves funds to best yield when APY gap > ${(trigger.offenseThresholdBps.toNumber() / 100).toFixed(2)}%`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-5 text-sm text-primary">
                  <span className="font-semibold">Note:</span> You can only have
                  one active trigger configuration at a time. Setting a new one
                  will override the previous.
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {(["Defense", "Offense"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`p-4 rounded-lg border text-left transition-all ${mode === m ? "border-purple bg-purple/10 text-primary" : "border-border text-secondary hover:border-muted"}`}
                    >
                      <p className="font-medium text-sm">{m} Mode</p>
                      <p className="text-xs text-muted mt-1">
                        {m === "Defense"
                          ? "Move funds when utilization is too high"
                          : "Move funds to the higher yielding protocol"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 mb-5">
                  {mode === "Defense" && (
                    <div>
                      <label className="text-xs text-secondary block mb-1">
                        Defense threshold (basis points)
                      </label>
                      <input
                        type="number"
                        value={defThresh}
                        onChange={(e) => setDefThresh(e.target.value)}
                        placeholder="9000"
                        className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-primary font-mono text-sm focus:outline-none focus:border-purple/50"
                      />
                      <p className="text-xs text-muted mt-1">
                        {defThresh
                          ? `Trigger fires when utilization exceeds ${(parseInt(defThresh) / 100).toFixed(2)}%`
                          : ""}
                      </p>
                    </div>
                  )}
                  {mode === "Offense" && (
                    <div>
                      <label className="text-xs text-secondary block mb-1">
                        Offense threshold (basis points)
                      </label>
                      <input
                        type="number"
                        value={offThresh}
                        onChange={(e) => setOffThresh(e.target.value)}
                        placeholder="200"
                        className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-primary font-mono text-sm focus:outline-none focus:border-purple/50"
                      />
                      <p className="text-xs text-muted mt-1">
                        {offThresh
                          ? `Trigger fires when APY difference exceeds ${(parseInt(offThresh) / 100).toFixed(2)}%`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <TxButton onClick={handleSetTrigger}>Arm Trigger</TxButton>
                  {trigger && (
                    <button
                      onClick={() => setShowTriggerForm(false)}
                      className="btn btn-outline text-secondary border-border"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Deployment Status */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <h2 className="text-sm font-medium text-secondary uppercase tracking-widest mb-6">
              Current Deployment
            </h2>

            <div
              className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-inner ${currentProtocolStr === "Idle" ? "bg-base-200" : "bg-primary/10"}`}
            >
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${currentProtocolStr === "Idle" ? "bg-base-300 text-muted" : "bg-primary text-primary-content"}`}
              >
                {currentProtocolStr === "MarginFi" && (
                  <span className="font-bold text-xl">MarginFi</span>
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
          <h2 className="font-semibold text-lg">Recent Crank Executions</h2>
        </div>
        <ActivityFeed limit={5} />
      </div>
    </div>
  );
}
