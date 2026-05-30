use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub owner: Pubkey,
    pub usdc_deposited: u64,
    pub current_protocol: Protocol,
    pub marginfi_account: Pubkey,
    pub kamino_account: Pubkey,
    pub lifetime_yield: u64,
    pub deposit_timestamp: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace, Debug)]
pub enum Protocol {
    Idle,
    Kamino,
    MarginFi,
}
