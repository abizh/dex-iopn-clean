/**
 * GOLD OPTIMIZER — MASTER APP.JS (EXECUTOR MODE)
 * Status: EXECUTOR ACTIVE | READY TEST (POOL REQUIRED)
 */

// =============================
// EXECUTOR CONFIG
// =============================
const EXECUTOR_ADDR = "0x7253EFaaeca3DdA533d2646fb21e9d50142D601f";

const EXECUTOR_ABI = [
  "function executeRoute(address[] pools,address[] path,uint256 amountIn,uint256 minOut) returns (uint256)"
];

// =============================
// GLOBAL WALLET STATE
// =============================
window.wallet = {
  address: null,
  provider: null,
  signer: null
};

// =============================
// SYSTEM OUTPUT
// =============================
function updateSystem(msg) {
  document.getElementById("output").innerHTML = msg;
}

// =============================
// ENGINE INIT
// =============================
window.initEngine = function () {
  fetchBalances();
  setupEventListeners();
  simulateExecution();

  updateSystem("> SYSTEM: Online. Wallet Synced.");
};

// =============================
// SIMULATION ENGINE
// =============================
function simulateExecution() {
  const amt = parseFloat(document.getElementById("amountIn").value);
  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;

  if (!amt || amt <= 0) {
    document.getElementById("amountOut").value = "0.00";
    return;
  }

  const est =
    (amt * DEX_CONFIG.TOKENS[tIn].price) /
    DEX_CONFIG.TOKENS[tOut].price;

  const minOut = est * 0.95;

  document.getElementById("amountOut").value = est.toFixed(6);

  updateSystem(`
    > ROUTE: ${tIn} → ${tOut}
    <br>> EST: ${est.toFixed(6)}
    <br>> MIN OUT: ${minOut.toFixed(6)}
  `);
}

// =============================
// EXECUTION (EXECUTOR MODE)
// =============================
async function executeSwap() {
  const btn = document.getElementById("btnSwap");
  const out = document.getElementById("output");

  if (!window.wallet || !window.wallet.address) {
    out.innerHTML = "> ERROR: Wallet not connected";
    return;
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

    const amountIn = document.getElementById("amountIn").value;

    // ⚠️ ROUTE SEMENTARA (WAJIB GANTI POOL)
    const path = [
      DEX_CONFIG.TOKENS["WOPN"].address,
      DEX_CONFIG.TOKENS["OPNT"].address
    ];

    const pools = [
      "ISI_POOL_REAL_DISINI"
    ];

    // VALIDASI ADDRESS
    if (!ethers.utils.isAddress(path[0]) || !ethers.utils.isAddress(path[1])) {
      throw new Error("INVALID TOKEN ADDRESS");
    }

    if (!ethers.utils.isAddress(pools[0])) {
      throw new Error("INVALID POOL ADDRESS");
    }

    const amtWei = ethers.utils.parseUnits(amountIn.toString(), 18);
    const minOut = 0;

    // APPROVE (HANYA UNTUK ERC20)
    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256) returns (bool)"],
      signer
    );

    out.innerHTML = "> APPROVING...";
    const txA = await token.approve(EXECUTOR_ADDR, amtWei);
    await txA.wait();

    // EXECUTE
    out.innerHTML = "> EXECUTING ROUTE...";
    const tx = await executor.executeRoute(
      pools,
      path,
      amtWei,
      minOut
    );

    out.innerHTML = "> TX SENT: " + tx.hash;

    await tx.wait();

    out.innerHTML = "> SUCCESS: SWAP DONE";

  } catch (err) {
    console.error(err);

    out.innerHTML =
      "> FAILED: " +
      (err.reason || err.data?.message || err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "INITIATE SWAP";
  }
}

// =============================
// EVENT LISTENER
// =============================
function setupEventListeners() {
  ["amountIn", "tokenIn", "tokenOut"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.oninput = simulateExecution;
    el.onchange = simulateExecution;
  });
}

// =============================
// BALANCE FETCH
// =============================
async function fetchBalances() {
  if (!window.wallet.provider || !window.wallet.address) return;

  const grid = document.getElementById("balance-grid");
  grid.innerHTML = "...";

  try {
    const bal = await window.wallet.provider.getBalance(
      window.wallet.address
    );

    const formatted = ethers.utils.formatEther(bal);

    grid.innerHTML = `
      <div class="card">
        <small>OPN</small>
        <div class="val">${parseFloat(formatted).toFixed(4)}</div>
      </div>
    `;
  } catch (e) {
    console.error("Balance fetch error:", e);
    grid.innerHTML = "<div class='card'>ERROR</div>";
  }
}

// =============================
// EXPORT GLOBAL
// =============================
window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
