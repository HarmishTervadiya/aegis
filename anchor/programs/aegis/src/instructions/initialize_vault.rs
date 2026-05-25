use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use crate::state::vault::{Protocol, UserVault};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        init, 
        payer=owner,
        token::mint=usdc_mint,
        token::authority=user_vault,
        seeds=[b"vault_token", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account:Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program:Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>
}

pub fn handler(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    vault.owner = ctx.accounts.owner.key();
    vault.usdc_deposited = 0;
    vault.current_protocol = Protocol::Idle;
    vault.marginfi_account = Pubkey::default();
    vault.kamino_account = Pubkey::default();
    vault.bump = ctx.bumps.user_vault;
    Ok(())
}
