'reach 0.1';
'use strict';

export const farm = Reach.App(() => {
  setOptions({
    untrustworthyMaps: true
  });
  const Creator = Participant('Creator', {
    deployed: Fun([], Null),
    getParams: Fun([], Object({
      stakeToken: Token,
      rewardToken: Token,
    })),
  });

  const Api = API({
    stake: Fun([UInt], UInt),
    claim: Fun([], UInt),
  });

  init();

  Creator.only(() => {
    const { stakeToken, rewardToken } = declassify(interact.getParams());
    assume(stakeToken != rewardToken);
  });

  Creator.publish(stakeToken, rewardToken);

  commit();
  Creator.pay([[100, rewardToken], [1000, stakeToken]]);
  Creator.interact.deployed();

  const stakeM = new Map(UInt);
  const stake = (p) => fromSome(stakeM[p], 0);

  const [totalStake] = parallelReduce([0])
    .invariant(true)
    .while(true)
    .paySpec([stakeToken, rewardToken])
    .api(
      Api.stake,
      (_) => { },
      (toStake) => [0, [toStake, stakeToken], [0, rewardToken]],
      (toStake, callback) => {
        stakeM[this] = stake(this) + toStake;
        callback(stake(this));
        return [totalStake + toStake]
      }
    )
    .api(
      Api.claim,
      (callback) => {
        callback(stake(this));
        if (1 <= balance(rewardToken)) {
          transfer([[1, rewardToken]]).to(this);
        }
        return [totalStake]
      }
    )

  commit();
  Anybody.publish();
  transfer([balance(), [balance(rewardToken), rewardToken], [balance(stakeToken), stakeToken]]).to(Creator);
  commit();
});



export const main = Reach.App(() => {
  setOptions({
    untrustworthyMaps: true
  });
  const Common = {
    ...hasConsoleLogger,
    deployed: Fun([], Null),
  };

  const Creator = Participant('Creator', {
    ...Common,
    getParams: Fun([], Object({
      stakeToken: Token,
      rewardToken: Token,
      underlyingFarmId: Contract,
    })),
  });

  const User = Participant('User', {
    ...Common,
  })

  void (User);

  const Api = API({
    stake: Fun([UInt], Null),
  });

  init();

  Creator.only(() => {
    const {
      stakeToken,
      rewardToken,
      underlyingFarmId
    } = declassify(interact.getParams());
    assume(stakeToken != rewardToken);
  });


  Creator.publish(stakeToken, rewardToken, underlyingFarmId);

  each([Creator, User], () => {
    interact.deployed();
  });

  const underlyingFarmCtc = remote(underlyingFarmId, {
    stake: Fun([UInt], UInt),
    claim: Fun([], UInt),
  })

  const [totalStaked] = parallelReduce([0])
    .define(() => {
    })
    .invariant(true)
    .while(true)
    .paySpec([stakeToken, rewardToken])
    .api(
      Api.stake,
      (_) => {
        assume(true)
      },
      (toStake) => [0, [toStake, stakeToken], [0, rewardToken]],
      (toStake, callback) => {
        callback(null);

        /* PROBLEM 1:
.../contracts/node_modules/@reach-sh/stdlib/dist/cjs/shared_impl.js:306 fail(new Error("".concat(bl, " errored with ").concat(err)));

Error: stake errored with Error: invalid BigNumber value (argument="value", value=undefined, code=INVALID_ARGUMENT, version=bignumber/5.6.0)
    at /home/anonymous/github/metafarm-frontend/contracts/node_modules/@reach-sh/stdlib/dist/cjs/shared_impl.js:306:34
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
        */
        const state = underlyingFarmCtc.claim.withBill([rewardToken])();

        /* PROBLEM 2: 
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
        //const state = underlyingFarmCtc.stake.pay([0, [toStake, stakeToken], [0, rewardToken]])(toStake);

        void (state);

        return [
          totalStaked + toStake,
        ];
      }
    )
  commit();

  Anybody.publish();
  transfer([balance(), [balance(rewardToken), rewardToken], [balance(stakeToken), stakeToken]]).to(Creator);
  commit();
});
