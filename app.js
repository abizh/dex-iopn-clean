/**
 * BOZZDEX V2.1 - MASTER LOGIC (STABLE FINAL)
 */

// ===============================
// 🛠️ CONFIGURATION
// ===============================
const RAW_ADDR = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const CONFIG = {
    ROUTER: ethers.getAddress(RAW_ADDR.ROUTER),
    T_IN: ethers.getAddress(RAW_ADDR.T_IN),
    T_OUT: ethers.getAddress(RAW_ADDR.T_OUT)
};

const ABIS = {
    ROUTER: [
        "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external"
    ],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

// ===============================
// 🌍 GLOBAL STATE (ONLY ONCE)
// ===============================
let provider = null;
let signer = null;
let userAddress = null;
let tokenDecimals = 18;

// ===============================
// 🧠 LOGGER
// ===============================
function log(msg) {
    const el = document.getElementById('statusLog');
    if (el) el.innerText = "> " + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// 🛡️ UTILS
// ===============================
function sanitizeInput(val, dec) {
    if (!val.includes(".")) return val;
    const parts = val.split(".");
    if (parts[1].length > dec) return parts[0] + "." + parts[1].slice(0, dec);
    return val;
}

function formatSafe(val, dec) {
    const full = ethers.formatUnits(val, dec);
    const parts = full.split(".");
    return parts.length > 1 ? parts[0] + "." + parts[1].slice(0, 4) : full;
}

// ===============================
// 🔌 AUTO CONNECT
// ===============================
async function initAutoConnect() {
    if (!window.ethereum) {
        log("Wallet tidak ditemukan ❌");
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts.length > 0) {
            log("Auto reconnect...");
            await connectWallet();
        } else {
            log("Wallet siap, belum connect");
        }
    } catch (err) {
        log("Init error: " + err.message);
    }
}

// ===============================
// 🔗 CONNECT WALLET
// ===============================
async function connectWallet() {
    if (!window.ethereum) {
        alert("Gunakan Metamask / OKX Wallet!");
        return;
    }

    try {
        log("Meminta koneksi...");

        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts || accounts.length === 0) {
            throw new Error("User tidak memilih akun");
        }

        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // UI UPDATE
        const btn = document.getElementById("btnConnect");
        const badge = document.getElementById("networkBadge");
        const swapBtn = document.getElementById("btnSwap");

        if (btn) {
            btn.innerText =
                userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        }

        if (badge) {
            badge.innerText = "Online";
            badge.style.background = "#16a34a";
        }

        if (swapBtn) swapBtn.disabled = false;

        log("Wallet terhubung ✅");

        await updateBalances();

    } catch (err) {
        log("Error koneksi ❌");
        console.error(err);
    }
}

// ===============================
// 🔄 WALLET LISTENERS
// ===============================
function setupWalletListeners() {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            log("Wallet disconnect");
            location.reload();
        } else {
            userAddress = accounts[0];
            connectWallet();
        }
    });

    window.ethereum.on("chainChanged", () => {
        log("Network berubah...");
        location.reload();
    });
}

// ===============================
// 💰 BALANCE ENGINE
// ===============================
async function updateBalances() {
    if (!userAddress || !provider) return;

    try {
        const tokenIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const tokenOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);

        const [b1, d1, b2, d2] = await Promise.all([
            tokenIn.balanceOf(userAddress),
            tokenIn.decimals(),
            tokenOut.balanceOf(userAddress),
            tokenOut.decimals()
        ]);

        tokenDecimals = d1;

        const elIn = document.getElementById('balIn');
        const elOut = document.getElementById('balOut');

        if (elIn) elIn.innerText = `Saldo: ${formatSafe(b1, d1)}`;
        if (elOut) elOut.innerText = `Saldo: ${formatSafe(b2, d2)}`;

        log("Saldo diperbarui");

    } catch (err) {
        log("Gagal ambil saldo");
        console.error(err);
    }
}

// ===============================
// 🚀 SWAP ENGINE
// ===============================
async function executeSwap() {
    const rawVal = document.getElementById('inputAmount')?.value;
    if (!rawVal || rawVal <= 0) return log("Masukkan jumlah valid!");

    try {
        const cleanVal = sanitizeInput(rawVal, tokenDecimals);
        const amtWei = ethers.parseUnits(cleanVal, tokenDecimals);

        const tokenIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek allowance...");
        const allowance = await tokenIn.allowance(userAddress, CONFIG.ROUTER);

        if (allowance < amtWei) {
            log("Approval...");
            await (await tokenIn.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait();
        }

        log("Swap berjalan...");
        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtWei, 0);
        await tx.wait();

        log("SWAP SUCCESS 🔥");
        alert("Swap berhasil!");

        updateBalances();

    } catch (err) {
        let msg = err.reason || err.message;
        log("Gagal: " + msg);
        console.error(err);
    }
}

// ===============================
// 🎬 INIT (ONE ENTRY POINT)
// ===============================
window.onload = () => {
    log("System booting...");

    // tombol connect
    const btn = document.getElementById("btnConnect");
    if (btn) btn.onclick = connectWallet;

    // tombol swap
    const btnSwap = document.getElementById("btnSwap");
    if (btnSwap) btnSwap.onclick = executeSwap;

    // input sync UI
    const inputAmt = document.getElementById('inputAmount');
    if (inputAmt) {
        inputAmt.oninput = (e) => {
            const out = document.getElementById('outputAmount');
            if (out) out.value = e.target.value;
        };
    }

    initAutoConnect();
    setupWalletListeners();

    // 🔥 AUTO REFRESH BALANCE (REAL UX)
    setInterval(updateBalances, 10000);
};
