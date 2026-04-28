/**
 * MASTER CODE APP.JS - PHASE 1
 * Audit: Mobile Compatible, iOPN Testnet Linked
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
let provider, account;

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        return alert("Gunakan Mises Browser atau Metamask Mobile!");
    }
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        account = accounts[0];
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        document.getElementById('btn-connect').innerText = "Connected ✅";
        document.getElementById('btn-connect').style.background = "#064e3b";
        document.getElementById('wallet-info').innerHTML = `Wallet: <b>${account.substring(0,6)}...${account.slice(-4)}</b>`;
        
        await fetchBalances();
    } catch (error) {
        console.error(error);
        alert("Gagal konek wallet.");
    }
}

async function fetchBalances() {
    const grid = document.getElementById('balance-grid');
    grid.innerHTML = "<p style='grid-column:1/-1; text-align:center;'>Syncing Blockchain...</p>";

    const tasks = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
        const token = DEX_CONFIG.TOKENS[key];
        let balance = "0.00";
        try {
            if (token.address === "NATIVE") {
                const b = await provider.getBalance(account);
                balance = ethers.utils.formatEther(b);
            } else {
                const contract = new ethers.Contract(token.address, MIN_ABI, provider);
                const b = await contract.balanceOf(account);
                balance = ethers.utils.formatUnits(b, token.decimals);
            }
        } catch (e) { balance = "0.00"; }
        return { ...token, balance };
    });

    const results = await Promise.all(tasks);
    grid.innerHTML = "";
    results.forEach(res => {
        const card = document.createElement('div');
        card.className = "card";
        card.innerHTML = `
            <small>${res.name}</small>
            <div class="val">${parseFloat(res.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <span class="symbol">${res.symbol}</span>
        `;
        grid.appendChild(card);
    });
}

window.connectWallet = connectWallet;
