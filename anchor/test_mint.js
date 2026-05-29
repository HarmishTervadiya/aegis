const anchor = require("@coral-xyz/anchor");
const { createMint } = require("@solana/spl-token");

async function run() {
  const provider = anchor.AnchorProvider.local();
  const wallet = provider.wallet;
  try {
    const mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
    );
    console.log("Mint:", mint.toBase58());
  } catch (e) {
    console.error("ERROR:", e.message);
    if (e.logs) console.error("LOGS:", e.logs);
  }
}
run();
