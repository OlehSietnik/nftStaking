// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFTStakingContract is ERC721Upgradeable {
    using Counters for Counters.Counter;

    struct StakedNFTInfo {
        address stakerAddress;
        uint256 mintedTokenId;
        uint256 endTime;
        bool claimed;
    }

    uint256 public constant MAX_USER_STAKED_NFTS = 10;
    uint256 public constant STAKING_PERIOD = 30 * 24 * 3600;

    // _______________ Storage _______________

    Counters.Counter public lastNftId;
    IERC721[] public nftCollections;
    // collectionId => tokenId => info
    mapping(uint256 => mapping(uint256 => StakedNFTInfo)) public stakedNFTsInfo;
    mapping(uint256 => mapping(uint256 => bool)) public stakedNFTs;
    mapping(address => mapping(uint256 => uint256[])) public userStakedNFTs;
    mapping(address => uint256) public userStakedNFTsCount;

    // _______________ Errors _______________


    // _______________ Events _______________


    function initialize(string memory name_, string memory symbol_, address[] memory collections) external initializer {
        require(collections.length > 0, "Number of NFT collections must be greater than 0!");
        
        __ERC721_init(name_, symbol_);

        for(uint256 i = 0; i < collections.length; i++) {
            nftCollections.push(IERC721(collections[i]));
        }
    }

    // _______________ External functions _______________

    function stake(uint256 tokenId, uint256 collectionId) external {
        require(!stakedNFTs[collectionId][tokenId], "This token is/was already staked!");
        require(userStakedNFTsCount[_msgSender()] < MAX_USER_STAKED_NFTS, "You cannot stake more tokens!");

        nftCollections[collectionId].transferFrom(_msgSender(), address(this), tokenId);
        uint256 mintedId = mint(_msgSender());
        stakedNFTs[collectionId][tokenId] = true;
        stakedNFTsInfo[collectionId][tokenId].mintedTokenId = mintedId;
        stakedNFTsInfo[collectionId][tokenId].endTime = block.timestamp + STAKING_PERIOD;
        stakedNFTsInfo[collectionId][tokenId].stakerAddress = _msgSender();
        userStakedNFTs[_msgSender()][collectionId].push(tokenId);
        userStakedNFTsCount[_msgSender()]++;
    }

    function unstake(uint256 tokenId, uint256 collectionId) external {
        require(stakedNFTs[collectionId][tokenId], "This token isn't staked!");
        require(_msgSender() == stakedNFTsInfo[collectionId][tokenId].stakerAddress, "Only staker can unstake tokens!");
        require(stakedNFTsInfo[collectionId][tokenId].endTime > block.timestamp, 
        "You cannot unstake token after staking endtime!");

        nftCollections[collectionId].transferFrom(address(this), 
        stakedNFTsInfo[collectionId][tokenId].stakerAddress, tokenId);
        stakedNFTs[collectionId][tokenId] = false;
        _transfer(_msgSender(), address(this), stakedNFTsInfo[collectionId][tokenId].mintedTokenId);
        uint256[] storage refUserStakedNFTs = userStakedNFTs[_msgSender()][collectionId];
        uint256 len = refUserStakedNFTs.length;
        for(uint256 i = 0; i < len; i++) {
            if(refUserStakedNFTs[i] == tokenId) {
                refUserStakedNFTs[i] = refUserStakedNFTs[len - 1];
                refUserStakedNFTs.pop();
                break;
            }
        }
        userStakedNFTsCount[_msgSender()]--;
    }

    function claimNewNFT(uint256 tokenId, uint256 collectionId) external {
        require(stakedNFTs[collectionId][tokenId], "This token isn't staked!");
        require(_msgSender() == stakedNFTsInfo[collectionId][tokenId].stakerAddress,
        "Only staker can claim new tokens!");
        require(stakedNFTsInfo[collectionId][tokenId].endTime <= block.timestamp, 
        "Token staking period not passed!");
        require(!stakedNFTsInfo[collectionId][tokenId].claimed, "You already claimed an NFT from this token!");

        nftCollections[collectionId].transferFrom(address(this), 
        stakedNFTsInfo[collectionId][tokenId].stakerAddress, tokenId);
        mint(stakedNFTsInfo[collectionId][tokenId].stakerAddress);
        stakedNFTsInfo[collectionId][tokenId].claimed = true;
    }

    function getUserStakedTokens(address user) external view returns (uint256[][] memory) {
        uint256[][] memory userStakedTokens = new uint256[][](nftCollections.length);
        for(uint256 i = 0; i < nftCollections.length; i++) {
            userStakedTokens[i] = userStakedNFTs[user][i];
        }
        return userStakedTokens;
    }

    // _______________ Internal functions _______________

    function mint(address to) internal returns (uint256) {
        _mint(to, lastNftId.current());
        uint256 tokenId = lastNftId.current();
        lastNftId.increment();
        return tokenId;
    }

}
