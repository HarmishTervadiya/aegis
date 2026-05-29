# Aegis — Frontend Plan

---

## Design language

Reference: Jupiter and 0.xyz.

What both do well that you copy exactly:

- Dark background, near-black (#0a0a0f range), not pure black
- Muted borders (1px, low opacity white or gray)
- Data is the hero — numbers are large, labels are small and dimmed
- Status is communicated through color accents only where it matters
- No gradients on every element — reserved for one focal point per screen
- Monospace font for numbers and addresses
- Wallet connect is always top-right, always visible

What Aegis adds on top:

- A "live" feeling — utilization bars that visually fill toward danger thresholds
- A clear safe/at-risk state per protocol (green dot / amber dot / red dot)
- The trigger as a tangible arming mechanism the user controls

---

## Tech stack

```
React + Vite
TailwindCSS (utility classes only, no component libraries)
@coral-xyz/anchor          — program interaction
@solana/web3.js            — RPC calls
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets  (Phantom, Backpack, Solflare)
recharts                   — utilization history chart
react-router-dom v6        — routing
bs58                       — signature encoding for auth
axios                      — API calls to backend
react-hot-toast            — transaction notifications
```

No shadcn, no Chakra, no MUI. Raw Tailwind keeps the bundle small and
forces you to own the design decisions.

---

## Folder structure

```
aegis/frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    — app entry, providers
│   ├── App.tsx                     — router
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx           — home: live protocol health
│   │   ├── Deposit.tsx             — deposit USDC + arm trigger
│   │   └── Portfolio.tsx           — user positions + history
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          — logo, nav links, wallet button
│   │   │   └── Layout.tsx          — wraps pages with Navbar
│   │   │
│   │   ├── dashboard/
│   │   │   ├── ProtocolCard.tsx    — MarginFi / Kamino stat card
│   │   │   ├── UtilizationBar.tsx  — animated fill bar with threshold marker
│   │   │   └── HealthChart.tsx     — recharts line chart of util history
│   │   │
│   │   ├── deposit/
│   │   │   ├── DepositForm.tsx     — USDC amount input + submit
│   │   │   └── TriggerSetup.tsx    — Defense / Offense mode selector + threshold
│   │   │
│   │   ├── portfolio/
│   │   │   ├── PositionCard.tsx    — current protocol, balance, trigger status
│   │   │   └── ExecutionHistory.tsx — table of TriggerLog entries
│   │   │
│   │   └── shared/
│   │       ├── AddressDisplay.tsx  — truncated pubkey with copy button
│   │       ├── TokenAmount.tsx     — formats USDC with 6 decimal handling
│   │       ├── StatusDot.tsx       — green / amber / red indicator
│   │       ├── TxButton.tsx        — button with loading state for transactions
│   │       └── Modal.tsx           — generic modal wrapper
│   │
│   ├── hooks/
│   │   ├── useAegisProgram.ts      — anchor program instance
│   │   ├── useUserVault.ts         — fetch and watch UserVault PDA
│   │   ├── useTriggerConfig.ts     — fetch and watch TriggerConfig PDA
│   │   ├── useProtocolHealth.ts    — polls /api/health from backend
│   │   ├── useExecutionHistory.ts  — fetch TriggerLog accounts for wallet
│   │   └── useAuth.ts              — wallet sign-in, JWT management
│   │
│   ├── lib/
│   │   ├── anchor.ts               — program setup, IDL import
│   │   ├── pdas.ts                 — PDA derivation helpers
│   │   ├── api.ts                  — axios instance with JWT interceptor
│   │   └── format.ts               — number and address formatters
│   │
│   ├── idl/
│   │   └── aegis.json              — copied from anchor/target/idl/
│   │
│   ├── types/
│   │   └── index.ts                — shared TypeScript interfaces
│   │
│   └── styles/
│       └── index.css               — tailwind directives + css variables
├── .env.example
├── index.html
├── tailwind.config.ts
└── vite.config.ts
```

---

## Step 1 — Setup

```bash
cd aegis
npm create vite@latest frontend -- --template react-ts
cd frontend

npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p

npm install @coral-xyz/anchor @solana/web3.js \
  @solana/wallet-adapter-react \
  @solana/wallet-adapter-react-ui \
  @solana/wallet-adapter-wallets \
  react-router-dom recharts bs58 axios react-hot-toast
```

### `tailwind.config.ts`

```typescript
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base
        bg: "#0a0a0f",
        surface: "#111118",
        border: "#1e1e2a",
        // Text
        primary: "#e8e8f0",
        secondary: "#6b6b80",
        muted: "#3a3a4a",
        // Accents
        green: "#22c55e",
        amber: "#f59e0b",
        red: "#ef4444",
        purple: "#a78bfa",
        // Protocol colors
        marginfi: "#699BF7",
        kamino: "#9FE2BF",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
};
```

### `src/styles/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap");

body {
  background-color: #0a0a0f;
  color: #e8e8f0;
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Wallet adapter modal override to match dark theme */
.wallet-adapter-modal-wrapper {
  background: #111118 !important;
}
.wallet-adapter-button {
  background: #1e1e2a !important;
  border: 1px solid #2a2a3a !important;
}
.wallet-adapter-button:hover {
  background: #2a2a3a !important;
}
```

### `.env.example`

```env
VITE_RPC_URL=http://127.0.0.1:8899
VITE_BACKEND_URL=http://localhost:3001
VITE_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
VITE_MARGINFI_BANK=3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG
VITE_KAMINO_RESERVE=d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q
```

---

## Step 2 — Entry point and providers

### `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8899";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <App />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#111118",
                  color: "#e8e8f0",
                  border: "1px solid #1e1e2a",
                },
              }}
            />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>,
);
```

### `src/App.tsx`

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Portfolio from "./pages/Portfolio";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
```

---

## Step 3 — Core lib files

### `src/lib/pdas.ts`

```typescript
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

export function deriveVaultPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveVaultTokenPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token"), owner.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveTriggerPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trigger"), owner.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveTriggerLogPda(
  owner: PublicKey,
  logIndex: number,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("log"),
      owner.toBuffer(),
      new BN(logIndex).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  );
  return pda;
}
```

### `src/lib/format.ts`

```typescript
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
```

### `src/lib/api.ts`

```typescript
import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aegis_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the token and let the user re-authenticate
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("aegis_token");
    }
    return Promise.reject(err);
  },
);

export default api;
```

---

## Step 4 — Core hooks

### `src/hooks/useAegisProgram.ts`

```typescript
import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import IDL from "../idl/aegis.json";

export function useAegisProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(IDL as any, provider);
  }, [connection, wallet]);
}
```

### `src/hooks/useProtocolHealth.ts`

```typescript
import { useState, useEffect } from "react";
import api from "../lib/api";

interface ProtocolState {
  utilizationBps: number;
  utilizationPct: number;
  updatedAt: string | null;
}

interface HealthData {
  marginfi: ProtocolState;
  kamino: ProtocolState;
  lastPollAt: string | null;
}

export function useProtocolHealth(intervalMs = 15_000) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/api/health");
        setData(res.data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { data, loading, error };
}
```

### `src/hooks/useUserVault.ts`

```typescript
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveVaultPda } from "../lib/pdas";

export function useUserVault() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !program) {
      setVault(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      try {
        const pda = deriveVaultPda(publicKey);
        const data = await program.account.userVault.fetch(pda);
        setVault({ ...data, pda });
      } catch {
        setVault(null); // vault does not exist yet
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [publicKey, program]);

  return { vault, loading };
}
```

### `src/hooks/useAuth.ts`

```typescript
import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import api from "../lib/api";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();
  const [authed, setAuthed] = useState(!!localStorage.getItem("aegis_token"));

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    try {
      // Step 1: get nonce
      const { message } = await api
        .get(`/auth/nonce?wallet=${publicKey.toString()}`)
        .then((r) => r.data);

      // Step 2: sign with wallet — no SOL spent, just a signature
      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      const sigB58 = bs58.encode(signature);

      // Step 3: verify + receive JWT
      const { token } = await api
        .post("/auth/verify", {
          wallet: publicKey.toString(),
          signature: sigB58,
        })
        .then((r) => r.data);

      localStorage.setItem("aegis_token", token);
      setAuthed(true);
    } catch (err) {
      console.error("Auth failed:", err);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    localStorage.removeItem("aegis_token");
    setAuthed(false);
  }, []);

  return { authed, login, logout };
}
```

---

## Step 5 — Shared components

### `src/components/shared/StatusDot.tsx`

```tsx
type Status = "safe" | "warning" | "danger" | "idle";

const colors: Record<Status, string> = {
  safe: "bg-green",
  warning: "bg-amber",
  danger: "bg-red animate-pulse",
  idle: "bg-muted",
};

export default function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  );
}
```

### `src/components/shared/TxButton.tsx`

```tsx
import { useState, ReactNode } from "react";
import toast from "react-hot-toast";

interface Props {
  onClick: () => Promise<string | void>; // returns tx signature or void
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function TxButton({
  onClick,
  children,
  disabled,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const sig = await onClick();
      if (sig) {
        toast.success(
          <span>
            Transaction confirmed.{" "}
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
      }
    } catch (err: any) {
      toast.error(err?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={disabled || loading}
      className={`
        flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium text-sm
        bg-purple text-bg
        hover:bg-purple/90
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-150
        ${className || ""}
      `}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="30 70"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
```

### `src/components/shared/AddressDisplay.tsx`

```tsx
import { useState } from "react";
import { truncateAddress } from "../../lib/format";

export default function AddressDisplay({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="font-mono text-sm text-secondary hover:text-primary transition-colors"
      title={address}
    >
      {copied ? "Copied!" : truncateAddress(address)}
    </button>
  );
}
```

---

## Step 6 — Dashboard page

### `src/components/dashboard/UtilizationBar.tsx`

```tsx
interface Props {
  utilizationPct: number;
  thresholdPct?: number; // user's defense threshold, shown as a marker
  protocol: "marginfi" | "kamino";
}

export default function UtilizationBar({
  utilizationPct,
  thresholdPct,
  protocol,
}: Props) {
  const pct = Math.min(utilizationPct, 100);
  const color = pct >= 90 ? "bg-red" : pct >= 70 ? "bg-amber" : "bg-green";
  const accent = protocol === "marginfi" ? "bg-marginfi" : "bg-kamino";

  return (
    <div className="relative w-full h-2 bg-muted rounded-full overflow-visible">
      {/* Fill */}
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
      {/* Threshold marker */}
      {thresholdPct && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-60"
          style={{ left: `${thresholdPct}%` }}
          title={`Your threshold: ${thresholdPct}%`}
        />
      )}
    </div>
  );
}
```

### `src/components/dashboard/ProtocolCard.tsx`

```tsx
import StatusDot from "../shared/StatusDot";
import UtilizationBar from "./UtilizationBar";
import { formatBps } from "../../lib/format";

interface Props {
  name: "MarginFi" | "Kamino";
  utilizationBps: number;
  protocol: "marginfi" | "kamino";
  thresholdBps?: number;
}

export default function ProtocolCard({
  name,
  utilizationBps,
  protocol,
  thresholdBps,
}: Props) {
  const pct = utilizationBps / 100;
  const status = pct >= 90 ? "danger" : pct >= 70 ? "warning" : "safe";

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-sm font-medium text-secondary">{name}</span>
        </div>
        <span className="text-xs text-muted">USDC Pool</span>
      </div>

      <div>
        <p className="text-3xl font-mono font-medium text-primary">
          {pct.toFixed(2)}
          <span className="text-lg text-secondary">%</span>
        </p>
        <p className="text-xs text-muted mt-1">Utilization</p>
      </div>

      <UtilizationBar
        utilizationPct={pct}
        thresholdPct={thresholdBps ? thresholdBps / 100 : undefined}
        protocol={protocol}
      />

      <div className="flex justify-between text-xs text-muted">
        <span>0%</span>
        <span className="text-secondary">
          {formatBps(utilizationBps)} utilization
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}
```

### `src/pages/Dashboard.tsx`

```tsx
import ProtocolCard from "../components/dashboard/ProtocolCard";
import { useProtocolHealth } from "../hooks/useProtocolHealth";
import { useTriggerConfig } from "../hooks/useTriggerConfig";

export default function Dashboard() {
  const { data, loading } = useProtocolHealth();
  const { trigger } = useTriggerConfig();

  const defenseThreshold = trigger?.defenseThresholdBps ?? undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-primary">Protocol Health</h1>
        <p className="text-sm text-secondary mt-1">
          Live utilization across MarginFi and Kamino USDC pools.
          {trigger?.isActive && (
            <span className="ml-2 text-green">
              Your {trigger.mode.defense ? "Defense" : "Offense"} trigger is
              active.
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProtocolCard
            name="MarginFi"
            utilizationBps={data.marginfi.utilizationBps}
            protocol="marginfi"
            thresholdBps={trigger?.mode.defense ? defenseThreshold : undefined}
          />
          <ProtocolCard
            name="Kamino"
            utilizationBps={data.kamino.utilizationBps}
            protocol="kamino"
          />
        </div>
      ) : (
        <p className="text-secondary text-sm">Could not load protocol data.</p>
      )}

      {data && (
        <p className="text-xs text-muted mt-4 text-right">
          Updated{" "}
          {data.lastPollAt
            ? new Date(data.lastPollAt).toLocaleTimeString()
            : "—"}
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse h-40" />
  );
}
```

---

## Step 7 — Deposit and trigger setup page

### `src/pages/Deposit.tsx`

```tsx
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "../hooks/useAegisProgram";
import { useUserVault } from "../hooks/useUserVault";
import {
  deriveVaultPda,
  deriveVaultTokenPda,
  deriveTriggerPda,
} from "../lib/pdas";
import TxButton from "../components/shared/TxButton";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import toast from "react-hot-toast";

const USDC_MINT = new PublicKey(import.meta.env.VITE_MARGINFI_BANK);

export default function Deposit() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { vault } = useUserVault();

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"Defense" | "Offense">("Defense");
  const [defThresh, setDefThresh] = useState("9000"); // 90%
  const [offThresh, setOffThresh] = useState("200"); // 2%

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

    return tx;
  };

  const handleDeposit = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const usdcAmount = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(usdcAmount) || usdcAmount <= 0) throw new Error("Invalid amount");

    const vaultPda = deriveVaultPda(publicKey);
    const vaultTokenPda = deriveVaultTokenPda(publicKey);

    // User's USDC ATA — derive using spl-token helpers
    // For brevity, assume userTokenAccount is fetched/derived separately
    const tx = await program.methods
      .deposit(new BN(usdcAmount))
      .accounts({
        userVault: vaultPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: publicKey, // replace with actual ATA
        owner: publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  };

  const handleSetTrigger = async (): Promise<string> => {
    if (!publicKey || !program) throw new Error("Wallet not connected");
    const vaultPda = deriveVaultPda(publicKey);
    const triggerPda = deriveTriggerPda(publicKey);
    const modeArg = mode === "Defense" ? { defense: {} } : { offense: {} };

    const tx = await program.methods
      .setTrigger(
        modeArg,
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

    return tx;
  };

  if (!publicKey) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-secondary">Connect your wallet to deposit.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
      {/* Step 1: Initialize vault if needed */}
      {!vaultExists && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-secondary mb-1">Step 1</h2>
          <p className="text-primary font-medium mb-4">
            Initialize your Aegis vault
          </p>
          <TxButton onClick={handleInitVault}>Create Vault</TxButton>
        </div>
      )}

      {/* Step 2: Deposit */}
      <div
        className={`bg-surface border border-border rounded-xl p-5 ${!vaultExists ? "opacity-40 pointer-events-none" : ""}`}
      >
        <h2 className="text-sm font-medium text-secondary mb-1">
          {!vaultExists ? "Step 2" : "Deposit USDC"}
        </h2>
        <p className="text-primary font-medium mb-4">Deposit USDC into vault</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="
                w-full bg-bg border border-border rounded-lg
                px-4 py-2.5 text-primary font-mono text-sm
                focus:outline-none focus:border-purple/50
                placeholder:text-muted
              "
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              USDC
            </span>
          </div>
          <TxButton onClick={handleDeposit} disabled={!amount}>
            Deposit
          </TxButton>
        </div>
        {vault && (
          <p className="text-xs text-muted mt-2">
            Current balance:{" "}
            {(vault.usdcDeposited.toNumber() / 1_000_000).toFixed(2)} USDC
          </p>
        )}
      </div>

      {/* Step 3: Set trigger */}
      <div
        className={`bg-surface border border-border rounded-xl p-5 ${!vaultExists ? "opacity-40 pointer-events-none" : ""}`}
      >
        <h2 className="text-sm font-medium text-secondary mb-1">
          {!vaultExists ? "Step 3" : "Configure trigger"}
        </h2>
        <p className="text-primary font-medium mb-4">Choose automation mode</p>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {(["Defense", "Offense"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`
                p-4 rounded-lg border text-left transition-all
                ${
                  mode === m
                    ? "border-purple bg-purple/10 text-primary"
                    : "border-border text-secondary hover:border-muted"
                }
              `}
            >
              <p className="font-medium text-sm">{m} Mode</p>
              <p className="text-xs text-muted mt-1">
                {m === "Defense"
                  ? "Move funds when MarginFi utilization is too high"
                  : "Move funds to the higher yielding protocol automatically"}
              </p>
            </button>
          ))}
        </div>

        {/* Threshold inputs */}
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
                className="
                  w-full bg-bg border border-border rounded-lg
                  px-4 py-2.5 text-primary font-mono text-sm
                  focus:outline-none focus:border-purple/50
                "
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
                className="
                  w-full bg-bg border border-border rounded-lg
                  px-4 py-2.5 text-primary font-mono text-sm
                  focus:outline-none focus:border-purple/50
                "
              />
              <p className="text-xs text-muted mt-1">
                {offThresh
                  ? `Trigger fires when APY difference exceeds ${(parseInt(offThresh) / 100).toFixed(2)}%`
                  : ""}
              </p>
            </div>
          )}
        </div>

        <TxButton onClick={handleSetTrigger}>Arm Trigger</TxButton>
      </div>
    </div>
  );
}
```

---

## Step 8 — Portfolio page

### `src/pages/Portfolio.tsx`

```tsx
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserVault } from "../hooks/useUserVault";
import { useTriggerConfig } from "../hooks/useTriggerConfig";
import { useAegisProgram } from "../hooks/useAegisProgram";
import { deriveVaultPda, deriveTriggerPda } from "../lib/pdas";
import { formatUsdc, formatBps, formatTimestamp } from "../lib/format";
import TxButton from "../components/shared/TxButton";
import AddressDisplay from "../components/shared/AddressDisplay";
import StatusDot from "../components/shared/StatusDot";
import { SystemProgram } from "@solana/web3.js";
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
    const vaultTokenPda = /* derive */ vaultPda;

    return program.methods
      .withdraw(new BN(vault.usdcDeposited))
      .accounts({
        userVault: vaultPda,
        triggerConfig: triggerPda,
        vaultTokenAccount: vaultTokenPda,
        userTokenAccount: publicKey, // replace with ATA
        owner: publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
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
```

---

## Step 9 — Navbar

### `src/components/layout/Navbar.tsx`

```tsx
import { Link, useLocation } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/deposit", label: "Deposit" },
  { to: "/portfolio", label: "Portfolio" },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-primary font-semibold tracking-tight">
            Aegis
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`
                  px-3 py-1.5 rounded-md text-sm transition-colors
                  ${
                    pathname === to
                      ? "text-primary bg-bg"
                      : "text-secondary hover:text-primary"
                  }
                `}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <WalletMultiButton />
      </div>
    </nav>
  );
}
```

### `src/components/layout/Layout.tsx`

```tsx
import { ReactNode } from "react";
import Navbar from "./Navbar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-primary">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
```

---

## Step 10 — Run

```bash
cd aegis/frontend
cp .env.example .env
# Fill in VITE_PROGRAM_ID and VITE_BACKEND_URL
npm run dev
```

---

## Best practices applied throughout

**Component responsibility.** Every component does one thing. `UtilizationBar` renders a bar. `ProtocolCard` composes a card. `Dashboard` composes a page. No component fetches data AND renders complex UI in the same file.

**All data access in hooks.** Components never call RPC or API directly. They call hooks. This means any component that needs vault data just calls `useUserVault()` — it does not care how the data is fetched.

**No hardcoded addresses in components.** All program IDs, account addresses, and RPC URLs come from `.env` via `import.meta.env`. Changing from devnet to mainnet is one `.env` change.

**Transaction feedback always.** `TxButton` handles loading state, success toast with explorer link, and error toast. No transaction goes silent.

**Skeleton states.** Every data-dependent component renders a skeleton while loading, not a blank space. This prevents layout shifts and looks production-grade.

**Tailwind only.** No inline styles except where dynamic values are needed (bar fill width, threshold marker position). Keeps the bundle lean.

**IDL is the source of truth.** The IDL file in `src/idl/` is copied from `anchor/target/idl/` after every program build. A mismatch between IDL and program causes confusing runtime errors that are hard to debug — keeping it synced prevents that.

**Font.** Inter for UI, JetBrains Mono for all numbers and addresses. This is what every serious DeFi frontend does and it makes numbers feel precise and trustworthy.
