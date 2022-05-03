import * as backend from "./build/index.main.mjs";
import { loadStdlib } from "@reach-sh/stdlib";

const stdlib = loadStdlib(process.env);
const creatorAcc = await stdlib.newTestAccount(stdlib.parseCurrency(100));
const tokenA = await stdlib.launchToken(creatorAcc, "A", "A");
const tokenB = await stdlib.launchToken(creatorAcc, "B", "B");
const tokenLP = await stdlib.launchToken(creatorAcc, "LP", "LP");

export async function deployStandardContract(
  creatorCtc,
  initialState,
  additionalCreatorMethods = {}
) {
  const creatorInteract = {
    getParams: () => initialState,
    deployed: async () => {
      throw ["done", {}];
    },
    ...additionalCreatorMethods,
  };

  try {
    await creatorCtc.p.Creator(creatorInteract);
  } catch (e) {
    if (e[0] !== "done") {
      throw e;
    }
  }
}

export async function deploy(creatorAcc, tokenA, tokenB, lpToken, liquidityPoolContractId) {
  const creatorCtc = creatorAcc.contract(backend);
  await deployStandardContract(
    creatorCtc,
    {
      tokenA: tokenA.id,
      tokenB: tokenB.id,
      lpToken: lpToken.id,
      liquidityPool: liquidityPoolContractId,
    },
    {
      ...stdlib.hasConsoleLogger,
    }
  );

  return creatorCtc;
}

const creatorCtc = await deploy(creatorAcc, tokenA, tokenB, tokenLP, 100);

creatorCtc.p.User({
  deployed: () => {},
  log: (...args) => {
    console.log(args);
  },
});

await creatorCtc.a.addTokens(1000, 1000);
