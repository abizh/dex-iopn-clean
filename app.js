/**
 * BOZZDEX V2.6 - VALIDATED FROM EXPLORER
 * Source: testnet.iopn.tech
 */

// ===============================
// DATA RESMI (VALIDATED)
// ===============================
const CONFIG = {
    CHAIN_ID: "0x3d8", // 984
    CHAIN_NAME: "OPN Testnet",
    RPC_URL: "https://testnet-rpc2.iopn.tech",
    EXPLORER: "https://testnet.iopn.tech",
    SYMBOL: "OPN",
    
    // ALAMAT KONTRAK (VERIFIED FROM EXPLORER)
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",   // Wrapped OPN (WOPN)
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"  // OPN Testnet (OPNT)
};

const ABIS = {
    ROUTER: ["function swap(address,address,uint256,uint256) external"],
    ERC20: [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function approve(address,uint256) external returns (bool)",
        "function allowance(address,address) view returns (uint256)"
    ]
};

let provider, signer, userAddress;
let decimalsIn = 18;

// ===============================
// LOGGER
// ===============================
function log(msg, err = false) {
    const el = document.getElementById("statusLog");
    if (el) {
        el.innerText = "> " + msg;
        el.style.color = err ? "#f85149" : "#7ee787";
    }
}

// ===============================
// NETWORK GUARD
// ===============================
async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.CHAIN_ID }],
        });
    } catch (error) {
        if (error.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: CONFIG.CHAIN_ID,
                    chainName: CONFIG.CHAIN_NAME,
                    rpcUrls: [CONFIG.RPC_URL],
                    nativeCurrency: { name: "OPN", symbol: CONFIG.SYMBOL, decimals: 18 },
                    blockExplorerUrls: [CONFIG.EXPLORER]
                }],
            });
        }
    }
}

// ===============================
// WALLET CORE
// ===============================
async function connectWallet() {
    if (!window.ethereum) return alert("Gunakan Metamask / OKX Wallet!");

    try {
        log("Sinkronisasi Jaringan...");
        await switchNetwork();

        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.getNetwork();
        signer = await provider.getSigner();

        // UI SYNC
        const btn = document.getElementById("btnConnect");
        if (btn) btn.innerText = userAddress.slice(0,6)+"..."+userAddress.slice(-4);
        
        const badge = document.getElementById("networkBadge");
        if (badge) {
            badge.innerText = "OPN ONLINE";
            badge.style.background = "#238636";
        }

        document.getElementById("btnSwap").disabled = false;

        log("Terhubung ke OPN Testnet ✅");
        await updateBalances();

    } catch (err) {
        log("Gagal konek: " + err.message.slice(0,20), true);
    }
}

// ===============================
// BALANCE ENGINE (OPTIMIZED)
// ===============================
async function updateBalances() {
    if (!userAddress || !provider) return;
    
    try {
        // Pastikan kita pakai provider terbaru
        const currentProvider = new ethers.BrowserProvider(window.ethereum);
        const cIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, currentProvider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, currentProvider);

        // Ambil data secara paralel
        const [b1, d1, b2, d2] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress),
            cOut.decimals()
        ]);

        decimalsIn = Number(d1);

        // Formatting saldo dengan presisi 4 angka di belakang titik
        const formatBal = (val, dec) => {
            const formatted = ethers.formatUnits(val, dec);
            return parseFloat(formatted).toFixed(4); 
        };

        // Update UI - Paksa ganti koma jadi titik jika ada
        const balInVal = formatBal(b1, d1).replace(',', '.');
        const balOutVal = formatBal(b2, d2).replace(',', '.');

        document.getElementById("balIn").innerText = "Saldo: " + balInVal;
        document.getElementById("balOut").innerText = "Saldo: " + balOutVal;

        console.log("Balance Sync Success:", { balInVal, balOutVal });
    } catch (e) { 
        console.error("Balance Error:", e);
        // Retry sekali lagi setelah 2 detik kalau gagal
        setTimeout(updateBalances, 2000);
    }
}

// ===============================
// INPUT SYNC (ANTI-KOMA)
// ===============================
// Cari bagian DOMContentLoaded lo, dan ganti input oninput-nya:
input.oninput = (e) => {
    // Ambil value, ganti koma ke titik secara real-time
    let val = e.target.value.replace(',', '.');
    e.target.value = val; // Set balik ke input agar tetap titik
    document.getElementById("outputAmount").value = val;
};

// ===============================
// SWAP ENGINE
// ===============================
async function executeSwap() {
    const val = document.getElementById("inputAmount").value;
    if (!val || val <= 0) return log("Input Kosong!", true);

    try {
        log("Menyiapkan Transaksi...");
        const amt = ethers.parseUnits(val.toString(), decimalsIn);
        const tIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Mengecek Izin (Allowance)...");
        const allowance = await tIn.allowance(userAddress, CONFIG.ROUTER);
        
        if (allowance < amt) {
            log("Meminta Persetujuan Token...");
            const txA = await tIn.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await txA.wait();
        }

        log("Melakukan Swap...");
        const txS = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        log("Menunggu Konfirmasi...");
        await txS.wait();

        log("Swap Berhasil! 🔥");
        await updateBalances();
    } catch (e) {
        log("Transaksi Gagal ❌", true);
    }
}

// ===============================
// INITIALIZER
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnConnect");
    const swap = document.getElementById("btnSwap");
    const input = document.getElementById("inputAmount");

    if (btn) btn.onclick = connectWallet;
    if (swap) swap.onclick = executeSwap;
    if (input) {
        input.oninput = (e) => {
            document.getElementById("outputAmount").value = e.target.value;
        };
    }

    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(acc => {
            if (acc.length > 0) connectWallet();
        });
        
        window.ethereum.on("accountsChanged", () => location.reload());
        window.ethereum.on("chainChanged", () => location.reload());
    }
});
