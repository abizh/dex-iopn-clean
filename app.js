// ===============================
// ⚙️ CONFIG
// ===============================
const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8", // 984
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// ===============================
// 🌐 PROVIDERS
// ===============================
let walletProvider; // dari wallet
let rpcProvider;    // langsung ke RPC
let signer, userAddress;

// ===============================
// 🧠 LOGGER
// ===============================
function log(msg) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = "> " + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// 🔗 CONNECT WALLET (FIX TOTAL)
// ===============================
async function connect() {
    if (!window.ethereum) {
        alert("Gunakan MetaMask / OKX Wallet!");
        return;
    }

    try {
        log("Menghubungkan wallet...");

        // Request akun
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        userAddress = accounts[0];

        // Wallet provider
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();

        // RPC provider (INDEPENDENT)
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);

        // VALIDASI CHAIN
        const chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CONFIG.CHAIN_ID) {
            log("Switch ke iOPN...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CONFIG.CHAIN_ID }]
            });
        }

        // UI update
        document.getElementById("btnConnect").innerText =
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

        document.getElementById("btnSwap").disabled = false;

        log("Wallet connected ✅");

        // LOAD BALANCE
        await updateBalances();

        // AUTO REFRESH
        setInterval(updateBalances, 10000);

    } catch (err) {
        log("Koneksi gagal ❌");
        console.error(err);
    }
}

// ===============================
// 💰 UPDATE BALANCE (FIX UTAMA)
// ===============================
async function updateBalances() {
    if (!userAddress || !rpcProvider) return;

    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ABI, rpcProvider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABI, rpcProvider);

        const [bIn, dIn, bOut, dOut] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress),
            cOut.decimals()
        ]);

        const balIn = ethers.formatUnits(bIn, dIn);
        const balOut = ethers.formatUnits(bOut, dOut);

        document.getElementById("balIn").innerText =
            "Saldo: " + parseFloat(balIn).toFixed(4);

        document.getElementById("balOut").innerText =
            "Saldo: " + parseFloat(balOut).toFixed(4);

        log("Balance updated ✅");

    } catch (err) {
        log("Gagal ambil saldo ❌");
        console.error(err);
    }
}

// ===============================
// 🔄 INPUT SYNC
// ===============================
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");

    input.oninput = (e) => {
        let val = e.target.value
            .replace(",", ".")
            .replace(/[^0-9.]/g, "");

        const parts = val.split(".");
        if (parts.length > 2) {
            val = parts[0] + "." + parts.slice(1).join("");
        }

        input.value = val;
        output.value = val;
    };
}

// ===============================
// 🎬 INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    document.getElementById("btnConnect").onclick = connect;
});
