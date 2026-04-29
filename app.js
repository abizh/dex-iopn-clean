/**
 * GOLD OPTIMIZER — FINAL APP.JS (TRUE AMM MODE)
 * Status: 100% SYNC WITH ROUTER + POOL
 */

// =============================
// CONFIG
// =============================
const ROUTER_ADDR = "0x5111Ec47ea2fd841f562Da9f80DAcA8dB825f7ce";

const ROUTER_ABI = [
  "function swapExactTokensForTokens(address[] path,uint256 amountIn,uint256 minOut,address to) returns (uint256)"
];

const POOL_ABI = [
  "function getAmountOut(address tokenIn,uint256 amountIn) view returns (uint256)"
];

const DEX_CONFIG = {
  TOKENS: {
    WOPN: { address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84" },
    OPNT: { address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" }
  },
  POOL: "0x34963e16F1092b7d0f2b450fB147e7685259B76e"
};

// =============================
window.wallet = {
  address: null,
  provider: null,
  signer: null
};

// =============================
function updateSystem(msg) {
  document.getElementById("output").innerHTML = msg;
}

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

  updateSystem("> SYSTEM: READY (TRUE AMM)");
};

// =============================
// REAL SIMULATION (POOL BASED)
// =============================
async function simulateExecution() {
  try {
    const amt = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;

    if (!amt || amt <= 0) {
      document.getElementById("amountOut").value = "0.00";
      return;
    }

    const pool = new ethers.Contract(
      DEX_CONFIG.POOL,
      POOL_ABI,
      window.wallet.provider
    );

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    const out = await pool.getAmountOut(
      DEX_CONFIG.TOKENS[tIn].address,
      amountInWei
    );

    document.getElementById("amountOut").value =
      ethers.utils.formatUnits(out, 18);

  } catch {
    document.getElementById("amountOut").value = "0.00";
  }
}

// =============================
// EXECUTION
// =============================
async function executeSwap() {
  const btn = document.getElementById("btnSwap");

  try {
    btn.disabled = true;
    btn.innerText = "EXECUTING...";

    const amt = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;
    const tOut = document.getElementById("tokenOut").value;

    const path = [
      DEX_CONFIG.TOKENS[tIn].address,
      DEX_CONFIG.TOKENS[tOut].address
    ];

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    const router = new ethers.Contract(
      ROUTER_ADDR,
      ROUTER_ABI,
      window.wallet.signer
    );

    // =============================
    // APPROVE (MAX)
    // =============================
    updateSystem("> APPROVING TOKEN...");

    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256) returns (bool)"],
      window.wallet.signer
    );

    await (await token.approve(
      ROUTER_ADDR,
      ethers.constants.MaxUint256
    )).wait();

    // =============================
    // GET REAL OUTPUT
    // =============================
    const pool = new ethers.Contract(
      DEX_CONFIG.POOL,
      POOL_ABI,
      window.wallet.provider
    );

    const expectedOut = await pool.getAmountOut(
      path[0],
      amountInWei
    );

    // SLIPPAGE 3%
    const minOut = expectedOut.mul(97).div(100);

    // =============================
    // SWAP
    // =============================
    updateSystem("> EXECUTING SWAP...");

    const tx = await router.swapExactTokensForTokens(
      path,
      amountInWei,
      minOut,
      window.wallet.address
    );

    updateSystem("> TX: " + tx.hash);
    await tx.wait();

    updateSystem("> SUCCESS ✅");
    fetchBalances();

  } catch (err) {
    updateSystem("> ERROR: " + (err.reason || err.message));
  } finally {
    btn.disabled = false;
    btn.innerText = "INITIATE SWAP";
  }
}

// =============================
async function fetchBalances() {
  const grid = document.getElementById("balance-grid");
  grid.innerHTML = "";

  for (const key in DEX_CONFIG.TOKENS) {
    const token = DEX_CONFIG.TOKENS[key];

    const c = new ethers.Contract(
      token.address,
      ["function balanceOf(address) view returns (uint256)"],
      window.wallet.provider
    );

    const bal = await c.balanceOf(window.wallet.address);

    grid.innerHTML += `
      <div class="card">
        <small>${key}</small>
        <div class="val">${parseFloat(ethers.utils.formatUnits(bal, 18)).toFixed(4)}</div>
      </div>
    `;
  }
}

// =============================
function setupEventListeners() {
  ["amountIn", "tokenIn", "tokenOut"].forEach(id => {
    const el = document.getElementById(id);
    el.oninput = simulateExecution;
  });
}

// =============================
window.executeSwap = executeSwap;
