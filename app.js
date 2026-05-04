const CONFIG = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
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

// 1. Fungsi Log yang Aman (Cek element dulu)
function log(msg) {
    const statusLog = document.getElementById('statusLog');
    if (statusLog) statusLog.innerText = `> ${msg}`;
    console.log(`[DEX]: ${msg}`);
}

// 2. AUTO-DETECT STATE (Titik Lemah ke-3 kamu)
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

// 3. FUNGSI KONEKSI (Titik Lemah ke-1 & 2)
async function connectWallet() {
    if (!window.ethereum) return alert("Gunakan Browser Metamask/OKX!");

    try {
        log("Menghubungkan...");
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Update UI secara aman
        const btnConn = document.getElementById('btnConnect');
        const badge = document.getElementById('networkBadge');
        const btnSwp = document.getElementById('btnSwap');

        if (btnConn) btnConn.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        if (badge) {
            badge.innerText = "Online";
            badge.style.background = "#238636";
        }
        if (btnSwp) btnSwp.disabled = false;

        log("Siap Tempur!");
        updateBalances();
    } catch (err) {
        log("Koneksi dibatalkan.");
    }
}

async function updateBalances() {
    if (!userAddress || !provider) return;
    try {
        const tIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const tOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);
        const [b1, b2] = await Promise.all([tIn.balanceOf(userAddress), tOut.balanceOf(userAddress)]);
        
        if(document.getElementById('balIn')) document.getElementById('balIn').innerText = `Saldo: ${ethers.formatUnits(b1, 18)}`;
        if(document.getElementById('balOut')) document.getElementById('balOut').innerText = `Saldo: ${ethers.formatUnits(b2, 18)}`;
    } catch (e) { console.error(e); }
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
