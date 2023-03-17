import type { SnapshotRestorer } from "@nomicfoundation/hardhat-network-helpers";
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import type { NFTStakingContract, ERC721Mock } from "../typechain-types";
const BigNumber = ethers.BigNumber;

describe("NFTStakingContract", function () {
    const NUM_NFTS = 2;
    const STAKING_PERIOD = 30 * 24 * 3600;
    let snapshotA: SnapshotRestorer;

    // Signers.
    let deployer: SignerWithAddress, owner: SignerWithAddress, user: SignerWithAddress;
    let nfts: ERC721Mock[] = [];

    let nftStakingContract: NFTStakingContract;

    before(async () => {
        // Getting of signers.
        [deployer, user] = await ethers.getSigners();

        const NFT = await ethers.getContractFactory("ERC721Mock", deployer);
        for(let i = 0; i < NUM_NFTS; i++) {
            nfts.push(await NFT.deploy("ERC721Token", "ERCT"));
            await nfts[i].deployed();
        }

        owner = deployer;

        snapshotA = await takeSnapshot();
    });

    afterEach(async () => await snapshotA.restore());

    describe("# Deployment", function () {
        it("Cannot deploy without NFT collections", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            await expect(upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC", []]
            )).to.be.revertedWith("Number of NFT collections must be greater than 0!");
        });
    });

    describe("# Staking", function () {
        it("Cannot stake already staked tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await expect(nftStakingContract.connect(user).stake(TokenID, 0))
            .to.be.revertedWith("This token is/was already staked!");
        });
        it("Cannot stake more than 10 tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            const MAX_USER_STAKED_NFTS = 10;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            for(let i = 0; i < MAX_USER_STAKED_NFTS; i++) {
                await nfts[i % NUM_NFTS].mint(user.address, TokenID + i);
                await nfts[i % NUM_NFTS].connect(user).approve(nftStakingContract.address, TokenID + i);
                await nftStakingContract.connect(user).stake(TokenID + i, i % NUM_NFTS);
            }
            await nfts[0].mint(user.address, TokenID + MAX_USER_STAKED_NFTS);
            await expect(nftStakingContract.connect(user).stake(TokenID + MAX_USER_STAKED_NFTS, 0))
            .to.be.revertedWith("You cannot stake more tokens!");
        });
        it("Should stake tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let now = Math.floor(Date.now() / 1000) + 5;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await network.provider.send("evm_setNextBlockTimestamp", [now - 1]);
            await network.provider.send("evm_mine");
            await nftStakingContract.connect(user).stake(TokenID, 0);
            expect(await nfts[0].ownerOf(TokenID)).to.be.equal(nftStakingContract.address);
            expect(await nftStakingContract.ownerOf(0)).to.be.equal(user.address);
            expect(await nftStakingContract.stakedNFTs(0, TokenID)).to.be.true;
            expect((await nftStakingContract.stakedNFTsInfo(0, TokenID)).mintedTokenId).to.be.equal(0);
            expect((await nftStakingContract.stakedNFTsInfo(0, TokenID)).endTime).to.be.equal(now + STAKING_PERIOD);
            expect((await nftStakingContract.stakedNFTsInfo(0, TokenID)).stakerAddress).to.be.equal(user.address);
            expect(await nftStakingContract.userStakedNFTs(user.address, 0, 0)).to.be.equal(TokenID);
            expect(await nftStakingContract.userStakedNFTsCount(user.address)).to.be.equal(1);
        });
    });
    describe("# Unstaking", function () {
        it("Cannot unstake tokens that are not staked yet", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await expect(nftStakingContract.connect(user).unstake(TokenID, 0))
            .to.be.revertedWith("This token isn't staked!");
        });
        it("Only staker can unstake tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await expect(nftStakingContract.connect(deployer).unstake(TokenID, 0))
            .to.be.revertedWith("Only staker can unstake tokens!");
        });
        it("Cannot unstake token after staking endtime", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let now = Math.floor(Date.now() / 1000);
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await network.provider.send("evm_setNextBlockTimestamp", [now + STAKING_PERIOD + 3600]);
            await network.provider.send("evm_mine");
            await expect(nftStakingContract.connect(user).unstake(TokenID, 0))
            .to.be.revertedWith("You cannot unstake token after staking endtime!");
        });
        it("Should unstake tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567, TokenID1 = 34586;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await nfts[0].mint(user.address, TokenID1);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID1);
            await nftStakingContract.connect(user).stake(TokenID1, 0);
            await nftStakingContract.connect(user).unstake(TokenID1, 0);
            expect(await nfts[0].ownerOf(TokenID1)).to.be.equal(user.address);
            expect(await nftStakingContract.ownerOf(1)).to.be.equal(nftStakingContract.address);
            expect(await nftStakingContract.stakedNFTs(0, TokenID1)).to.be.false;
            expect(await nftStakingContract.userStakedNFTs(user.address, 0, 0)).to.be.equal(TokenID);
            expect(await nftStakingContract.userStakedNFTsCount(user.address)).to.be.equal(1);
        });
    });
    describe("# Claiming new NFTs", function () {
        it("Cannot claim NFTs from tokens that are not staked yet", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await expect(nftStakingContract.connect(user).claimNewNFT(TokenID, 0))
            .to.be.revertedWith("This token isn't staked!");
        });
        it("Only staker can claim new NFTs", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await expect(nftStakingContract.connect(deployer).claimNewNFT(TokenID, 0))
            .to.be.revertedWith("Only staker can claim new tokens!");
        });
        it("Cannot claim new NFTs before staking endtime", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await expect(nftStakingContract.connect(user).claimNewNFT(TokenID, 0))
            .to.be.revertedWith("Token staking period not passed!");
        });
        it("Cannot claim from one token more than once", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let now = Math.floor(Date.now() / 1000);
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await network.provider.send("evm_setNextBlockTimestamp", [now + STAKING_PERIOD + 3600]);
            await network.provider.send("evm_mine");
            await nftStakingContract.connect(user).claimNewNFT(TokenID, 0);
            await expect(nftStakingContract.connect(user).claimNewNFT(TokenID, 0))
            .to.be.revertedWith("You already claimed an NFT from this token!");
        });
        it("Cannot claim from one token more than once", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let now = Math.floor(Date.now() / 1000);
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            await nfts[0].mint(user.address, TokenID);
            await nfts[0].connect(user).approve(nftStakingContract.address, TokenID);
            await nftStakingContract.connect(user).stake(TokenID, 0);
            await network.provider.send("evm_setNextBlockTimestamp", [now + STAKING_PERIOD + 3600]);
            await network.provider.send("evm_mine");
            await nftStakingContract.connect(user).claimNewNFT(TokenID, 0);
            expect(await nfts[0].ownerOf(TokenID)).to.be.equal(user.address);
            expect(await nftStakingContract.ownerOf(1)).to.be.equal(user.address);
            expect((await nftStakingContract.stakedNFTsInfo(0, TokenID)).claimed).to.be.true;
        });
    });
    describe("# Statistics", function () {
        it("Should get user staked tokens array", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenIDs = [34567, 24356, 85774, 48576];
            let resultArray: any[][] = Array.from(nfts, x => []);
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            for(let i = 0; i < TokenIDs.length; i++) {
                resultArray[i % NUM_NFTS].push(BigNumber.from(TokenIDs[i]));
                await nfts[i % NUM_NFTS].mint(user.address, TokenIDs[i]);
                await nfts[i % NUM_NFTS].connect(user).approve(nftStakingContract.address, TokenIDs[i]);
                await nftStakingContract.connect(user).stake(TokenIDs[i], i % NUM_NFTS);
            }
            expect(await nftStakingContract.getUserStakedTokens(user.address)).to.be.deep.equal(resultArray);
        });
    });
});
