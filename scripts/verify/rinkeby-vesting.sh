#!/bin/bash
yarn hardhat verify --network rinkeby $(cat ./info/rinkeby/latest/vesting.address) "$(cat ./info/rinkeby/latest/token.address)"
