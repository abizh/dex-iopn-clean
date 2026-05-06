// ==========================================================
// 🚀 BOZZDEX MEGA-MASTER CODE - V2.3 (ADVANCED ENGINE)
// ==========================================================

const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d"),
    OFFICIAL_ROUTER: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885",
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"
};

const ABI_TOKEN = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)"
];

const ABI_ROUTER = [
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)",
    "function swap(address,address,uint256,uint256) external",
    "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external",
    "function removeLiquidityMulti(address tA, address tB, uint8 percentChoice, bool toNative) external",
    "function getPool(address,address) view returns (address)"
];

const ABI_POOL = [
    "function reserve0() view returns (uint112)",
    "function reserve1() view returns (uint112)",
    "function token0() view returns (address)"
];

let walletProvider, rpcProvider, signer, userAddress;
let debounceTimer;

function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = (isError ? "❌ " : "> ") + msg;
    console.log("[BOZZDEX]", msg);
}

// --- CORE ---
async function connect() {
    if (!window.ethereum) return alert("Install Wallet!");
    try {
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);
        let chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== CONFIG.CHAIN_ID) await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CONFIG.CHAIN_ID }] });
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();
        document.getElementById("btnConnect").innerText = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        document.getElementById("btnSwap").disabled = false;
        if(document.getElementById("btnLiquidity")) document.getElementById("btnLiquidity").disabled = false;
        log("Connected ✅");
        updateBalances();
    } catch (err) { log("Conn Failed", true); }
}

async function updateBalances() {
    if (!userAddress || !rpcProvider) return;
    const cIn = new ethers.Contract(CONFIG.T_IN, ABI_TOKEN, rpcProvider);
    const cOut = new ethers.Contract(CONFIG.T_OUT, ABI_TOKEN, rpcProvider);
    const [bIn, bOut] = await Promise.all([cIn.balanceOf(userAddress), cOut.balanceOf(userAddress)]);
    document.getElementById("balIn").innerText = "Saldo: " + ethers.formatUnits(bIn, 18);
    document.getElementById("balOut").innerText = "Saldo: " + ethers.formatUnits(bOut, 18);
}

// --- LOGIC SWAP & PRICE IMPACT ---
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");
    input.oninput = async (e) => {
        let val = e.target.value.replace(",", ".");
        if (!val || isNaN(val)) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const router = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, rpcProvider);
            const poolAddr = await router.getPool(CONFIG.T_IN, CONFIG.T_OUT);
            const pool = new ethers.Contract(poolAddr, ABI_POOL, rpcProvider);
            
            const [r0, r1, t0] = await Promise.all([pool.reserve0(), pool.reserve1(), pool.token0()]);
            const [resIn, resOut] = CONFIG.T_IN === t0 ? [r0, r1] : [r1, r0];
            
            const amtIn = ethers.parseUnits(val, 18);
            const amtInWithFee = (amtIn * 997n) / 1000n;
            const amtOut = (amtInWithFee * resOut) / (resIn + amtInWithFee);
            
            output.value = ethers.formatUnits(amtOut, 18);
            
            // Calc Impact
            const impact = ((Number(resOut)/Number(resIn) - Number(amtOut)/Number(val)) / (Number(resOut)/Number(resIn)) * 100).toFixed(2);
            log(`Price Impact: ${impact}% ${impact > 5 ? '⚠️' : '✅'}`);
        }, 400);
    };
}

// --- ACTIONS ---
async function ensureApproval(token, amt) {
    const c = new ethers.Contract(token, ABI_TOKEN, signer);
    if (await c.allowance(userAddress, CONFIG.BOZZ_ROUTER) < amt) {
        log("Approving...");
        await (await c.approve(CONFIG.BOZZ_ROUTER, ethers.MaxUint256)).wait();
    }
}

async function executeSwap() {
    try {
        const amtIn = ethers.parseUnits(document.getElementById("inputAmount").value, 18);
        await ensureApproval(CONFIG.T_IN, amtIn);
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        const minOut = (ethers.parseUnits(document.getElementById("outputAmount").value, 18) * 97n) / 100n;
        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut);
        log("Swapping... ⏳");
        await tx.wait();
        log("Swap Success 🔥");
        updateBalances();
    } catch (err) { log("Swap Error", true); }
}

async function executeAddLiquidity() {
    try {
        const amtA = ethers.parseUnits(document.getElementById("inputAmtA").value, 18);
        const amtB = ethers.parseUnits(document.getElementById("inputAmtB").value, 18);
        await ensureApproval(CONFIG.T_IN, amtA);
        await ensureApproval(CONFIG.T_OUT, amtB);
        const tx = await (new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer)).addLiquidity(CONFIG.T_IN, CONFIG.T_OUT, amtA, amtB);
        await tx.wait();
        log("Liquidity Added! 💉");
        updateBalances();
    } catch (err) { log("Add Liq Error", true); }
}

async function executeRemoveLiquidity(percent) {
    try {
        const tx = await (new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer)).removeLiquidityMulti(CONFIG.T_IN, CONFIG.T_OUT, percent, false);
        log("Removing... ⏳");
        await tx.wait();
        log("Liquidity Removed! 💸");
        updateBalances();
    } catch (err) { log("Remove Error", true); }
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap;
    if(document.getElementById("btnLiquidity")) document.getElementById("btnLiquidity").onclick = executeAddLiquidity;
});
            
