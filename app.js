/**
 * GOLD OPTIMIZER — MASTER APP.JS (V1.3.0)
 * Status: PRIVATE POOL MODE | SOP: Ultra Precision
 * Executor: 0x7253EFaaeca3DdA533d2646fb21e9d50142D601f
 */

// --- SYARAT 1: DEX_CONFIG (Pusat Data & Checksum) ---
const DEX_CONFIG = {
    TOKENS: {
        "WOPN":  { symbol: "WOPN",  price: 1.25, address: ethers.utils.getAddress("0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84") },
        "OPNT":  { symbol: "OPNT",  price: 1.15, address: ethers.utils.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d") },
        "TETE":  { symbol: "TETE",  price: 0.05, address: ethers.utils.getAddress("0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E") },
        "tUSDT": { symbol: "tUSDT", price: 1.0,  address: ethers.utils.getAddress("0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b") }
    },
    // SYARAT 3: Pool Validation (Menggunakan Alamat Kontrak Sendiri sebagai Pool Sementara)
    POOLS: {
        "SIMULATION_POOL": ethers.utils.getAddress("0x7253EFaaeca3DdA533d2646fb21e9d50142D601f")
    }
};

// SYARAT 2: EXECUTOR_ADDR (Identitas Kontrak Kamu)
const EXECUTOR_ADDR = ethers.utils.getAddress("0x7253EFaaeca3DdA533d2646fb21e9d50142D601f");

const EXECUTOR_ABI = [
    "function executeRoute(address[] pools, address[] path, uint256 amountIn, uint256 minOut) returns (uint256)"
];

// --- CORE SYSTEM ENGINE ---
window.initEngine = function () {
    console.log("SOP: Booting Executor Engine V1.3.0...");
    
    // Sync Global State
    if (!window.wallet) window.wallet = {};
    window.wallet.address = window.userAddress;
    window.wallet.provider = window.provider;
    window.wallet.signer = window.provider?.getSigner();

    fetchBalances();
    setupEventListeners();
    simulateExecution();
    
    updateSystem("> SYSTEM: Private Pool Mode Active. Ready.");
};

function updateSystem(msg) {
    const out = document.getElementById("output");
    if (out) out.innerHTML = msg;
}

// --- LOGIC & SIMULATION ---
function simulateExecution() {
    const amt = document.getElementById("amountIn").value;
    const tInKey = document.getElementById("tokenIn").value;
    const tOutKey = document.getElementById("tokenOut").value;

    if (!amt || amt <= 0) {
        document.getElementById("amountOut").value = "0.00";
        return;
    }

    const pIn = DEX_CONFIG.TOKENS[tInKey].price;
    const pOut = DEX_CONFIG.TOKENS[tOutKey].price;
    const est = (amt * pIn) / pOut;
    
    document.getElementById("amountOut").value = est.toFixed(6);
    updateSystem(`> ROUTE: ${tInKey} → ${tOutKey}<br>> POOL: Private (0x7253...)`);
}

async function executeSwap() {
    const btn = document.getElementById("btnSwap");
    if (!window.wallet.address) return updateSystem("> ERROR: Handshake Failed.");

    try {
        btn.disabled = true;
        btn.innerText = "EXECUTING...";

        const amountIn = document.getElementById("amountIn").value;
        const tInKey = document.getElementById("tokenIn").value;
        const tOutKey = document.getElementById("tokenOut").value;

        const path = [DEX_CONFIG.TOKENS[tInKey].address, DEX_CONFIG.TOKENS[tOutKey].address];
        const pools = [DEX_CONFIG.POOLS.SIMULATION_POOL];

        const amtWei = ethers.utils.parseUnits(amountIn.toString(), 18);
        const executor = new ethers.Contract(EXECUTOR_ADDR, EXECUTOR_ABI, window.wallet.signer);

        // 1. APPROVE
        updateSystem("> STATUS: Approving Asset...");
        const tokenIn = new ethers.Contract(path[0], ["function approve(address,uint256) returns (bool)"], window.wallet.signer);
        const txA = await tokenIn.approve(EXECUTOR_ADDR, amtWei);
        await txA.wait();

        // 2. EXECUTE
        updateSystem("> STATUS: Swapping via Private Pool...");
        const txS = await executor.executeRoute(pools, path, amtWei, 0);
        
        updateSystem(`> TX SENT: ${txS.hash.substring(0,25)}...`);
        await txS.wait();
        updateSystem("> SUCCESS: Swap Processed On-Chain.");
        fetchBalances();

    } catch (err) {
        updateSystem(`> FAILED: ${err.message.substring(0, 50)}`);
    } finally {
        btn.disabled = false;
        btn.innerText = "INITIATE SWAP";
    }
}

// --- DATA FETCHING ---
async function fetchBalances() {
    if (!window.wallet.address) return;
    const grid = document.getElementById("balance-grid");
    grid.innerHTML = "";
    
    try {
        const results = await Promise.all(Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
            const token = DEX_CONFIG.TOKENS[key];
            const contract = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint256)"], window.wallet.provider);
            const b = await contract.balanceOf(window.wallet.address);
            return { symbol: key, balance: ethers.utils.formatUnits(b, 18) };
        }));

        results.forEach(res => {
            grid.innerHTML += `<div class="card"><small>${res.symbol}</small><div class="val">${parseFloat(res.balance).toFixed(4)}</div></div>`;
        });
    } catch (e) { console.error("Sync Error", e); }
}

function setupEventListeners() {
    ["amountIn", "tokenIn", "tokenOut"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.oninput = simulateExecution;
            el.onchange = simulateExecution;
        }
    });
}

window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;

