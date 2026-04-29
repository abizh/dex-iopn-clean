/**
 * GOLD OPTIMIZER — MASTER APP.JS (V1.4.0 FINAL)
 * Status: STABLE HANDSHAKE + EXECUTOR LIVE READY
 */

// =============================
// CONFIG
// =============================
const EXECUTOR_ADDR = ethers.utils.getAddress("0x7253EFaaeca3DdA533d2646fb21e9d50142D601f");

const EXECUTOR_ABI = [
  "function executeRoute(address[] pools,address[] path,uint256 amountIn,uint256 minOut) returns (uint256)"
];

const DEX_CONFIG = {
  TOKENS: {
    WOPN:  { price: 1.25, address: ethers.utils.getAddress("0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84") },
    OPNT:  { price: 1.15, address: ethers.utils.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d") },
    TETE:  { price: 0.05, address: ethers.utils.getAddress("0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E") },
    tUSDT: { price: 1.0,  address: ethers.utils.getAddress("0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b") }
  },

  // ⚠️ GANTI DENGAN POOL REAL
  POOLS: {
    WOPN_OPNT: "0x7253EFaaeca3DdA533d2646fb21e9d50142D601f"
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
// ENGINE INIT (CRITICAL FIX)
// =============================
window.initEngine = function () {
  console.log("Engine Init Triggered");

  // HARD SYNC (anti bug metamask mobile)
  if (window.userAddress && window.provider) {
    window.wallet.address = window.userAddress;
    window.wallet.provider = window.provider;
    window.wallet.signer = window.provider.getSigner();
  }

  if (!window.wallet.address) {
    updateSystem("> ERROR: Wallet not synced");
    return;
  }

  fetchBalances();
  setupEventListeners();
  simulateExecution();

  updateSystem("> SYSTEM: Engine Online. Wallet Synced.");
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

  if (tIn === tOut) {
    updateSystem("> INVALID: Token tidak boleh sama");
    return;
  }

  const est =
    (amt * DEX_CONFIG.TOKENS[tIn].price) /
    DEX_CONFIG.TOKENS[tOut].price;

  document.getElementById("amountOut").value = est.toFixed(6);

  updateSystem(`
    > ROUTE: ${tIn} → ${tOut}
    <br>> EST: ${est.toFixed(6)}
  `);
}

// =============================
// EXECUTION (REAL)
// =============================
async function executeSwap() {
  const btn = document.getElementById("btnSwap");

  if (!window.wallet.address) {
    return updateSystem("> ERROR: Wallet not connected");
  }

  try {
    btn.disabled = true;
    btn.innerText = "PROCESSING...";

    const amountIn = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;
    const tOut = document.getElementById("tokenOut").value;

    if (tIn === tOut) throw new Error("Token input & output sama");

    const path = [
      DEX_CONFIG.TOKENS[tIn].address,
      DEX_CONFIG.TOKENS[tOut].address
    ];

    const pools = [DEX_CONFIG.POOLS.WOPN_OPNT];

    if (!pools[0] || pools[0].includes("ISI")) {
      throw new Error("POOL BELUM DISET");
    }

    const amtWei = ethers.utils.parseUnits(amountIn.toString(), 18);

    const executor = new ethers.Contract(
      EXECUTOR_ADDR,
      EXECUTOR_ABI,
      window.wallet.signer
    );

    // APPROVE
    updateSystem("> APPROVING...");
    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256) returns (bool)"],
      window.wallet.signer
    );

    const txA = await token.approve(EXECUTOR_ADDR, amtWei);
    await txA.wait();

    // EXECUTE
	updateSystem("> EXECUTING...");
	const tx = await executor.executeRoute(
  pools,
  path,
  amtWei,
  minOut,
  {
    gasLimit: 500000,
    maxFeePerGas: ethers.utils.parseUnits("20", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei")
  }
);

    updateSystem("> TX SENT: " + tx.hash);

    await tx.wait();

    updateSystem("> SUCCESS: SWAP COMPLETE");

    fetchBalances();

  } catch (err) {
    updateSystem("> FAILED: " + (err.reason || err.message));
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
  grid.innerHTML = "...";

  try {
    const results = await Promise.all(
      Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
        const token = DEX_CONFIG.TOKENS[key];

        const contract = new ethers.Contract(
          token.address,
          ["function balanceOf(address) view returns (uint256)"],
          window.wallet.provider
        );

        const bal = await contract.balanceOf(window.wallet.address);

        return {
          symbol: key,
          balance: ethers.utils.formatUnits(bal, 18)
        };
      })
    );

    grid.innerHTML = "";

    results.forEach((r) => {
      grid.innerHTML += `
        <div class="card">
          <small>${r.symbol}</small>
          <div class="val">${parseFloat(r.balance).toFixed(4)}</div>
        </div>
      `;
    });

  } catch (e) {
    console.error(e);
    grid.innerHTML = "<div class='card'>ERROR</div>";
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
window.executeSwap = executeSwap;
window.simulateExecution = simulateExecution;
window.fetchBalances = fetchBalances;
