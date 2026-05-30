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
    is_active: bool,
    threshold_bps: u64,
) -> Result<()> {
    require!(
        threshold_bps > 0 && threshold_bps <= 10000,
        AegisError::InvalidThreshold
    );

    let trigger = &mut ctx.accounts.trigger_config;
    
    // Set owner and bump only if it's the first time
    if trigger.owner == Pubkey::default() {
        trigger.owner = ctx.accounts.owner.key();
        trigger.bump = ctx.bumps.trigger_config;
    }

    match mode {
        TriggerMode::Defense => {
            trigger.defense_active = is_active;
            if is_active {
                trigger.defense_threshold_bps = threshold_bps;
            }
        }
        TriggerMode::Offense => {
            trigger.offense_active = is_active;
            if is_active {
                trigger.offense_threshold_bps = threshold_bps;
            }
        }
    }

    Ok(())
}
