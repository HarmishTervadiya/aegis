import { PublicKey } from "@solana/web3.js";

const isDevnet = process.env.RPC_URL?.includes("devnet") || process.env.VITE_NETWORK === "devnet";

export const MARGINFI_BANK = new PublicKey(
  isDevnet && process.env.MOCK_MARGINFI_MARKET
    ? process.env.MOCK_MARGINFI_MARKET
    : "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9",
);
export const KAMINO_RESERVE = new PublicKey(
  isDevnet && process.env.MOCK_KAMINO_MARKET
    ? process.env.MOCK_KAMINO_MARKET
    : "9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu",
);
export const MARGINFI_PROGRAM = new PublicKey(
  isDevnet && process.env.MOCK_PROGRAM_ID
    ? process.env.MOCK_PROGRAM_ID
    : "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
);
export const KAMINO_PROGRAM = new PublicKey(
  isDevnet && process.env.MOCK_PROGRAM_ID
    ? process.env.MOCK_PROGRAM_ID
    : "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);

export const MARGINFI_ASSETS_OFFSET = isDevnet ? 40 : 182;
export const MARGINFI_LIABILITIES_OFFSET = isDevnet ? 48 : 240;
export const KAMINO_AVAILABLE_OFFSET = isDevnet ? 40 : 137;
export const KAMINO_BORROWED_OFFSET = isDevnet ? 48 : 145;
