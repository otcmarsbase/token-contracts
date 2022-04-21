import { expect } from "chai"
import { ethers } from "hardhat"

const UINT_OVERFLOW_PANIC_MESSAGE = 'VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)'

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
		let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 100_000)
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
		await expect(vest.connect(cto)["unvest(uint256)"](tokenId)).to.be.revertedWith("Vesting has not started")

		// send vesting nft to investor
		await vest.connect(cto).transferFrom(cto.address, investor.address, tokenId)

		// console.log('transferred')

		// check that investor cannot unvest tokens
		await expect(vest.connect(investor)["unvest(uint256)"](tokenId)).to.be.revertedWith("Vesting has not started")

		// skip time to start date
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate])

		// check that no tokens are available to unvest
		await expect(vest.connect(investor)["unvest(uint256)"](tokenId)).to.be.revertedWith("No tokens to unvest")

		// skip 1 more day
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + 86400])

		// unvest tokens by investor
		let unvestTx = await vest.connect(investor)["unvest(uint256)"](tokenId)
		let unvestTxResult = await unvestTx.wait()

		// check that investor has 1k tokens
		expect(await mbase.balanceOf(investor.address)).to.equal(1_000)

		// console.log('unvested')

		// check that investor cannot unvest any more tokens
		await expect(vest.connect(investor)["unvest(uint256)"](tokenId)).to.be.revertedWith("No tokens to unvest")

		// console.log('skipping')

		// skip 200 days
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + 86400 * 200])

		// console.log('skipped')

		// unvest rest of the tokens
		unvestTx = await vest.connect(investor)["unvest(uint256)"](tokenId)
		unvestTxResult = await unvestTx.wait()

		// console.log('unvested rest')

		// expect investor to have 100k tokens
		expect(await mbase.balanceOf(investor.address)).to.equal(100_000)

		// expect nft to be burned and not available to unvest
		await expect(vest.connect(investor)["unvest(uint256)"](tokenId)).to.be.revertedWith("ERC721: owner query for nonexistent token")
	})
	it('should overflow on huge amounts of tokens up until full unvest', async () => {
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		const [owner, cto] = await ethers.getSigners()

		// mint UINT256_MAX amount of tokens to CTO
		await mbase.mint(cto.address, ethers.constants.MaxUint256)

		expect(await mbase.balanceOf(cto.address)).to.equal(ethers.constants.MaxUint256)

		// set start date to tomorrow as timestamp
		const startDate = (await ethers.provider.getBlock("latest")).timestamp + 86400
		// set end date to startDate + 100 days
		const endDate = startDate + 86400 * 100

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, ethers.constants.MaxUint256)

		// vest CTO tokens
		let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, ethers.constants.MaxUint256)
		let vestTxResult = await vestTx.wait()

		// get tokenId from events
		let tokenId = vestTxResult.events?.[0]?.args?.tokenId

		// try to unvest
		await expect(vest.connect(cto)["unvest(uint256)"](tokenId)).to.be.revertedWith("Vesting has not started")

		// expect CTO to have 0 tokens
		expect(await mbase.balanceOf(cto.address)).to.equal(0)

		// skip time to start date + 1 day
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + 86400])

		// expect unvesting to fail
		await expect(vest.connect(cto)["unvest(uint256)"](tokenId)).to.be.revertedWith(UINT_OVERFLOW_PANIC_MESSAGE)

		// skip time to end date
		await ethers.provider.send("evm_setNextBlockTimestamp", [endDate])

		// try to unvest
		await (await vest.connect(cto)["unvest(uint256)"](tokenId)).wait()

		// expect CTO token balance to be UINT256_MAX
		expect(await mbase.balanceOf(cto.address)).to.equal(ethers.constants.MaxUint256)
	})
	it('should split vesting nfts', async () => {
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		const [owner, cto, investor] = await ethers.getSigners()

		// mint 100k tokens to cto
		await mbase.mint(cto.address, 100_000)

		// set start date to tomorrow as timestamp
		const startDate = (await ethers.provider.getBlock("latest")).timestamp + 86400
		// set end date to startDate + 100 days
		const endDate = startDate + 86400 * 100

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, 100_000)

		// vest 100k tokens for a month
		let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 100_000)
		let vestTxResult = await vestTx.wait()
		expect(vestTxResult.events?.length == 1)
		// expect transfer tx
		expect(vestTxResult.events?.[0].event).to.equal("Transfer")
		// get tokenId from transfer event
		let tokenId = vestTxResult.events?.[0]?.args?.tokenId
		// expect tokenId to be BigNumber
		expect(tokenId).to.be.instanceOf(ethers.BigNumber)

		// read vesting nft from contract
		let oldVesting = await vest.getVestingRecord(tokenId)
		// expect vesting to be correct
		expect(oldVesting.start).to.equal(startDate)
		expect(oldVesting.end).to.equal(endDate)
		expect(oldVesting.amount).to.equal(100_000)
		expect(oldVesting.initialAmount).to.equal(100_000)

		// send vesting nft to investor
		await vest.connect(cto).transferFrom(cto.address, investor.address, tokenId)

		// split vesting nft to two with 60/40 split
		let splitTx = await vest.connect(investor).split(tokenId, 60_000, 40_000)
		let splitTxResult = await splitTx.wait()

		// expect investor to have 0 tokens
		expect(await mbase.balanceOf(investor.address)).to.equal(0)
		// expect cto to have 0 tokens
		expect(await mbase.balanceOf(cto.address)).to.equal(0)

		// expect Transfer and VestingSplit event to fire
		expect(splitTxResult.events?.length == 2)

		// expect first event to be Transfer
		let [transferEvent, splitEvent] = splitTxResult.events!
		
		// check for transferEvent fields
		expect(transferEvent.event).to.equal("Transfer")
		expect(transferEvent.args!.from).to.equal(ethers.constants.AddressZero)
		expect(transferEvent.args!.to).to.equal(investor.address)

		let secondTokenId = transferEvent.args!.tokenId

		// check for splitEvent fields
		expect(splitEvent.event).to.equal("VestingSplit")
		expect(splitEvent.args!.splitter).to.equal(investor.address)
		expect(splitEvent.args!.oldVestingId).to.equal(tokenId)
		expect(splitEvent.args!.oldAmount).to.equal(100_000)
		expect(splitEvent.args!.newVestingId).to.equal(secondTokenId)
		expect(splitEvent.args!.leftAmount).to.equal(60_000)
		expect(splitEvent.args!.rightAmount).to.equal(40_000)

		// get both vesting nfts from contract
		let leftVesting = await vest.getVestingRecord(tokenId)
		let rightVesting = await vest.getVestingRecord(secondTokenId)

		// expect leftVesting to have correct params
		expect(leftVesting.start).to.equal(startDate)
		expect(leftVesting.end).to.equal(endDate)
		expect(leftVesting.amount).to.equal(60_000)
		expect(leftVesting.initialAmount).to.equal(60_000)

		// expect rightVesting to have correct params
		expect(rightVesting.start).to.equal(startDate)
		expect(rightVesting.end).to.equal(endDate)
		expect(rightVesting.amount).to.equal(40_000)
		expect(rightVesting.initialAmount).to.equal(40_000)

		// skip time to start date
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate])

		// TODO: test unvesting
	})
	it('should subtract transfer fee from vested amount', async () => {
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		// set transfer fee to 1%
		await vest.setFeeTransfer(0.01 * 1e5)

		const [owner, cto, investor] = await ethers.getSigners()

		// mint 100k tokens to cto
		await mbase.mint(cto.address, 100_000)

		await mbase.connect(cto).approve(vest.address, 100_000)

		let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](0, 0, 100_000)
		await vestTx.wait()

		let tokenId = 0

		// read vesting data
		let vestingData = await vest.getVestingRecord(tokenId)
		// expect vesting to be correct
		expect(vestingData.amount).to.equal(100_000)

		// transfer nft to investor
		await vest.connect(cto).transferFrom(cto.address, investor.address, tokenId)

		// read vesting data
		vestingData = await vest.getVestingRecord(tokenId)

		// check that fee was subtracted
		expect(vestingData.amount).to.equal(99_000)
	})
	it('should split vesting nfts and subtract fee', async () => {
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		// set split fee to 1%
		await vest.setFeeSplit(0.01 * 1e5)

		const [owner, cto, investor] = await ethers.getSigners()

		// mint 100k tokens to cto
		await mbase.mint(cto.address, 100_000)

		// set start date to tomorrow as timestamp
		const startDate = (await ethers.provider.getBlock("latest")).timestamp + 86400
		// set end date to startDate + 100 days
		const endDate = startDate + 86400 * 100

		// give vesting contract allowance for all cto tokens
		await mbase.connect(cto).approve(vest.address, 100_000)

		// vest 100k tokens for a month
		let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 100_000)
		let vestTxResult = await vestTx.wait()
		expect(vestTxResult.events?.length == 1)
		// expect transfer tx
		expect(vestTxResult.events?.[0].event).to.equal("Transfer")
		// get tokenId from transfer event
		let tokenId = vestTxResult.events?.[0]?.args?.tokenId
		// expect tokenId to be BigNumber
		expect(tokenId).to.be.instanceOf(ethers.BigNumber)

		// read vesting nft from contract
		let oldVesting = await vest.getVestingRecord(tokenId)
		// expect vesting to be correct
		expect(oldVesting.start).to.equal(startDate)
		expect(oldVesting.end).to.equal(endDate)
		expect(oldVesting.amount).to.equal(100_000)
		expect(oldVesting.initialAmount).to.equal(100_000)

		// send vesting nft to investor
		await vest.connect(cto).transferFrom(cto.address, investor.address, tokenId)

		// split vesting nft to two with 60/40 split
		let splitTx = await vest.connect(investor).split(tokenId, 60_000, 40_000)
		let splitTxResult = await splitTx.wait()

		// expect first event to be Transfer
		let [transferEvent, splitEvent] = splitTxResult.events!

		let secondTokenId = transferEvent.args!.tokenId

		// check for splitEvent fields
		expect(splitEvent.event).to.equal("VestingSplit")
		expect(splitEvent.args!.splitter).to.equal(investor.address)
		expect(splitEvent.args!.oldVestingId).to.equal(tokenId)
		expect(splitEvent.args!.oldAmount).to.equal(100_000)
		expect(splitEvent.args!.newVestingId).to.equal(secondTokenId)
		expect(splitEvent.args!.leftAmount).to.equal(59_000)
		expect(splitEvent.args!.rightAmount).to.equal(40_000)

		// get both vesting nfts from contract
		let leftVesting = await vest.getVestingRecord(tokenId)
		let rightVesting = await vest.getVestingRecord(secondTokenId)

		// expect leftVesting to have correct params
		expect(leftVesting.start).to.equal(startDate)
		expect(leftVesting.end).to.equal(endDate)
		expect(leftVesting.amount).to.equal(59_000)
		expect(leftVesting.initialAmount).to.equal(59_000)

		// expect rightVesting to have correct params
		expect(rightVesting.start).to.equal(startDate)
		expect(rightVesting.end).to.equal(endDate)
		expect(rightVesting.amount).to.equal(40_000)
		expect(rightVesting.initialAmount).to.equal(40_000)

		// skip time to start date
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate])

		// TODO: test unvesting
	})
	it('should unvest multiple tokens', async () => {
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		const vest = await MarsbaseVesting.deploy(mbase.address)
		await vest.deployed()

		// set transfer fee to 1%
		await vest.setFeeTransfer(0.01 * 1e5)

		const [owner, cto] = await ethers.getSigners()

		// mint 100k tokens to cto
		await mbase.mint(cto.address, 100_000)

		await mbase.connect(cto).approve(vest.address, 100_000)

		let startDate = (await ethers.provider.getBlock("latest")).timestamp + 86400
		let endDate = startDate + 86400 * 100
		// create 100 vesting nfts in a loop
		let tokenIds = []
		for (let i = 0; i < 100; i++)
		{
			let vestTx = await vest.connect(cto)["vest(uint256,uint256,uint256)"](startDate, endDate, 1_000)
			let result = await vestTx.wait()
			let tokenId = result.events?.[0]?.args?.tokenId
			tokenIds.push(tokenId)
		}

		// skip time to start date
		await ethers.provider.send("evm_setNextBlockTimestamp", [startDate + (endDate - startDate) / 2])

		// unvest nft
		let unvestTx = await vest.connect(cto)["unvest(uint256[])"](tokenIds)
		let unvestTxResult = await unvestTx.wait()

		// expect cto to have 50k tokens
		let ctoBalance = await mbase.balanceOf(cto.address)
		expect(ctoBalance).to.equal(50_000)

		// skip time to end date
		await ethers.provider.send("evm_setNextBlockTimestamp", [endDate])

		unvestTx = await vest.connect(cto)["unvest(uint256[])"](tokenIds)
		unvestTxResult = await unvestTx.wait()

		// expect cto to have 100k tokens
		ctoBalance = await mbase.balanceOf(cto.address)
		expect(ctoBalance).to.equal(100_000)
	})
})
