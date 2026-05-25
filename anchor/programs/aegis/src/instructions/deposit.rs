use crate::errors::AegisError;
use crate::state::vault::{self, Protocol, UserVault};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds=[b"vault", owner.key().as_ref()],
        bump= user_vault.bump,
        has_one=owner
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds=[b"vault_token", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, AegisError::InvalidAccountData);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        },
    );

    token::transfer(cpi_ctx, amount)?;

    let vault = &mut ctx.accounts.user_vault;
    vault.usdc_deposited = vault
        .usdc_deposited
        .checked_add(amount)
        .ok_or(AegisError::MathOverflow)?;

    vault.current_protocol=Protocol::Idle;
    Ok(())
}
