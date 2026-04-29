/**
 * GOLD OPTIMIZER — MASTER APP.JS (V1.5.0 HARD FIX)
 * Status: SAFE EXECUTION + ANTI-REVERT + GAS FIX
 */

// =============================
// CONFIG
// =============================
const EXECUTOR_ADDR = "0x7253EFaaeca3DdA533d2646fb21e9d50142D601f";

const EXECUTOR_ABI = [
  "function executeRoute(address[] pools,address[] path,uint256 amountIn,uint256 minOut) returns (uint256)"
];

const DEX_CONFIG = {
  TOKENS: {
    WOPN:  { price: 1.25, address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84" },
    OPNT:  { price: 1.15, address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" },
    TETE:  { price: 0.05, address: "0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E" },
    tUSDT: { price: 1.0,  address: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b" }
  },

  // ⚠️ DEFAULT = SAFE MODE (NO REAL EXEC)
  POOLS: {
    WOPN_OPNT: null
  }
};

// =============================
// GLOBAL STATE
// =============================
window.wallet = {
  address: null,
  provider: null,
  signer: null
};

// =============================
// SYSTEM LOGGER
// =============================
function updateSystem(msg) {
  const el = document.getElementById("output");
  if (el) el.innerHTML = msg;
}

// =============================
// ENGINE INIT
// =============================
window.initEngine = function () {
  if (window.userAddress && window.provider) {
    window.wallet.address = window.userAddress;
    window.wallet.provider = window.provider;
    window.wallet.signer = window.provider.getSigner();
  }

  if (!window.wallet.address) {
    return updateSystem("> ERROR: Wallet not synced");
  }

  fetchBalances();
  setupEventListeners();
  simulateExecution();

  updateSystem("> SYSTEM: READY");
};

// =============================
// SIMULATION
// =============================
function simulateExecution() {
  const amt = parseFloat(document.getElementById("amountIn").value);
  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;

  if (!amt || amt <= 0) {
    document.getElementById("amountOut").value = "0.00";
    return;
  }

  const est = (amt * DEX_CONFIG.TOKENS[tIn].price) /
              DEX_CONFIG.TOKENS[tOut].price;

  document.getElementById("amountOut").value = est.toFixed(6);

  updateSystem(`
    > ROUTE: ${tIn} → ${tOut}
    <br>> EST: ${est.toFixed(6)}
  `);
}

// =============================
// EXECUTION (ANTI-REVERT MODE)
// =============================
async function executeSwap() {
  const btn = document.getElementById("btnSwap");

  if (!window.wallet.address) {
    return updateSystem("> ERROR: Wallet not connected");
  }

  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;
  const amountIn = document.getElementById("amountIn").value;

  const pool = DEX_CONFIG.POOLS.WOPN_OPNT;

  // =============================
  // VALIDATION BLOCK (CRITICAL)
  // =============================
  if (!pool) {
    return updateSystem(`
      > SAFE MODE ACTIVE
      <br>> NO VALID POOL
      <br>> EXECUTION BLOCKED
    `);
  }

  if (pool.toLowerCase() === EXECUTOR_ADDR.toLowerCase()) {
    return updateSystem(`
      > ERROR: INVALID POOL
      <br>> POOL = EXECUTOR (FATAL CONFIG)
    `);
  }

  try {
    btn.disabled = true;
    btn.innerText = "PROCESSING...";

    const signer = window.wallet.signer;

    const executor = new ethers.Contract(
      EXECUTOR_ADDR,
      EXECUTOR_ABI,
      signer
    );

    const path = [
      DEX_CONFIG.TOKENS[tIn].address,
      DEX_CONFIG.TOKENS[tOut].address
    ];

    const pools = [pool];

    const amtWei = ethers.utils.parseUnits(amountIn.toString(), 18);

    // =============================
    // APPROVE
    // =============================
    updateSystem("> APPROVING...");
    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256) returns (bool)"],
      signer
    );

    const txA = await token.approve(EXECUTOR_ADDR, amtWei);
    await txA.wait();

    // =============================
    // GAS FIX (EIP-1559)
    // =============================
    const fee = await window.wallet.provider.getFeeData();

    // =============================
    // EXECUTE
    // =============================
    updateSystem("> EXECUTING...");
    const tx = await executor.executeRoute(
      pools,
      path,
      amtWei,
      0,
      {
        gasLimit: 500000,
        maxFeePerGas: fee.maxFeePerGas,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas
      }
    );

    updateSystem("> TX: " + tx.hash);
    await tx.wait();

    updateSystem("> SUCCESS");
    fetchBalances();

  } catch (err) {
    console.error(err);

    let reason = err.reason || err.message;

    if (reason.includes("revert")) {
      reason = "POOL / EXECUTOR NOT COMPATIBLE";
    }

    updateSystem("> FAILED: " + reason);

  } finally {
    btn.disabled = false;
    btn.innerText = "INITIATE SWAP";
  }
}

// =============================
// BALANCE FETCH
// =============================
async function fetchBalances() {
  if (!window.wallet.address) return;

  const grid = document.getElementById("balance-grid");
  grid.innerHTML = "";

  for (const key in DEX_CONFIG.TOKENS) {
    try {
      const token = DEX_CONFIG.TOKENS[key];

      const contract = new ethers.Contract(
        token.address,
        ["function balanceOf(address) view returns (uint256)"],
        window.wallet.provider
      );

      const bal = await contract.balanceOf(window.wallet.address);

      grid.innerHTML += `
        <div class="card">
          <small>${key}</small>
          <div class="val">
            ${parseFloat(ethers.utils.formatUnits(bal, 18)).toFixed(4)}
          </div>
        </div>
      `;
    } catch (e) {
      console.log("Balance error:", key);
    }
  }
}

// =============================
// EVENTS
// =============================
function setupEventListeners() {
  ["amountIn", "tokenIn", "tokenOut"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.oninput = simulateExecution;
    el.onchange = simulateExecution;
  });
}

// =============================
window.executeSwap = executeSwap;
window.fetchBalances = fetchBalances;
