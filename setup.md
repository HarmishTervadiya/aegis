# Aegis Setup and Testing Guide

This document outlines the steps required to set up, build, and test the Aegis smart contract and backend indexer server.

## 1. Smart Contract (Anchor)

### Prerequisites

- Rust and Cargo
- Solana CLI
- Anchor CLI
- Node.js and Yarn (or Bun)

### Setup and Build

1. Navigate to the anchor directory:
   ```bash
   cd anchor
   ```
2. Install Node dependencies:
   ```bash
   yarn install
   ```
3. Build the smart contract:
   ```bash
   anchor build
   ```
   After building, note the deployed Program ID in the output (e.g., `5f3FSmoxZ6fpiQtdBoaPdAyCwUXmqFSRGBpSpRP9C4iU`). Ensure this matches the `[programs.localnet]` entry in `Anchor.toml`.

### Running the Local Validator

To test the smart contract locally, spin up a test validator that clones necessary mainnet state (MarginFi and Kamino programs/accounts).

Run the provided script (compatible with WSL/Linux):

```bash
./run_validator.sh
```

This will start the `solana-test-validator` on `http://127.0.0.1:8899`.

### Testing the Smart Contract

With the local validator running in the background, you can execute the integration tests:

1. Export required Anchor environment variables:
   ```bash
   export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
   export ANCHOR_WALLET="id.json"
   ```
2. Run the test suite:
   ```bash
   yarn test
   ```
   This will execute the Mocha tests defined in `tests/`, which deploy mock vaults, trigger configurations, and test the CPI execution logic.

---

## 2. Backend Server (Indexer & API)

### Prerequisites

- Bun runtime

### Setup and Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file to ensure the following values are correct:
   - `RPC_URL=http://127.0.0.1:8899` (Point to your local test validator)
   - `PROGRAM_ID` (Must match the exact Anchor Program ID from the smart contract build step)
   - `ADMIN_SECRET` (A secret key required to hit protected endpoints like `/api/crank`)

### Running the Server

Start the backend server in development mode:

```bash
bun start
```

The server will start on `http://localhost:3001` (or the PORT defined in `.env`). It will automatically begin running background cron jobs to poll protocol state and evaluate active triggers.

### Testing the API

You can verify the backend is running and interacting with the blockchain correctly by testing the REST endpoints.

**1. Check System Health (Public)**

```bash
curl -X GET http://localhost:3001/api/health
```

Expected output: A JSON response containing MarginFi and Kamino utilization data.

**2. Check Active Triggers (Public)**

```bash
curl -X GET http://localhost:3001/api/triggers
```

Expected output: An array of all active triggers fetched from the smart contract.

**3. Manually Crank the Indexer (Protected)**
To force the indexer to poll state and evaluate triggers immediately, use the protected crank endpoint. Replace `your_secret_here` with your actual `ADMIN_SECRET`.

```bash
curl -X POST http://localhost:3001/api/crank \
  -H "x-admin-secret: your_secret_here"
```

Expected output: A JSON response detailing the number of triggers evaluated and executed.

**4. Test Authentication Nonce Generation (Public)**

```bash
curl -X GET "http://localhost:3001/auth/nonce?wallet=HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH"
```

Expected output: A message string to be signed by the user's wallet.
