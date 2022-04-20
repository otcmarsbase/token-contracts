import { expect } from "chai"
import { ethers } from "hardhat"

describe("Greeter", function ()
{
	it("Should return the new greeting once it's changed", async function ()
	{
		const Greeter = await ethers.getContractFactory("Greeter")
		const greeter = await Greeter.deploy("Hello, world!")
		await greeter.deployed()

		expect(await greeter.greet()).to.equal("Hello, world!")

		const setGreetingTx = await greeter.setGreeting("Hola, mundo!")

		// wait until the transaction is mined
		await setGreetingTx.wait()

		expect(await greeter.greet()).to.equal("Hola, mundo!")
	})
	it("should deploy&mint tokens", async () =>
	{
		const [owner, addr1, addr2] = await ethers.getSigners()

		const Mbase = await ethers.getContractFactory("MarsbaseToken")
		const mbase = await Mbase.deploy()
		await mbase.deployed()

		// create account to mint tokens to
		await mbase.mint(addr1.address, 100)
		expect(await mbase.balanceOf(addr1.address)).to.equal(100)

		// burn 1 mbase token from account1
		await mbase.connect(addr1).burn(1)
		expect(await mbase.balanceOf(addr1.address)).to.equal(99)

		// send some eth to the account
		owner.sendTransaction({
			to: addr1.address,
			value: ethers.utils.parseEther("1.0")
		})

		// create tx by account1 to send 1 token to zero address
		const tx = await mbase.connect(addr1).transfer(addr2.address, 1)
		// send tx from account1
		await tx.wait()

		// check that account1 has 98 tokens
		expect(await mbase.balanceOf(addr1.address)).to.equal(98)
	})
	it('should vest tokens', async () =>
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

		// vest 100k tokens for a month
		let vestTx = await vest.connect(cto).vest(startDate, endDate, 100_000)
		let vestTxResult = await vestTx.wait()
		expect(vestTxResult.events?.length == 1)
		// expect transfer tx
		expect(vestTxResult.events?.[0].event).to.equal("Transfer")
		// get tokenId from transfer event
		let tokenId = vestTxResult.events?.[0]?.args?.tokenId
		// expect tokenId to be BigNumber
		expect(tokenId).to.be.instanceOf(ethers.BigNumber)

		// console.log('minted')

		// check that cto cannot unvest tokens
		await expect(vest.connect(cto).unvest(tokenId)).to.be.revertedWith("Vesting has not started")

		// send vesting nft to investor
		await vest.connect(cto).transferFrom(cto.address, investor.address, tokenId)

		// console.log('transferred')

		// check that investor cannot unvest tokens
		await expect(vest.connect(investor).unvest(tokenId)).to.be.revertedWith("Vesting has not started")

		// skip time to start date
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate])

		// check that no tokens are available to unvest
		await expect(vest.connect(investor).unvest(tokenId)).to.be.revertedWith("No tokens to unvest")

		// skip 1 more day
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + 86400])

		// unvest tokens by investor
		let unvestTx = await vest.connect(investor).unvest(tokenId)
		let unvestTxResult = await unvestTx.wait()

		// check that investor has 1k tokens
		expect(await mbase.balanceOf(investor.address)).to.equal(1_000)

		// console.log('unvested')

		// check that investor cannot unvest any more tokens
		await expect(vest.connect(investor).unvest(tokenId)).to.be.revertedWith("No tokens to unvest")

		// console.log('skipping')

		// skip 200 days
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + 86400 * 200])

		// console.log('skipped')

		// unvest rest of the tokens
		unvestTx = await vest.connect(investor).unvest(tokenId)
		unvestTxResult = await unvestTx.wait()

		// console.log('unvested rest')

		// expect investor to have 100k tokens
		expect(await mbase.balanceOf(investor.address)).to.equal(100_000)

		// expect nft to be burned and not available to unvest
		await expect(vest.connect(investor).unvest(tokenId)).to.be.revertedWith("ERC721: owner query for nonexistent token")
	})
})
