/**
 * PHASE 1 - CORE DATA & REGISTRY (AUDITED)
 * Penempatan: Paste total di file app.js
 */

const DEX_CONFIG = {
    NETWORK: {
        chainId: '0x3d8', // Hex dari 984
        name: "iOPN Testnet",
        rpc: "https://testnet.iopn.tech"
    },
    TOKENS: {
        "OPN":   { symbol: "OPN",   name: "iOPN Native",  address: "NATIVE", decimals: 18 },
        "wOPN":  { symbol: "wOPN",  name: "Wrapped OPN",  address: "0x2e061801C7a780e9D577c61f207044621E8b62CC", decimals: 18 },
        "tUSDT": { symbol: "tUSDT", name: "Testnet USDT", address: "0x77E154687D04a601968840212720d939626A0EBe", decimals: 18 },
        "tBNB":  { symbol: "tBNB",  name: "Testnet BNB",  address: "0xd0294b4E48043685f0A1F0571C3527027C0E4a81", decimals: 18 },
        "OPNT":  { symbol: "OPNT",  name: "OPN Token",    address: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", decimals: 18 },
        "TETE":  { symbol: "TETE",  name: "Tester Tok",   address: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E", decimals: 18 }
    }
};

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
let provider, signer, account;

async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask!");
    
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        account = accounts[0];
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        document.getElementById('wallet-address').innerText = `Wallet: ${account.substring(0,6)}...${account.slice(-4)}`;
        document.getElementById('btn-connect').innerText = "Connected";
        
        await fetchAllBalances();
    } catch (err) {
        console.error("User rejected", err);
    }
}

async function fetchAllBalances() {
    const balanceContainer = document.getElementById('balance-grid');
    balanceContainer.innerHTML = "<p>Loading integrity data...</p>";

    const promises = Object.keys(DEX_CONFIG.TOKENS).map(async (key) => {
        const token = DEX_CONFIG.TOKENS[key];
        let bal = "0.00";
        try {
            if (token.address === "NATIVE") {
                const raw = await provider.getBalance(account);
                bal = ethers.utils.formatEther(raw);
            } else {
                const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                const raw = await contract.balanceOf(account);
                bal = ethers.utils.formatUnits(raw, token.decimals);
            }
        } catch (e) { bal = "Error"; }
        return { key, bal, name: token.name };
    });

    const results = await Promise.all(promises);
    balanceContainer.innerHTML = ""; // Clear loading
    
    results.forEach(res => {
        balanceContainer.innerHTML += `
            <div style="background:#111; padding:15px; border-radius:10px; border:1px solid #333;">
                <small style="color:#666">${res.name}</small>
                <div style="font-size:1.2rem; font-weight:bold;">${parseFloat(res.bal).toFixed(4)} ${res.key}</div>
            </div>
        `;
    });
}

window.connectWallet = connectWallet;
