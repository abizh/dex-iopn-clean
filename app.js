// ==========================================================
// 🚀 BOZZDEX MASTER CODE - HYBRID AGGREGATOR (FIXED)
// ==========================================================

// ===============================
// ⚙️ CONFIG
// ===============================
const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",

    T_IN: "0xbc022c9deb5af250a526321d16ef52e39b4dbd84",  // WOPN
    T_OUT: "0x2aec1db9197ff284011a6a1d0752ad03f5782b0d", // OPNT

    OFFICIAL_ROUTER: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885",
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"
};

// ===============================
// 🔧 INIT ADDRESS (ANTI ERROR)
// ===============================
CONFIG.T_IN = ethers.getAddress(CONFIG.T_IN);
CONFIG.T_OUT = ethers.getAddress(CONFIG.T_OUT);

// ===============================
const ABI_TOKEN = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const ABI_ROUTER = [
    "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)",
    "function swap(address,address,uint256,uint256) external"
];

// ===============================
let walletProvider, rpcProvider, signer, userAddress;
let debounceTimer;

// ===============================
function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = (isError ? "❌ " : "> ") + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// 🔗 CONNECT WALLET (FIX TOTAL)
// ===============================
async function connect() {
    if (!window.ethereum) {
        alert("Install MetaMask / OKX Wallet!");
        return;
    }

    try {
        log("Connect wallet...");

        // INIT RPC dulu (biar gak delay)
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);

        // CHECK CHAIN
        let chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CONFIG.CHAIN_ID) {
            log("Switch network...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CONFIG.CHAIN_ID }]
            });
        }

        // REQUEST ACCOUNT
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

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
        console.error(err);
        log("Connection Failed", true);
    }
}

// ===============================
// 💰 BALANCE
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

        document.getElementById("balIn").innerText =
            "Saldo: " + parseFloat(ethers.formatUnits(bIn, dIn)).toFixed(4);

        document.getElementById("balOut").innerText =
            "Saldo: " + parseFloat(ethers.formatUnits(bOut, dOut)).toFixed(4);

    } catch (err) {
        console.error(err);
        log("Balance Error", true);
    }
}

// ===============================
// 📡 ORACLE PRICE (DEX RESMI)
// ===============================
async function getLivePrice() {
    if (!rpcProvider) return;

    try {
        const router = new ethers.Contract(
            CONFIG.OFFICIAL_ROUTER,
            ABI_ROUTER,
            rpcProvider
        );

        const amounts = await router.getAmountsOut(
            ethers.parseUnits("1", 18),
            [CONFIG.T_IN, CONFIG.T_OUT]
        );

        const price = ethers.formatUnits(amounts[1], 18);

        document.getElementById("marketPrice").innerText =
            "Market: 1 WOPN = " + Number(price).toFixed(6) + " OPNT";

        return price;

    } catch (err) {
        console.error(err);
        log("Oracle Error", true);
    }
}

// ===============================
// 🔄 INPUT SYNC (ORACLE)
// ===============================
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");

    input.oninput = (e) => {
        let val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");

        const parts = val.split(".");
        if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");

        input.value = val;

        clearTimeout(debounceTimer);

        if (!val || val <= 0 || !rpcProvider) {
            output.value = "";
            return;
        }

        output.value = "...";

        debounceTimer = setTimeout(async () => {
            try {
                const router = new ethers.Contract(
                    CONFIG.OFFICIAL_ROUTER,
                    ABI_ROUTER,
                    rpcProvider
                );

                const amounts = await router.getAmountsOut(
                    ethers.parseUnits(val, 18),
                    [CONFIG.T_IN, CONFIG.T_OUT]
                );

                output.value = ethers.formatUnits(amounts[1], 18);

                log("Price Synced ✅");

            } catch (err) {
                console.error(err);
                output.value = "Error";
            }
        }, 400);
    };
}

// ===============================
// ⚡ SWAP (BOZZ ROUTER)
// ===============================
async function executeSwap() {
    const val = document.getElementById("inputAmount");

    if (!val.value || val.value <= 0) {
        log("Isi jumlah dulu!", true);
        return;
    }

    try {
        log("Execute swap...");

        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        const amt = ethers.parseUnits(val.value, 18);

        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);

        log("Waiting confirmation...");
        await tx.wait();

        log("Swap Success 🔥");

        val.value = "";
        document.getElementById("outputAmount").value = "";

        await updateBalances();

    } catch (err) {
        console.error(err);
        log("Swap Failed", true);
    }
}

// ===============================
// 🎬 INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    setupInput();

    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap;

    log("BozzDex Ready 🚀");
});

// ===============================
// 🔁 AUTO REFRESH
// ===============================
setInterval(() => {
    if (userAddress) {
        updateBalances();
        getLivePrice();
    }
}, 7000);
