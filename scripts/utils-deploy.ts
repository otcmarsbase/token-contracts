import type { ethers as Ethers, network as Network } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"

import fs from "fs"
import path from "path"

import { askQuestion, cleanupDir, copyRecursive, dateSlugShort, inspect, mkdirp, unixtimestamp } from "./utils"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

export const init = (hre: HardhatRuntimeEnvironment) =>
	_init(hre.network, hre.ethers)

export function _init(network: typeof Network, ethers: typeof Ethers)
{
	const LATEST_DIR = `info/${network.name}/latest`
	const NOW_DIR = `info/${network.name}/${unixtimestamp()}-${dateSlugShort()}`

	function rewriteLatestDir()
	{
		cleanupDir(LATEST_DIR)

		copyRecursive(NOW_DIR, LATEST_DIR)
	}
	function write(file: string, data: string)
	{
		let src = path.join(NOW_DIR, file)
		fs.writeFileSync(src, data)
	}
	function append(file: string, data: string)
	{
		mkdirp(NOW_DIR)
		let src = path.join(NOW_DIR, file)
		fs.appendFileSync(src, data + "\n")
	}

	let log = console.log
	console.log = function(...args)
	{
		log.call(this, ...args)
		append("log.txt", args.map(x => inspect(x)).join(" "))
	}

	async function deployMarsbaseToken()
	{
		// deploy erc20 token
		const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
		const mbase = await MarsbaseToken.deploy()
		await mbase.deployed()
		console.log("Marsbase Token deployed to:", mbase.address)
		write("token.address", mbase.address)

		return mbase
	}
	async function deployMarsbaseVesting(mbaseAddress: string)
	{
		// deploy vesting (no pool)
		const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
		// const vmbaseTx = MarsbaseVesting.getDeployTransaction(mbase.address)
		// let vtx = await MarsbaseVesting.connect(ethers.provider.getUncheckedSigner(deployer.address)).deploy(mbase.address)
		// ethers.provider.getUncheckedSigner(deployer.address).populateTransaction(vmbaseTx)
		const vmbase = await MarsbaseVesting.deploy(mbaseAddress)
		await vmbase.deployed()
		console.log("Marsbase Vesting deployed to:", vmbase.address)
		write("vesting.address", vmbase.address)

		return vmbase
	}

	const printBalance = async (deployer: SignerWithAddress) =>
		console.log("Account balance:", (await deployer.getBalance()).toString())

	async function prepareDeployment(deployTargetName: string)
	{
		const [deployer] = await ethers.getSigners()

		console.log(`Deploying ${deployTargetName} with the account:`, deployer.address)

		printBalance(deployer)

		mkdirp(NOW_DIR)

		write("deployer.address", deployer.address)

		return deployer
	}
	return {
		rewriteLatestDir,
		deployMarsbaseToken,
		deployMarsbaseVesting,
		printBalance,
		prepareDeployment,

		tasks: {
			deployAll: async () =>
			{
				const deployer = await prepareDeployment(`both contracts`)
				
				let mbase = await deployMarsbaseToken()

				printBalance(deployer)

				let vmbase = await deployMarsbaseVesting(mbase.address)

				printBalance(deployer)

				rewriteLatestDir()
			},
			deployToken: async () =>
			{
				const deployer = await prepareDeployment(`MarsbaseToken contract`)
				
				let mbase = await deployMarsbaseToken()

				printBalance(deployer)

				rewriteLatestDir()
			},
			deployVesting: async (tokenAddress: string) =>
			{
				const deployer = await prepareDeployment(`MarsbaseVesting contract`)
				
				write("token.address", tokenAddress)
				let vmbase = await deployMarsbaseVesting(tokenAddress)

				printBalance(deployer)

				rewriteLatestDir()
			},
		}
	}
}
