# APY Arena

A no-loss prediction market on Solana. Users deposit USDC and bet their unrealized yield (not their principal) on which lending protocol (Kamino or MarginFi) will post a higher APY at the end of a weekly epoch. A constant-product AMM prices YES/NO outcome shares dynamically. Resolution is trustless: the program reads live on-chain reserve state from Kamino and MarginFi directly via account deserialization, no external oracle.

---

## What makes this technically non-trivial

**Oracle-free resolution via account deserialization.** At epoch end, the `resolve_market` instruction receives Kamino's `Reserve` account and MarginFi's `Bank` account as remaining accounts. The Rust program deserializes both structs, extracts borrow rate and utilization data, computes APY from each protocol's rate curve, and declares the winner entirely on-chain. No Pyth. No Switchboard. No off-chain API call. This requires understanding Solana account memory layout at the struct level.

**Constant-product AMM inside an Anchor program.** A `x * y = k` AMM governs the price of YES (yKAM) and NO (yMAR) outcome shares. As users buy yKAM, its price rises and yMAR becomes cheaper, incentivizing contrarian positions without a market maker. All AMM math, including overflow-safe arithmetic via `checked_mul` and `checked_div`, runs in Rust.

**No-loss guarantee enforced at the contract level.** Principal (deposited USDC) and yield are tracked as separate fields in `UserPosition`. The `withdraw_principal` instruction is always available regardless of market state. Only `yield_allocated` enters the prediction market. The separation is enforced in program logic, not just frontend convention.

**Full CPI stack.** The program makes CPIs to the SPL Token program (mint, burn, transfer) and reads external protocol accounts. The yield accrual model mirrors how Kamino's cToken exchange rate grows over time.

---

## Architecture

```
User
 |
 |-- deposit_usdc --------------------------------------------> YieldVault PDA
 |                                                               tracks principal + yield
 |
 |-- swap_yield_for_shares -----------------------------------> AmmPool PDA
 |        |                                                      x * y = k
 |        +-- mints yKAM or yMAR SPL tokens -----------------> UserPosition PDA
 |
 |-- resolve_market ------------------------------------------> reads Kamino Reserve account
 |        |                                                      reads MarginFi Bank account
 |        +-- computes APY from utilization curve               declares winner on-chain
 |
 +-- redeem_winning_shares / withdraw_principal -------------> returns funds to user
```

**On-chain state (PDAs):**

| Account        | Seeds                         | Purpose                                                      |
| -------------- | ----------------------------- | ------------------------------------------------------------ |
| `Market`       | `[b"market", epoch_id]`       | Epoch config, protocol pubkeys, market status, APY snapshots |
| `AmmPool`      | `[b"amm", market]`            | YES/NO reserve sizes, k invariant, fee config                |
| `YieldVault`   | `[b"vault", market]`          | Custodies USDC, tracks total deposits and accrued yield      |
| `UserPosition` | `[b"position", market, user]` | Per-user deposit, yield_allocated, share balances            |

**Instructions:**

| Instruction             | What it does                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `initialize_market`     | Creates all PDAs, seeds AMM at 50/50, sets epoch duration and protocol pubkeys          |
| `deposit_usdc`          | Transfers USDC to vault, creates UserPosition                                           |
| `accrue_yield`          | Calculates yield owed based on deposit share and slots elapsed, updates yield_allocated |
| `swap_yield_for_shares` | Runs AMM math, mints YES or NO SPL tokens to user, updates pool reserves                |
| `resolve_market`        | Deserializes Kamino Reserve + MarginFi Bank, computes APY, sets winner                  |
| `redeem_winning_shares` | Burns winning tokens, distributes yield pool proportionally                             |
| `withdraw_principal`    | Returns deposited USDC, always available                                                |

---

## Repository structure

```
APY-ARENA/
|-- anchor/                         Anchor program (Rust)
|   |-- programs/
|   |   +-- apy-arena/
|   |       +-- src/
|   |           |-- lib.rs              instruction entrypoints
|   |           |-- state/
|   |           |   |-- market.rs       Market account
|   |           |   |-- amm_pool.rs     AmmPool account
|   |           |   |-- vault.rs        YieldVault account
|   |           |   +-- user_position.rs
|   |           |-- instructions/
|   |           |   |-- initialize.rs
|   |           |   |-- deposit.rs
|   |           |   |-- accrue_yield.rs
|   |           |   |-- swap.rs         AMM logic
|   |           |   |-- resolve.rs      Kamino + MarginFi account reads
|   |           |   |-- redeem.rs
|   |           |   +-- withdraw.rs
|   |           +-- errors.rs
|   +-- tests/
|       +-- apy-arena.ts                Anchor integration tests
|-- client/                             React + Vite + TailwindCSS
|   +-- src/
|       |-- pages/
|       |   |-- Deposit.tsx
|       |   |-- Market.tsx              AMM price chart + buy shares
|       |   +-- Portfolio.tsx
|       |-- hooks/
|       |   |-- useMarket.ts
|       |   |-- usePosition.ts
|       |   +-- useApy.ts
|       +-- idl/                        generated from anchor build
+-- server/                             Node.js + Express
    |-- index.js                        server + cron jobs
    |-- kamino.js                       polls Kamino Reserve account via RPC
    +-- marginfi.js                     polls MarginFi Bank account via RPC
```

---

## How the oracle-free resolution works

Kamino's `Reserve` account (program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`) contains a `ReserveLiquidity` struct with `available_amount`, `borrowed_amount_wads`, and the borrow rate curve configuration. Utilization = `borrowed / (borrowed + available)`. APY is derived by evaluating the piecewise rate curve at that utilization point.

MarginFi's `Bank` account (program: `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`) contains `total_asset_shares`, `total_liability_shares`, and an `InterestRateConfig` with `optimal_utilization_rate`, `plateau_interest_rate`, and `max_interest_rate`. Same computation pattern.

The `resolve_market` instruction takes both accounts as `remaining_accounts`, matches the discriminator to confirm account type, deserializes using the imported crate types, and compares the two computed APYs. No trust assumptions. Anyone can call it.

---

## Running locally

**Prerequisites:** Rust, Anchor CLI, Node.js 18+, Solana CLI configured for devnet.

```bash
git clone https://github.com/your-handle/apy-arena
cd apy-arena

# Build and deploy program
cd anchor
anchor build
anchor deploy --provider.cluster devnet

# Copy IDL to frontend
cp target/idl/apy_arena.json ../client/src/idl/

# Start backend
cd ../server
npm install
cp .env.example .env   # add your RPC URL
node index.js

# Start frontend
cd ../client
npm install
npm run dev
```

---

## Technical decisions worth noting

**Why no Pyth?** Pyth gives you a price feed pushed by off-chain validators. This project's resolution condition is not a price — it is the live operational state of two on-chain programs. Reading that state directly is both more accurate (same block, no staleness) and more decentralized (no oracle network dependency).

**Why constant-product over LMSR?** LMSR (Logarithmic Market Scoring Rule) guarantees bounded loss for the market maker but is significantly harder to implement correctly in Rust with integer arithmetic. Constant-product is simpler, well-understood, and already proven in production (Uniswap v2). For a weekly epoch market with a single binary outcome, the price dynamics are equivalent in practice.

**Why separate yield_allocated from principal?** This is the core safety property of the no-loss mechanic. Mixing them as a single balance would require careful subtraction logic on withdrawal and create an attack surface where a user could drain principal by manipulating yield accounting. Keeping them as distinct `u64` fields in `UserPosition` makes the invariant trivially verifiable.

**Compressed epochs for testing.** The `epoch_duration` field in `Market` is set by the admin at initialization. Production: 604800 seconds (7 days). Tests and demo: 120 seconds. This is standard practice — the same logic that governs a 7-day epoch governs a 2-minute epoch.

---

## What this demonstrates

- Anchor program architecture with multiple interacting PDAs
- CPI to SPL Token program for mint, burn, and transfer
- External account deserialization (reading another protocol's on-chain state without a CPI call)
- Constant-product AMM math in Rust with overflow-safe arithmetic
- Full-stack Solana dApp: on-chain program, React client, Node.js server/indexer backend
