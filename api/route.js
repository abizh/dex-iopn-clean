// ==========================================================
// STABLE API (DYNAMIC INPUT, SELF-CONTAINED SOLVER)
// ==========================================================

// ===== AMM =====
function getAmountOut(amountIn, reserveIn, reserveOut, fee = 0.003) {
  const amountInWithFee = amountIn * (1 - fee);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

// ===== SIMULASI =====
function simulatePath(path, tokenIn, amountIn) {
  let amount = amountIn;
  let current = tokenIn;

  for (const p of path) {
    let reserveIn, reserveOut, next;

    if (p.token0 === current) {
      reserveIn = p.reserve0;
      reserveOut = p.reserve1;
      next = p.token1;
    } else if (p.token1 === current) {
      reserveIn = p.reserve1;
      reserveOut = p.reserve0;
      next = p.token0;
    } else {
      return 0;
    }

    amount = getAmountOut(amount, reserveIn, reserveOut, p.fee);
    current = next;
  }

  return amount;
}

// ===== PATH FINDER =====
function findAllPaths(pools, start, end, maxHops = 3) {
  const results = [];

  function dfs(current, target, visited, path) {
    if (path.length > maxHops) return;

    if (current === target) {
      results.push([...path]);
      return;
    }

    for (const p of pools) {
      let next = null;

      if (p.token0 === current) next = p.token1;
      else if (p.token1 === current) next = p.token0;

      if (!next || visited.has(next)) continue;

      visited.add(next);
      path.push(p);

      dfs(next, target, visited, path);

      path.pop();
      visited.delete(next);
    }
  }

  dfs(start, end, new Set([start]), []);
  return results;
}

// ===== SOLVER (SIZE-AWARE VIA PENALTY) =====
function solveRoute(pools, tokenIn, tokenOut, amountIn) {
  const paths = findAllPaths(pools, tokenIn, tokenOut);

  let best = null;

  for (const path of paths) {
    const output = simulatePath(path, tokenIn, amountIn);

    // liquidity score (depth)
    let liq = 0;
    for (const p of path) {
      liq += Math.sqrt(p.reserve0 * p.reserve1);
    }
    const avgLiq = liq / path.length;

    // penalty jika size terlalu besar terhadap liquidity
    const ratio = amountIn / Math.max(avgLiq, 1);
    const penalty = Math.min(ratio, 0.9);

    const score = output * (1 - penalty);

    if (!best || score > best.score) {
      best = { path, output, score };
    }
  }

  return best;
}

// ===== HANDLER =====
export default function handler(req, res) {
  try {
    // ===== SAFE INPUT =====
    let body = {};
    if (req.method === "POST") {
      body = req.body || {};
    }

    const tokenIn = body.tokenIn || "OPN";
    const tokenOut = body.tokenOut || "OPNT";
    const amount = Number(body.amount || 10);

    // ===== POOLS (KALIBRASI FINAL) =====
    const pools = [
      // shallow (kecil)
      { id: "OPN-WOPN", token0: "OPN", token1: "WOPN", reserve0: 800, reserve1: 800, fee: 0.003 },
      { id: "WOPN-OPNT", token0: "WOPN", token1: "OPNT", reserve0: 800, reserve1: 900, fee: 0.003 },

      // medium
      { id: "OPN-OPNT", token0: "OPN", token1: "OPNT", reserve0: 15000, reserve1: 16000, fee: 0.003 },

      // deep (besar)
      { id: "OPN-tBNB", token0: "OPN", token1: "tBNB", reserve0: 200000, reserve1: 180000, fee: 0.003 },
      { id: "tBNB-OPNT", token0: "tBNB", token1: "OPNT", reserve0: 180000, reserve1: 210000, fee: 0.003 }
    ];

    const result = solveRoute(pools, tokenIn, tokenOut, amount);

    if (!result || !result.path) {
      return res.status(200).json({
        route: ["NO_ROUTE"],
        expectedOut: 0
      });
    }

    return res.status(200).json({
      route: result.path.map(p => `${p.token0}/${p.token1}`),
      expectedOut: result.output
    });

  } catch (err) {
    return res.status(500).json({
      error: "CRASH",
      detail: err.message
    });
  }
}
