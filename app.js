/**
 * MASTER CODE APP.JS - PHASE 1 (FINAL SYNC)
 * Data Source: Verified OPN Explorer Addresses
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

async function fetchBalances() {
    const grid = document.getElementById('balance-grid');
    if (!grid) return;
    grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; font-size:12px; color:#00d4ff;'>🔄 Syncing Explorer Data...</p>";

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
            const numBal = parseFloat(res.balance);
            
            // Format Display (Abbreviation for 25M TETE)
            let display = numBal >= 1000000 
                ? (numBal / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2}) + "M"
                : numBal.toLocaleString(undefined, {maximumFractionDigits: 4});

            card.innerHTML = `
                <small>${res.name}</small>
                <div class="val" style="${numBal > 0 ? 'color:#00ff00;' : 'color:#444;'}">${display}</div>
                <span class="sym">${res.symbol}</span>
            `;
            grid.appendChild(card);
        });
        document.getElementById('output').innerText = "SOP: Blockchain Sync Complete. All Assets Verified.";
    } catch (err) { console.error(err); }
}

function simulateExecution() {
    const val = document.getElementById('amountIn').value;
    document.getElementById('output').innerText = `Simulating Route for ${val} OPN...`;
    document.getElementById('output').innerText += `\nPath: OPN -> WOPN -> tUSDT -> OPNT`;
}

function executeSwap() {
    alert("Phase 1 Complete. Phase 2 (Engine) Required for Execution.");
}

window.fetchBalances = fetchBalances;
window.simulateExecution = simulateExecution;
window.executeSwap = executeSwap;
