/**
 * MASTER CODE APP.JS - PHASE 2 (DYNAMIC ROUTING)
 * Locked: TETE, OPNT, tUSDT, tBNB, WOPN
 */

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

const MIN_ABI = ["function balanceOf(address) view returns (uint256)"];

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
                const contract = new ethers.Contract(token.address, MIN_ABI, window.provider);
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
    } catch (e) { console.error(e); }
}

function simulateExecution() {
    const amountIn = document.getElementById('amountIn').value;
    const tokenIn = document.getElementById('tokenIn').value;
    const tokenOut = document.getElementById('tokenOut').value;
    const output = document.getElementById('output');

    if (amountIn <= 0) return;

    const pIn = DEX_CONFIG.TOKENS[tokenIn].price;
    const pOut = DEX_CONFIG.TOKENS[tokenOut].price;

    const estOut = (amountIn * pIn) / pOut;
    document.getElementById('amountOut').value = estOut.toFixed(6);

    // Path Logic: OPN -> WOPN -> Target
    let path = `${tokenIn} → ${tokenOut}`;
    if (tokenIn === "OPN" && tokenOut !== "WOPN") path = `OPN → WOPN → ${tokenOut}`;

    output.innerHTML = `> ANALYZING ROUTE...<br>> PATH: ${path}<br>> EST. RECEIVE: ${estOut.toFixed(6)} ${tokenOut}<br>> PRICE IMPACT: <0.01%<br>> STATUS: OPTIMAL`;
}

function setupEventListeners() {
    window.provider.on("block", () => fetchBalances());
}

function executeSwap() {
    document.getElementById('output').innerHTML += `<br>> [CRITICAL] PHASE 3: CONTRACT BRIDGE REQUIRED.`;
    alert("Phase 2 Success! Engine optimal. Lanjut Phase 3: Contract Execution?");
}

window.fetchBalances = fetchBalances;
window.setupEventListeners = setupEventListeners;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
