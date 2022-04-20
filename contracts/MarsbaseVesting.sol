// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MarsbaseVesting is ERC721Enumerable {
    // address of the ERC20 token that will be vested
    address private _tokenAddress;

    // add constructor param with token address
    constructor(address tokenAddress) ERC721("OTC Marsbase Token", "MBASE") {
        _tokenAddress = tokenAddress;
    }

	// split event description
	event VestingSplit(
		address indexed splitter,
		uint256 indexed oldVestingId,
		uint256 oldAmount,
		uint256 indexed newVestingId,
		uint256 leftAmount,
		uint256 rightAmount
	);

    // vesting record type
    struct VestingRecord {
        uint256 start;
        uint256 end;
        uint256 amount;
		uint256 initialAmount;
    }

    // Mapping from token ID to vesting data
    mapping(uint256 => VestingRecord) private _vestings;

	// function to view VestingRecord by tokenId
	function getVestingRecord(uint256 tokenId) public view returns (VestingRecord memory) {
		return _vestings[tokenId];
	}

    // function to wrap ERC20 tokens into NFT
    function vest(
        uint256 start,
        uint256 end,
        uint256 amount
    ) public returns (uint256) {
		// console.log("vesting", start, end, amount);
        // require enough ERC20 allowance on token with address _tokenAddress
        require(
            IERC20(_tokenAddress).allowance(msg.sender, address(this)) >= amount,
            "not enough tokens"
        );

        // mint token with new id
        uint256 tokenId = this.totalSupply();
        _mint(msg.sender, tokenId);

        // transfer erc20 tokens from msg.sender to this contract address based on amount param
        IERC20(_tokenAddress).transferFrom(msg.sender, address(this), amount);

        // add vesting data to _vestings
        _vestings[tokenId] = VestingRecord(start, end, amount, amount);

        // require(!_vestings[tokenId].start, "Token is already wrapped");
        // _vestings[tokenId].start = block.timestamp;
		return tokenId;
    }

	function safeLerp(uint256 timePassed, uint256 amount, uint256 duration) public pure returns (uint256) {
		if (timePassed >= duration)
			return amount;
		if (timePassed <= 0)
			return 0;

		// TODO: calculate with precision for all types of overflow

		return amount * timePassed / duration;
	}

	function unvest(uint256 tokenId) public returns (uint256) {
		// console.log("unvesting", tokenId);
		// require tokenId to exist and be owned by msg.sender
		require(this.ownerOf(tokenId) == msg.sender, "Token is not owned by you");

		// get tokenId vesting data
		VestingRecord memory vesting = _vestings[tokenId];

		console.log("current vesting value", vesting.start, vesting.end, vesting.amount);

		// get current timestamp
		uint256 timestamp = block.timestamp;

		// require vesting to have started based on current timestamp
		require(vesting.start <= timestamp, "Vesting has not started");

		// calculate vesting duration
		uint256 duration = vesting.end - vesting.start;

		// calculate time passed since vesting start based on current timestamp
		uint256 timePassed = timestamp - vesting.start;

		// calculate amount of tokens to be transferred back to msg.sender
		uint256 amount = safeLerp(timePassed, vesting.amount, duration);

		// require amount to be greater than 0
		require(amount > 0, "No tokens to unvest");

		// if amount is greater than vesting amount, set amount to vesting amount
		if (amount > vesting.amount) {
			amount = vesting.amount;
		}

		// calculate remaining tokens
		uint256 remaining = vesting.amount - amount;

		// if remaining tokens are 0, burn token and remove vesting data
		if (remaining == 0) {
			delete _vestings[tokenId];
			_burn(tokenId);
		} else {
			// otherwise, update vesting data
			_vestings[tokenId].amount = remaining;
			_vestings[tokenId].start = timestamp;
		}
		
		// transfer tokens back to msg.sender
		IERC20(_tokenAddress).transfer(msg.sender, amount);

		return amount;
	}
	function split(uint256 tokenId, uint256 leftAmount, uint256 rightAmount) public returns (uint256) {
		// console.log("splitting", tokenId, leftAmount, rightAmount);
		// require tokenId to exist and be owned by msg.sender
		require(this.ownerOf(tokenId) == msg.sender, "Token is not owned by you");

		// get tokenId vesting data
		VestingRecord memory vesting = _vestings[tokenId];

		// require amounts to be gt 0
		require(leftAmount > 0, "Left amount must be gt 0");
		require(rightAmount > 0, "Right amount must be gt 0");

		// require vesting amount to be equal to left+right
		require(vesting.amount == leftAmount + rightAmount, "Amounts do not add up");

		// create new nft
		uint256 newTokenId = this.totalSupply();
		_mint(msg.sender, newTokenId);

		// set new tokenId vesting data
		_vestings[newTokenId] = VestingRecord(vesting.start, vesting.end, rightAmount, rightAmount);

		// update old nft with left amount
		_vestings[tokenId].amount = leftAmount;
		_vestings[tokenId].initialAmount = leftAmount;

		// fire event
		emit VestingSplit(msg.sender, tokenId, vesting.amount, newTokenId, leftAmount, rightAmount);

		return newTokenId;
	}
}
