// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "hardhat/console.sol";

import "./MarsbaseVesting.sol";

contract LightSpeedPool is MarsbaseVesting {

	// staking event
	event Staking(
		address indexed staker,
		uint256 indexed amount,
		uint256 indexed vestingId
	);

	// staking data record
	struct StakingData {
		uint256 stakingStart;
		uint256 lastUnstake;
		uint256 stakingAmount;
		// uint256 vestingStart;
		// uint256 vestingEnd;
	}

	// mapping from tokenId to staking data
	mapping (uint256 => StakingData) private _stakingDatas;

	// function to check if data is staked for given tokenId
	function isStaked(uint256 tokenId) public view returns (bool) {
		return _stakingDatas[tokenId].stakingAmount > 0;
	}

	// call constructor
	constructor(address tokenAddress) MarsbaseVesting(tokenAddress) {
	}

	// function to stake nft with mbase tokens
	function stake(uint256 tokenId, uint256 mbaseAmount) public {

		// require that staking data with this tokenId doesn't exist
		require(!isStaked(tokenId), "Token already staked");

		// unvest nft
		unvest(tokenId);

		// transfer nft to this contract (will fail if not owner)
		_transfer(msg.sender, address(this), tokenId);

		// transfer mbase tokens to the contract (will fail if not enough allowance)
		IERC20(_tokenAddress).transferFrom(msg.sender, address(this), mbaseAmount);

		uint256 timestamp = block.timestamp;

		// create staking data for given tokenId
		_stakingDatas[tokenId] = StakingData(
			timestamp,
			timestamp,
			mbaseAmount
		);

		// emit event
		emit Staking(msg.sender, mbaseAmount, tokenId);
	}

	// variable to store staking cliff
	uint256 _stakingCliff = 86400 * 30; // 30 days

	// getter
	function getStakingCliff() public view returns (uint256) {
		return _stakingCliff;
	}
	// setter
	function setStakingCliff(uint256 newStakingCliff) public onlyOwner {
		_stakingCliff = newStakingCliff;
	}

	// variable to store staking coefficient
	uint256 internal _stakingKoef = 1 * 1e5;
	// getter
	function getStakingKoef() public view returns (uint256) {
		return _stakingKoef;
	}
	// setter (contract owner only)
	function setStakingKoef(uint256 newStakingKoef) public onlyOwner {
		_stakingKoef = newStakingKoef;
	}

	function calculateSpeedPure(uint256 baseAmount, uint256 stakedAmount, uint256 precisionAbsolute) public pure returns (uint256) {
		return (stakedAmount * precisionAbsolute) / baseAmount;
	}
	function withStakingKoef(uint256 amount) public view returns (uint256) {
		if (_stakingKoef == 1e5) {
			return amount;
		}
		return amount * _stakingKoef / 1e5;
	}

	// override unvest function
	function unvest(uint256 tokenId) public override returns (uint256) {
		// return base class override if not staked
		if (!isStaked(tokenId)) {
			return super.unvest(tokenId);
		}

		uint256 timestamp = block.timestamp;

		uint256 stakingBonusStart = _stakingDatas[tokenId].stakingStart + _stakingCliff;
		require(stakingBonusStart > block.timestamp, "staking cliff");

		// calculate amount to speed up from last unvest

		// get vested data
		VestingRecord memory vesting = _vestings[tokenId];

		uint256 amountToUnvestNormally = calculateUnvestAmount(vesting.start, vesting.end, vesting.amount, timestamp);
		uint256 amountAfterUnvest = vesting.amount - amountToUnvestNormally;

		if (amountAfterUnvest <= 0) {
			return unstake(tokenId);
		}

		uint256 stakingAmount = _stakingDatas[tokenId].stakingAmount;
		uint256 timePassed = timestamp - _stakingDatas[tokenId].lastUnstake;
		uint256 timeSpeedUp = calculateSpeedUp(vesting.amount, amountAfterUnvest, withStakingKoef(stakingAmount), timePassed);

		// update vesting end date based on time speed up
		uint256 newEnd = vesting.end - timeSpeedUp;
		_vestings[tokenId].end = newEnd;
		_stakingDatas[tokenId].lastUnstake = timestamp;

		if (newEnd <= timestamp)
		{
			return unstake(tokenId);
		}

		return _unvest(tokenId, msg.sender, timestamp);
	}
	function calculateSpeedUp(
		uint256 vestingAmountStart,
		uint256 vestingAmountEnd,
		uint256 stakingAmount,
		uint256 timePassed
	) public pure returns (uint256) {
		uint256 speed1e10start = calculateSpeedPure(
			vestingAmountStart,
			stakingAmount,
			1e10
		);
		uint256 speed1e10end = calculateSpeedPure(
			vestingAmountEnd,
			stakingAmount,
			1e10
		);
		uint256 averageSpeed1e10 = (speed1e10start + speed1e10end) / 2;
		uint256 timeSpeedUp = timePassed * averageSpeed1e10 / 1e10;
		return timeSpeedUp;
	}

	// function to unstake nft with mbase tokens
	function unstake(uint256 tokenId) public returns (uint256) {
	}
}