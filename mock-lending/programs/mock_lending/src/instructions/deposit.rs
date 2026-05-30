use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Market, UserPosition};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"position".as_ref(), market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, seeds = [b"market_vault".as_ref(), market.key().as_ref()], bump)]
    pub market_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let position = &mut ctx.accounts.user_position;
    
    if position.market == Pubkey::default() {
        position.market = ctx.accounts.market.key();
        position.user = ctx.accounts.user.key();
        position.deposited_amount = 0;
        position.bump = ctx.bumps.user_position;
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    position.deposited_amount = position.deposited_amount.checked_add(amount).unwrap();
    Ok(())
}
