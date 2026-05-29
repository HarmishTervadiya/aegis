#!/bin/bash
source ~/.profile
cd /mnt/e/aegis/anchor

solana-test-validator \
--ledger .anchor/test-ledger \
--mint 8KAPX5iqJ4u8mDWrRfSXEs5jmhQeL44YP5ThWT1YwvyU \
--bpf-program 5f3FSmoxZ6fpiQtdBoaPdAyCwUXmqFSRGBpSpRP9C4iU /mnt/e/aegis/anchor/target/deploy/aegis.so \
--account 5fQ1QzbLrJ4gUt6RgWbaTkY43uSBt2PBcy5R596tYo9i usdc_account.json \
--bind-address 0.0.0.0 \
--clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
--clone 3DzjXRfxRm6iejfyyMynR4tScddaanrePJ1NJU2XnPPL \
--clone 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF \
--clone D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 \
--clone-upgradeable-program MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA \
--clone Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6 \
--clone 8NXMyRD91p3nof61BTkJvrfpGTASHygz1cUvc3HvwyGS \
--clone 66bbb81Xo3cwR3J8XNbumHixVHSeLy49Dcb3Pn2kb5Gd \
--clone 7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat \
--clone 3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG \
--clone 2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB \
--clone-upgradeable-program KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD \
--clone BbDUrk1bVtSixgQsPLBJFZEF7mwGstnD5joA1WzYvYFX \
--clone B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D \
--clone GD1uQyAWbC1P9ZCb7BaEPXq83ntCqQCwxiwWhpJJuCaK \
--clone 4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8 \
--clone 2UywZrUdyqs5vDchy7fKQJKau2RVyuzBev2XKGPDSiX1 \
--clone d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q \
--rpc-port 8899 \
--url https://api.mainnet-beta.solana.com
