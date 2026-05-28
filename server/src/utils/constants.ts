import { PublicKey } from "@solana/web3.js";

export const MARGINFI_BANK = new PublicKey(
  "3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG",
);
export const KAMINO_RESERVE = new PublicKey(
  "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q",
);
export const MARGINFI_PROGRAM = new PublicKey(
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
);
export const KAMINO_PROGRAM = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);

export const MARGINFI_ASSETS_OFFSET = 248;
export const MARGINFI_LIABILITIES_OFFSET = 264;
export const KAMINO_AVAILABLE_OFFSET = 137;
export const KAMINO_BORROWED_OFFSET = 145;
