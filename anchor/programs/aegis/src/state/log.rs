use crate::state::trigger::TriggerMode;
use crate::state::vault::Protocol;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TriggerLog {
    pub owner: Pubkey,
    pub executed_at: i64,
    pub mode: TriggerMode,
    pub from_protocol: Protocol,
    pub to_protocol: Protocol,
    pub amount_moved: u64,
    pub marginfi_utilization_bps: u64,
    pub kamino_utilization_bps: u64,
    pub yield_earned: u64,
    pub bump: u8,
}
