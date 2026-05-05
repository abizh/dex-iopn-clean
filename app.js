/**
 * BOZZDEX V2.1 - MASTER CODE UTUH
 * Sinkronisasi Total: UI & Blockchain
 */

// ===============================
// CONFIG (Sesuai OPN Testnet)
// ===============================
const CONFIG = {
    ROUTER: ethers.getAddress("0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"),
    T_IN: ethers.getAddress("0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84"),
    T_OUT: ethers.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d")
};

const ABIS = {
    ROUTER: ["function swap(address,address,uint256,uint256) external"],
    ERC20: [
        "function approve(address,uint256) external returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

// ===============================
// GLOBAL STATE
// ===============================
let provider = null;
let signer = null;
let userAddress = null;
let tokenDecimals = 18;

// ===============================
// LOGGER
// ===============================
function log(msg) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = "> " + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// WALLET CONNECT ENGINE
// ===============================
async function connectWallet() {
    if (!window.ethereum) {
        alert("Gunakan Metamask / OKX Wallet bray!");
        return;
    }

    try {
        log("Meminta koneksi...");

        // Trigger pop-up dompet
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts || accounts.length === 0) {
            log("Koneksi ditolak ❌");
            return;
        }

        userAddress = accounts[0];
        
        // Re-init provider untuk ethers v6
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Update UI secara masif
        updateUI(userAddress);

        log("Wallet terhubung ✅");

        // Ambil data terbaru
        await updateBalances();

    } catch (err) {
        log("Error koneksi ❌");
        console.error("Forensic Error:", err);
    }
}

// Helper untuk UI agar kode lebih bersih
function updateUI(address) {
    const btn = document.getElementById("btnConnect");
    if (btn) btn.innerText = address.slice(0, 6) + "..." + address.slice(-4);

    const badge = document.getElementById("networkBadge");
    if (badge) {
        badge.innerText = "Online";
        badge.style.background = "#238636";
    }

    const swapBtn = document.getElementById("btnSwap");
    if (swapBtn) swapBtn.disabled = false;
}

// ===============================
// AUTO RECONNECT (GOD-EYE MODE)
// ===============================
async function initAutoConnect() {
    if (!window.ethereum) return;

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts && accounts.length > 0) {
            // Fix ethers v6: listAccounts balikin array objek account
            userAddress = accounts[0].address;
            signer = await provider.getSigner();

            log("Memulihkan sesi...");
            updateUI(userAddress);
            await updateBalances();
        } else {
            log("Siap beraksi, bray...");
        }
    } catch (err) {
        console.error("Silent Init Error:", err);
    }
}

// ===============================
// BALANCE & DECIMALS ENGINE
// ===============================
async function updateBalances() {
    if (!userAddress || !provider) return;

    try {
        const tIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const tOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);

        // Ambil paralel biar kenceng bray
        const [b1, d1, b2, d2] = await Promise.all([
            tIn.balanceOf(userAddress),
            tIn.decimals(),
            tOut.balanceOf(userAddress),
            tOut.decimals()
        ]);

        tokenDecimals = Number(d1);

        const elIn = document.getElementById("balIn");
        if (elIn) elIn.innerText = "Saldo: " + ethers.formatUnits(b1, d1).slice(0, 10);

        const elOut = document.getElementById("balOut");
        if (elOut) elOut.innerText = "Saldo: " + ethers.formatUnits(b2, d2).slice(0, 10);

    } catch (err) {
        console.error("Gagal ambil saldo bray:", err);
    }
}

// ===============================
// SWAP ENGINE (FINAL SAFETY)
// ===============================
async function executeSwap() {
    const inputVal = document.getElementById("inputAmount").value;
    if (!inputVal || inputVal <= 0) {
        log("Input tidak valid!");
        return;
    }

    try {
        log("Menyiapkan transaksi...");
        
        // Proteksi presisi
        const amt = ethers.parseUnits(inputVal.toString(), tokenDecimals);

        const token = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek izin (Allowance)...");
        const allowance = await token.allowance(userAddress, CONFIG.ROUTER);

        if (allowance < amt) {
            log("Approve token...");
            const txApp = await token.approve(CONFIG.ROUTER, ethers.MaxUint256);
            log("Tunggu approval...");
            await txApp.wait();
            log("Approval sukses!");
        }

        log("Memulai Swap...");
        const txSwap = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        
        log("Menunggu blok...");
        await txSwap.wait();

        log("Swap sukses bray! 🔥🚀");
        
        // Refresh saldo otomatis
        await updateBalances();

    } catch (err) {
        log("Swap gagal ❌");
        console.error("Swap Error:", err);
    }
}

// ===============================
// MASTER INITIALIZER
// ===============================
window.addEventListener("DOMContentLoaded", () => {
    
    // Jalankan auto-detect sesegera mungkin
    initAutoConnect();

    // Link input bray (UI Sync)
    const inputAmt = document.getElementById("inputAmount");
    const outputAmt = document.getElementById("outputAmount");
    if (inputAmt && outputAmt) {
        inputAmt.addEventListener("input", (e) => {
            outputAmt.value = e.target.value; // Estimasi 1:1
        });
    }

    // Wallet Listener (Hanya jika ethereum ada)
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", () => window.location.reload());
        window.ethereum.on("chainChanged", () => window.location.reload());
    }

    // Refresh saldo tiap 15 detik biar data tetep segar
    setInterval(updateBalances, 15000);
});
