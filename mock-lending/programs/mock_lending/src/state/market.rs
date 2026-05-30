use anchor_lang::prelude::*;

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub total_assets: u64,
    pub total_liabilities: u64,
    pub bump: u8,
}
