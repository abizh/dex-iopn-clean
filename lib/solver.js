/* =========================================================
   ROUTE OPTIMIZER ENGINE (FIXED + CONSISTENT)
========================================================= */

const pools = [
  { id: "OPN/WOPN", token0: "OPN", token1: "WOPN", reserve0: 5000, reserve1: 5000 },
  { id: "WOPN/OPNT", token0: "WOPN", token1: "OPNT", reserve0: 5000, reserve1: 6000 },
  { id: "OPN/OPNT", token0: "OPN", token1: "OPNT", reserve0: 1000, reserve1: 200 },
  { id: "OPN/tBNB", token0: "OPN", token1: "tBNB", reserve0: 4000, reserve1: 3000 },
  { id: "tBNB/OPNT", token0: "tBNB", token1: "OPNT", reserve0: 3000, reserve1: 3500 }
];

/* ================= AMM ================= */

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 0.997;
  return (amountInWithFee * reserveOut) /
         (reserveIn + amountInWithFee);
}

/* ================= DFS ROUTE SEARCH ================= */

function findRoutes(start, end, maxHops = 3) {
  const results = [];

  function dfs(currentToken, targetToken, path, visitedTokens) {
    if (path.length > maxHops) return;

    if (currentToken === targetToken) {
      results.push([...path]);
      return;
    }

    for (const pool of pools) {
      let nextToken = null;

      if (pool.token0 === currentToken) nextToken = pool.token1;
      else if (pool.token1 === currentToken) nextToken = pool.token0;

      if (!nextToken) continue;
      if (visitedTokens.has(nextToken)) continue;

      visitedTokens.add(nextToken);
      path.push({
        poolId: pool.id,
        tokenIn: currentToken,
        tokenOut: nextToken,
        pool
      });

      dfs(nextToken, targetToken, path, visitedTokens);

      path.pop();
      visitedTokens.delete(nextToken);
    }
  }

  dfs(start, end, [], new Set([start]));
  return results;
}

/* ================= SIMULATION (FIXED CORE) ================= */

function simulate(route, amountIn) {
  let amount = amountIn;

  for (const step of route) {
    const { pool, tokenIn } = step;

    let reserveIn, reserveOut;

    if (pool.token0 === tokenIn) {
      reserveIn = pool.reserve0;
      reserveOut = pool.reserve1;
    } else {
      reserveIn = pool.reserve1;
      reserveOut = pool.reserve0;
    }

    amount = getAmountOut(amount, reserveIn, reserveOut);
  }

  return amount;
}

/* ================= SCORING ================= */

function scoreRoute(route, output) {
  const hopPenalty = route.length * 0.02;
  return output * (1 - hopPenalty);
}

/* ================= MAIN ================= */

export function solveRoute(tokenIn, tokenOut, amount) {
  const routes = findRoutes(tokenIn, tokenOut);

  let best = null;

  for (const route of routes) {
    if (route.length === 0) continue;

    const out = simulate(route, amount);
    const score = scoreRoute(route, out);

    if (!best || score > best.score) {
      best = {
        route,
        expectedOut: out,
        score
      };
    }
  }

  return best;
}
