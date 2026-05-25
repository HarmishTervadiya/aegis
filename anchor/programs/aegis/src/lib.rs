use anchor_lang::prelude::*;

pub mod errors;
pub mod external;
pub mod state;
pub mod instructions;
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
}