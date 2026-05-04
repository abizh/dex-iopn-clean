// ==========================================
// BOZZDEX V2.1 - MASTER LOGIC
// Router: 0xf24fcf8992A336662eB43232E702dE5b6449b6F3
// ==========================================

const DEX_ADDRESS = "0xf24fcf8992A336662eB43232E702dE5b6449b6F3";
const WOPN_ADDRESS = "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84";

// ABI Lengkap sesuai Master Code Solidity V2.1
const DEX_ABI = [
    "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
    "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external",
    "function removeLiquidityMulti(address tA, address tB, uint8 percentChoice, bool toNative) external",
    "function getPool(address tA, address tB) view returns (address)",
    "function fee() view returns (uint256)",
    "function treasury() view returns (address)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

let provider, signer, account;

// --- FUNGSI KONEKSI WALLET ---
async function connectWallet() {
    if (window.ethereum) {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            account = await signer.getAddress();
            
            const btn = document.getElementById('connectBtn');
            btn.innerText = account.substring(0,6) + "..." + account.substring(38);
            btn.classList.replace('btn-connect', 'wallet-active');
            
            document.getElementById('swapBtn').innerText = "MULAI PERDAGANGAN";
            console.log("BOZZDEX Connected:", account);
        } catch (error) {
            console.error("Koneksi Gagal:", error);
        }
    } else {
        alert("Silakan install MetaMask atau gunakan Web3 Browser!");
    }
}

// --- FUNGSI EKSEKUSI SWAP ---
async function executeSwap() {
    if (!signer) return connectWallet();
    
    const amtInValue = document.getElementById('amtIn').value;
    if (!amtInValue || amtInValue <= 0) return alert("Masukkan jumlah token!");

    try {
        const dexContract = new ethers.Contract(DEX_ADDRESS, DEX_ABI, signer);
        const amountWei = ethers.parseEther(amtInValue);
        
        // Contoh Swap: User menukar Token A ke wOPN
        // Dalam implementasi nyata, address tIn diambil dari dropdown 'Select Token'
        const tokenIn = "0x...ALAMAT_TOKEN_USER..."; 
        const tokenOut = WOPN_ADDRESS;

        // 1. Cek & Approve Token Terlebih Dahulu
        const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
        console.log("Meminta Izin (Approval)...");
        const appTx = await tokenContract.approve(DEX_ADDRESS, amountWei);
        await appTx.wait();

        // 2. Eksekusi Swap
        console.log("Mengeksekusi Swap di Router...");
        const swapTx = await dexContract.swap(tokenIn, tokenOut, amountWei, 0); // minOut=0 untuk tes
        await swapTx.wait();

        alert("Swap Berhasil! Saldo akan segera diperbarui.");
    } catch (error) {
        console.error("Detail Error:", error);
        alert("Transaksi Gagal. Cek Konsol Termux/Browser.");
    }
}

// --- EVENT LISTENERS ---
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.getElementById('swapBtn').addEventListener('click', executeSwap);

// Listener untuk Toggle Native (Ciri khas V2.1)
document.getElementById('toNativeToggle').addEventListener('change', function() {
    if(this.checked) {
        console.log("Mode: Auto-Unwrap ke Native OPN Aktif");
    }
});
