import { connection, program } from "./src/rpc.js";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const all = await (program.account as any).triggerConfig.all();
  for (const t of all) {
    console.log(`PDA: ${t.publicKey.toString()}`);
    console.log(`Owner: ${t.account.owner.toString()}`);
    console.log(`executionCount: ${t.account.executionCount.toString()}`);
    console.log(`lastExecuted: ${t.account.lastExecuted.toString()}`);
  }
  process.exit(0);
}
main();
