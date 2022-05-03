"reach 0.1";

const InitialStateObj = {
  tokenA: Token,
  tokenB: Token,
  lpToken: Token,
  liquidityPool: Contract,
};

export const main = Reach.App(() => {
  const Common = {
    ...hasConsoleLogger,
    deployed: Fun([], Null),
  };

  const Creator = Participant("Creator", {
    ...Common,
    getParams: Fun(
      [],
      Object({
        ...InitialStateObj,
      })
    ),
    optIn: Fun([Token, Token], Bool),
  });

  const User = Participant("User", {
    ...Common,
  });

  void User;

  const Api = API({
    addTokens: Fun([UInt, UInt], Null),
  });

  init();

  Creator.only(() => {
    const { tokenA, tokenB, lpToken, liquidityPool } = declassify(interact.getParams());

    assume(distinct(tokenA, tokenB, lpToken));
  });

  Creator.publish(tokenA, tokenB, lpToken, liquidityPool);

  const liquidityPoolCtc = remote(liquidityPool, {
    addLiquidity: Fun([UInt], Null),
    getLpPrice: Fun([], Tuple(UInt, UInt)),
  });

  each([Creator, User], () => {
    interact.deployed();
  });

  const [] = parallelReduce([])
    .invariant(true)
    .while(true)
    .paySpec([tokenA, tokenB])
    .api(
      Api.addTokens,
      (deltaA, deltaB) => {
      },
      (deltaA, deltaB) => [0, [deltaA, tokenA], [deltaB, tokenB]],
      (deltaA, deltaB, callback) => {
        callback(null);
        
        const [aPerLp, bPerLp] = liquidityPoolCtc.getLpPrice();
        if (balance(tokenA) != 0 && balance(tokenB) != 0) {
          const aToEqualB = (balance(tokenB) * aPerLp) / bPerLp;

          const aToPay = aToEqualB < balance(tokenA) ? aToEqualB : balance(tokenA);

          User.interact.log(["aToPay, balance(a)", aToPay, balance(tokenA)]);
          const rv = liquidityPoolCtc.addLiquidity
            // TODO bug
            .pay([0, [aToPay, tokenA], [0, tokenB], [0, lpToken]])
            .withBill([lpToken])(balance(tokenA));
        }

        return [];
      }
    );

  commit();
});
