use anchor_lang::prelude::*;

pub mod errors;
pub mod external;
pub mod state;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod aegis {
    use super::*;
}