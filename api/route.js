import { solveRoute } from "../lib/solver.js";

export default function handler(req, res) {
  const { tokenIn, tokenOut, amount } = req.body;

  // ====== LIQUIDITY MODEL (DIKALIBRASI AGAR ROUTE BERGANTI) ======
  const pools = [
    // SHALLOW PATH (bagus utk kecil, hancur saat besar)
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

    // MEDIUM DIRECT (menang di mid size)
    {
      id: "OPN-OPNT",
      token0: "OPN",
      token1: "OPNT",
      reserve0: 9000,
      reserve1: 10000,
      fee: 0.003
    },

    // DEEP PATH (menang di size besar)
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

  res.status(200).json({
    route: result.path.map(p => `${p.token0}/${p.token1}`),
    expectedOut: result.output
  });
}
