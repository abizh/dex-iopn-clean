// --- KONFIGURASI DAN SINKRONISASI ALAMAT ---
const RAW_ADDR = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

// Checksum Otomatis agar tidak Error "Bad Address"
const CONTRACTS = {
    ROUTER: ethers.getAddress(RAW_ADDR.ROUTER),
    T_IN: ethers.getAddress(RAW_ADDR.T_IN),
    T_OUT: ethers.getAddress(RAW_ADDR.T_OUT)
};

const ABIS = {
    ROUTER: [
        "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
        "function getPool(address, address) view returns (address)"
    ],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
    ]
};

let provider, signer, userAddress;

// UI Elements
const btnConnect = document.getElementById('btnConnect');
const btnSwap = document.getElementById('btnSwap');
const statusLog = document.getElementById('statusLog');
const inputAmt = document.getElementById('inputAmount');

// Logger Function
function log(msg) {
    statusLog.innerText = `> ${msg}`;
    console.log(`[DEX]: ${msg}`);
}

// Inisialisasi Event Listener setelah DOM siap
document.addEventListener('DOMContentLoaded', () => {
    btnConnect.addEventListener('click', connectWallet);
    btnSwap.addEventListener('click', executeSwap);
    
    // Sync Input (Estimasi 1:1 untuk testing)
    inputAmt.addEventListener('input', (e) => {
        document.getElementById('outputAmount').value = e.target.value;
    });
});

async function connectWallet() {
    if (!window.ethereum) return alert("Metamask tidak ditemukan!");

    try {
        log("Menghubungkan ke Metamask...");
        // Minta akun (Pop-up Metamask)
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Update UI
        btnConnect.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        btnConnect.style.borderColor = "#238636";
        document.getElementById('networkBadge').innerText = "Online";
        btnSwap.disabled = false;

        log("Wallet terhubung!");
        updateBalances();
    } catch (err) {
        log("Gagal konek: " + err.message);
        console.error(err);
    }
}

async function updateBalances() {
    if (!userAddress) return;
    try {
        const tIn = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, provider);
        const tOut = new ethers.Contract(CONTRACTS.T_OUT, ABIS.ERC20, provider);

        const [bal1, bal2] = await Promise.all([
            tIn.balanceOf(userAddress),
            tOut.balanceOf(userAddress)
        ]);

        document.getElementById('balIn').innerText = `Saldo: ${ethers.formatUnits(bal1, 18)}`;
        document.getElementById('balOut').innerText = `Saldo: ${ethers.formatUnits(bal2, 18)}`;
    } catch (err) {
        log("Gagal ambil saldo.");
    }
}

async function executeSwap() {
    const val = inputAmt.value;
    if (!val || val <= 0) return log("Masukkan jumlah token!");

    try {
        const amountWei = ethers.parseUnits(val, 18);
        const tokenIn = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONTRACTS.ROUTER, ABIS.ROUTER, signer);

        // 1. Cek Allowance
        log("Mengecek izin token...");
        const allowance = await tokenIn.allowance(userAddress, CONTRACTS.ROUTER);

        if (allowance < amountWei) {
            log("Meminta Approval...");
            const txApp = await tokenIn.approve(CONTRACTS.ROUTER, ethers.MaxUint256);
            await txApp.wait();
            log("Approval Berhasil!");
        }

        // 2. Eksekusi Swap
        log("Memproses Swap...");
        const txSwap = await dex.swap(
            CONTRACTS.T_IN,
            CONTRACTS.T_OUT,
            amountWei,
            0 // minOut 0 untuk testing likuiditas rendah
        );

        log("Menunggu konfirmasi...");
        await txSwap.wait();
        
        log("SWAP BERHASIL!");
        alert("Transaksi Sukses!");
        updateBalances();
    } catch (err) {
        log("Error: " + (err.reason || err.message));
        console.error(err);
    }
}
