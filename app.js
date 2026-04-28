/**
 * MASTER CODE APP.JS - PHASE 2 (ROUTING ENGINE)
 * Status: Live Sync + Price Discovery
 */

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   name: "IOPN NATIVE",  address: "NATIVE", decimals: 18, priceUsd: 1.2 },
        "TETE":  { symbol: "TETE",  name: "TESTER TOK",   address: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E", decimals: 18, priceUsd: 0.05 },
        "OPNT":  { symbol: "OPNT",  name: "OPN TESTNET",  address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", decimals: 18, priceUsd: 1.1 },
        "tUSDT": { symbol: "tUSDT", name: "TESTNET USDT", address: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b", decimals: 18, priceUsd: 1.0 },
        "tBNB":  { symbol: "tBNB",  name: "TESTNET BNB",  address: "0x92cF36713a5622351c9489D5556B90B321873607", decimals: 18, priceUsd: 600 },
        "WOPN":  { symbol: "WOPN",  name: "WRAPPED OPN",  address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84", decimals: 18, priceUsd: 1.2 }
    }
};

const MIN_ABI = ["function balanceOf(address) view returns (uint256)"];

// --- 1. CORE: FETCH BALANCE (STABLE) ---
async function fetchBalances() {
    const grid = document.getElementById('balance-grid');
    if (!grid || !window.userAddress || !window.provider) return;
    try {
        const tasks = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
            const token = DEX_CONFIG.TOKENS[key];
            let rawBal = "0";
            try {
                if (token.address === "NATIVE") {
                    const b = await window.provider.getBalance(window.userAddress);
                    rawBal = ethers.utils.formatEther(b);
                } else {
                    const contract = new ethers.Contract(token.address, MIN_ABI, window.provider);
                    const b = await contract.balanceOf(window.userAddress);
                    rawBal = ethers.utils.formatUnits(b, token.decimals);
                }
            } catch (e) { rawBal = "0"; }
            return { ...token, balance: rawBal };
        });
        const results = await Promise.all(tasks);
        grid.innerHTML = ""; 
        results.forEach(res => {
            const numBal = parseFloat(res.balance);
            let displayVal = numBal >= 1000000 
                ? (numBal / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2}) + "M"
                : numBal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
            const card = document.createElement('div');
            card.className = "card";
            card.innerHTML = `<small>${res.name}</small><div class="val" style="${numBal > 0 ? 'color:#00ff00;' : 'color:#444;'}">${displayVal}</div><span class="sym">${res.symbol}</span>`;
            grid.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

// --- 2. CORE: ROUTE OPTIMIZER ENGINE (PHASE 2) ---
function calculateRoute(amountIn, fromToken, toToken) {
    const tokenA = DEX_CONFIG.TOKENS[fromToken];
    const tokenB = DEX_CONFIG.TOKENS[toToken];
    
    if (!tokenA || !tokenB) return null;

    // Logika Simulasi Jalur: Jika tidak ada direct pool, lewat WOPN
    let path = [fromToken, toToken];
    if (fromToken !== "WOPN" && toToken !== "WOPN" && fromToken !== "OPN") {
        path = [fromToken, "WOPN", toToken];
    }

    // Kalkulasi Estimasi (Price A / Price B * Amount)
    const estimateOut = (amountIn * tokenA.priceUsd) / tokenB.priceUsd;
    const priceImpact = (amountIn > 100) ? (amountIn / 1000) : 0.01; // Simulasi impact

    return {
        path: path.join(" → "),
        estimate: estimateOut.toFixed(6),
        impact: priceImpact.toFixed(2)
    };
}

// --- 3. UI HANDLERS ---
function simulateExecution() {
    const amount = document.getElementById('amountIn').value;
    const output = document.getElementById('output');
    
    if (amount <= 0) {
        output.innerHTML = "<span style='color:red;'>Error: Masukkan jumlah yang valid!</span>";
        return;
    }

    // Default simulation: OPN ke TETE
    const routeData = calculateRoute(amount, "OPN", "TETE");

    output.innerHTML = `
        <div style="color:#00d4ff; font-weight:bold; margin-bottom:5px;">OPTIMAL ROUTE FOUND</div>
        <div>Path: ${routeData.path}</div>
        <div>Est. Receive: <span style="color:#00ff00;">${routeData.estimate} TETE</span></div>
        <div style="font-size:10px; color:#555;">Price Impact: ${routeData.impact}% | Slippage: 0.5%</div>
    `;
}

function setupEventListeners() {
    if (!window.provider) return;
    window.provider.on("block", () => fetchBalances());
    const filter = { topics: [ethers.utils.id("Transfer(address,address,uint256)")] };
    window.provider.on(filter, () => setTimeout(fetchBalances, 1500));
}

function executeSwap() {
    const output = document.getElementById('output');
    output.innerHTML += `<br><span style="color:#ffcc00;">[SYSTEM] Mempersiapkan Smart Contract Call...</span>`;
    setTimeout(() => {
        alert("Phase 2 Engine: Integrasi Contract Swap dimulai!");
    }, 1000);
}

// Global Exports
window.fetchBalances = fetchBalances;
window.setupEventListeners = setupEventListeners;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
