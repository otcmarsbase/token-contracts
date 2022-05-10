// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat"

import fs from "fs"
import path from "path"

import { askQuestion, cleanupDir, copyRecursive, dateSlugShort, inspect, mkdirp, unixtimestamp } from "./utils"

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

async function main()
{
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile')

	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	mkdirp(NOW_DIR)

	write("deployer.address", deployer.address)
	
	// deploy erc20 token
	const MarsbaseToken = await ethers.getContractFactory("MarsbaseToken")
	const mbase = await MarsbaseToken.deploy()
	await mbase.deployed()
	console.log("Marsbase Token deployed to:", mbase.address)
	write("token.address", mbase.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	// deploy vesting (no pool)
	const MarsbaseVesting = await ethers.getContractFactory("MarsbaseVesting")
	// const vmbaseTx = MarsbaseVesting.getDeployTransaction(mbase.address)
	// let vtx = await MarsbaseVesting.connect(ethers.provider.getUncheckedSigner(deployer.address)).deploy(mbase.address)
	// ethers.provider.getUncheckedSigner(deployer.address).populateTransaction(vmbaseTx)
	const vmbase = await MarsbaseVesting.deploy(mbase.address)
	await vmbase.deployed()
	console.log("Marsbase Vesting deployed to:", vmbase.address)
	write("vesting.address", vmbase.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	// deploy LightSpeed pool
	// const LightSpeedPool = await ethers.getContractFactory("LightSpeedPool")
	// const lspool = await LightSpeedPool.deploy(mbase.address)
	// await lspool.deployed()
	// console.log("LightSpeedPool deployed to:", lspool.address)
	// write("pool.address", lspool.address)

	rewriteLatestDir()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) =>
{
	console.error(error)
	process.exitCode = 1
})
