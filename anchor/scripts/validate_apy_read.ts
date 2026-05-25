import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Kamino USDC Reserve on mainnet (use devnet equivalent or fork)
// Mainnet: 3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG (MarginFi USDC pool)
// For devnet you will use a localnet fork or mock account

async function readKaminoReserve() {
  const KAMINO_PROGRAM = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
  const USDC_RESERVE = new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"); // Kamino main market USDC
    console.log("Hello");
  const accountInfo = await connection.getAccountInfo(USDC_RESERVE);
  if (!accountInfo) throw new Error("Account not found");
  
  console.log("Account data length:", accountInfo.data.length);
  console.log("Owner program:", accountInfo.owner.toString());
  // Parse the raw bytes — owner should match KAMINO_PROGRAM
}

readKaminoReserve();