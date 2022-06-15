import { expect } from "chai"
import { BigNumberish } from "ethers"
import { ethers } from "hardhat"

describe("duplicate ids regression", () =>
{
	it('should mint tokens after unvesting', async () =>
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

		const now = (await ethers.provider.getBlock("latest")).timestamp

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, 1_000_000)

		let vestTx1 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](now - 100, now - 10, 1)
		let vid1 = (await vestTx1.wait()).events?.[0].args?.tokenId
		let vestTx2 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](now, now + 100, 2)
		let vid2 = (await vestTx2.wait()).events?.[0].args?.tokenId
		let vestTx3 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](now, now + 100, 3)
		let vid3 = (await vestTx3.wait()).events?.[0].args?.tokenId

		let unvestTx1 = await vest.connect(cto)["unvest(uint256)"](vid1)
		let vestTx4 = await vest.connect(cto)["vest(uint256,uint256,uint256)"](now, now + 100, 4)
	})
})