// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MarsbaseVesting is ERC721Enumerable {
    // address of the ERC20 token that will be vested
    address internal _tokenAddress;

	// contract owner
	address internal _owner;
	
	// change owner setter
	modifier onlyOwner {
		require(msg.sender == _owner, "Only owner");
		_;
	}

	// owner getter
	function getOwner() public view returns(address) {
		return _owner;
	}
	// owner setter
	function setOwner(address newOwner) public onlyOwner {
		_owner = newOwner;
	}


    // add constructor param with token address
    constructor(address tokenAddress) ERC721("OTC Marsbase Vested Token", "vMBASE") {
        _tokenAddress = tokenAddress;
		_owner = msg.sender;
    }

	// split event description
	event VestingSplit(
		address indexed splitter,
		uint256 indexed oldVestingId,
		uint256 oldAmount,
		uint256 indexed newVestingId,
		uint256 leftAmount,
		uint256 rightAmount,
		uint256 fee
	);
	
    // vesting record type
    struct VestingRecord {
        uint256 start;
        uint256 end;
        uint256 amount;
		uint256 initialAmount;
		uint256 initialStart;
    }

    // Mapping from token ID to vesting data
    mapping(uint256 => VestingRecord) internal _vestings;

	// splitting fee variable (multiplied by 1e5 to achieve 5 digits precision)
	uint256 private _feeSplit = 0;

	// fee getter
	function getFeeSplit() public view returns (uint256) {
		return _feeSplit;
	}
	// fee setter for owner only
	function setFeeSplit(uint256 newFee) public onlyOwner {
		_feeSplit = newFee;
	}

	// transfer fee variable (multiplied by 1e5 to achieve 5 digits precision)
	uint256 private _feeTransfer = 0;

	// fee getter
	function getFeeTransfer() public view returns (uint256) {
		return _feeTransfer;
	}
	// fee setter for owner only
	function setFeeTransfer(uint256 newFee) public onlyOwner {
		_feeTransfer = newFee;
	}

	// function to calculate the fee for a given amount and return both fee and rest amount
	function calculateFee(uint256 amount, uint256 _fee) public pure returns (uint256 fee, uint256 rest) {
		fee = amount * _fee / 1e5;
		rest = amount - fee;
		return (fee, rest);
	}

	// function to view VestingRecord by tokenId
	function getVestingRecord(uint256 tokenId) public view returns (VestingRecord memory) {
		return _vestings[tokenId];
	}
	function getVestingsByOwner(address owner) public view returns (uint256[] memory) {
		// get amount of tokens for the owner
		uint256 tokensCount = balanceOf(owner);
		uint256[] memory result = new uint256[](tokensCount);
		uint256 i = 0;
		uint256 vestingsCount = totalSupply();
		for (uint256 tokenId = 0; tokenId < vestingsCount; tokenId++)
		{
			if (ownerOf(tokenId) == owner)
			{
				result[i++] = tokenId;
			}
		}
		return result;
	}

	function _transfer(address _from, address _to, uint256 _tokenId) internal override {
		// call parent transfer function
		super._transfer(_from, _to, _tokenId);
		// return if fee is zero
		if (_feeTransfer == 0) {
			return;
		}
		// return if transferring to/from contract
		if (_to == address(this) || _from == address(this)) {
			return;
		}
		// calculate transfer fee
		(, uint256 rest) = calculateFee(_vestings[_tokenId].amount, _feeTransfer);
		// require rest to be greater than 0
		require(rest > 0, "not enough tokens");
		// subtract fee from vesting amount
		_vestings[_tokenId].amount = rest;
	}

	function vest(
        uint256 start,
        uint256 end,
        uint256 amount
    ) public returns (uint256) {
		// vest for msg.sender
		return vest(start, end, amount, msg.sender);
	}

    // function to wrap ERC20 tokens into NFT
    function vest(
        uint256 start,
        uint256 end,
        uint256 amount,
		address receiver
    ) public returns (uint256) {
		// console.log("vesting", start, end, amount);
        // require enough ERC20 allowance on token with address _tokenAddress
        require(
            IERC20(_tokenAddress).allowance(msg.sender, address(this)) >= amount,
            "not enough tokens"
        );

        // mint token with new id
        uint256 tokenId = this.totalSupply();
        _mint(receiver, tokenId);

        // transfer erc20 tokens from msg.sender to this contract address based on amount param
        IERC20(_tokenAddress).transferFrom(msg.sender, address(this), amount);

		uint256 timestamp = block.timestamp;
		// require start&end dates to not be more than 100 years into the future
		require(start <= timestamp + 100 * 365 * 86400, "start date is too far");
		require(end <= timestamp + 100 * 365 * 86400, "end date is too far");

        // add vesting data to _vestings
        _vestings[tokenId] = VestingRecord(start, end, amount, amount, start);

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

	function unvest(uint256 tokenId) public virtual returns (uint256) {
		// console.log("unvesting", tokenId);
		// require tokenId to exist and be owned by msg.sender
		require(this.ownerOf(tokenId) == msg.sender, "Token is not owned by you");

		// get current timestamp
		uint256 timestamp = block.timestamp;

		return _unvest(tokenId, msg.sender, timestamp);
	}
	function calculateUnvestAmount(uint256 vestingStart, uint256 vestingEnd, uint256 vestingAmount, uint256 timestamp) public pure returns (uint256) {
		// calculate vesting duration
		uint256 duration = vestingEnd - vestingStart;

		// calculate time passed since vesting start based on current timestamp
		uint256 timePassed = timestamp - vestingStart;

		// calculate amount of tokens to be transferred back to msg.sender
		uint256 amount = safeLerp(timePassed, vestingAmount, duration);
		return amount;
	}
	
	function _unvest(uint256 tokenId, address beneficiary, uint256 timestamp) internal returns (uint256) {
		// get tokenId vesting data
		VestingRecord memory vesting = _vestings[tokenId];

		// require vesting amount to be gt 0
		require(vesting.amount > 0, "Token is not vested");

		// console.log("current vesting value", vesting.start, vesting.end, vesting.amount);

		// require vesting to have started based on current timestamp
		require(vesting.start <= timestamp, "Vesting has not started");

		// calculate amount of tokens to be transferred back to msg.sender
		uint256 amount = calculateUnvestAmount(vesting.start, vesting.end, vesting.amount, timestamp);

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
		IERC20(_tokenAddress).transfer(beneficiary, amount);

		return amount;
	}

	// unvest function for multiple token ids
	function unvest(uint256[] memory tokenIds) public returns (uint256) {
		// get length of tokenIds array
		uint256 length = tokenIds.length;

		// loop over all tokenIds
		uint256 total = 0;
		for (uint256 i = 0; i < length; i++) {
			// unvest tokenId
			total += unvest(tokenIds[i]);
		}
		return total;
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

		// calculate fee and rest amount
		uint256 fee = 0;
		if (_feeSplit > 0)
		{
			(fee,) = calculateFee(vesting.amount, _feeSplit);

			// require left amount to be gt fee
			require(leftAmount > fee, "Left amount must be gt fee");

			// subtract fee from left amount
			leftAmount -= fee;
		}

		// create new nft
		uint256 newTokenId = this.totalSupply();
		_mint(msg.sender, newTokenId);

		// set new tokenId vesting data
		_vestings[newTokenId] = VestingRecord(vesting.start, vesting.end, rightAmount, rightAmount, vesting.start);

		// update old nft with left amount
		_vestings[tokenId].amount = leftAmount;
		_vestings[tokenId].initialAmount = leftAmount;

		// fire event
		emit VestingSplit(msg.sender, tokenId, vesting.amount, newTokenId, leftAmount, rightAmount, fee);

		return newTokenId;
	}
}
