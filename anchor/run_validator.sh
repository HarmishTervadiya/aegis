#!/bin/bash
export PATH=/home/harmis/.cargo/bin:/home/harmis/.local/share/solana/install/active_release/bin:$PATH

echo "Building smart contract..."
cd /mnt/e/aegis/anchor
anchor build

echo "Starting Solana Local Validator with Mainnet Clones..."
solana-test-validator \
  --bpf-program 5f3FSmoxZ6fpiQtdBoaPdAyCwUXmqFSRGBpSpRP9C4iU target/deploy/aegis.so \
  --clone MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA \
  --clone 4Q8u2ny8YYgytJEncwZQfVWbd5axZtfgDxYKHehvPQR7 \
  --clone KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD \
  --clone 9uSbGW1y9H5Av6H5TKxQ1wnFApSq2t3oEpfF2YfjDQGA \
  --clone 4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8 \
  --clone 2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB \
  --clone 66bbb81Xo3cwR3J8XNbumHixVHSeLy49Dcb3Pn2kb5Gd \
  --clone 7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat \
  --clone GD1uQyAWbC1P9ZCb7BaEPXq83ntCqQCwxiwWhpJJuCaK \
  --clone 3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG \
  --clone 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF \
  --clone 2UywZrUdyqs5vDchy7fKQJKau2RVyuzBev2XKGPDSiX1 \
  --clone 8NXMyRD91p3nof61BTkJvrfpGTASHygz1cUvc3HvwyGS \
  --clone d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q \
  --account LJRdqYR8TiqxYY1w1zyoB1gDfZPMGo4ZPRDFdxgSMsC ./scripts/mock_marginfi_high.json \
  --account 5HH4TwFfdUazDEPh6TfJNiehBPppShsTeF7FHWeAAxnr ./scripts/mock_kamino_high.json \
  --clone D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 \
  --clone Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6 \
  --clone BbDUrk1bVtSixgQsPLBJFZEF7mwGstnD5joA1WzYvYFX \
  --clone B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D \
  --clone 3DzjXRfxRm6iejfyyMynR4tScddaanrePJ1NJU2XnPPL \
  --clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --account 5fQ1QzbLrJ4gUt6RgWbaTkY43uSBt2PBcy5R596tYo9i usdc_account.json \
  --url https://api.mainnet-beta.solana.com \
  --reset
