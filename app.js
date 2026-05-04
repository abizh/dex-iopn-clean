const CONFIG = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const ABIS = {
    ROUTER: ["function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external"],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
    ]
};

let provider, signer, userAddress;

// Fungsi Log yang Aman (Cek element dulu)
function log(msg) {
    const statusLog = document.getElementById('statusLog');
    if (statusLog) statusLog.innerText = `> ${msg}`;
    console.log(`[DEX]: ${msg}`);
}

//  AUTO-DETECT STATE (Titik Lemah ke-3 kamu)
async function initAutoConnect() {
    if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            log("Mendeteksi koneksi lama...");
            await connectWallet(); // Auto connect kalau sudah pernah izin
        }
    }
}

// ===============================
// 🔥 GLOBAL STATE
// ===============================
let provider, signer, userAddress;
let balanceInterval = null;

// ===============================
// 🧠 LOGGER AMAN
// ===============================
function log(msg) {
    const statusLog = document.getElementById('statusLog');
    if (statusLog) statusLog.innerText = `> ${msg}`;
    console.log(`[BOZZDEX]: ${msg}`);
}

// ===============================
// 🔄 AUTO CONNECT (CEK SESSION)
// ===============================
async function initAutoConnect() {
    if (!window.ethereum) return;

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts.length > 0) {
            log("Mendeteksi koneksi lama...");
            await connectWallet();
        }
    } catch (err) {
        console.error("AutoConnect Error:", err);
    }
}

// ===============================
// ⚙️ START AUTO BALANCE REFRESH
// ===============================
function startAutoUpdate() {
    if (balanceInterval) clearInterval(balanceInterval);

    // refresh tiap 10 detik
    balanceInterval = setInterval(() => {
        updateBalances();
    }, 10000);
}

// ===============================
// 🔌 CONNECT WALLET (FINAL FIX)
// ===============================
async function connectWallet() {
    if (!window.ethereum) {
        alert("Gunakan Browser Metamask / OKX!");
        return;
    }

    try {
        log("Menghubungkan wallet...");

        // request akun
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        userAddress = accounts[0];

        // setup provider & signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // 🔥 paksa sinkronisasi network
        await provider.getNetwork();

        // ===============================
        // 🎨 UPDATE UI
        // ===============================
        const btnConn = document.getElementById('btnConnect');
        const badge = document.getElementById('networkBadge');
        const btnSwap = document.getElementById('btnSwap');

        if (btnConn) {
            btnConn.innerText =
                userAddress.substring(0, 6) +
                "..." +
                userAddress.substring(38);
        }

        if (badge) {
            badge.innerText = "Online";
            badge.style.background = "#238636";
        }

        if (btnSwap) btnSwap.disabled = false;

        log("Wallet terhubung ✅");

        // ===============================
        // 💰 LOAD BALANCE AWAL
        // ===============================
        await updateBalances();

        // ===============================
        // 🔄 AUTO REFRESH BALANCE
        // ===============================
        startAutoUpdate();

        // ===============================
        // ⚡ REALTIME MODE (OPTIONAL PRO)
        // ===============================
        provider.on("block", () => {
            updateBalances();
        });

    } catch (err) {
        console.error(err);

        if (err.code === 4001) {
            log("User menolak koneksi ❌");
        } else {
            log("Gagal koneksi wallet ❌");
        }
    }
}

async function updateBalances() {
    if (!userAddress || !provider) {
        log("Provider / Wallet belum siap...");
        return;
    }

    try {
        log("Mengambil saldo token...");

        const tIn = new ethers.Contract(CONFIG.T_IN, [
            ...ABIS.ERC20,
            "function decimals() view returns (uint8)"
        ], provider);

        const tOut = new ethers.Contract(CONFIG.T_OUT, [
            ...ABIS.ERC20,
            "function decimals() view returns (uint8)"
        ], provider);

        // 🔥 Ambil balance + decimals sekaligus
        const [b1, b2, d1, d2] = await Promise.all([
            tIn.balanceOf(userAddress),
            tOut.balanceOf(userAddress),
            tIn.decimals(),
            tOut.decimals()
        ]);

        // 🔥 Format sesuai decimals asli
        const formatted1 = ethers.formatUnits(b1, d1);
        const formatted2 = ethers.formatUnits(b2, d2);

        // 🔥 Update UI
        const elIn = document.getElementById('balIn');
        const elOut = document.getElementById('balOut');

        if (elIn) elIn.innerText = `Saldo: ${Number(formatted1).toFixed(4)}`;
        if (elOut) elOut.innerText = `Saldo: ${Number(formatted2).toFixed(4)}`;

        log("Saldo berhasil diperbarui ");

    } catch (err) {
        console.error(err);

        log("Gagal ambil saldo, retry 2 detik...");

        // Retry otomatis (biar ga dead)
        setTimeout(updateBalances, 2000);
    }
}

async function executeSwap() {
    const val = document.getElementById('inputAmount')?.value;
    if (!val || val <= 0) return log("Input nol!");

    try {
        const amtWei = ethers.parseUnits(val, 18);
        const tokenIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek Approval...");
        const allow = await tokenIn.allowance(userAddress, CONFIG.ROUTER);
        if (allow < amtWei) {
            log("Minta Izin...");
            await (await tokenIn.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait();
        }

        log("Swap dimulai...");
        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtWei, 0);
        await tx.wait();
        log("SUKSES!");
        alert("Swap Berhasil!");
        updateBalances();
    } catch (err) {
        log("Gagal: " + (err.reason || "Cek Saldo/Gas"));
    }
}

// JALANKAN SUTRADARA SAAT PANGGUNG SIAP
window.onload = () => {
    initAutoConnect();
    // Sinkronisasi input box
    const inBox = document.getElementById('inputAmount');
    if (inBox) {
        inBox.oninput = (e) => {
            const outBox = document.getElementById('outputAmount');
            if (outBox) outBox.value = e.target.value;
        };
    }
};
