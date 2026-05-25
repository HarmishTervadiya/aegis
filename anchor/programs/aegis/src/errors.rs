use anchor_lang::prelude::*;

#[error_code]
pub enum AegisError{
    #[msg("Integer overflow in calculation")]
    MathOverflow,
    #[msg("Account not owned by the expected program")]
    InvalidAccountOwner,
    #[msg("Account data is too short or malformed")]
    InvalidAccountData,
    #[msg("Failed to deserialize account bytes at expected offset")]
    DeserializationFailed,
}