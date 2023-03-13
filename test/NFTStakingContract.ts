import type { SnapshotRestorer } from "@nomicfoundation/hardhat-network-helpers";
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import type { NFTStakingContract, ERC721Mock } from "../typechain-types";

describe("NFTStakingContract", function () {
    const NUM_NFTS = 2;
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
        it("Cannot stake token not being its owner", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            nfts[0].mint(user.address, TokenID);
            await expect(nftStakingContract.stake(TokenID, 0)).to.be.revertedWith("You're not an owner of this token!");
        });
        it("Cannot stake already staked tokens", async () => {
            const NFTStakingContract = await ethers.getContractFactory("NFTStakingContract", deployer);
            const TokenID = 34567;
            let nftStakingContract = await upgrades.deployProxy(NFTStakingContract, ["NFTStaking", "NSC",
            nfts.map((x) => { return x.address })]);
            nfts[0].mint(user.address, TokenID);
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
                nfts[i % NUM_NFTS].mint(user.address, TokenID + i);
                await nftStakingContract.connect(user).stake(TokenID + i, i % NUM_NFTS);
            }
            nfts[0].mint(user.address, TokenID + MAX_USER_STAKED_NFTS);
            await expect(nftStakingContract.connect(user).stake(TokenID + MAX_USER_STAKED_NFTS, 0))
            .to.be.revertedWith("You cannot stake more tokens!");
        });
    });
});
