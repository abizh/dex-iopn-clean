/**
 * BOZZDEX V2.3 - ULTRA-HYBRID (Final Stable)
 * Kombinasi: Stabilitas Manual & Keamanan Otomatis
 */

// =============================
// CONFIGURATION (STABLE)
// =============================
const CONFIG = {
    ROUTER: ethers.getAddress("0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"),
    T_IN: ethers.getAddress("0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84"),
    T_OUT: ethers.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d")
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

let provider, signer, userAddress;
let tokenDecimals = 18;

// =============================
// SAFE LOGGER & UTILS
// =============================
function log(msg, isError = false) {
    const el = document.getElementById('statusLog');
    if (el) {
        el.innerText = "> " + msg;
        el.style.color = isError ? "#f85149" : "#7ee787";
    }
    console.log("[BOZZDEX]", msg);
}

function sanitizeInput(val, dec) {
    if (!val.includes(".")) return val;
    const parts = val.split(".");
    if (parts[1].length > dec) return parts[0] + "." + parts[1].slice(0, dec);
    return val;
}

// =============================
// WALLET ENGINE (THE MERGER)
// =============================

async function initAutoConnect() {
    if (!window.ethereum) {
        log("Wallet tidak ditemukan ❌");
        return;
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            log("Memulihkan sesi...");
            await connectWallet();
        }
    } catch (err) {
        console.error("Init error:", err);
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        alert("Gunakan Metamask / OKX Wallet!");
        return;
    }

    try {
        log("Meminta koneksi...");
        
        // Request Accounts (Metode Wajib)
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (!accounts || accounts.length === 0) throw new Error("Akses ditolak");

        userAddress = accounts[0];
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Update UI
        const btn = document.getElementById("btnConnect");
        const badge = document.getElementById("networkBadge");
        const swapBtn = document.getElementById("btnSwap");

        if (btn) btn.innerText = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        if (badge) {
            badge.innerText = "Online";
            badge.style.background = "#16a34a";
        }
        if (swapBtn) swapBtn.disabled = false;

        log("Wallet terhubung ✅");
        await updateBalances();

    } catch (err) {
        log("Error koneksi ❌", true);
        console.error(err);
    }
}

// =============================
// DATA ENGINE (SYNC)
// =============================
async function updateBalances() {
    if (!userAddress || !provider) return;
    try {
        const contractIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const contractOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);

        const [balIn, decIn, balOut] = await Promise.all([
            contractIn.balanceOf(userAddress),
            contractIn.decimals(),
            contractOut.balanceOf(userAddress)
        ]);

        tokenDecimals = Number(decIn);
        
        if (document.getElementById('balIn')) 
            document.getElementById('balIn').innerText = `Saldo: ${ethers.formatUnits(balIn, decIn)}`;
        if (document.getElementById('balOut')) 
            document.getElementById('balOut').innerText = `Saldo: ${ethers.formatUnits(balOut, 18)}`; // Asumsi T-B 18 dec
    } catch (e) {
        console.error("Gagal update saldo", e);
    }
}

// =============================
// LISTENER (ANTI-ZOMBI)
// =============================
function setupWalletListeners() {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            log("Wallet terputus");
            location.reload();
        } else {
            connectWallet();
        }
    });

    window.ethereum.on("chainChanged", () => {
        location.reload();
    });
}

// =============================
// SWAP EXECUTION
// =============================
async function executeSwap() {
    const rawVal = document.getElementById('inputAmount').value;
    if (!rawVal || rawVal <= 0) return log("Input tidak valid", true);

    try {
        log("Menyiapkan transaksi...");
        const cleanVal = sanitizeInput(rawVal, tokenDecimals);
        const amtWei = ethers.parseUnits(cleanVal, tokenDecimals);

        const tokenIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek Allowance...");
        const allowance = await tokenIn.allowance(userAddress, CONFIG.ROUTER);
        
        if (allowance < amtWei) {
            log("Approve Token...");
            const txApp = await tokenIn.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await txApp.wait();
        }

        log("Eksekusi Swap...");
        const txSwap = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtWei, 0);
        await txSwap.wait();
        
        log("Swap Berhasil! 🔥");
        updateBalances();
    } catch (err) {
        log("Swap Gagal ❌", true);
        console.error(err);
    }
}

// =============================
// INITIALIZATION
// =============================
window.onload = () => {
    // Double-bind: Manual click & Auto-detect
    const btn = document.getElementById("btnConnect");
    if (btn) btn.onclick = connectWallet;

    setupWalletListeners();
    initAutoConnect();
};
