/**
 * BOZZDEX V2.1 - MASTER LOGIC
 * Certification: Kopi Tubruk 5in1 (Verified)
 * Mode: God-Eye Analytics & Deep Forensic Safety
 */

// ===============================
// 🛠️ CONFIGURATION & CONSTANTS
// ===============================
const RAW_ADDR = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

// Safe Checksum Addresses
const CONFIG = {
    ROUTER: ethers.getAddress(RAW_ADDR.ROUTER),
    T_IN: ethers.getAddress(RAW_ADDR.T_IN),
    T_OUT: ethers.getAddress(RAW_ADDR.T_OUT)
};

const ABIS = {
    ROUTER: ["function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external"],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

// ===============================
// 🔥 GLOBAL STATE & SECURITY GUARDS
// ===============================
let provider, signer, userAddress;
let tokenDecimals = 18; // Standard fallback
let isBlockListenerActive = false;

// ===============================
// 🧠 SYSTEM LOGGER (UI FEEDBACK)
// ===============================
function log(msg) {
    const statusLog = document.getElementById('statusLog');
    if (statusLog) statusLog.innerText = `> ${msg}`;
    console.log(`[BOZZDEX]: ${msg}`);
}

// ===============================
// 🛡️ UTILS & DATA SANITIZATION
// ===============================
// Mencegah crash parseUnits akibat desimal berlebih
function sanitizeInput(val, dec) {
    if (!val.includes(".")) return val;
    const parts = val.split(".");
    if (parts[1].length > dec) return parts[0] + "." + parts[1].slice(0, dec);
    return val;
}

// Format saldo tanpa pembulatan Number() yang merusak presisi
function formatSafe(val, dec) {
    const full = ethers.formatUnits(val, dec);
    const parts = full.split(".");
    if (parts.length > 1) return parts[0] + "." + parts[1].slice(0, 4);
    return full;
}

// ===============================
// 🔌 CONNECTIVITY ENGINE (GOD-EYE)
// ===============================
async function connectWallet() {
    if (!window.ethereum) return alert("Buka di Browser Metamask/OKX App!");

    try {
        log("Memicu Metamask...");
        
        // Rapid Account Request
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        // Background Provider Setup
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Update UI State
        const btnConn = document.getElementById('btnConnect');
        if (btnConn) btnConn.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        
        const badge = document.getElementById('networkBadge');
        if (badge) { badge.innerText = "Online"; badge.style.background = "#238636"; }
        
        const btnSwp = document.getElementById('btnSwap');
        if (btnSwp) btnSwp.disabled = false;

        log("Koneksi Stabil ✅");
        
        // Sync Data
        await updateBalances();
        
        // Anti-Duplicate Block Listener
        if (!isBlockListenerActive) {
            provider.on("block", () => {
                console.log("Syncing New Block...");
                updateBalances();
            });
            isBlockListenerActive = true;
        }

    } catch (err) {
        log(err.code === 4001 ? "User menolak izin ❌" : "Error koneksi ❌");
        console.error(err);
    }
}

// Session Recovery
async function initAutoConnect() {
    if (window.ethereum) {
        const tempProv = new ethers.BrowserProvider(window.ethereum);
        const accounts = await tempProv.listAccounts();
        if (accounts.length > 0) {
            log("Memulihkan sesi...");
            await connectWallet();
        }
    }
}

// ===============================
// 💰 BALANCE ENGINE (PARTIAL SYNC)
// ===============================
async function updateBalances() {
    if (!userAddress || !provider) return;

    const fetchToken = async (addr, configAddr) => {
        try {
            const contract = new ethers.Contract(configAddr, ABIS.ERC20, provider);
            const [bal, dec] = await Promise.all([
                contract.balanceOf(addr),
                contract.decimals()
            ]);
            return { bal, dec };
        } catch (e) { return null; }
    };

    // Parallel fetch dengan pengaman individual
    const [resIn, resOut] = await Promise.all([
        fetchToken(userAddress, CONFIG.T_IN),
        fetchToken(userAddress, CONFIG.T_OUT)
    ]);

    if (resIn) {
        tokenDecimals = resIn.dec; // Sync decimals untuk swap
        const elIn = document.getElementById('balIn');
        if (elIn) elIn.innerText = `Saldo: ${formatSafe(resIn.bal, resIn.dec)}`;
    }

    if (resOut) {
        const elOut = document.getElementById('balOut');
        if (elOut) elOut.innerText = `Saldo: ${formatSafe(resOut.bal, resOut.dec)}`;
    }
}

// ===============================
// 🚀 SWAP ENGINE (ROBUST EXECUTION)
// ===============================
async function executeSwap() {
    const rawVal = document.getElementById('inputAmount')?.value;
    if (!rawVal || rawVal <= 0) return log("Masukkan jumlah valid!");

    try {
        // Refresh Signer (Proteksi sesi basi)
        const currentProvider = new ethers.BrowserProvider(window.ethereum);
        const currentSigner = await currentProvider.getSigner();

        // Sanitize & Parse
        const cleanVal = sanitizeInput(rawVal, tokenDecimals);
        const amtWei = ethers.parseUnits(cleanVal, tokenDecimals);

        const tokenIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, currentSigner);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, currentSigner);

        // 1. Logic Allowance
        log("Mengecek Approval...");
        const allowance = await tokenIn.allowance(userAddress, CONFIG.ROUTER);
        
        if (allowance < amtWei) {
            log("Menunggu Approval...");
            const txApp = await tokenIn.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await txApp.wait();
            log("Approval Sukses!");
        }

        // 2. Logic Swap
        log("Memproses Swap...");
        const txSwap = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtWei, 0);
        log("Menunggu Konfirmasi...");
        await txSwap.wait();
        
        log("SWAP SUCCESS 🔥");
        alert("Transaksi Berhasil!");
        updateBalances();

    } catch (err) {
        // Advanced Error Extraction
        let errMsg = err.reason || err.message;
        if (err.data && err.data.message) errMsg = err.data.message;
        log("Gagal: " + (errMsg.includes("insufficient") ? "Saldo/Gas Tidak Cukup" : errMsg));
        console.error(err);
    }
}

// ===============================
// 🎬 DOM INITIALIZATION
// ===============================
window.onload = () => {
    initAutoConnect();

    // UI Linkage
    const inputAmt = document.getElementById('inputAmount');
    if (inputAmt) {
        inputAmt.oninput = (e) => {
            const outAmt = document.getElementById('outputAmount');
            if (outAmt) outAmt.value = e.target.value; // Estimasi 1:1 untuk UI
        };
    }

    // Event Watchers for Metamask
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', () => window.location.reload());
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
};
