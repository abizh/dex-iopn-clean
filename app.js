/**
 * GOLD AMM ENGINE — FINAL STABLE
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
function log(msg) {
  const el = document.getElementById("output");
  if (el) el.innerHTML = msg;
}

// =============================
window.initEngine = function () {
  if (window.userAddress && window.provider) {
    wallet.address = window.userAddress;
    wallet.provider = window.provider;
    wallet.signer = window.provider.getSigner();
  }

  if (!wallet.address) {
    return log("> ERROR: Wallet not connected");
  }

  setupEvents();
  simulate();

  log("> SYSTEM READY (AMM LIVE)");
};

// =============================
// SIMULATION (REAL POOL)
// =============================
async function simulate() {
  try {
    const amt = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;

    if (!amt || amt <= 0) return;

    const pool = new ethers.Contract(
      DEX_CONFIG.POOL,
      POOL_ABI,
      wallet.provider
    );

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    const out = await pool.getAmountOut(
      DEX_CONFIG.TOKENS[tIn].address,
      amountInWei
    );

    document.getElementById("amountOut").value =
      ethers.utils.formatUnits(out, 18);

  } catch (e) {
    log("> SIM ERROR");
  }
}

// =============================
// EXECUTE SWAP
// =============================
async function executeSwap() {
  const btn = document.getElementById("btnSwap");

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "PROCESSING...";
    }

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
      wallet.signer
    );

    // APPROVE
    log("> APPROVING TOKEN...");
    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256) returns (bool)"],
      wallet.signer
    );

    await (await token.approve(
      ROUTER_ADDR,
      ethers.constants.MaxUint256
    )).wait();

    // GET OUTPUT
    const pool = new ethers.Contract(
      DEX_CONFIG.POOL,
      POOL_ABI,
      wallet.provider
    );

    const expectedOut = await pool.getAmountOut(
      path[0],
      amountInWei
    );

    const minOut = expectedOut.mul(97).div(100);

    // SWAP
    log("> EXECUTING SWAP...");
    const tx = await router.swapExactTokensForTokens(
      path,
      amountInWei,
      minOut,
      wallet.address
    );

    log("> TX: " + tx.hash);
    await tx.wait();

    log("> SUCCESS ✅");

  } catch (err) {
    log("> ERROR: " + (err.reason || err.message));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "SWAP";
    }
  }
}

// =============================
function setupEvents() {
  ["amountIn", "tokenIn", "tokenOut"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = simulate;
      el.onchange = simulate;
    }
  });
}
