#!/bin/bash
yarn hardhat verify --network rinkeby --contract contracts/MarsbaseToken.sol:MarsbaseToken $(cat ./info/rinkeby/latest/token.address)
