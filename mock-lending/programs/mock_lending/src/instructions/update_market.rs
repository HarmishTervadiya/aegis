use anchor_lang::prelude::*;
use crate::state::Market;

#[derive(Accounts)]
pub struct UpdateMarket<'info> {
    #[account(mut, has_one = authority)]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateMarket>, assets: u64, liabilities: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.total_assets = assets;
    market.total_liabilities = liabilities;
    Ok(())
}
