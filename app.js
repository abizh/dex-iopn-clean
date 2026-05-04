const DEX_ADDRESS = "0xf24fcf8992A336662eB43232E702dE5b6449b6F3"; 
const ABI = [
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const provider = new ethers.BrowserProvider(window.ethereum);

// FUNGSI UTAMA: MENGHIDUPKAN ANGKA OUTPUT
async function updateEstimate() {
    const inputAmount = document.getElementById('inputAmount').value;
    const outputField = document.getElementById('outputAmount');
    
    if (!inputAmount || inputAmount <= 0) {
        outputField.value = "0.0";
        return;
    }

    try {
        const contract = new ethers.Contract(DEX_ADDRESS, ABI, provider);
        const amountIn = ethers.parseEther(inputAmount);
        const path = ["0xTOKEN_A", "0xTOKEN_B"]; // GANTI DENGAN ADDR TOKEN ASLI

        const amounts = await contract.getAmountsOut(amountIn, path);
        outputField.value = ethers.formatEther(amounts[1]);
        console.log("Harga Berhasil Diupdate!");
    } catch (error) {
        console.error("Gagal ambil harga:", error);
        outputField.value = "Error Harga";
    }
}

// PASANG LISTENER (Biar UI Bergerak saat Diketik)
document.getElementById('inputAmount').addEventListener('input', updateEstimate);

async function executeSwap() {
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(DEX_ADDRESS, ABI, signer);
        // ... Logika swap kamu ...
        alert("Transaksi Berhasil dikirim ke Blockchain!");
    } catch (error) {
        alert("Detail Error: " + error.message);
    }
}
