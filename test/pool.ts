import { expect } from "chai"
import { ethers } from "hardhat"

describe("Pool", () =>
{
	it("should deploy a pool contract", async () =>
	{
		const Mbase = await ethers.getContractFactory("MarsbaseToken")
		const mbase = await Mbase.deploy()
		await mbase.deployed()

		const LightSpeedPool = await ethers.getContractFactory("LightSpeedPool")
		const lspool = await LightSpeedPool.deploy(mbase.address)
	})
	// function to calculate increased vesting based on vesting start, vesting end, staking start, last unstake date
	let vesting = {
        start: 0,
        end: 12,
        amount: 1_000_000,

		initialStart: 0,
		initialEnd: 12,
		initialAmount: 1_000_000,
	}
	let staking = {
		started: 0,
		amountStaked: 1_000_000,

		lastUnstake: 0,
	}
	const amountToUnvest = (v: typeof vesting, timestamp: number) => {
		if (timestamp <= v.start) {
			return 0
		}
		if (timestamp >= v.end) {
			return v.amount
		}
		let timePassed = timestamp - v.start
		let duration = v.end - v.start
		let progress = timePassed / duration
		let amount = v.amount * progress
		return amount
	}
	const fantasyTimePassed = (calcStartDate: number, timestamp: number, speed: number) => (timestamp - calcStartDate) * speed
})

type NFT = {
	start: number
	end: number
	amount: number
}
type Staking = {
	amount: number
	koef: number
}

/**
 * Calculates unvest end date based on nft params and staking params
 * @param nft 
 * @param staking 
 * @return (timestamp) unvest end date based on speedup
 */
function unvestEndDate(nft: NFT, staking: Staking): number
{
	// calculate speed at the start
	let speed = speedKoef(nft, staking, nft.start)
	return NaN
}
function unvestReward(nft: NFT, staking: Staking, date: number): number
{
	return NaN
}
function speedKoef(nft: NFT, staking: Staking, date: number): number
{
	return NaN
}
function unvestDateAfterSpeedup(nft: NFT, staking: Staking, date: number): number
{
	return NaN
}
function requiredStakingAmount(nft: NFT, stakingKoef: number, date: number): number
{
	return NaN
}
