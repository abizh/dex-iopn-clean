// ==========================================================
// ROUTE SOLVER v6 (DETERMINISTIC, NO MUTATION, SIZE-AWARE)
// ==========================================================

function getAmountOut(amountIn, reserveIn, reserveOut, fee = 0.003) {
  const amountInWithFee = amountIn * (1 - fee);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

// Tentukan arah swap untuk setiap hop TANPA mutasi object
function simulatePath(path, tokenIn, amountIn) {
  let amount = amountIn;
  let currentToken = tokenIn;

  for (const p of path) {
    let reserveIn, reserveOut, nextToken;

    if (p.token0 === currentToken) {
      reserveIn = p.reserve0;
      reserveOut = p.reserve1;
      nextToken = p.token1;
    } else if (p.token1 === currentToken) {
      reserveIn = p.reserve1;
      reserveOut = p.reserve0;
      nextToken = p.token0;
    } else {
      // path invalid (harusnya tidak terjadi)
      return 0;
    }

    amount = getAmountOut(amount, reserveIn, reserveOut, p.fee);
    currentToken = nextToken;
  }

  return amount;
}

// DFS semua kemungkinan path
function findAllPaths(pools, start, end, maxHops = 3) {
  const results = [];

  function dfs(current, target, visitedTokens, path) {
    if (path.length > maxHops) return;

    if (current === target) {
      results.push([...path]);
      return;
    }

    for (const p of pools) {
      let next = null;

      if (p.token0 === current) next = p.token1;
      else if (p.token1 === current) next = p.token0;

      if (!next || visitedTokens.has(next)) continue;

      visitedTokens.add(next);
      path.push(p);

      dfs(next, target, visitedTokens, path);

      path.pop();
      visitedTokens.delete(next);
    }
  }

  dfs(start, end, new Set([start]), []);
  return results;
}


export function solveRoute(pools, tokenIn, tokenOut, amountIn) {
  const paths = findAllPaths(pools, tokenIn, tokenOut);

  let best = null;

  for (const path of paths) {
    const output = simulatePath(path, tokenIn, amountIn);

    // ---- penalty sederhana: total liquidity path ----
    // semakin kecil liquidity kumulatif, semakin besar penalty
    let liqScore = 0;
    for (const p of path) {
      const liq = Math.sqrt(p.reserve0 * p.reserve1);
      liqScore += liq;
    }
    const avgLiq = liqScore / path.length;

    // penalty berbasis size vs liquidity
    const sizeRatio = amountIn / Math.max(avgLiq, 1);
    const penalty = Math.min(sizeRatio, 0.9); // clamp

    const finalScore = output * (1 - penalty);

    if (!best || finalScore > best.score) {
      best = { path, output, score: finalScore };
    }
  }

  return best;
}
