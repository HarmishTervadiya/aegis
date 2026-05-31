export interface TourStep {
  id: string;
  page: string; // route path, e.g. "/" or "/deposit"
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

// data-tour="<id>" must exist on the target element for each step
export const TOUR_STEPS: TourStep[] = [
  // ── Dashboard ──────────────────────────────────────────────
  {
    id: "protocol-cards",
    page: "/",
    title: "Live Market Pulse",
    description:
      "These two cards show the real-time utilization of the MarginFi and Kamino USDC lending pools. When utilization spikes, yield rises — Aegis tracks this 24/7 so you don't have to.",
    position: "bottom",
  },
  {
    id: "marginfi-card",
    page: "/",
    title: "MarginFi Pool",
    description:
      "The MarginFi USDC utilization rate. When this climbs above your offense threshold, Aegis automatically moves your funds here for maximum yield.",
    position: "bottom",
  },
  {
    id: "kamino-card",
    page: "/",
    title: "Kamino Pool",
    description:
      "The Kamino USDC utilization rate. Aegis keeps a close eye on both pools and hops your funds to whichever is performing better.",
    position: "bottom",
  },
  {
    id: "vault-metrics",
    page: "/",
    title: "Your Vault at a Glance",
    description:
      "Once you deposit, your live position, unrealized yield, and estimated APY appear here — fully on-chain, fully yours.",
    position: "top",
  },
  // ── Deposit ──────────────────────────────────────────────
  {
    id: "mint-usdc",
    page: "/deposit",
    title: "Get Test Funds",
    description:
      "On Devnet, click here to mint 1,000,000 mock USDC straight to your wallet. Free and instant — no faucet needed.",
    position: "bottom",
  },
  {
    id: "deposit-amount",
    page: "/deposit",
    title: "Choose Your Amount",
    description:
      "Enter how much USDC you'd like to deposit into your Aegis vault. Your funds are held in a non-custodial on-chain vault — only you can withdraw.",
    position: "top",
  },
  {
    id: "init-vault",
    page: "/deposit",
    title: "Create Your Vault",
    description:
      "First-time users need to initialize their on-chain vault. This is a one-time transaction that creates your personal Aegis account on Solana.",
    position: "top",
  },
  {
    id: "defense-trigger",
    page: "/deposit",
    title: "Defense Mode",
    description:
      "Set a utilization ceiling. When MarginFi or Kamino exceeds this threshold, Aegis automatically moves your funds to the safer protocol — protecting your capital from liquidity risk.",
    position: "top",
  },
  {
    id: "offense-trigger",
    page: "/deposit",
    title: "Offense Mode",
    description:
      "Set a utilization floor. When a protocol's utilization rises above this, Aegis automatically jumps your funds there to capture the higher yield opportunity.",
    position: "top",
  },
  // ── Portfolio ──────────────────────────────────────────────
  {
    id: "position-card",
    page: "/portfolio",
    title: "Your Live Position",
    description:
      "Your deposited USDC balance, current protocol allocation, and cumulative yield earned — all pulled live from the Solana blockchain.",
    position: "bottom",
  },
  {
    id: "withdraw-btn",
    page: "/portfolio",
    title: "Withdraw Anytime",
    description:
      "You can withdraw your full principal plus earned yield at any time when your triggers are inactive. No lock-up periods, no permission required.",
    position: "top",
  },
  {
    id: "yield-graph",
    page: "/portfolio",
    title: "Yield Over Time",
    description:
      "This chart shows how your yield accumulates over each automated rebalancing hop. Every time the crank fires, your gains are recorded here.",
    position: "top",
  },
  // ── Activity ──────────────────────────────────────────────
  {
    id: "activity-feed",
    page: "/activity",
    title: "Automated Execution Log",
    description:
      "Every time Aegis fires an automated trigger on your behalf, the transaction signature and yield earned are logged here. Full transparency on every move.",
    position: "top",
  },
  {
    id: "tour-complete",
    page: "/activity",
    title: "You're all set! 🎉",
    description:
      "That's the full Aegis tour. Head to the Deposit page to mint some test USDC and make your first deposit. Click the ? button anytime to replay this guide.",
    position: "top",
  },
];
