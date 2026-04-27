import { solveRoute } from "../lib/solver.js";

export default function handler(req, res) {
  try {
    const { tokenIn, tokenOut, amount } = req.body;

    const pools = [
      {
        id: "OPN-WOPN",
        token0: "OPN",
        token1: "WOPN",
        reserve0: 1200,
        reserve1: 1200,
        fee: 0.003
      },
      {
        id: "WOPN-OPNT",
        token0: "WOPN",
        token1: "OPNT",
        reserve0: 1200,
        reserve1: 1500,
        fee: 0.003
      },
      {
        id: "OPN-OPNT",
        token0: "OPN",
        token1: "OPNT",
        reserve0: 9000,
        reserve1: 10000,
        fee: 0.003
      },
      {
        id: "OPN-tBNB",
        token0: "OPN",
        token1: "tBNB",
        reserve0: 50000,
        reserve1: 45000,
        fee: 0.003
      },
      {
        id: "tBNB-OPNT",
        token0: "tBNB",
        token1: "OPNT",
        reserve0: 45000,
        reserve1: 52000,
        fee: 0.003
      }
    ];

    const result = solveRoute(pools, tokenIn, tokenOut, amount);

    // ===== GUARD (INI KUNCI FIX) =====
    if (!result || !result.path || result.path.length === 0) {
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
      error: "ROUTE_ENGINE_ERROR",
      detail: err.message
    });
  }
}
