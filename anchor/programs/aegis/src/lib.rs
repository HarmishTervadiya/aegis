use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use crate::state::trigger::TriggerMode;
use instructions::*;

declare_id!("5f3FSmoxZ6fpiQtdBoaPdAyCwUXmqFSRGBpSpRP9C4iU");

#[program]
pub mod aegis {

    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::initialize_vault::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn set_trigger(
        ctx: Context<SetTrigger>,
        mode: TriggerMode,
        defense_threshold_bps: u64,
        offense_threshold_bps: u64,
    ) -> Result<()> {
        instructions::set_trigger::handler(ctx, mode, defense_threshold_bps, offense_threshold_bps)
    }

    pub fn cancel_trigger(ctx: Context<CancelTrigger>) -> Result<()> {
        instructions::cancel_trigger::handler(ctx)
    }

    pub fn execute_trigger(ctx: Context<ExecuteTrigger>, log_index: u64) -> Result<()> {
        instructions::execute_trigger::handler(ctx, log_index)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    pub fn update_mock(
        ctx: Context<UpdateMock>,
        mfi_assets: u128,
        mfi_liab: u128,
        kam_avail: u64,
        kam_borrow: u128,
    ) -> Result<()> {
        instructions::update_mock::handler(ctx, mfi_assets, mfi_liab, kam_avail, kam_borrow)
    }
}
