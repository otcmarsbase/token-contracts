// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat"

async function main()
{
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile')

	const [deployer] = await ethers.getSigners()

	console.log("Deploying USDT with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())
	
	// deploy erc20 token
	const USDT = await ethers.getContractFactory("TetherToken")
	const usdt = await USDT.deploy(ethers.BigNumber.from("100000000000"), "Tether USD", "USDT", 6)
	await usdt.deployed()
	console.log("USDT deployed to:", usdt.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) =>
{
	console.error(error)
	process.exitCode = 1
})
