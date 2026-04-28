/**
 * MASTER CODE APP.JS - GOLD EDITION STABLE
 * Standard: High Precision | Fix: Initialization Order
 */

// 1. Definisikan Konfigurasi Terlebih Dahulu (Global Scope)
const ROUTER_ADDR = ethers.utils.getAddress("0x8979D19E528148b329431835773199D6aE7e748A");

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   price: 1.2,  address: "NATIVE" },
        "TETE":  { symbol: "TETE",  price: 0.05, address: ethers.utils.getAddress("0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E") },
        "OPNT":  { symbol: "OPNT",  price: 1.1,  address: ethers.utils.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d") },
        "tUSDT": { symbol: "tUSDT", price: 1.0,  address: ethers.utils.getAddress("0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b") },
        "tBNB":  { symbol: "tBNB",  price: 600,  address: ethers.utils.getAddress("0x92cF36713a5622351c9489D5556B90B321873607") },
        "WOPN":  { symbol: "WOPN",  price: 1.2,  address: ethers.utils.getAddress("0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84") }
    }
};

const FULL_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
];

// 2. Inisialisasi Engine setelah Wallet Connect
window.initEngine = function() {
    fetchBalances();
    setupEventListeners();
    simulateExecution();
    document.getElementById('output').innerHTML = "> SYSTEM: Engine online. Assets synced.";
};

async function fetchBalances() {
    if (!window.userAddress || !window.provider) return;
    const grid = document.getElementById('balance-grid');
    try {
        const tasks = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
            const token = DEX_CONFIG.TOKENS[key];
            let bal = "0";
            if (token.address === "NATIVE") {
                const b = await window.provider.getBalance(window.userAddress);
                bal = ethers.utils.formatEther(b);
            } else {
                const contract = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint256)"], window.provider);
                const b = await contract.balanceOf(window.userAddress);
                bal = ethers.utils.formatUnits(b, 18);
            }
            return { symbol: key, balance: bal };
        });
        const results = await Promise.all(tasks);
        grid.innerHTML = "";
        results.forEach(res => {
            const num = parseFloat(res.balance);
            const display = num >= 1000000 ? (num/1000000).toFixed(2)+"M" : num.toLocaleString(undefined, {maximumFractionDigits: 4});
            grid.innerHTML += `<div class="card"><small>${res.symbol}</small><div class="val">${display}</div></div>`;
        });
    } catch (e) { console.error(e); }
}

function simulateExecution() {
    // Safety check agar tidak error jika elemen belum ada
    const amountInEl = document.getElementById('amountIn');
    if(!amountInEl) return;

    const amountIn = amountInEl.value;
    const tokenInKey = document.getElementById('tokenIn').value;
    const tokenOutKey = document.getElementById('tokenOut').value;
    const output = document.getElementById('output');

    if (amountIn <= 0) {
        document.getElementById('amountOut').value = "0.00";
        return;
    }

    const pIn = DEX_CONFIG.TOKENS[tokenInKey].price;
    const pOut = DEX_CONFIG.TOKENS[tokenOutKey].price;
    const estOut = (amountIn * pIn) / pOut;

    document.getElementById('amountOut').value = estOut.toFixed(6);
    output.innerHTML = `> ROUTE FOUND: ${tokenInKey} → ${tokenOutKey}<br>> EST. RECEIVE: <span style="color:#00ff00;">${estOut.toFixed(6)}</span>`;
}

async function executeSwap() {
    const output = document.getElementById('output');
    const amountInVal = document.getElementById('amountIn').value;
    const tIn = DEX_CONFIG.TOKENS[document.getElementById('tokenIn').value];
    const tOut = DEX_CONFIG.TOKENS[document.getElementById('tokenOut').value];
    
    if (tIn.address === "NATIVE") {
        output.innerHTML = "> <span style='color:orange;'>NOTICE: NATIVE SWAP (PHASE 4) UNDER DEV. PLEASE TEST WITH tUSDT.</span>";
        return;
    }

    try {
        const signer = window.provider.getSigner();
        const amountInWei = ethers.utils.parseUnits(amountInVal.toString(), 18);
        const tokenContract = new ethers.Contract(tIn.address, FULL_ABI, signer);
        
        output.innerHTML = `> STEP 1: VALIDATING ALLOWANCE...`;
        const allowance = await tokenContract.allowance(window.userAddress, ROUTER_ADDR);
        
        if (allowance.lt(amountInWei)) {
            output.innerHTML += `<br>> STEP 2: REQUESTING APPROVAL...`;
            const txA = await tokenContract.approve(ROUTER_ADDR, ethers.constants.MaxUint256);
            await txA.wait();
            output.innerHTML += `<br>> <span style='color:green;'>APPROVAL GRANTED.</span>`;
        }

        output.innerHTML += `<br>> STEP 3: EXECUTING SWAP...`;
        const router = new ethers.Contract(ROUTER_ADDR, FULL_ABI, signer);
        const path = [tIn.address, tOut.address];
        const deadline = Math.floor(Date.now() / 1000) + 600;

        const txS = await router.swapExactTokensForTokens(amountInWei, 0, path, window.userAddress, deadline);
        output.innerHTML += `<br>> TX SEND: ${txS.hash.substring(0,18)}...`;
        await txS.wait();
        output.innerHTML += `<br>> <span style='color:green; font-weight:bold;'>SUCCESS! ASSETS EXCHANGED.</span>`;
        fetchBalances();
    } catch (err) {
        output.innerHTML += `<br><span style='color:red;'>> ERROR: ${err.reason || "Transaction Denied"}</span>`;
    }
}

function setupEventListeners() {
    // Re-calculate saat input berubah
    document.getElementById('amountIn').addEventListener('input', simulateExecution);
    document.getElementById('tokenIn').addEventListener('change', simulateExecution);
    document.getElementById('tokenOut').addEventListener('change', simulateExecution);
    
    // Auto sync tiap blok
    if(window.provider) {
        window.provider.on("block", () => fetchBalances());
    }
}

// Export agar bisa dibaca script lain jika perlu
window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
