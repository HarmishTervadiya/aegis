use anchor_lang::prelude::*;

pub mod errors;
pub mod external;
pub mod instructions;
pub mod state;
use crate::state::trigger::TriggerMode;
use instructions::*;

declare_id!("JDnMTnXL1iAnhvVC2j4C32yzd6NxxH7SszuJw1tAjG7u");

#[program]
pub mod aegis {

    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::initialize_vault::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn set_trigger(ctx: Context<SetTrigger>, mode: TriggerMode) -> Result<()> {
        instructions::set_trigger::handler(ctx, mode)
    }

    pub fn cancel_trigger(ctx: Context<CancelTrigger>) -> Result<()> {
        instructions::cancel_trigger::handler(ctx)
    }
}
