// ==========================================
// BOZZDEX V2.1 - SINKRONISASI TOTAL
// ==========================================

const DEX_ADDRESS = "0xf24fcf8992A336662eB43232E702dE5b6449b6F3";
const WOPN_ADDRESS = "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84";

const DEX_ABI = [
    "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
    "function getPool(address tA, address tB) view returns (address)"
];

let provider, signer, account;

async function connectWallet() {
    console.log("Mencoba menghubungkan wallet...");
    
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Gunakan BrowserProvider untuk ethers v6
            provider = new ethers.BrowserProvider(window.ethereum);
            
            // Request akun
            const accounts = await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            account = accounts[0];

            console.log("Terkoneksi ke:", account);

            // Update UI - Gunakan ID yang sesuai di HTML: 'connectBtn'
            const btn = document.getElementById('connectBtn');
            if (btn) {
                btn.innerText = account.substring(0, 6) + "..." + account.substring(38);
                btn.classList.remove('btn-connect');
                btn.classList.add('wallet-active');
            }

            const swapBtn = document.getElementById('swapBtn');
            if (swapBtn) {
                swapBtn.innerText = "MULAI PERDAGANGAN";
            }

            alert("Wallet Berhasil Terhubung!");
        } catch (error) {
            console.error("User menolak atau error:", error);
            alert("Koneksi dibatalkan.");
        }
    } else {
        alert("Wallet tidak terdeteksi! Gunakan Mises Browser atau Kiwi Browser.");
    }
}

// Pasang event listener setelah DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    const cBtn = document.getElementById('connectBtn');
    if (cBtn) {
        cBtn.onclick = connectWallet; // Gunakan .onclick untuk kepastian di mobile
    }
});
