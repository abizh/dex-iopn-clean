// BOZZDEX V2.1 - PRODUCTION LOGIC
const DEX_ADDRESS = "0xf24fcf8992A336662eB43232E702dE5b6449b6F3";

const DEX_ABI = [
  "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
  "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external",
  "function getPool(address tA, address tB) view returns (address)",
  "function wOPN() view returns (address)",
  "function removeLiquidityMulti(address tA, address tB, uint8 percentChoice, bool toNative) external"
];

let provider, signer, account;

async function connectWallet() {
    if (window.ethereum) {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            account = accounts[0];
            
            const btn = document.getElementById('connectBtn');
            btn.innerText = account.substring(0,6) + "..." + account.substring(38);
            btn.classList.add('wallet-active');
            document.getElementById('swapBtn').innerText = "MULAI PERDAGANGAN";
            console.log("BOZZDEX Live:", account);
        } catch (e) { alert("Koneksi Gagal!"); }
    } else { alert("Gunakan Mises Browser!"); }
}

async function executeSwap() {
    if (!signer) return connectWallet();
    const val = document.getElementById('amtIn').value;
    if (!val || val <= 0) return alert("Isi jumlah!");

    try {
        const contract = new ethers.Contract(DEX_ADDRESS, DEX_ABI, signer);
        const amtWei = ethers.parseEther(val);
        
        // Ambil wOPN otomatis dari contract
        const tOut = await contract.wOPN();
        const tIn = "0xTOKEN_ADDRESS_DI_SINI"; // Masukkan alamat token yang mau di-swap

        console.log("Proses Swap ke Router...");
        const tx = await contract.swap(tIn, tOut, amtWei, 0);
        await tx.wait();
        alert("Swap Berhasil! 🔥");
    } catch (err) {
        console.error(err);
        alert("Gagal: " + (err.reason || "Cek Saldo/Approval"));
    }
}

document.getElementById('connectBtn').onclick = connectWallet;
document.getElementById('swapBtn').onclick = executeSwap;
