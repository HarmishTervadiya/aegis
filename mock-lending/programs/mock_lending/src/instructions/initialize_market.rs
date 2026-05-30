use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Market;

#[derive(Accounts)]
#[instruction(label_bytes: Vec<u8>)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 1 + 32, // Added 32 for max len buffer for any future proofing, minimal impact on tests
        seeds = [b"market".as_ref(), label_bytes.as_ref(), authority.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        init,
        payer = authority,
        seeds = [b"market_vault".as_ref(), market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market_vault
    )]
    pub market_vault: Account<'info, TokenAccount>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<InitializeMarket>,
    _label_bytes: Vec<u8>,
    initial_assets: u64,
    initial_liabilities: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.authority = ctx.accounts.authority.key();
    market.total_assets = initial_assets;
    market.total_liabilities = initial_liabilities;
    market.bump = ctx.bumps.market;
    Ok(())
}
