const pools = [
  // ===== PATH 1 (VERY SHALLOW) =====
  {
    id: "OPN-WOPN",
    token0: "OPN",
    token1: "WOPN",
    reserve0: 800,
    reserve1: 800,
    fee: 0.003
  },
  {
    id: "WOPN-OPNT",
    token0: "WOPN",
    token1: "OPNT",
    reserve0: 800,
    reserve1: 900,
    fee: 0.003
  },

  // ===== PATH 2 (MEDIUM) =====
  {
    id: "OPN-OPNT",
    token0: "OPN",
    token1: "OPNT",
    reserve0: 15000,
    reserve1: 16000,
    fee: 0.003
  },

  // ===== PATH 3 (ULTRA DEEP) =====
  {
    id: "OPN-tBNB",
    token0: "OPN",
    token1: "tBNB",
    reserve0: 200000,
    reserve1: 180000,
    fee: 0.003
  },
  {
    id: "tBNB-OPNT",
    token0: "tBNB",
    token1: "OPNT",
    reserve0: 180000,
    reserve1: 210000,
    fee: 0.003
  }
];
