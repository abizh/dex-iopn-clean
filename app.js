// ==========================================================
// 🚀 BOZZDEX MASTER CODE - HYBRID AGGREGATOR (ULTRA PRECISION)
// ==========================================================

const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),  
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d"), 
    OFFICIAL_ROUTER: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885",
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"
};

const ABI_TOKEN = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address,address) view returns (uint256)", // FIXED: Tambah check izin
    "function approve(address,uint256) external returns (bool)"   // FIXED: Tambah fungsi izin
];

const ABI_ROUTER = [
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)",
    "function swap(address,address,uint256,uint256) external"
];

let walletProvider, rpcProvider, signer, userAddress;
let debounceTimer;
let decimalsIn = 18; // FIXED: Simpan decimals global biar akurat

function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = (isError ? "❌ " : "> ") + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// 🔗 CONNECT WALLET (FIXED SYNC)
// ===============================
async function connect() {
    if (!window.ethereum) {
        alert("Install MetaMask / OKX Wallet!");
        return;
    }

    try {
        log("Connecting...");
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);
        
        let chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== CONFIG.CHAIN_ID) {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CONFIG.CHAIN_ID }]
            });
        }

        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();

        document.getElementById("btnConnect").innerText = 
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        document.getElementById("btnSwap").disabled = false;

        log("Wallet Connected ✅");
        await updateBalances();
        await getLivePrice();
    } catch (err) {
        log("Connection Failed", true);
    }
}

// ===============================
// 💰 BALANCE & DECIMALS (PRECISION)
// ===============================
async function updateBalances() {
    if (!userAddress || !rpcProvider) return;
    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ABI_TOKEN, rpcProvider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABI_TOKEN, rpcProvider);

        const [bIn, dIn, bOut, dOut] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress),
            cOut.decimals()
        ]);

        decimalsIn = dIn; // FIXED: Update decimals real-time
        
        document.getElementById("balIn").innerText = 
            "Saldo: " + ethers.formatUnits(bIn, dIn);
        document.getElementById("balOut").innerText = 
            "Saldo: " + ethers.formatUnits(bOut, dOut);
    } catch (err) {
        log("Balance Error", true);
    }
}

async function getLivePrice() {
    if (!rpcProvider) return;
    try {
        const router = new ethers.Contract(CONFIG.OFFICIAL_ROUTER, ABI_ROUTER, rpcProvider);
        // Pakai 1 unit token berdasarkan decimalsIn
        const amounts = await router.getAmountsOut(ethers.parseUnits("1", decimalsIn), [CONFIG.T_IN, CONFIG.T_OUT]);
        const price = ethers.formatUnits(amounts[1], 18); // Asumsi T_OUT itu OPNT (18 dec)
        
        document.getElementById("marketPrice").innerText = 
            "Market: 1 WOPN = " + Number(price).toFixed(6) + " OPNT";
        return price;
    } catch (err) {
        log("Oracle Error", true);
    }
}

// ===============================
// 🔄 INPUT SYNC (DEBOUNCE FIXED)
// ===============================
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");

    input.oninput = (e) => {
        let val = e.target.value.replace(",", ".");
        if (!val || isNaN(val)) { output.value = ""; return; }

        clearTimeout(debounceTimer);
        output.value = "...";

        debounceTimer = setTimeout(async () => {
            try {
                const router = new ethers.Contract(CONFIG.OFFICIAL_ROUTER, ABI_ROUTER, rpcProvider);
                const amounts = await router.getAmountsOut(ethers.parseUnits(val, decimalsIn), [CONFIG.T_IN, CONFIG.T_OUT]);
                output.value = ethers.formatUnits(amounts[1], 18);
                log("Price Synced ✅");
            } catch (err) {
                output.value = "Error";
            }
        }, 400);
    };
}

// ===============================
// ⚡ SWAP (AUTO-APPROVE & SLIPPAGE FIXED)
// ===============================
async function executeSwap() {
    const inputEl = document.getElementById("inputAmount");
    const outputEl = document.getElementById("outputAmount");

    if (!inputEl.value || inputEl.value <= 0) {
        log("Isi jumlah dulu!", true);
        return;
    }

    try {
        const amtIn = ethers.parseUnits(inputEl.value, decimalsIn);
        const tokenInContract = new ethers.Contract(CONFIG.T_IN, ABI_TOKEN, signer);
        
        // --- 1. AUTO APPROVAL CHECK ---
        log("Checking allowance...");
        const allowance = await tokenInContract.allowance(userAddress, CONFIG.BOZZ_ROUTER);
        
        if (allowance < amtIn) {
            log("Approving token...");
            const approveTx = await tokenInContract.approve(CONFIG.BOZZ_ROUTER, ethers.MaxUint256);
            await approveTx.wait();
            log("Approval Success ✅");
        }

        // --- 2. EXECUTE SWAP WITH SLIPPAGE (0.5%) ---
        log("Executing Swap...");
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        
        // FIXED: Hitung minOut (Slippage 0.5% biar aman tapi tetep dapet harga bagus)
        const expectedOut = ethers.parseUnits(outputEl.value, 18);
        const minOut = (expectedOut * 995n) / 1000n; 

        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut);
        
        log("Confirming...");
        await tx.wait();

        log("Swap Success 🔥");
        inputEl.value = "";
        outputEl.value = "";
        await updateBalances();

    } catch (err) {
        console.error(err);
        log("Swap Failed: " + (err.reason || "Check Console"), true);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap;
});

setInterval(() => {
    if (userAddress) {
        updateBalances();
        getLivePrice();
    }
}, 7000);
            
