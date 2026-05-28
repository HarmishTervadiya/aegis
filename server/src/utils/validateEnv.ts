const REQUIRED_ENV = [
  "RPC_URL",
  "PROGRAM_ID",
  "CRANK_KEYPAIR_PATH",
  "ADMIN_SECRET",
  "JWT_SECRET",
];

export function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}
