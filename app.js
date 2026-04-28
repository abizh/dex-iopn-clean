/**
 * MASTER CODE APP.JS - PHASE 1
 * Kombinasi Stabilitas Koneksi & UI Balance
 */

const DEX_CONFIG = {
    TOKENS: {
        "OPN":   { symbol: "OPN",   name: "iOPN Native",  address: "NATIVE", decimals: 18 },
        "wOPN":  { symbol: "wOPN",  name: "Wrapped OPN",  address: "0x2e061801C7a780e9D577c61f207044621E8b62CC", decimals: 18 },
        "tUSDT": { symbol: "tUSDT", name: "Testnet USDT", address: "0x77E154687D04a601968840212720d939626A0EBe", decimals: 18 },
        "tBNB":  { symbol: "tBNB",  name: "Testnet BNB",  address: "0xd0294b4E48043685f0A1F0571C3527027C0E4a81", decimals: 18 },
        "OPNT":  { symbol: "OPNT",  name: "OPN Token",    address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", decimals: 18 },
        "TETE":  { symbol: "TETE",  name: "Tester Tok",   address: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E", decimals: 18 }
    }
};

const MIN_ABI = ["function balanceOf(address) view returns (uint256)"];

async function fetchBalances() {
    const grid = document.getElementById('balance-grid');
    if (!grid) return;
    
    grid.innerHTML = "<p style='grid-column:1/-1; font-size:12px;'>Fetching Assets...</p>";

    try {
        const tasks = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
            const token = DEX_CONFIG.TOKENS[key];
            let bal = "0.00";
            try {
                if (token.address === "NATIVE") {
                    const b = await window.provider.getBalance(window.userAddress);
                    bal = ethers.utils.formatEther(b);
                } else {
                    const contract = new ethers.Contract(token.address, MIN_ABI, window.provider);
                    const b = await contract.balanceOf(window.userAddress);
                    bal = ethers.utils.formatUnits(b, token.decimals);
                }
            } catch (e) { bal = "0.00"; }
            return { ...token, balance: bal };
        });

        const results = await Promise.all(tasks);
        grid.innerHTML = "";
        
        results.forEach(res => {
            const card = document.createElement('div');
            card.className = "card";
            card.innerHTML = `
                <small>${res.name}</small>
                <div class="val">${parseFloat(res.balance).toFixed(2)}</div>
                <span class="sym">${res.symbol}</span>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

// Placeholder untuk fitur selanjutnya (Phase 2)
function simulateExecution() {
    document.getElementById('output').innerText = "Simulation Mode: Calculating Best Route...";
    document.getElementById('route').innerText = "OPN -> tUSDT -> OPNT";
}

function executeSwap() {
    alert("Execute feature is locked. Complete Phase 1 first!");
}

// Ekspos ke window
window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
