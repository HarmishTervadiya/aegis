use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateMock<'info> {
    /// CHECK: Mock account owned by Aegis
    #[account(mut)]
    pub marginfi_account: UncheckedAccount<'info>,
    /// CHECK: Mock account owned by Aegis
    #[account(mut)]
    pub kamino_account: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
}

#[cfg(feature = "mock-cpi")]
pub fn handler(
    ctx: Context<UpdateMock>,
    mfi_assets: u128,
    mfi_liab: u128,
    kam_avail: u64,
    kam_borrow: u128,
) -> Result<()> {
    let mut mfi_data = ctx.accounts.marginfi_account.try_borrow_mut_data()?;
    let mut kam_data = ctx.accounts.kamino_account.try_borrow_mut_data()?;

    // Marginfi offsets: assets at 182, liab at 240
    if mfi_data.len() >= 240 + 16 {
        mfi_data[182..182 + 16].copy_from_slice(&mfi_assets.to_le_bytes());
        mfi_data[240..240 + 16].copy_from_slice(&mfi_liab.to_le_bytes());
    }

    // Kamino offsets: avail at 137, borrow at 145
    if kam_data.len() >= 145 + 16 {
        kam_data[137..137 + 8].copy_from_slice(&kam_avail.to_le_bytes());
        kam_data[145..145 + 16].copy_from_slice(&kam_borrow.to_le_bytes());
    }

    Ok(())
}

#[cfg(not(feature = "mock-cpi"))]
pub fn handler(
    _ctx: Context<UpdateMock>,
    _mfi_assets: u128,
    _mfi_liab: u128,
    _kam_avail: u64,
    _kam_borrow: u128,
) -> Result<()> {
    Ok(())
}
