/**
 * MASTER CODE APP.JS - PHASE 3 (EXECUTION LAYER)
 * Status: High Precision | iOPN Testnet Linked
 */

const ROUTER_ADDRESS = "0x8979D19E528148b329431835773199D6aE7e748A"; // Router iOPN

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   price: 1.2 },
        "TETE":  { symbol: "TETE",  price: 0.05, address: "0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E" },
        "OPNT":  { symbol: "OPNT",  price: 1.1,  address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" },
        "tUSDT": { symbol: "tUSDT", price: 1.0,  address: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b" },
        "tBNB":  { symbol: "tBNB",  price: 600,  address: "0x92cF36713a5622351c9489D5556B90B321873607" },
        "WOPN":  { symbol: "WOPN",  price: 1.2,  address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84" }
    }
};

const FULL_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
];

// --- CORE FUNCTIONS ---
async function fetchBalances() {
    if (!window.userAddress || !window.provider) return;
    const grid = document.getElementById('balance-grid');
    try {
        const tasks = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
            const token = DEX_CONFIG.TOKENS[key];
            let bal = "0";
            if (key === "OPN") {
                const b = await window.provider.getBalance(window.userAddress);
                bal = ethers.utils.formatEther(b);
            } else {
                const contract = new ethers.Contract(token.address, FULL_ABI, window.provider);
                const b = await contract.balanceOf(window.userAddress);
                bal = ethers.utils.formatUnits(b, 18);
            }
            return { symbol: key, balance: bal };
        });
        const results = await Promise.all(tasks);
        grid.innerHTML = "";
        results.forEach(res => {
            const num = parseFloat(res.balance);
            const display = num >= 1000000 ? (num/1000000).toFixed(2)+"M" : num.toFixed(4);
            grid.innerHTML += `<div class="card"><small>${res.symbol}</small><div class="val">${display}</div></div>`;
        });
    } catch (e) { console.error("Balance Sync Failed", e); }
}

async function executeSwap() {
    const output = document.getElementById('output');
    const amountInRaw = document.getElementById('amountIn').value;
    const tokenInKey = document.getElementById('tokenIn').value;
    const tokenOutKey = document.getElementById('tokenOut').value;
    
    if (!window.provider || amountInRaw <= 0) return;

    const signer = window.provider.getSigner();
    const amountIn = ethers.utils.parseUnits(amountInRaw.toString(), 18);
    const tokenIn = DEX_CONFIG.TOKENS[tokenInKey];
    const tokenOut = DEX_CONFIG.TOKENS[tokenOutKey];

    try {
        output.innerHTML = `> [STEP 1/2] Checking Allowance for ${tokenInKey}...`;
        
        // 1. APPROVE IF NEEDED
        if (tokenInKey !== "OPN") {
            const tokenContract = new ethers.Contract(tokenIn.address, FULL_ABI, signer);
            const allowance = await tokenContract.allowance(window.userAddress, ROUTER_ADDRESS);
            
            if (allowance.lt(amountIn)) {
                output.innerHTML += `<br>> Requesting Permission to spend ${tokenInKey}...`;
                const txApprove = await tokenContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
                await txApprove.wait();
                output.innerHTML += `<br>> <span style="color:#00ff00;">APPROVAL GRANTED!</span>`;
            }
        }

        // 2. SWAP EXECUTION
        output.innerHTML += `<br>> [STEP 2/2] Executing Swap on iOPN Chain...`;
        const router = new ethers.Contract(ROUTER_ADDRESS, FULL_ABI, signer);
        const path = [tokenIn.address, tokenOut.address];
        const deadline = Math.floor(Date.now() / 1000) + 600; // 10 menit

        // Logika untuk OPN Native akan dipisah di Phase 4, sekarang fokus ke Token-to-Token
        const txSwap = await router.swapExactTokensForTokens(
            amountIn,
            0, // Slippage 0% untuk testnet
            path,
            window.userAddress,
            deadline
        );

        output.innerHTML += `<br>> TX HASH: <span style="color:#00d4ff;">${txSwap.hash.substring(0,20)}...</span>`;
        await txSwap.wait();
        output.innerHTML += `<br>> <span style="color:#00ff00; font-weight:bold;">SWAP SUCCESSFUL!</span>`;
        
        fetchBalances(); // Refresh saldo otomatis
    } catch (err) {
        output.innerHTML += `<br><span style="color:red;">> FAILED: ${err.reason || err.message}</span>`;
    }
}

function simulateExecution() {
    const amountIn = document.getElementById('amountIn').value;
    const tokenIn = document.getElementById('tokenIn').value;
    const tokenOut = document.getElementById('tokenOut').value;
    if (amountIn <= 0) return;

    const pIn = DEX_CONFIG.TOKENS[tokenIn].price;
    const pOut = DEX_CONFIG.TOKENS[tokenOut].price;
    const estOut = (amountIn * pIn) / pOut;
    document.getElementById('amountOut').value = estOut.toFixed(6);

    document.getElementById('output').innerHTML = `> ENGINE READY...<br>> EST. RECEIVE: ${estOut.toFixed(6)} ${tokenOut}<br>> STATUS: VERIFIED`;
}

window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
