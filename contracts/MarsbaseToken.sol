// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MarsbaseToken is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("OTC Marsbase Token", "MBASE") {

	}
}