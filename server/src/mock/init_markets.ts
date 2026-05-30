import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// We'll load the IDL from the mock-lending build output
const IDL_PATH = path.resolve(
  __dirname,
  "../../../mock-lending/target/idl/mock_lending.json",
);

async function main() {
  console.log("Starting init_markets...");

  // 1. Get devnet connection
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed",
  );

  // 2. Load deployer wallet
  const keypairPath = path.resolve(
    process.env.HOME || process.env.USERPROFILE || "",
    "deploy-key.json",
  );
  let secretKey;
  try {
    secretKey = Uint8Array.from(
      JSON.parse(fs.readFileSync(keypairPath, "utf8")),
    );
  } catch (e) {
    console.error("Failed to load deployer key from", keypairPath);
    process.exit(1);
  }
  const wallet = new Wallet(Keypair.fromSecretKey(secretKey));
  console.log("Deployer:", wallet.publicKey.toBase58());

  // 3. Create Mock USDC Mint using CLI
  console.log("Creating Mock USDC Mint on Devnet...");
  let usdcMint;
  try {
    const output = execSync(
      'wsl -e bash -lc "spl-token create-token --url devnet"',
      { encoding: "utf8" },
    );
    const match = output.match(/Creating token ([A-Za-z0-9]+)/);
    if (!match)
      throw new Error("Could not parse token address from output: " + output);
    usdcMint = match[1];
    console.log("Mock USDC Mint:", usdcMint);
  } catch (e) {
    console.error("Failed to create mint:", e);
    process.exit(1);
  }

  // 4. Initialize Markets
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const programId = new PublicKey(idl.address);
  console.log("Mock Program ID:", programId.toBase58());

  const program = new Program(idl, provider);

  const initMarket = async (labelString, initialAssets, initialLiabilities) => {
    const labelBytes = Buffer.from(labelString);
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), labelBytes, wallet.publicKey.toBuffer()],
      programId,
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market_vault"), marketPda.toBuffer()],
      programId,
    );

    console.log(`Initializing ${labelString} Market: ${marketPda.toBase58()}`);

    try {
      const tx = await program.methods
        .initializeMarket(
          labelBytes,
          new (require("bn.js"))(initialAssets),
          new (require("bn.js"))(initialLiabilities),
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          usdcMint: new PublicKey(usdcMint),
          authority: wallet.publicKey,
        })
        .rpc();
      console.log(`- Success! Tx: ${tx}`);
    } catch (e) {
      console.error(`- Failed:`, e);
    }
    return marketPda;
  };

  const marginFiMarket = await initMarket("marginfi", 1000000000, 600000000); // 60%
  const kaminoMarket = await initMarket("kamino", 1000000000, 550000000); // 55%

  // 5. Update .env file
  const envPath = path.resolve(__dirname, "../../.env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Replace or add env vars
  const updateEnv = (key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  };

  updateEnv("VITE_NETWORK", "devnet");
  updateEnv("MOCK_PROGRAM_ID", programId.toBase58());
  updateEnv("MOCK_MARGINFI_MARKET", marginFiMarket.toBase58());
  updateEnv("MOCK_KAMINO_MARKET", kaminoMarket.toBase58());
  updateEnv("USDC_MINT", usdcMint);

  fs.writeFileSync(envPath, envContent.trim() + "\n");
  console.log(".env updated with Mock Market PDAs.");

  console.log("\n--- DONE ---");
  console.log("Run the server with MOCK_MODE=true to start fluctuation.");
}

main().catch(console.error);
