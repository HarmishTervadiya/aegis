use crate::errors::AegisError;
use crate::state::trigger::{TriggerConfig, TriggerMode};
use crate::state::vault::UserVault;
use anchor_lang::prelude::*;

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

pub fn handler(
    ctx: Context<SetTrigger>,
    mode: TriggerMode,
    defense_threshold_bps: u64,
    offense_threshold_bps: u64,
) -> Result<()> {
    require!(
        defense_threshold_bps > 0 && defense_threshold_bps <= 10000,
        AegisError::InvalidThreshold
    );
    require!(
        offense_threshold_bps > 0 && offense_threshold_bps <= 10000,
        AegisError::InvalidThreshold
    );

    let trigger = &mut ctx.accounts.trigger_config;
    trigger.owner = ctx.accounts.owner.key();
    trigger.mode = mode;
    trigger.is_active = true;
    trigger.defense_threshold_bps = defense_threshold_bps;
    trigger.offense_threshold_bps = offense_threshold_bps;
    trigger.bump = ctx.bumps.trigger_config;

    Ok(())
}
