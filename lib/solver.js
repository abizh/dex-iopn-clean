// =========================================================
// ROUTE SOLVER (DUMMY LIQUIDITY, PRODUCTION-STYLE CORE)
// =========================================================

/**
 * Pool:
 * { id, token0, token1, reserve0, reserve1, fee }
 */

function getAmountOut(amountIn, reserveIn, reserveOut, fee) {
  const amountInWithFee = amountIn * (1 - fee);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return numerator / denominator;
}

function buildGraph(pools) {
  const graph = new Map();

  for (const p of pools) {
    if (!graph.has(p.token0)) graph.set(p.token0, []);
    if (!graph.has(p.token1)) graph.set(p.token1, []);

    graph.get(p.token0).push({ to: p.token1, pool: p });
    graph.get(p.token1).push({ to: p.token0, pool: p });
  }

  return graph;
}

function simulatePath(path, amountIn) {
  let amount = amountIn;

  for (const step of path) {
    const { pool, from } = step;

    const reserveIn =
      pool.token0 === from ? pool.reserve0 : pool.reserve1;
    const reserveOut =
      pool.token0 === from ? pool.reserve1 : pool.reserve0;

    amount = getAmountOut(amount, reserveIn, reserveOut, pool.fee);
  }

  return amount;
}

function findRoutesDFS(graph, start, end, maxHops = 3) {
  const results = [];

  function dfs(current, target, visited, path) {
    if (path.length > maxHops) return;

    if (current === target) {
      results.push([...path]);
      return;
    }

    const edges = graph.get(current) || [];

    for (const e of edges) {
      if (visited.has(e.to)) continue;

      visited.add(e.to);
      path.push({ pool: e.pool, from: current, to: e.to });

      dfs(e.to, target, visited, path);

      path.pop();
      visited.delete(e.to);
    }
  }

  dfs(start, end, new Set([start]), []);
  return results;
}

function scoreRoute(path, amountIn) {
  const out = simulatePath(path, amountIn);

  const hops = path.length;
  const gasPenalty = hops * 0.05; // ringan
  const score = out * (1 - gasPenalty);

  return { out, score };
}

// =========================================================
// MAIN ENTRY
// =========================================================

export function solveRoute({ tokenIn, tokenOut, amount }) {
  // 🔥 DUMMY POOLS (bisa kamu ubah-ubah nanti)
  const pools = [
    {
      id: "P1",
      token0: "OPN",
      token1: "WOPN",
      reserve0: 10000,
      reserve1: 2500,
      fee: 0.003
    },
    {
      id: "P2",
      token0: "WOPN",
      token1: "OPNT",
      reserve0: 5000,
      reserve1: 1200,
      fee: 0.003
    },
    {
      id: "P3",
      token0: "OPN",
      token1: "OPNT",
      reserve0: 100,
      reserve1: 10,
      fee: 0.003
    },
    {
      id: "P4",
      token0: "OPN",
      token1: "tBNB",
      reserve0: 8000,
      reserve1: 50,
      fee: 0.003
    },
    {
      id: "P5",
      token0: "tBNB",
      token1: "OPNT",
      reserve0: 60,
      reserve1: 1000,
      fee: 0.003
    }
  ];

  const graph = buildGraph(pools);

  const routes = findRoutesDFS(graph, tokenIn, tokenOut, 3);

  if (!routes.length) return null;

  let best = null;

  for (const r of routes) {
    const { out, score } = scoreRoute(r, amount);

    if (!best || score > best.score) {
      best = { path: r, out, score };
    }
  }

  return best;
}
