import * as rt from "runtypes"
import { task } from "hardhat/config"
import { init } from "./utils-deploy"

task("deploy-all", "Deploys MarsbaseToken and MarsbaseVesting contracts").setAction(async (params, hre) =>
{
	return init(hre).tasks.deployAll()
})

task("deploy-token", "Deploys MarsbaseToken").setAction(async (params, hre) =>
{
	return init(hre).tasks.deployToken()
})
task("deploy-vesting", "Deploys MarsbaseVesting").addParam("token").setAction(async (params, hre) =>
{
	let validator = rt.Record({
		token: rt.String
	})
	let { token } = validator.check(params)
	
	return init(hre).tasks.deployVesting(token)
})
