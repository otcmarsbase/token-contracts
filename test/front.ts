import { expect } from "chai"
import { BigNumberish } from "ethers"
import { ethers } from "hardhat"

describe("Frontend-specific tests", () =>
{
	it('should iterate over tokens', async () =>
	{
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		const [owner, cto, investor] = await ethers.getSigners()

		// mint tokens to CTO
		await mbase.mint(cto.address, 1_000_000)
		expect(await mbase.balanceOf(cto.address)).to.equal(1_000_000)

		// set start date to tomorrow as timestamp
		const startDate = (await ethers.provider.getBlock("latest")).timestamp + 86400
		// set end date to startDate + 100 days
		const endDate = startDate + 86400 * 100

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, 1_000_000)

		let vestTx1 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 1)
		let vid1 = (await vestTx1.wait()).events?.[0].args?.tokenId
		let vestTx2 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 2)
		let vid2 = (await vestTx2.wait()).events?.[0].args?.tokenId
		let vestTx3 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 3)
		let vid3 = (await vestTx3.wait()).events?.[0].args?.tokenId

		// get tokens list for cto
		let ctoTokenIds = await vest.getVestingsByOwner(cto.address)
		expect(ctoTokenIds.length).to.equal(3)
		expect(ctoTokenIds[0]).to.equal(vid1)
		expect(ctoTokenIds[1]).to.equal(vid2)
		expect(ctoTokenIds[2]).to.equal(vid3)
		let records = await Promise.all(ctoTokenIds.map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records.length).to.equal(3)
		expect(records[0].amount).to.equal(1)
		expect(records[1].amount).to.equal(2)
		expect(records[2].amount).to.equal(3)

		// get tokens list for investor
		let investorTokenIds = await vest.getVestingsByOwner(investor.address)
		expect(investorTokenIds.length).to.equal(0)

		// send one token from cto to investor
		let tx = await vest.connect(cto).transferFrom(cto.address, investor.address, vid1)
		await tx.wait()

		// get tokens list for cto
		let ctoTokenIds2 = await vest.getVestingsByOwner(cto.address)
		expect(ctoTokenIds2).to.have.same.deep.members([vid2, vid3])
		let records2 = await Promise.all([vid2, vid3].map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records2.length).to.equal(2)
		expect(records2[0].amount).to.equal(2)
		expect(records2[1].amount).to.equal(3)

		// get tokens list for investor
		let investorTokenIds2 = await vest.getVestingsByOwner(investor.address)
		expect(investorTokenIds2.length).to.equal(1)
		expect(investorTokenIds2[0]).to.equal(vid1)
		let records3 = await Promise.all(investorTokenIds2.map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records3.length).to.equal(1)
		expect(records3[0].amount).to.equal(1)
	})
	it('should iterate over tokens after claim', async () =>
	{
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		const [owner, cto, investor] = await ethers.getSigners()

		// mint tokens to CTO
		await mbase.mint(cto.address, 1_000_000)
		expect(await mbase.balanceOf(cto.address)).to.equal(1_000_000)

		// set start date to now minus one minute
		const startDate = (await ethers.provider.getBlock("latest")).timestamp - 60
		// set end date to startDate + 30 secs
		const endDate = startDate + 30

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, 1_000_000)
		let vestTx1 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 1)
		let vid1 = (await vestTx1.wait()).events?.[0].args?.tokenId
		let vestTx2 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 2)
		let vid2 = (await vestTx2.wait()).events?.[0].args?.tokenId
		let vestTx3 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 3)
		let vid3 = (await vestTx3.wait()).events?.[0].args?.tokenId

		// get tokens list for cto
		let ctoTokenIds = await vest.getVestingsByOwner(cto.address)
		expect(ctoTokenIds.length).to.equal(3)
		expect(ctoTokenIds[0]).to.equal(vid1)
		expect(ctoTokenIds[1]).to.equal(vid2)
		expect(ctoTokenIds[2]).to.equal(vid3)
		let records = await Promise.all(ctoTokenIds.map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records.length).to.equal(3)
		expect(records[0].amount).to.equal(1)
		expect(records[1].amount).to.equal(2)
		expect(records[2].amount).to.equal(3)

		// get tokens list for investor
		let investorTokenIds = await vest.getVestingsByOwner(investor.address)
		expect(investorTokenIds.length).to.equal(0)

		// send one token from cto to investor
		let tx = await vest.connect(cto).transferFrom(cto.address, investor.address, vid1)
		await tx.wait()

		// get tokens list for cto
		let ctoTokenIds2 = await vest.getVestingsByOwner(cto.address)
		expect(ctoTokenIds2).to.have.same.deep.members([vid2, vid3])
		let records2 = await Promise.all([vid2, vid3].map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records2.length).to.equal(2)
		expect(records2[0].amount).to.equal(2)
		expect(records2[1].amount).to.equal(3)

		// get tokens list for investor
		let investorTokenIds2 = await vest.getVestingsByOwner(investor.address)
		expect(investorTokenIds2.length).to.equal(1)
		expect(investorTokenIds2[0]).to.equal(vid1)
		let records3 = await Promise.all(investorTokenIds2.map((x: BigNumberish) => vest.getVestingRecord(x)))
		expect(records3.length).to.equal(1)
		expect(records3[0].amount).to.equal(1)

		// unvest first token for cto
		let claimTx = await vest.connect(cto)["unvest(uint256)"](vid2)

		// get tokens list for cto
		let ctoTokenIds3 = await vest.getVestingsByOwner(cto.address)
		expect(ctoTokenIds3).to.have.same.deep.members([vid3])

		// unvest first token for investor
		let claimTx2 = await vest.connect(investor)["unvest(uint256)"](vid1)

		// get tokens list for investor
		let investorTokenIds3 = await vest.getVestingsByOwner(investor.address)
		expect(investorTokenIds3.length).to.equal(0)
	})
})