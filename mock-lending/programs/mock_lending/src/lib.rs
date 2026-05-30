use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5oaCiRoijFmywSeZaUDd3v51HM5WqUXHgUahcCsMyUXr");

#[program]
pub mod mock_lending {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        label_bytes: Vec<u8>,
        initial_assets: u64,
        initial_liabilities: u64,
    ) -> Result<()> {
        instructions::initialize_market::handler(ctx, label_bytes, initial_assets, initial_liabilities)
    }

    pub fn update_market(
        ctx: Context<UpdateMarket>,
        assets: u64,
        liabilities: u64,
    ) -> Result<()> {
        instructions::update_market::handler(ctx, assets, liabilities)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }
}

