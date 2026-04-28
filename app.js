/**
 * MASTER CODE APP.JS - GOLD OPTIMIZER V1.1.3
 * Status: HEARTBEAT FIX | SOP Standard: High Precision
 */

const ROUTER_ADDR = ethers.utils.getAddress("0x8979D19E528148b329431835773199D6aE7e748A");

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   price: 1.25, address: "NATIVE" },
        "TETE":  { symbol: "TETE",  price: 0.05, address: ethers.utils.getAddress("0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E") },
        "OPNT":  { symbol: "OPNT",  price: 1.15, address: ethers.utils.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d") },
        "tUSDT": { symbol: "tUSDT", price: 1.0,  address: ethers.utils.getAddress("0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b") },
        "tBNB":  { symbol: "tBNB",  price: 600,  address: ethers.utils.getAddress("0x92cF36713a5622351c9489D5556B90B321873607") },
        "WOPN":  { symbol: "WOPN",  price: 1.25, address: ethers.utils.getAddress("0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84") }
    }
};

const SWAP_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
];

window.initEngine = function() {
    console.log("Engine Bootstrapping...");
    fetchBalances();
    setupEventListeners();
    simulateExecution();
    document.getElementById('output').innerHTML = "> SYSTEM: Engine Online. Handshake Verified.";
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
    } catch (e) { console.error("Balance Sync Failed", e); }
}

function simulateExecution() {
    const amtIn = document.getElementById('amountIn').value;
    const tInKey = document.getElementById('tokenIn').value;
    const tOutKey = document.getElementById('tokenOut').value;
    if (!amtIn || amtIn <= 0) { document.getElementById('amountOut').value = "0.00"; return; }
    
    const estOut = (amtIn * DEX_CONFIG.TOKENS[tInKey].price) / DEX_CONFIG.TOKENS[tOutKey].price;
    document.getElementById('amountOut').value = estOut.toFixed(6);
    document.getElementById('output').innerHTML = `> ANALYSIS: Route Active [${tInKey} -> ${tOutKey}]<br>> EST. YIELD: ${estOut.toFixed(6)} ${tOutKey}`;
}

async function executeSwap() {
    const btn = document.getElementById('btnSwap');
    const out = document.getElementById('output');
    const amtInVal = document.getElementById('amountIn').value;
    const tInKey = document.getElementById('tokenIn').value;
    const tOutKey = document.getElementById('tokenOut').value;
    const tIn = DEX_CONFIG.TOKENS[tInKey];
    const tOut = DEX_CONFIG.TOKENS[tOutKey];
    
    if (tIn.address === "NATIVE") {
        out.innerHTML = "> <span style='color:orange;'>ALERT: Use WOPN or tUSDT. Native OPN requires Bridge Phase 4.</span>";
        return;
    }

    try {
        btn.disabled = true; btn.innerText = "PROCESSING...";
        const signer = window.provider.getSigner();
        const amtWei = ethers.utils.parseUnits(amtInVal.toString(), 18);
        const tokenCon = new ethers.Contract(tIn.address, SWAP_ABI, signer);
        
        out.innerHTML = `> STATUS: Validating Allowance...`;
        const allowance = await tokenCon.allowance(window.userAddress, ROUTER_ADDR);
        
        if (allowance.lt(amtWei)) {
            out.innerHTML += `<br>> STATUS: Requesting Approval...`;
            const txA = await tokenCon.approve(ROUTER_ADDR, ethers.constants.MaxUint256);
            await txA.wait();
        }

        out.innerHTML += `<br>> STATUS: Executing Swap...`;
        const router = new ethers.Contract(ROUTER_ADDR, SWAP_ABI, signer);
        const path = [tIn.address, tOut.address];
        const txS = await router.swapExactTokensForTokens(amtWei, 0, path, window.userAddress, Math.floor(Date.now()/1000)+600);
        
        out.innerHTML += `<br>> TX: ${txS.hash.substring(0,20)}...`;
        await txS.wait();
        out.innerHTML += `<br>> <span style='color:green; font-weight:bold;'>SUCCESS: Swap Confirmed!</span>`;
        fetchBalances();
    } catch (err) {
        out.innerHTML += `<br><span style='color:#ff4d4d;'>> FAILED: ${err.reason || "Handshake Rejected"}</span>`;
    } finally {
        btn.disabled = false; btn.innerText = "INITIATE SWAP";
    }
}

function setupEventListeners() {
    ['amountIn', 'tokenIn', 'tokenOut'].forEach(id => {
        const el = document.getElementById(id);
        el.replaceWith(el.cloneNode(true)); // Clear existing listeners
        document.getElementById(id).addEventListener('input', simulateExecution);
        document.getElementById(id).addEventListener('change', simulateExecution);
    });
}

window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
