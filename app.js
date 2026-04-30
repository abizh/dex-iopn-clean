/**
 * GOLD OPTIMIZER — FINAL STABLE ENGINE
 * SYNC ROUTER + POOL + SAFE EXECUTION
 */

// =============================
// CONFIG
// =============================
const ROUTER_ADDR = "0x5111Ec47ea2fd841f562Da9f80DAcA8dB825f7ce";

const ROUTER_ABI = [
  "function swapExactTokensForTokens(address[] path,uint256 amountIn,uint256 minOut,address to) returns (uint256)",
  "function getPool(bytes32) view returns (address)"
];

const POOL_ABI = [
  "function getAmountOut(address tokenIn,uint256 amountIn) view returns (uint256)"
];

const DEX_CONFIG = {
  TOKENS: {
    WOPN: { address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84" },
    OPNT: { address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" }
  }
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
// INIT
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

  updateSystem("> SYSTEM: READY (SYNCED ROUTER)");
};

// =============================
// GET POOL FROM ROUTER (SOURCE OF TRUTH)
// =============================
async function getPoolAddress(tokenA, tokenB) {
  const router = new ethers.Contract(
    ROUTER_ADDR,
    ROUTER_ABI,
    window.wallet.provider
  );

  const [a, b] =
    tokenA.toLowerCase() < tokenB.toLowerCase()
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

  const key = ethers.utils.keccak256(
    ethers.utils.solidityPack(["address", "address"], [a, b])
  );

  return await router.getPool(key);
}

// =============================
// SIMULATION (REAL POOL)
// =============================
async function simulateExecution() {
  try {
    const amt = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;
    const tOut = document.getElementById("tokenOut").value;

    if (!amt || amt <= 0) {
      document.getElementById("amountOut").value = "0.00";
      return;
    }

    const tokenIn = DEX_CONFIG.TOKENS[tIn].address;
    const tokenOut = DEX_CONFIG.TOKENS[tOut].address;

    const poolAddr = await getPoolAddress(tokenIn, tokenOut);

    if (poolAddr === ethers.constants.AddressZero) {
      document.getElementById("amountOut").value = "NO POOL";
      return;
    }

    const pool = new ethers.Contract(poolAddr, POOL_ABI, window.wallet.provider);

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    const out = await pool.getAmountOut(tokenIn, amountInWei);

    if (out.eq(0)) {
      document.getElementById("amountOut").value = "NO LIQUIDITY";
      return;
    }

    document.getElementById("amountOut").value =
      ethers.utils.formatUnits(out, 18);

  } catch (err) {
    console.log("SIM ERROR:", err);
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

    const tokenIn = DEX_CONFIG.TOKENS[tIn].address;
    const tokenOut = DEX_CONFIG.TOKENS[tOut].address;

    const path = [tokenIn, tokenOut];

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    console.log("ROUTER:", ROUTER_ADDR);
    console.log("PATH:", path);
    console.log("USER:", window.wallet.address);

    const router = new ethers.Contract(
      ROUTER_ADDR,
      ROUTER_ABI,
      window.wallet.signer
    );

    // =============================
    // GET POOL (SYNC)
    // =============================
    const poolAddr = await getPoolAddress(tokenIn, tokenOut);

    if (poolAddr === ethers.constants.AddressZero) {
      throw new Error("POOL NOT FOUND");
    }

    // =============================
    // APPROVE (SAFE)
    // =============================
    const token = new ethers.Contract(
      tokenIn,
      [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)"
      ],
      window.wallet.signer
    );

    const allowance = await token.allowance(
      window.wallet.address,
      ROUTER_ADDR
    );

    if (allowance.lt(amountInWei)) {
      updateSystem("> APPROVING TOKEN...");
      console.log("APPROVE TO:", ROUTER_ADDR);

      await (await token.approve(
        ROUTER_ADDR,
        ethers.constants.MaxUint256
      )).wait();
    } else {
      console.log("ALREADY APPROVED");
    }

    // =============================
    // GET REAL OUTPUT
    // =============================
    const pool = new ethers.Contract(poolAddr, POOL_ABI, window.wallet.provider);

    const expectedOut = await pool.getAmountOut(tokenIn, amountInWei);

    if (expectedOut.eq(0)) {
      throw new Error("NO LIQUIDITY");
    }

    const minOut = expectedOut.mul(97).div(100);

    // =============================
    // SAFETY SIMULATION
    // =============================
    await router.callStatic.swapExactTokensForTokens(
      path,
      amountInWei,
      minOut,
      window.wallet.address
    );

    // =============================
    // EXECUTE
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
    console.log("SWAP ERROR:", err);
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
