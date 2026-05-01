/**
 * BOZZ DEX 
 */

// =============================
// CONFIG (LATEST DATA)
// =============================
const ROUTER_ADDR = "0x65Beb7F2eAbCDd8CfD4d53A51c5E704E9404eC91";

// ABI disesuaikan dengan kontrak BOZZ_DEX.sol terbaru
const ROUTER_ABI = [
  "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
  "function getAmountOut(uint256 amtIn, uint256 resIn, uint256 resOut) public view returns (uint256)",
  "function getPool(address t0, address t1) public view returns (address)"
];

// ABI untuk membaca reserve dari Pool
const POOL_ABI = [
  "function reserve0() view returns (uint112)",
  "function reserve1() view returns (uint112)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];

const DEX_CONFIG = {
  TOKENS: {
    WOPN: { address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84" },
    OPNT: { address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" }
  },
  POOL: "0x246D33734CE3032C824CAF8ac062ac5f0C8b20Db"
};

// =============================
window.wallet = {
  address: null,
  provider: null,
  signer: null
};

function log(msg) {
  const el = document.getElementById("output");
  if (el) el.innerHTML = msg;
}

window.initEngine = function () {
  if (window.userAddress && window.provider) {
    wallet.address = window.userAddress;
    wallet.provider = window.provider;
    wallet.signer = window.provider.getSigner();
  }

  if (!wallet.address) return log("> ERROR: Wallet not connected");

  setupEvents();
  simulate();
  log("> BOZZ DEX LIVE");
};

// =============================
// SIMULATION (LOGIKA AMM BARU)
// =============================
async function simulate() {
  try {
    const amt = document.getElementById("amountIn").value;
    const tInKey = document.getElementById("tokenIn").value;
    const tOutKey = document.getElementById("tokenOut").value;

    if (!amt || amt <= 0) return;

    const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, wallet.provider);
    const pool = new ethers.Contract(DEX_CONFIG.POOL, POOL_ABI, wallet.provider);

    const addrIn = DEX_CONFIG.TOKENS[tInKey].address;
    const token0 = await pool.token0();
    
    // Ambil data Reserve
    const r0 = await pool.reserve0();
    const r1 = await pool.reserve1();

    // Tentukan mana ResIn dan ResOut
    const [resIn, resOut] = (addrIn.toLowerCase() === token0.toLowerCase()) 
      ? [r0, r1] 
      : [r1, r0];

    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);
    const out = await router.getAmountOut(amountInWei, resIn, resOut);

    document.getElementById("amountOut").value = ethers.utils.formatUnits(out, 18);

  } catch (e) {
    console.error(e);
    log("> SIM ERROR: Check Liquidity");
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
    const tInKey = document.getElementById("tokenIn").value;
    const tOutKey = document.getElementById("tokenOut").value;

    const addrIn = DEX_CONFIG.TOKENS[tInKey].address;
    const addrOut = DEX_CONFIG.TOKENS[tOutKey].address;
    const amountInWei = ethers.utils.parseUnits(amt.toString(), 18);

    const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, wallet.signer);

    // 1. APPROVE KE ROUTER (BUKAN KE POOL!)
    log("> APPROVING ROUTER...");
    const tokenContract = new ethers.Contract(
      addrIn,
      ["function approve(address,uint256) returns (bool)"],
      wallet.signer
    );
    const appTx = await tokenContract.approve(ROUTER_ADDR, ethers.constants.MaxUint256);
    await appTx.wait();

    // 2. HITUNG MIN OUT (SLIPPAGE 3%)
    const outVal = document.getElementById("amountOut").value;
    const outWei = ethers.utils.parseUnits(outVal.toString(), 18);
    const minOut = outWei.mul(97).div(100);

    // 3. SWAP
    log("> EXECUTING SWAP...");
    const tx = await router.swap(
      addrIn,
      addrOut,
      amountInWei,
      minOut,
      { gasLimit: 300000 }
    );

    log("> TX HASH: " + tx.hash);
    await tx.wait();

    log("> SWAP SUCCESS ✅");
    simulate();

  } catch (err) {
    log("> ERROR: " + (err.reason || err.message));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "SWAP";
    }
  }
}

function setupEvents() {
  ["amountIn", "tokenIn", "tokenOut"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = simulate;
      el.onchange = simulate;
    }
  });
}
