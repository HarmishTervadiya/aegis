use anchor_lang::prelude::*;
use crate::state::trigger::{TriggerConfig, TriggerMode};
use crate::state::vault::UserVault;

#[derive(Accounts)]
pub struct SetTrigger<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + TriggerConfig::INIT_SPACE,
        seeds = [b"trigger", owner.key().as_ref()],
        bump
    )]
    pub trigger_config: Account<'info, TriggerConfig>,

    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = user_vault.bump,
        has_one = owner
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SetTrigger>, mode: TriggerMode) -> Result<()> {
    let trigger = &mut ctx.accounts.trigger_config;
    trigger.owner = ctx.accounts.owner.key();
    trigger.mode = mode;
    trigger.is_active = true;
    trigger.bump = ctx.bumps.trigger_config;
    Ok(())
}