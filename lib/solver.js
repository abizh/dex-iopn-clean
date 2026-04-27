/* =========================================================
   ROUTE OPTIMIZER ENGINE (CONSISTENT MASTER VERSION)
========================================================= */

const pools = [
  {
    id: "OPN/WOPN",
    token0: "OPN",
    token1: "WOPN",
    reserve0: 5000,
    reserve1: 5000,
    fee: 0.003
  },
  {
    id: "WOPN/OPNT",
    token0: "WOPN",
    token1: "OPNT",
    reserve0: 5000,
    reserve1: 6000,
    fee: 0.003
  },
  {
    id: "OPN/OPNT",
    token0: "OPN",
    token1: "OPNT",
    reserve0: 1000,
    reserve1: 200,
    fee: 0.003
  },
  {
    id: "OPN/tBNB",
    token0: "OPN",
    token1: "tBNB",
    reserve0: 4000,
    reserve1: 3000,
    fee: 0.003
  },
  {
    id: "tBNB/OPNT",
    token0: "tBNB",
    token1: "OPNT",
    reserve0: 3000,
    reserve1: 3500,
    fee: 0.003
  }
];

/* ================= GRAPH ================= */

function getNeighbors(token) {
  return pools.filter(
    p => p.token0 === token || p.token1 === token
  );
}

/* ================= AMM ================= */

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 0.997;
  return (amountInWithFee * reserveOut) /
         (reserveIn + amountInWithFee);
}

/* ================= DFS ROUTE SEARCH ================= */

function findRoutes(start, end, maxHops = 3) {
  const routes = [];

  function dfs(current, path, visited) {
    if (path.length > maxHops) return;

    if (current === end) {
      routes.push([...path]);
      return;
    }

    const neighbors = getNeighbors(current);

    for (const pool of neighbors) {
      const next =
        pool.token0 === current ? pool.token1 : pool.token0;

      if (visited.has(next)) continue;

      visited.add(next);
      path.push(pool);

      dfs(next, path, visited);

      path.pop();
      visited.delete(next);
    }
  }

  dfs(start, [], new Set([start]));
  return routes;
}

/* ================= SIMULATION ================= */

function simulate(route, amountIn) {
  let amount = amountIn;

  for (const pool of route) {
    const isToken0 = pool.token0 === route[0].token0 || pool.token0 === route[0].token1;

    const reserveIn = isToken0 ? pool.reserve0 : pool.reserve1;
    const reserveOut = isToken0 ? pool.reserve1 : pool.reserve0;

    amount = getAmountOut(amount, reserveIn, reserveOut);
  }

  return amount;
}

/* ================= SCORING ================= */

function scoreRoute(route, output) {
  const hopPenalty = route.length * 0.02;
  return output * (1 - hopPenalty);
}

/* ================= MAIN SOLVER ================= */

export function solveRoute(tokenIn, tokenOut, amount) {
  const routes = findRoutes(tokenIn, tokenOut);

  let best = null;

  for (const route of routes) {
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
