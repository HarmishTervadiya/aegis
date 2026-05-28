use crate::errors::AegisError;
use crate::state::trigger::TriggerConfig;
use crate::state::vault::UserVault;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = user_vault.bump,
        has_one = owner
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        seeds = [b"trigger", owner.key().as_ref()],
        bump = trigger_config.bump
    )]
    pub trigger_config: Account<'info, TriggerConfig>,

    #[account(
        mut,
        seeds = [b"vault_token", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(
        !ctx.accounts.trigger_config.is_active,
        AegisError::TriggerStillActive
    );

    let owner_key = ctx.accounts.owner.key();
    let bump = ctx.accounts.user_vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", owner_key.as_ref(), &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user_vault.to_account_info(),
        },
        signer_seeds,
    );

    token::transfer(transfer_ctx, amount)?;

    ctx.accounts.user_vault.usdc_deposited = ctx
        .accounts
        .user_vault
        .usdc_deposited
        .checked_sub(amount)
        .unwrap();

    Ok(())
}
