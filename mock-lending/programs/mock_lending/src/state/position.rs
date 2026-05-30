use anchor_lang::prelude::*;

#[account]
pub struct UserPosition {
    pub market: Pubkey,
    pub user: Pubkey,
    pub deposited_amount: u64,
    pub bump: u8,
}
