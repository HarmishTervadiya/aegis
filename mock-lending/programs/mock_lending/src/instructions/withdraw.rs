use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Market, UserPosition};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"position".as_ref(), market.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, seeds = [b"market_vault".as_ref(), market.key().as_ref()], bump)]
    pub market_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let position = &mut ctx.accounts.user_position;
    require!(position.deposited_amount >= amount, anchor_lang::error::ErrorCode::InstructionMissing); // For simplicity fallback error

    let market_key = ctx.accounts.market.key();
    let market_vault_bump = ctx.bumps.market_vault;
    let seeds = &[
        b"market_vault".as_ref(),
        market_key.as_ref(),
        &[market_vault_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.market_vault.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token::transfer(cpi_ctx, amount)?;

    position.deposited_amount = position.deposited_amount.checked_sub(amount).unwrap();
    Ok(())
}
