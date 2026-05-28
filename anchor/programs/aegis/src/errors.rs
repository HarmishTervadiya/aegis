use anchor_lang::prelude::*;

#[error_code]
pub enum AegisError {
    #[msg("Trigger condition not met — transaction reverted by on-chain validation")]
    ConditionNotMet,

    #[msg("Integer overflow in calculation")]
    MathOverflow,

    #[msg("Account not owned by the expected program")]
    InvalidAccountOwner,

    #[msg("Account data is too short or malformed")]
    InvalidAccountData,

    #[msg("Failed to deserialize account bytes at expected offset")]
    DeserializationFailed,

    #[msg("Trigger is not active")]
    TriggerNotActive,

    #[msg("Cancel the trigger before withdrawing")]
    TriggerStillActive,

    #[msg("No funds are currently deployed in a protocol")]
    NoDeployedFunds,

    #[msg("Funds are not in the protocol required for this trigger mode")]
    FundsNotInExpectedProtocol,

    #[msg("Funds are already in the optimal protocol — no move needed")]
    AlreadyInOptimalProtocol,

    #[msg("Threshold must be between 1 and 10000 basis points")]
    InvalidThreshold,
}
