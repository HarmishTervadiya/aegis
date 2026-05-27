use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TriggerConfig {
    pub owner: Pubkey,
    pub mode: TriggerMode,
    pub is_active: bool,
    pub last_executed: i64,
    pub execution_count: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum TriggerMode {
    Defense,
    Offence,
}
