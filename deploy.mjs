import * as backend from "./build/index.main.mjs"
import * as farm_backend from "./build/index.farm.mjs"
import { BigNumber } from 'ethers'
import { loadStdlib } from "@reach-sh/stdlib";

const stdlib = loadStdlib(process.env)

const parseBigNumber = (bn) => {
  const hex = bn._hex.slice(2);
  return parseInt(hex, 16);
}

async function farm_init(accountsNumber) {
  const creatorAcc = await stdlib.newTestAccount(stdlib.parseCurrency(100))

  const userAccs = await stdlib.newTestAccounts(accountsNumber, stdlib.parseCurrency(10))

  const stakeToken = await stdlib.launchToken(creatorAcc, "Staky", "STAKE")
  const rewardToken = await stdlib.launchToken(creatorAcc, "Rewardy", "REWARD")

  if (stdlib.connector === 'ALGO') {
    for (const acc of userAccs) {
      await acc.tokenAccept(stakeToken.id)
      await acc.tokenAccept(rewardToken.id)
    }
  }

  const initalStakyBalance = BigNumber.from(1000000)
  for (const acc of userAccs) {
    await stdlib.transfer(creatorAcc, acc, initalStakyBalance, stakeToken.id)
  }
  console.log("Farm initialized")

  return {
    creatorAcc,
    userAccs,
    tokens: {
      stakeToken,
      rewardToken,
    },
  }
}


async function farm_deploy(
  creatorAcc,
  userAccs,
  stakeToken,
  rewardToken,
) {
  const creatorCtc = creatorAcc.contract(farm_backend)
  const creatorInteract = {
    getParams: () => ({
      stakeToken: stakeToken.id,
      rewardToken: rewardToken.id,
    }),
    deployed: async () => {
      throw ['done', {}]
    }
  };

  try {
    await creatorCtc.p.Creator(creatorInteract)
  } catch (e) {
    if (e[0] !== 'done') {
      throw e
    }
  }

  const contractId = parseBigNumber(await creatorCtc.getInfo())
  const userCtcs = userAccs.map(acc => acc.contract(farm_backend, contractId))
  return {
    contractId,
    creatorCtc,
    userCtcs,
  }
}

const accountsNumber = 2
const { creatorAcc, userAccs, tokens } = await farm_init(accountsNumber)
const { stakeToken, rewardToken } = tokens

const farmContractId = (await farm_deploy(creatorAcc, userAccs, stakeToken, rewardToken)).contractId
console.log(`The farm is deployed as = ${farmContractId}`);


export async function deploy(
  creatorAcc,
  stakeToken,
  rewardToken,
  underlyingFarmId,
  creatorFee = 1,
  ) {
  const creatorCtc = creatorAcc.contract(backend)
  const creatorInteract = {
    ...stdlib.hasConsoleLogger,
    getParams: () => ({
      stakeToken: parseBigNumber(stakeToken.id),
      rewardToken: parseBigNumber(rewardToken.id),
      underlyingFarmId: underlyingFarmId,
      creatorFee
    }),
    deployed: async () => {
      throw ['done', {}]
    }
  };

  try {
    await creatorCtc.p.Creator(creatorInteract)
  } catch (e) {
    if (e[0] !== 'done') {
      throw e
    }
  }

  const contractId = parseBigNumber(await creatorCtc.getInfo())
  
  return contractId
}

const optimizerContractId = await deploy(creatorAcc, stakeToken, rewardToken, farmContractId)
console.log(`The optimizer is deployed as = ${optimizerContractId}`);

const userCtcs = userAccs.map(acc => acc.contract(backend, optimizerContractId));

async function stake(account, amount) {
  const api = userCtcs[account].a
  return await api.stake(amount)
}

const retval1 = await stake(1, 100)
