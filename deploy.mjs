import * as farm_backend from "./build/index.farm.mjs";
import * as wrapper_backend from "./build/index.main.mjs";
import { loadStdlib } from "@reach-sh/stdlib";

const stdlib = loadStdlib(process.env);

const parseBigNumber = (bn) => {
  const hex = bn._hex.slice(2);
  return parseInt(hex, 16);
};

async function init() {
  const creatorAcc = await stdlib.newTestAccount(stdlib.parseCurrency(100));
  const userAccs = await stdlib.newTestAccounts(2, stdlib.parseCurrency(10));

  const stakeToken = await stdlib.launchToken(creatorAcc, "Staky", "STAKE");
  const rewardToken = await stdlib.launchToken(creatorAcc, "Rewardy", "REWARD");

  if (stdlib.connector === "ALGO") {
    for (const acc of userAccs) {
      await acc.tokenAccept(stakeToken.id);
      await acc.tokenAccept(rewardToken.id);
    }
  }

  const initalStakyBalance = 1000000;
  for (const acc of userAccs) {
    await stdlib.transfer(creatorAcc, acc, initalStakyBalance, stakeToken.id);
  }
  console.log("Farm initialized");

  return {
    creatorAcc,
    userAccs,
    tokens: {
      stakeToken,
      rewardToken,
    },
  };
}

async function farm_deploy(creatorAcc, stakeToken, rewardToken) {
  const creatorCtc = creatorAcc.contract(farm_backend);
  const creatorInteract = {
    getParams: () => ({
      stakeToken: stakeToken.id,
      rewardToken: rewardToken.id,
    }),
    deployed: async () => {
      throw ["done", {}];
    },
  };

  try {
    await creatorCtc.p.Creator(creatorInteract);
  } catch (e) {
    if (e[0] !== "done") {
      throw e;
    }
  }

  const contractId = parseBigNumber(await creatorCtc.getInfo());
  return contractId;
}

export async function deploy(
  creatorAcc,
  stakeToken,
  rewardToken,
  underlyingFarmId,
  creatorFee = 1
) {
  const creatorCtc = creatorAcc.contract(wrapper_backend);
  const creatorInteract = {
    ...stdlib.hasConsoleLogger,
    getParams: () => ({
      stakeToken: parseBigNumber(stakeToken.id),
      rewardToken: parseBigNumber(rewardToken.id),
      underlyingFarmId: underlyingFarmId,
      creatorFee,
    }),
    deployed: async () => {
      throw ["done", {}];
    },
  };

  try {
    await creatorCtc.p.Creator(creatorInteract);
  } catch (e) {
    if (e[0] !== "done") {
      throw e;
    }
  }

  const contractId = parseBigNumber(await creatorCtc.getInfo());
  return contractId;
}

const { creatorAcc, userAccs, tokens } = await init();
const { stakeToken, rewardToken } = tokens;

const farmContractId = await farm_deploy(creatorAcc, stakeToken, rewardToken);
console.log(`The farm is deployed as = ${farmContractId}`);

const wrapperContractId = await deploy(
  creatorAcc,
  stakeToken,
  rewardToken,
  farmContractId
);
console.log(`The optimizer is deployed as = ${wrapperContractId}`);

const farmUserCtcs = userAccs.map((acc) =>
  acc.contract(farm_backend, farmContractId)
);
const wrapperUserCtcs = userAccs.map((acc) =>
  acc.contract(wrapper_backend, wrapperContractId)
);

async function stakeDirectly(account, amount) {
  const api = farmUserCtcs[account].a;
  return await api.stake(amount);
}

async function stakeThroughWrapper(account, amount) {
  const api = wrapperUserCtcs[account].a;
  return await api.stake(amount);
}


// Works fine
await stakeDirectly(1, 100);
/*
Error: stake errored with Error: API call failed: {
  "type": "signAndPost",
  "e": {
    "status": 400,
    "response": {
      "message": "TransactionPool.Remember: transaction NNZUB5MMONS3DAROFVE62IBPSDJI7S2KN73YTUYVUEIPBPQOAWGA: logic eval error: itxn_begin without itxn_submit. Details: pc=265, opcodes=load 255\nitxn_field XferAsset\nitxn_begin\n"
    }
  },
  "es": "Error: Network request error. Received status 400: TransactionPool.Remember: transaction NNZUB5MMONS3DAROFVE62IBPSDJI7S2KN73YTUYVUEIPBPQOAWGA: logic eval error: itxn_begin without itxn_submit. Details: pc=265, opcodes=load 255\nitxn_field XferAsset\nitxn_begin\n"
}
    at .../contracts/node_modules/@reach-sh/stdlib/dist/cjs/shared_impl.js:306:34
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
*/
await stakeThroughWrapper(1, 100);
