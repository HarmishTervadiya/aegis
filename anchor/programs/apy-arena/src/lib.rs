use anchor_lang::prelude::*;

declare_id!("mb3rjkfckkGZdDJFMjiVmSLYpuyb9fXTqJubuzqsdh8");

#[program]
pub mod apy_arena {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
