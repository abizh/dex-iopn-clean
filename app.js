// ==========================================================
// 🚀 BOZZDEX MEGA-MASTER CODE - V2.5 (CEX HISTORY EDITION)
// ==========================================================

const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d"),
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"
};

const ABI_TOKEN = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) external returns (bool)"
];

const ABI_ROUTER = [
    "function getPool(address tokenA, address tokenB) view returns (address)",
    "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
    "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external",
    "function removeLiquidityMulti(address tA, address tB, uint8 percentChoice, bool toNative) external"
];

const ABI_POOL = [
    // reserve
    "function reserve0() view returns (uint112)",
    "function reserve1() view returns (uint112)",
    "function token0() view returns (address)",

    // LP ERC20
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
    "function approve(address,uint256) returns(bool)"
];

let walletProvider, rpcProvider, signer, userAddress, debounceTimer;

// --- UI LOGGERS ---
function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) el.innerHTML = (isError ? "❌ " : "> ") + msg;
}

// --- CORE WALLET ---
async function connect() {
    if (!window.ethereum) return alert("Install Wallet!");
    try {
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();
        document.getElementById("btnConnect").innerText = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        document.querySelectorAll(".btn-action").forEach(b => b.disabled = false);
        log("Connected ✅");
        updateBalances();
    } catch (err) { log("Conn Failed", true); }
}

async function updateBalances() {
    if (!userAddress || !rpcProvider) return;
    const cIn = new ethers.Contract(CONFIG.T_IN, ABI_TOKEN, rpcProvider);
    const cOut = new ethers.Contract(CONFIG.T_OUT, ABI_TOKEN, rpcProvider);
    const [bIn, bOut] = await Promise.all([cIn.balanceOf(userAddress), cOut.balanceOf(userAddress)]);
    document.getElementById("balIn").innerText = "Saldo: " + ethers.formatUnits(bIn, 18);
    document.getElementById("balOut").innerText = "Saldo: " + ethers.formatUnits(bOut, 18);
}

// --- PRICE IMPACT LOGIC ---
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");
    input.oninput = (e) => {
        let val = e.target.value.replace(",", ".");
        if (!val || isNaN(val) || val <= 0) { output.value = ""; return; }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const router = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, rpcProvider);
                const poolAddr = await router.getPool(CONFIG.T_IN, CONFIG.T_OUT);
                const pool = new ethers.Contract(poolAddr, ABI_POOL, rpcProvider);
                const [r0, r1, t0] = await Promise.all([pool.reserve0(), pool.reserve1(), pool.token0()]);
                const resIn = Number(ethers.formatUnits(CONFIG.T_IN === t0 ? r0 : r1, 18));
                const resOut = Number(ethers.formatUnits(CONFIG.T_IN === t0 ? r1 : r0, 18));
                const amtIn = Number(val);
                const amtOut = (amtIn * 0.997 * resOut) / (resIn + (amtIn * 0.997));
                output.value = amtOut.toFixed(18);
                const impact = (((resOut / resIn) - (amtOut / amtIn)) / (resOut / resIn) * 100);
                const color = impact > 5 ? "#da3633" : "#7ee787";
                log(`Price Impact: <span style="color:${color}; font-weight:bold;">${impact.toFixed(2)}%</span> ${impact > 5 ? '⚠️' : '✅'}`);
            } catch (err) { output.value = "Error"; }
        }, 400);
    };
}

// --- TRANSACTION HISTORY ENGINE ---
function saveTx(type, hash, status) {
    let history = JSON.parse(localStorage.getItem("bozz_history") || "[]");
    history.unshift({ type, hash, time: new Date().toLocaleTimeString(), status });
    if (history.length > 10) history.pop();
    localStorage.setItem("bozz_history", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById("txList");
    let history = JSON.parse(localStorage.getItem("bozz_history") || "[]");
    if (history.length === 0) return list.innerHTML = `<div style="text-align:center; font-size:10px; color:#484f58; padding:10px;">No history found</div>`;
    list.innerHTML = history.map(tx => `
        <div style="background:#0d1117; padding:8px; border-radius:8px; border:1px solid #30363d; font-size:10px; margin-bottom:5px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:bold; color:${tx.status==='Success'?'#7ee787':'#da3633'}">${tx.type}</span>
                <span style="color:#8b949e;">${tx.time}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <a href="https://testnet.iopn.tech/tx/${tx.hash}" target="_blank" style="color:#58a6ff; text-decoration:none;">${tx.hash.slice(0,10)}...${tx.hash.slice(-8)} ↗</a>
                <span>${tx.status}</span>
            </div>
        </div>
    `).join('');
}

function clearHistory() { 
    if(confirm("Hapus semua history?")) { localStorage.removeItem("bozz_history"); renderHistory(); }
}

// --- ACTIONS ---
async function ensureApproval(token, amt) {
    const c = new ethers.Contract(token, ABI_TOKEN, signer);
    log("Meminta Izin (Approve)... 🛡️");
    
    // Kita minta izin SEJUMLAH amt yang akan ditransaksikan
    // Ini lebih aman daripada MaxUint256
    const tx = await c.approve(CONFIG.BOZZ_ROUTER, amt);
    log("Menunggu Konfirmasi Approve... ⏳");
    await tx.wait();
    log("Izin Diberikan! ✅");
}

async function executeSwap() {
    try {
        const val = document.getElementById("inputAmount").value;
        const amtIn = ethers.parseUnits(val, 18);
        
        // 1. WAJIB APPROVE DULU (Gaya Rabby)
        await ensureApproval(CONFIG.T_IN, amtIn);
        
        // 2. BARU EKSEKUSI SWAP
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
        const minOut = (ethers.parseUnits(document.getElementById("outputAmount").value, 18) * 97n) / 100n;
        
        log("Konfirmasi Swap... ⏳");
        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut);
        await tx.wait();
        
        saveTx("Swap WOPN ➔ OPNT", tx.hash, "Success");
        log("Swap Success 🔥");
        updateBalances();
    } catch (err) { log("Transaksi Dibatalkan/Gagal", true); }
}

async function executeAddLiquidity() {
    try {
        const amtA = ethers.parseUnits(document.getElementById("inputAmtA").value, 18);
        const amtB = ethers.parseUnits(document.getElementById("inputAmtB").value, 18);
        await ensureApproval(CONFIG.T_IN, amtA);
        await ensureApproval(CONFIG.T_OUT, amtB);
        log("Adding Liquidity... ⏳");
        const tx = await (new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer)).addLiquidity(CONFIG.T_IN, CONFIG.T_OUT, amtA, amtB);
        await tx.wait();
        saveTx("Add Liquidity", tx.hash, "Success");
        log("Liquidity Added! 💉");
        updateBalances();
    } catch (err) { log("Add Liq Error", true); }
}

window.executeRemoveLiquidity = async (percent) => {

    try {

        // =========================
        // ROUTER
        // =========================
        const dex = new ethers.Contract(
            CONFIG.BOZZ_ROUTER,
            ABI_ROUTER,
            signer
        );

        // =========================
        // AMBIL POOL ADDRESS
        // =========================
        const poolAddress = await dex.getPool(
            CONFIG.T_IN,
            CONFIG.T_OUT
        );

        console.log("POOL:", poolAddress);

        // =========================
        // LP ABI
        // =========================
        const ABI_LP = [
            "function balanceOf(address) view returns(uint256)",
            "function allowance(address,address) view returns(uint256)",
            "function approve(address,uint256) returns(bool)"
        ];

        // =========================
        // LP CONTRACT
        // =========================
        const lp = new ethers.Contract(
            poolAddress,
            ABI_LP,
            signer
        );

        // =========================
        // CEK LP BALANCE
        // =========================
        const lpBalance = await lp.balanceOf(userAddress);

        console.log("LP BALANCE:", lpBalance.toString());

        if (lpBalance <= 0n) {
            log("LP Balance kosong ❌", true);
            return;
        }

        // =========================
        // CEK APPROVAL
        // =========================
        const allowance = await lp.allowance(
            userAddress,
            CONFIG.BOZZ_ROUTER
        );

        console.log("ALLOWANCE:", allowance.toString());

        // =========================
        // APPROVE JIKA BELUM
        // =========================
        if (allowance < lpBalance) {

            log("Approve LP...");

            const txApprove = await lp.approve(
                CONFIG.BOZZ_ROUTER,
                ethers.MaxUint256
            );

            await txApprove.wait();

            log("LP Approved ✅");
        }

window.executeRemoveLiquidity = async function(percent) {
    try {
        log("Menyiapkan penarikan... 🔄");
        
        // 1. Inisialisasi Provider & Signer Fresh
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const user = await signer.getAddress();
        
        const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);

        // 2. Ambil Alamat Pool (Penyebab utama missing revert data kalau salah)
        log("Mencari alamat kolam... 🔍");
        const poolAddr = await dex.getPool(CONFIG.T_IN, CONFIG.T_OUT);
        
        if (!poolAddr || poolAddr === ethers.ZeroAddress) {
            log("Kolam tidak ditemukan! ❌", true);
            return;
        }

        // 3. Cek Saldo LP (Harus ada isinya)
        const lpToken = new ethers.Contract(poolAddr, ABI_TOKEN, signer);
        const bal = await lpToken.balanceOf(user);
        
        if (bal === 0n) {
            log("Saldo LP Anda 0. Tidak ada yang bisa ditarik!", true);
            return;
        }

        // 4. Hitung Jumlah & MAPPING PERSEN
        const p = Number(percent);
        const mapPct = { 1: 25n, 2: 50n, 3: 75n, 4: 100n };
        const amtToApprove = (bal * mapPct[p]) / 100n;

        // 🛡️ STEP 1: APPROVE LP TOKEN (Wajib Gaya Rabby)
        // Tanpa ini, pasti muncul "missing revert data" saat execute
        log(`Izin Tarik ${mapPct[p]}% LP... 🛡️`);
        try {
            const txA = await lpToken.approve(CONFIG.BOZZ_ROUTER, amtToApprove);
            log("Menunggu persetujuan izin... ⏳");
            await txA.wait();
            log("Izin diberikan! ✅");
        } catch (approveErr) {
            log("Gagal memberikan izin! ❌", true);
            return;
        }

        // 🚀 STEP 2: EKSEKUSI REMOVE (Gunakan Gas Limit Manual untuk cegah Revert)
        log("Konfirmasi penarikan koin... ⏳");
        const txR = await dex.removeLiquidityMulti(
            CONFIG.T_IN, 
            CONFIG.T_OUT, 
            p, 
            false, 
            { gasLimit: 500000 } // Tambahin bensin biar gak sesak napas
        );
        
        log("Menunggu konfirmasi blok... ⏳");
        await txR.wait();
        
        const label = mapPct[p].toString() + '%';
        saveTx(`Remove Liq ${label}`, txR.hash, "Success");
        log(`Sukses! Modal ${label} sudah balik. 💸`);
        updateBalances();

    } catch (err) {
        console.error("ERROR LENGKAP:", err);
        // Tangani pesan error spesifik
        if (err.message.includes("user rejected")) {
            log("Transaksi dibatalkan user. ❌", true);
        } else {
            log("❌ missing revert data (Cek Saldo LP)", true);
        }
    }
};

        
document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    renderHistory();
    document.getElementById("btnConnect").onclick = connect;
    document.getElementById("btnSwap").onclick = executeSwap;
    document.getElementById("btnLiquidity").onclick = executeAddLiquidity;
});
        
