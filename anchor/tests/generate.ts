import { PublicKey } from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

describe("Generate USDC Account", () => {
  it("Generates usdc_account.json", () => {
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const OWNER = new PublicKey("8KAPX5iqJ4u8mDWrRfSXEs5jmhQeL44YP5ThWT1YwvyU");

    const [ATA] = PublicKey.findProgramAddressSync(
      [OWNER.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MINT.toBuffer()],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );

    const amount = 1_000_000_000_000n; 

    const buffer = Buffer.alloc(AccountLayout.span);
    AccountLayout.encode({
      mint: USDC_MINT,
      owner: OWNER,
      amount: amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1, // Initialized
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    }, buffer);

    const jsonAccount = {
      pubkey: ATA.toBase58(),
      account: {
        lamports: 1000000000,
        data: [
          buffer.toString("base64"),
          "base64"
        ],
        owner: TOKEN_PROGRAM_ID.toBase58(),
        executable: false,
        rentEpoch: 0
      }
    };

    fs.writeFileSync("usdc_account.json", JSON.stringify(jsonAccount, null, 2));
    console.log(`Created usdc_account.json for ATA ${ATA.toBase58()} with 1,000,000 USDC`);
  });
});
