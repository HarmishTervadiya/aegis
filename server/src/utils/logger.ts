import { AnchorError } from "@coral-xyz/anchor";

export function formatError(err: any): string {
  if (!err) return "Unknown error";

  if (err instanceof AnchorError || err.name === "AnchorError") {
    return `[AnchorError] Code: ${err.error.errorCode.code} (${err.error.errorCode.number}) - ${err.error.errorMessage}`;
  }

  if (err.message) {
    if (err.message.includes("custom program error: 0x0")) {
      return "[ProgramError] PDA already initialized or in use (0x0). Execution count may be out of sync.";
    }
    if (err.message.includes("Transaction simulation failed")) {
      return `[SimulationError] ${err.message.split("\n")[0]}`;
    }
    return err.stack || err.message;
  }

  return String(err);
}

export const logger = {
  info: (...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()} |`, ...args);
  },
  warn: (...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} |`, ...args);
  },
  error: (msg: string, err?: any) => {
    if (err !== undefined) {
      console.error(
        `[ERROR] ${new Date().toISOString()} | ${msg} ->`,
        formatError(err),
      );
    } else {
      console.error(`[ERROR] ${new Date().toISOString()} | ${msg}`);
    }
  },
  debug: (...args: any[]) => {
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] ${new Date().toISOString()} |`, ...args);
    }
  },
};
