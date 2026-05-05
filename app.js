// console.log("ETHERS CHECK:", typeof ethers);

// ===============================
// ⚙️ CONFIG
// ===============================
const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8", // 984
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d")
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
        console.log("Provider test jalan...");
const testProvider = new ethers.JsonRpcProvider(CONFIG.RPC);
const block = await testProvider.getBlockNumber();
console.log("BLOCK:", block);
        
        document.getElementById("btnConnect").innerText =
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

        document.getElementById("btnSwap").disabled = false;

        log("Wallet connected");

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
// 📡 MIRROR PRICE ENGINE (DEX RESMI)
// ===============================
async function getLivePrice() {
    try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC);

        const router = new ethers.Contract(
            "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885", // router resmi
            ["function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)"],
            provider
        );

        const amountIn = ethers.parseUnits("1", 18); // 1 WOPN

        const path = [
            CONFIG.T_IN,  // WOPN
            CONFIG.T_OUT  // OPNT
        ];

        const amounts = await router.getAmountsOut(amountIn, path);

        const price = ethers.formatUnits(amounts[1], 18);

        // 🔥 tampilkan ke UI
        const logEl = document.getElementById("marketPrice").innerText =
   "Market: 1 WOPN = " + Number(price).toFixed(6) + " OPNT";

        return price;

    } catch (err) {
        console.error("Price error:", err);
        log("Gagal ambil harga market ❌");
    }
            }

// ===============================
// 🔄 EXECUTE SWAP
// ===============================
async function executeSwap() {
    const val = document.getElementById("inputAmount").value;
    if (!val || val <= 0) {
        log("Input jumlah dulu, bray!", true);
        return;
    }

    try {
        log("Memproses Swap...");
        
        // ABI Router (Minimal)
        const routerAbi = ["function swap(address,address,uint256,uint256) external"];
        const routerAddr = "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"; // Alamat Router OPN
        
        const dex = new ethers.Contract(routerAddr, routerAbi, signer);
        
        // Ambil desimal dulu (atau paksa 18 kalau yakin)
        const amt = ethers.parseUnits(val, 18); 

        log("Konfirmasi di MetaMask...");
        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        
        log("Tunggu blokir...");
        await tx.wait();
        
        log("Swap Berhasil! 🔥🚀");
        await updateBalances();

    } catch (err) {
        log("Swap Gagal / Dibatalkan ❌");
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
    
    // Hubungkan tombol ke fungsi
    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap; // <--- INI JANGAN SAMPE KETINGGALAN!
    
    log("Aplikasi Siap.");
});

setInterval(() => {
    if (userAddress) {
        updateBalances();
        getLivePrice();
    }
}, 10000);
