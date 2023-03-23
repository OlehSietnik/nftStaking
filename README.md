# NFT staking contract example

This is an example of a contract used for staking NFT's.

A user can stake his tokens from external NFT collections and get in exchange new token from this contract and then get another new token after expiration of staking period.

Call `stake` function with token ID and collection from what you want to stake token for staking token. Maxiumun number of tokens user can stake is 10. Staking period will expire in 30 days.

If you want to unstake that token, call `unstake` functions with same parameters. You can stake that token again any time but with restarted staking period.

After expiration of staking period you can claim new token by calling the `claimNewNFT` function with parameters mentioned above.
