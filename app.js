/**
 * MASTER CODE APP.JS - PHASE 1 FINAL AUDIT
 * Precision: High | Real-time: Enabled | Database: Locked
 */

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   name: "IOPN NATIVE",  address: "NATIVE", decimals: 18 },
        "TETE":  { symbol: "TETE",  name: "TESTER TOK",   address: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E", decimals: 18 },
        "OPNT":  { symbol: "OPNT",  name: "OPN TESTNET",  address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", decimals: 18 },
        "tUSDT": { symbol: "tUSDT", name: "TESTNET USDT", address: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b", decimals: 18 },
        "tBNB":  { symbol: "tBNB",  name: "TESTNET BNB",  address: "0x92cF36713a5622351c9489D5556B90B321873607", decimals: 18 },
        "WOPN":  { symbol: "WOPN",  name: "WRAPPED OPN",  address: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84", decimals: 18 }
    }
};

const MIN_ABI = ["function balanceOf(address) view returns (uint256)"];

// --- FUNGSI AMBIL SALDO (ANTI-GAGAL) ---
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
        grid.innerHTML = ""; // Reset grid sebelum render ulang
        
        results.forEach(res => {
            const numBal = parseFloat(res.balance);
            let displayVal;
            
            // Logika Format 25M (TETE) & Presisi 4 Desimal (Lainnya)
            if (numBal >= 1000000) {
                displayVal = (numBal / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2}) + "M";
            } else {
                displayVal = numBal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
            }

            const card = document.createElement('div');
            card.className = "card";
            card.innerHTML = `
                <small>${res.name}</small>
                <div class="val" style="${numBal > 0 ? 'color:#00ff00;' : 'color:#444;'}">${displayVal}</div>
                <span class="sym">${res.symbol}</span>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Critical Sync Error:", err);
    }
}

// --- FUNGSI REAL-TIME LISTENER ---
function setupEventListeners() {
    if (!window.provider) return;

    // Trigger update tiap blok baru
    window.provider.on("block", () => fetchBalances());

    // Trigger update jika ada Transfer masuk/keluar ke wallet user
    const filter = {
        topics: [ethers.utils.id("Transfer(address,address,uint256)")]
    };
    window.provider.on(filter, () => {
        setTimeout(fetchBalances, 1500);
    });
}

// --- UI HANDLERS ---
function simulateExecution() {
    const val = document.getElementById('amountIn').value;
    document.getElementById('output').innerText = `Tracing Route for ${val} OPN...\nBest Path: OPN -> WOPN -> tUSDT -> OPNT`;
}

function executeSwap() {
    alert("Phase 1 Locked. System ready for Phase 2 Engine integration.");
}

// Export ke Window Scope agar bisa diakses index.html
window.fetchBalances = fetchBalances;
window.setupEventListeners = setupEventListeners;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
