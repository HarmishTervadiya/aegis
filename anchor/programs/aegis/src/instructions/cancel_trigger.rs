use anchor_lang::prelude::*;
use crate::state::trigger::TriggerConfig;

#[derive(Accounts)]
pub struct CancelTrigger<'info> {
    #[account(
        mut,
        seeds = [b"trigger", owner.key().as_ref()],
        bump = trigger_config.bump,
        has_one = owner
    )]
    pub trigger_config: Account<'info, TriggerConfig>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<CancelTrigger>) -> Result<()> {
    ctx.accounts.trigger_config.defense_active = false;
    ctx.accounts.trigger_config.offense_active = false;
    Ok(())
}