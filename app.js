// ==========================================================
// 🚀 BOZZDEX MEGA-MASTER CODE - V2.2 (FIXED & INNOVATED)
// ==========================================================

const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),  // WOPN
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d"), // OPNT
    OFFICIAL_ROUTER: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885",
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"
};

const ABI_TOKEN = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)"
];

const ABI_ROUTER = [
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)",
    "function swap(address,address,uint256,uint256) external",
    "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external"
];

let walletProvider, rpcProvider, signer, userAddress;
let debounceTimer;
let decimalsIn = 18;

function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = (isError ? "❌ " : "> ") + msg;
    console.log("[BOZZDEX]", msg);
}

// ==========================================
// 🔗 CORE FUNCTIONS (CONNECT & DATA FETCH)
// ==========================================
async function connect() {
    if (!window.ethereum) {
        alert("Install MetaMask / OKX Wallet!");
        return;
    }
    try {
        log("Connecting to iOPN Testnet...");
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
        
        // Aktifkan tombol
        document.getElementById("btnSwap").disabled = false;
        if(document.getElementById("btnLiquidity")) document.getElementById("btnLiquidity").disabled = false;

        log("Wallet Connected ✅");
        await updateBalances();
        await getLivePrice();
    } catch (err) {
        log("Connection Failed", true);
    }
}

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

        decimalsIn = dIn;
        
        if(document.getElementById("balIn")) document.getElementById("balIn").innerText = "Saldo: " + ethers.formatUnits(bIn, dIn);
        if(document.getElementById("balOut")) document.getElementById("balOut").innerText = "Saldo: " + ethers.formatUnits(bOut, dOut);
    } catch (err) {
        console.error(err);
    }
}

async function getLivePrice() {
    if (!rpcProvider) return;
    try {
        const router = new ethers.Contract(CONFIG.OFFICIAL_ROUTER, ABI_ROUTER, rpcProvider);
        const amounts = await router.getAmountsOut(ethers.parseUnits("1", decimalsIn), [CONFIG.T_IN, CONFIG.T_OUT]);
        const price = ethers.formatUnits(amounts[1], 18);
        
        const priceEl = document.getElementById("marketPrice");
        if(priceEl) priceEl.innerText = "Market: 1 WOPN = " + Number(price).toFixed(6) + " OPNT";
        return price;
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// 🛡️ SECURITY & VALIDATION (SATFAM BOZZ)
// ==========================================
async function ensureApproval(tokenAddress, amount) {
    const tokenContract = new ethers.Contract(tokenAddress, ABI_TOKEN, signer);
    const allowance = await tokenContract.allowance(userAddress, CONFIG.BOZZ_ROUTER);
    
    if (allowance < amount) {
        log("Approving token... Please confirm.");
        const tx = await tokenContract.approve(CONFIG.BOZZ_ROUTER, ethers.MaxUint256);
        await tx.wait();
        log("Approval Success ✅");
    }
}

// ==========================================
// ⚡ MAIN ACTIONS (SWAP & LIQUIDITY)
// ==========================================
async function executeSwap() {
    const inputEl = document.getElementById("inputAmount");
    const outputEl = document.getElementById("outputAmount");

    if (!inputEl.value || inputEl.value <= 0) {
        log("Input nominal swap!", true);
        return;
    }

    try {
        log("Checking Approval...");
        const amtIn = ethers.parseUnits(inputEl.value, decimalsIn);
        await ensureApproval(CONFIG.T_IN, amtIn);

        log("Executing Swap...");
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        
        // Slippage 3% (97/100) - Stabil untuk Pool Kecil / Testnet
        const expectedOut = ethers.parseUnits(outputEl.value, 18);
        const minOut = (expectedOut * 97n) / 100n; 

        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut);
        log("Waiting confirmation... ⏳");
        await tx.wait();

        log("Swap Success! 🔥");
        inputEl.value = "";
        outputEl.value = "";
        await updateBalances();
    } catch (err) {
        log("Swap Error: " + (err.reason || "Check Console"), true);
        console.error(err);
    }
}

async function executeAddLiquidity() {
    const inputA = document.getElementById("inputAmtA");
    const inputB = document.getElementById("inputAmtB");

    if (!inputA || !inputB || !inputA.value || !inputB.value) {
        log("Lengkapi nominal A & B!", true);
        return;
    }

    try {
        log("Checking Approvals...");
        const amtA = ethers.parseUnits(inputA.value, 18);
        const amtB = ethers.parseUnits(inputB.value, 18);

        await ensureApproval(CONFIG.T_IN, amtA);
        await ensureApproval(CONFIG.T_OUT, amtB);

        log("Suntik Likuiditas...");
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        
        const tx = await dex.addLiquidity(CONFIG.T_IN, CONFIG.T_OUT, amtA, amtB);
        log("Waiting confirmation... ⏳");
        await tx.wait();

        log("Likuiditas Gemuk Lagi! 💉✅");
        inputA.value = "";
        inputB.value = "";
        await updateBalances();
    } catch (err) {
        log("Add Liquidity Gagal!", true);
        console.error(err);
    }
}

// ==========================================
// 🛠️ UI SYNC (DEBOUNCE)
// ==========================================
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");
    if(!input || !output) return;

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

// ==========================================
// 🎬 INIT & AUTO-REFRESH
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap;
    
    const btnLiq = document.getElementById("btnLiquidity");
    if(btnLiq) btnLiq.onclick = executeAddLiquidity;

    log("BozzDex Engine Ready 🚀");
});

setInterval(() => {
    if (userAddress) {
        updateBalances();
        getLivePrice();
    }
}, 7000);
    
