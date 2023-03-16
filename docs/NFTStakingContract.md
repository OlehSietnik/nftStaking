# Solidity API

## NFTStakingContract

### StakedNFTInfo

```solidity
struct StakedNFTInfo {
  address stakerAddress;
  uint256 mintedTokenId;
  uint256 endTime;
  bool claimed;
}
```

### MAX_USER_STAKED_NFTS

```solidity
uint256 MAX_USER_STAKED_NFTS
```

### STAKING_PERIOD

```solidity
uint256 STAKING_PERIOD
```

### lastNftId

```solidity
struct Counters.Counter lastNftId
```

### nftCollections

```solidity
contract IERC721[] nftCollections
```

### stakedNFTsInfo

```solidity
mapping(uint256 => mapping(uint256 => struct NFTStakingContract.StakedNFTInfo)) stakedNFTsInfo
```

### stakedNFTs

```solidity
mapping(uint256 => mapping(uint256 => bool)) stakedNFTs
```

### userStakedNFTs

```solidity
mapping(address => mapping(uint256 => uint256[])) userStakedNFTs
```

### userStakedNFTsCount

```solidity
mapping(address => uint256) userStakedNFTsCount
```

### initialize

```solidity
function initialize(string name_, string symbol_, address[] collections) external
```

### stake

```solidity
function stake(uint256 tokenId, uint256 collectionId) external
```

### unstake

```solidity
function unstake(uint256 tokenId, uint256 collectionId) external
```

### claimNewNFT

```solidity
function claimNewNFT(uint256 tokenId, uint256 collectionId) external
```

### getUserStakedTokens

```solidity
function getUserStakedTokens(address user) external view returns (uint256[][])
```

### mint

```solidity
function mint(address to) internal returns (uint256)
```

