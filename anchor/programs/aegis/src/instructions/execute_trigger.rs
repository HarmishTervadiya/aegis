use crate::errors::AegisError;
use crate::state::log::TriggerLog;
use crate::state::trigger::{TriggerConfig, TriggerMode};
use crate::state::vault::{Protocol, UserVault};
use anchor_lang::prelude::*;
use std::str::FromStr;
use anchor_lang::solana_program::{
    instruction::AccountMeta, instruction::Instruction, program::invoke_signed,
};


// Byte offsets validated via validate_accounts.ts against live mainnet state
// MarginFi Bank struct: I80F48 total_asset_shares at 182, total_liability_shares at 240
pub const MARGINFI_ASSETS_OFFSET: usize = 182;
pub const MARGINFI_LIABILITIES_OFFSET: usize = 240;
// Kamino Reserve struct: u64 available_amount at 137, u128 borrowed_amount_sf at 145
pub const KAMINO_AVAILABLE_OFFSET: usize = 137;
pub const KAMINO_BORROWED_OFFSET: usize = 145;

// MarginFi
const MARGINFI_DEPOSIT_DISCRIMINATOR: [u8; 8] = [171, 94, 235, 103, 82, 64, 212, 140];
const MARGINFI_WITHDRAW_DISCRIMINATOR: [u8; 8] = [36, 72, 74, 19, 210, 210, 192, 192];

anchor_lang::declare_program!(kamino_lend);
anchor_lang::declare_program!(marginfi);

// const KAMINO_RESERVE_DISCRIMINATOR: [u8; 8] = [43, 242, 204, 202, 26, 247, 59, 127];
// Kamino
const KAMINO_DEPOSIT_DISCRIMINATOR: [u8; 8] = [129, 199, 4, 2, 222, 39, 26, 46];
const KAMINO_WITHDRAW_DISCRIMINATOR: [u8; 8] = [75, 93, 93, 220, 34, 150, 218, 196];

/// remaining_accounts layout:
///   [0] = MarginFi Bank (read-only)  — utilization read
///   [1] = Kamino Reserve (read-only) — utilization read
///
/// When full CPI accounts are provided (len > 4):
///   [2] = vault_pda (writable, signer-via-seeds) — same pubkey as user_vault
///   [3] = vault_token_account (writable)          — same pubkey as vault_token_account
///
///   MarginFi → Kamino (Defense or Offense), indices [4..26]:
///   Withdraw from MarginFi [4..12]:
///     [4]  marginfi_program
///     [5]  marginfi_group
///     [6]  marginfi_account (writable)
///     [7]  bank (writable, same pubkey as [0])
///     [8]  bank_liquidity_vault_authority
///     [9]  bank_liquidity_vault (writable)
///     [10] token_program
///   Deposit into Kamino [11..24]:
///     [11] kamino_program
///     [12] obligation (writable)
///     [13] lending_market
///     [14] lending_market_authority
///     [15] reserve (writable)
///     [16] reserve_liquidity_mint
///     [17] reserve_liquidity_supply (writable)
///     [18] reserve_collateral_mint (writable)
///     [19] reserve_destination_deposit_collateral (writable)
///     [20] collateral_token_program
///     [21] liquidity_token_program
///     [22] instruction_sysvar_account
///
///   Kamino → MarginFi (Offense), indices [4..26]:
///   Withdraw from Kamino [4..17]:
///     [4]  kamino_program
///     [5]  obligation (writable)
///     [6]  lending_market
///     [7]  lending_market_authority
///     [8]  withdraw_reserve (writable)
///     [9]  reserve_liquidity_mint
///     [10] reserve_source_collateral (writable)
///     [11] reserve_collateral_mint (writable)
///     [12] reserve_liquidity_supply (writable)
///     [13] collateral_token_program
///     [14] liquidity_token_program
///     [15] instruction_sysvar_account
///   Deposit into MarginFi [16..23]:
///     [16] marginfi_program
///     [17] marginfi_group
///     [18] marginfi_account (writable)
///     [19] bank (writable)
///     [20] bank_liquidity_vault (writable)
///     [21] token_program

#[derive(Accounts)]
#[instruction(log_index: u64)]
pub struct ExecuteTrigger<'info> {
    #[account(
        mut,
        seeds = [b"trigger", owner.key().as_ref()],
        bump = trigger_config.bump,
        has_one = owner
    )]
    pub trigger_config: Account<'info, TriggerConfig>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = user_vault.bump,
        has_one = owner
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [b"vault_token", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(
        init,
        payer = crank,
        space = 8 + TriggerLog::INIT_SPACE,
        seeds = [b"log", owner.key().as_ref(), &log_index.to_le_bytes()],
        bump
    )]
    pub trigger_log: Account<'info, TriggerLog>,

    /// CHECK: validated by CPI
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    // See module-level doc comment for remaining_accounts layout
}

pub fn handler(ctx: Context<ExecuteTrigger>, log_index: u64) -> Result<()> {
    let trigger = &ctx.accounts.trigger_config;

    require!(trigger.is_active, AegisError::TriggerNotActive);
    require!(
        log_index == trigger.execution_count,
        AegisError::InvalidAccountData
    );
    require!(
        ctx.remaining_accounts.len() >= 2,
        AegisError::InvalidAccountData
    );

    // Read on-chain utilization from both protocols via cloned account data
    require!(
        ctx.remaining_accounts[0].owner == &Pubkey::from_str("MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA").unwrap(),
        AegisError::InvalidAccountOwner
    );
    require!(
        ctx.remaining_accounts[1].owner == &Pubkey::from_str("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD").unwrap(),
        AegisError::InvalidAccountOwner
    );

    let marginfi_util_bps = read_marginfi_utilization(&ctx.remaining_accounts[0])?;
    let kamino_util_bps = read_kamino_utilization(&ctx.remaining_accounts[1])?;

    let defense_threshold = trigger.defense_threshold_bps;
    let offense_threshold = trigger.offense_threshold_bps;

    match trigger.mode {
        TriggerMode::Defense => {
            require!(
                marginfi_util_bps > defense_threshold,
                AegisError::ConditionNotMet
            );
        }
        TriggerMode::Offense => {
            let diff = if kamino_util_bps > marginfi_util_bps {
                kamino_util_bps.saturating_sub(marginfi_util_bps)
            } else {
                marginfi_util_bps.saturating_sub(kamino_util_bps)
            };
            require!(diff > offense_threshold, AegisError::ConditionNotMet);
        }
    }

    let current = ctx.accounts.user_vault.current_protocol.clone();

    let (from_protocol, to_protocol) = match trigger.mode {
        TriggerMode::Defense => {
            require!(
                current != Protocol::Idle,
                AegisError::NoDeployedFunds
            );
            (current.clone(), Protocol::Idle)
        }
        TriggerMode::Offense => {
            if kamino_util_bps > marginfi_util_bps {
                require!(
                    current != Protocol::Kamino,
                    AegisError::AlreadyInOptimalProtocol
                );
                (current.clone(), Protocol::Kamino)
            } else {
                require!(
                    current != Protocol::MarginFi,
                    AegisError::AlreadyInOptimalProtocol
                );
                (current.clone(), Protocol::MarginFi)
            }
        }
    };

    let amount = ctx.accounts.user_vault.usdc_deposited;

    // Read primitives from typed accounts — only keys/numbers, no AccountInfo borrows.
    // This avoids the Rust lifetime invariance conflict between Account<'info,T> and
    // remaining_accounts. All AccountInfo needed for CPIs come from remaining_accounts.
    let owner_key = ctx.accounts.owner.key();
    let vault_bump = ctx.accounts.user_vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", owner_key.as_ref(), &[vault_bump]];
    let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

    // Full CPI path: remaining_accounts must include vault_pda at [2] and
    // vault_token_account at [3], followed by protocol-specific accounts.
    // Passing only 2 remaining accounts skips CPIs (used in routing-only tests).
    if ctx.remaining_accounts.len() > 2 {
        require!(
            ctx.remaining_accounts.len() >= 4,
            AegisError::InvalidAccountData
        );
        // [2] vault_pda, [3] vault_token_account — same pubkeys as named accounts
        // but sourced from remaining_accounts to share the same lifetime.
        let vault_pda_info = &ctx.remaining_accounts[2];
        let vault_token_info = &ctx.remaining_accounts[3];

        match (&from_protocol, &to_protocol) {
            (Protocol::Idle, Protocol::MarginFi) => {
                marginfi_deposit(
                    &ctx.remaining_accounts[4..11],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            (Protocol::Idle, Protocol::Kamino) => {
                kamino_deposit(
                    &ctx.remaining_accounts[4..17],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            (Protocol::MarginFi, Protocol::Kamino) => {
                marginfi_withdraw(
                    &ctx.remaining_accounts[4..12],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
                kamino_deposit(
                    &ctx.remaining_accounts[12..25],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            (Protocol::Kamino, Protocol::MarginFi) => {
                kamino_withdraw(
                    &ctx.remaining_accounts[4..17],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
                marginfi_deposit(
                    &ctx.remaining_accounts[17..24],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            (Protocol::MarginFi, Protocol::Idle) => {
                marginfi_withdraw(
                    &ctx.remaining_accounts[4..12],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            (Protocol::Kamino, Protocol::Idle) => {
                kamino_withdraw(
                    &ctx.remaining_accounts[4..17],
                    vault_pda_info,
                    vault_token_info,
                    amount,
                    signer_seeds,
                )?;
            }
            _ => return err!(AegisError::NoDeployedFunds),
        }
    }

    // Update vault state to reflect new protocol
    ctx.accounts.user_vault.current_protocol = to_protocol.clone();

    // Write trigger execution log
    let clock = Clock::get()?;
    let log = &mut ctx.accounts.trigger_log;
    log.owner = ctx.accounts.owner.key();
    log.executed_at = clock.unix_timestamp;
    log.mode = trigger.mode.clone();
    log.from_protocol = from_protocol;
    log.to_protocol = to_protocol;
    log.amount_moved = amount;
    log.marginfi_utilization_bps = marginfi_util_bps;
    log.kamino_utilization_bps = kamino_util_bps;
    log.bump = ctx.bumps.trigger_log;

    // Increment trigger execution counter
    let trigger_mut = &mut ctx.accounts.trigger_config;
    trigger_mut.last_executed = clock.unix_timestamp;
    trigger_mut.execution_count = trigger_mut
        .execution_count
        .checked_add(1)
        .ok_or(AegisError::MathOverflow)?;

    msg!(
        "Aegis: trigger fired. mode={:?} marginfi={}bps kamino={}bps amount={} from={:?} to={:?}",
        trigger_mut.mode,
        marginfi_util_bps,
        kamino_util_bps,
        amount,
        log.from_protocol,
        log.to_protocol,
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// MarginFi raw CPI helpers
//
// We use raw `invoke_signed` rather than declare_program!-generated bindings
// so that the call works regardless of IDL naming conventions and compiles
// cleanly without needing the full MarginFi crate.
// ---------------------------------------------------------------------------

/// Withdraw from MarginFi via raw CPI.
/// accounts slice [0..7] from remaining_accounts starting at index 2:
///   [0] marginfi_program
///   [1] marginfi_group
///   [2] marginfi_account (writable)
///   [3] bank (writable)
///   [4] destination_token_account (writable) — vault token account
///   [5] bank_liquidity_vault_authority
///   [6] liquidity_vault (writable)
///   [7] token_program
fn marginfi_withdraw<'info>(
    accounts: &[AccountInfo<'info>],
    vault_pda: &AccountInfo<'info>,
    _vault_token_account: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(accounts.len() >= 8, AegisError::InvalidAccountData);

    // Instruction data: discriminator + amount (u64 LE) + Some(true) for withdraw_all (1 + 1 byte)
    let mut data = Vec::with_capacity(8 + 8 + 2);
    data.extend_from_slice(&MARGINFI_WITHDRAW_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(1); // Option::Some tag
    data.push(1); // withdraw_all = true

    let account_metas = vec![
        AccountMeta::new_readonly(accounts[1].key(), false), // group
        AccountMeta::new(accounts[2].key(), false),          // marginfi_account
        AccountMeta::new_readonly(vault_pda.key(), true),    // authority (vault PDA, signer)
        AccountMeta::new(accounts[3].key(), false),          // bank
        AccountMeta::new(accounts[4].key(), false),          // destination_token_account
        AccountMeta::new_readonly(accounts[5].key(), false), // bank_liquidity_vault_authority
        AccountMeta::new(accounts[6].key(), false),          // liquidity_vault
        AccountMeta::new_readonly(accounts[7].key(), false), // token_program
    ];

    let ix = Instruction {
        program_id: accounts[0].key(),
        accounts: account_metas,
        data,
    };

    let account_infos = vec![
        accounts[1].clone(), // group
        accounts[2].clone(), // marginfi_account
        vault_pda.clone(),   // authority
        accounts[3].clone(), // bank
        accounts[4].clone(), // destination_token_account
        accounts[5].clone(), // bank_liquidity_vault_authority
        accounts[6].clone(), // liquidity_vault
        accounts[7].clone(), // token_program
    ];

    invoke_signed(&ix, &account_infos, signer_seeds)?;
    Ok(())
}

/// Deposit into MarginFi via raw CPI.
/// accounts slice from remaining_accounts starting at index 15 (Kamino->MarginFi path):
///   [0] marginfi_program
///   [1] marginfi_group
///   [2] marginfi_account (writable)
///   [3] bank (writable)
///   [4] signer_token_account (vault token account, writable)
///   [5] liquidity_vault (writable)
///   [6] token_program
fn marginfi_deposit<'info>(
    accounts: &[AccountInfo<'info>],
    vault_pda: &AccountInfo<'info>,
    _vault_token_account: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(accounts.len() >= 7, AegisError::InvalidAccountData);

    // Instruction data: discriminator + amount (u64 LE) + None for deposit_up_to_limit
    let mut data = Vec::with_capacity(8 + 8 + 1);
    data.extend_from_slice(&MARGINFI_DEPOSIT_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(0); // Option::None

    let account_metas = vec![
        AccountMeta::new_readonly(accounts[1].key(), false), // group
        AccountMeta::new(accounts[2].key(), false),          // marginfi_account
        AccountMeta::new_readonly(vault_pda.key(), true),    // authority (vault PDA, signer)
        AccountMeta::new(accounts[3].key(), false),          // bank
        AccountMeta::new(accounts[4].key(), false),          // signer_token_account
        AccountMeta::new(accounts[5].key(), false),          // liquidity_vault
        AccountMeta::new_readonly(accounts[6].key(), false), // token_program
    ];

    let ix = Instruction {
        program_id: accounts[0].key(),
        accounts: account_metas,
        data,
    };

    let account_infos = vec![
        accounts[1].clone(), // group
        accounts[2].clone(), // marginfi_account
        vault_pda.clone(),   // authority
        accounts[3].clone(), // bank
        accounts[4].clone(), // signer_token_account
        accounts[5].clone(), // liquidity_vault
        accounts[6].clone(), // token_program
    ];

    invoke_signed(&ix, &account_infos, signer_seeds)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Kamino raw CPI helpers
// ---------------------------------------------------------------------------

/// Deposit into Kamino via raw CPI (deposit_reserve_liquidity_and_obligation_collateral).
/// accounts slice from remaining_accounts starting at index 10 (MarginFi->Kamino path):
///   [0]  kamino_program
///   [1]  obligation (writable)
///   [2]  lending_market
///   [3]  lending_market_authority
///   [4]  reserve (writable)
///   [5]  reserve_liquidity_mint
///   [6]  reserve_liquidity_supply (writable)
///   [7]  reserve_collateral_mint (writable)
///   [8]  reserve_destination_deposit_collateral (writable)
///   [9]  user_source_liquidity (vault token account, writable)
///   [10] collateral_token_program
///   [11] liquidity_token_program
///   [12] instruction_sysvar_account
fn kamino_deposit<'info>(
    accounts: &[AccountInfo<'info>],
    vault_pda: &AccountInfo<'info>,
    _vault_token_account: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(accounts.len() >= 13, AegisError::InvalidAccountData);

    let mut data = Vec::with_capacity(8 + 8);
    data.extend_from_slice(&KAMINO_DEPOSIT_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());

    let account_metas = vec![
        AccountMeta::new(vault_pda.key(), true), // owner (vault PDA, signer)
        AccountMeta::new(accounts[1].key(), false), // obligation
        AccountMeta::new_readonly(accounts[2].key(), false), // lending_market
        AccountMeta::new_readonly(accounts[3].key(), false), // lending_market_authority
        AccountMeta::new(accounts[4].key(), false), // reserve
        AccountMeta::new_readonly(accounts[5].key(), false), // reserve_liquidity_mint
        AccountMeta::new(accounts[6].key(), false), // reserve_liquidity_supply
        AccountMeta::new(accounts[7].key(), false), // reserve_collateral_mint
        AccountMeta::new(accounts[8].key(), false), // reserve_destination_deposit_collateral
        AccountMeta::new(accounts[9].key(), false), // user_source_liquidity
        AccountMeta::new_readonly(accounts[10].key(), false), // collateral_token_program
        AccountMeta::new_readonly(accounts[11].key(), false), // liquidity_token_program
        AccountMeta::new_readonly(accounts[12].key(), false), // instruction_sysvar_account
    ];

    let ix = Instruction {
        program_id: accounts[0].key(),
        accounts: account_metas,
        data,
    };

    let account_infos = vec![
        vault_pda.clone(),    // owner
        accounts[1].clone(),  // obligation
        accounts[2].clone(),  // lending_market
        accounts[3].clone(),  // lending_market_authority
        accounts[4].clone(),  // reserve
        accounts[5].clone(),  // reserve_liquidity_mint
        accounts[6].clone(),  // reserve_liquidity_supply
        accounts[7].clone(),  // reserve_collateral_mint
        accounts[8].clone(),  // reserve_destination_deposit_collateral
        accounts[9].clone(),  // user_source_liquidity
        accounts[10].clone(), // collateral_token_program
        accounts[11].clone(), // liquidity_token_program
        accounts[12].clone(), // instruction_sysvar_account
    ];

    invoke_signed(&ix, &account_infos, signer_seeds)?;
    Ok(())
}

/// Withdraw from Kamino via raw CPI (withdraw_obligation_collateral_and_redeem_reserve_collateral).
/// accounts slice from remaining_accounts starting at index 2 (Kamino->MarginFi path):
///   [0]  kamino_program
///   [1]  obligation (writable)
///   [2]  lending_market
///   [3]  lending_market_authority
///   [4]  withdraw_reserve (writable)
///   [5]  reserve_liquidity_mint
///   [6]  reserve_source_collateral (writable)
///   [7]  reserve_collateral_mint (writable)
///   [8]  reserve_liquidity_supply (writable)
///   [9]  user_destination_liquidity (vault token account, writable)
///   [10] collateral_token_program
///   [11] liquidity_token_program
///   [12] instruction_sysvar_account
fn kamino_withdraw<'info>(
    accounts: &[AccountInfo<'info>],
    vault_pda: &AccountInfo<'info>,
    _vault_token_account: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(accounts.len() >= 13, AegisError::InvalidAccountData);

    let mut data = Vec::with_capacity(8 + 8);
    data.extend_from_slice(&KAMINO_WITHDRAW_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());

    let account_metas = vec![
        AccountMeta::new(vault_pda.key(), true), // owner (vault PDA, signer)
        AccountMeta::new(accounts[1].key(), false), // obligation
        AccountMeta::new_readonly(accounts[2].key(), false), // lending_market
        AccountMeta::new_readonly(accounts[3].key(), false), // lending_market_authority
        AccountMeta::new(accounts[4].key(), false), // withdraw_reserve
        AccountMeta::new_readonly(accounts[5].key(), false), // reserve_liquidity_mint
        AccountMeta::new(accounts[6].key(), false), // reserve_source_collateral
        AccountMeta::new(accounts[7].key(), false), // reserve_collateral_mint
        AccountMeta::new(accounts[8].key(), false), // reserve_liquidity_supply
        AccountMeta::new(accounts[9].key(), false), // user_destination_liquidity
        AccountMeta::new_readonly(accounts[10].key(), false), // collateral_token_program
        AccountMeta::new_readonly(accounts[11].key(), false), // liquidity_token_program
        AccountMeta::new_readonly(accounts[12].key(), false), // instruction_sysvar_account
    ];

    let ix = Instruction {
        program_id: accounts[0].key(),
        accounts: account_metas,
        data,
    };

    let account_infos = vec![
        vault_pda.clone(),    // owner
        accounts[1].clone(),  // obligation
        accounts[2].clone(),  // lending_market
        accounts[3].clone(),  // lending_market_authority
        accounts[4].clone(),  // withdraw_reserve
        accounts[5].clone(),  // reserve_liquidity_mint
        accounts[6].clone(),  // reserve_source_collateral
        accounts[7].clone(),  // reserve_collateral_mint
        accounts[8].clone(),  // reserve_liquidity_supply
        accounts[9].clone(),  // user_destination_liquidity
        accounts[10].clone(), // collateral_token_program
        accounts[11].clone(), // liquidity_token_program
        accounts[12].clone(), // instruction_sysvar_account
    ];

    invoke_signed(&ix, &account_infos, signer_seeds)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Utilization readers
// ---------------------------------------------------------------------------

/// Reads MarginFi Bank account bytes and returns utilization in basis points.
///
/// MarginFi stores balances as I80F48 fixed-point numbers (16 bytes each).
/// utilization = total_liabilities / total_assets
/// Since both values share the same 2^48 scale factor, it cancels in the ratio.
/// Result: (liabilities_raw * 10000) / assets_raw (capped at 10000 bps).
fn read_marginfi_utilization(account: &AccountInfo) -> Result<u64> {
    let data = account.data.borrow();
    require!(
        data.len() > MARGINFI_LIABILITIES_OFFSET + 16,
        AegisError::InvalidAccountData
    );

    let assets_raw = u128::from_le_bytes(
        data[MARGINFI_ASSETS_OFFSET..MARGINFI_ASSETS_OFFSET + 16]
            .try_into()
            .map_err(|_| AegisError::DeserializationFailed)?,
    );
    let liabilities_raw = u128::from_le_bytes(
        data[MARGINFI_LIABILITIES_OFFSET..MARGINFI_LIABILITIES_OFFSET + 16]
            .try_into()
            .map_err(|_| AegisError::DeserializationFailed)?,
    );

    if assets_raw == 0 {
        return Ok(0);
    }

    let denominator = assets_raw.checked_div(10000).unwrap_or(1);
    let bps = if denominator == 0 {
        0
    } else {
        liabilities_raw.checked_div(denominator).unwrap_or(0) as u64
    };

    Ok(bps.min(10000))
}

/// Reads Kamino Reserve account bytes and returns utilization in basis points.
///
/// available_amount is a raw u64 token count.
/// borrowed_amount_sf is a scaled fraction (scale factor 2^60).
/// We shift available left by 60 bits to match the borrowed scale, then compute the ratio.
/// Result: (borrowed_sf * 10000) / (available_sf + borrowed_sf) (capped at 10000 bps).
fn read_kamino_utilization(account: &AccountInfo) -> Result<u64> {
    let data = account.data.borrow();
    require!(
        data.len() > KAMINO_BORROWED_OFFSET + 16,
        AegisError::InvalidAccountData
    );

    let available = u64::from_le_bytes(
        data[KAMINO_AVAILABLE_OFFSET..KAMINO_AVAILABLE_OFFSET + 8]
            .try_into()
            .map_err(|_| AegisError::DeserializationFailed)?,
    ) as u128;

    let borrowed_sf = u128::from_le_bytes(
        data[KAMINO_BORROWED_OFFSET..KAMINO_BORROWED_OFFSET + 16]
            .try_into()
            .map_err(|_| AegisError::DeserializationFailed)?,
    );

    // Shift available into the same scale as borrowed_sf (2^60)
    let available_sf = available.checked_shl(60).ok_or(AegisError::MathOverflow)?;

    let total_sf = available_sf
        .checked_add(borrowed_sf)
        .ok_or(AegisError::MathOverflow)?;

    if total_sf == 0 {
        return Ok(0);
    }

    let denominator = total_sf.checked_div(10000).unwrap_or(1);
    let bps = if denominator == 0 {
        0
    } else {
        borrowed_sf.checked_div(denominator).unwrap_or(0) as u64
    };

    Ok(bps.min(10000))
}
