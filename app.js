// ================================
// BOZZDEX V2.1 MASTER SCRIPT
// ================================

const DEX_ADDRESS = "0xf24fcf8992A336662eB43232E702dE5b6449b6F3";

// 🔥 GANTI SESUAI TOKEN REAL KAMU
const TOKEN_IN = "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84";
const TOKEN_OUT = "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d";

const DEX_ABI = [
    "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

let provider, signer, account;

// ================================
// CONNECT WALLET
// ================================
async function connectWallet() {
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        account = await signer.getAddress();

        const btn = document.getElementById("connectBtn");
        btn.innerText = account.slice(0,6) + "...";
        btn.classList.replace("btn-connect", "wallet-active");

        setStatus("Wallet connected ✔️");

    } catch (err) {
        console.error(err);
        setStatus("Connection failed ❌");
    }
}

// ================================
// ESTIMASI OUTPUT (SIMULASI)
// ================================
document.getElementById("amtIn").addEventListener("input", () => {
    const val = document.getElementById("amtIn").value;

    if (!val || val <= 0) {
        document.getElementById("amtOut").value = "";
        return;
    }

    // 🔥 SIMULASI (nanti bisa pakai reserve real)
    const estimate = val * 0.4;

    document.getElementById("amtOut").value = estimate;
});

// ================================
// SWAP EXECUTION
// ================================
async function executeSwap() {

    if (!signer) {
        return connectWallet();
    }

    const val = document.getElementById("amtIn").value;
    if (!val || val <= 0) {
        return alert("Masukkan jumlah dulu bro");
    }

    const amountWei = ethers.parseEther(val);

    try {

        setStatus("Checking allowance...");

        const token = new ethers.Contract(TOKEN_IN, ERC20_ABI, signer);
        const allowance = await token.allowance(account, DEX_ADDRESS);

        if (allowance < amountWei) {
            setStatus("Approving token...");
            const tx = await token.approve(DEX_ADDRESS, amountWei);
            await tx.wait();
        }

        const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, signer);

        // 🔥 slippage 3%
        const estimated = document.getElementById("amtOut").value;
        const minOut = ethers.parseEther((estimated * 0.97).toString());

        setStatus("Swapping...");

        const tx = await dex.swap(TOKEN_IN, TOKEN_OUT, amountWei, minOut);
        await tx.wait();

        setStatus("Swap success 🔥");

    } catch (err) {
        console.error(err);
        setStatus("Swap failed ❌");
    }
}

// ================================
// UI HELPER
// ================================
function setStatus(msg) {
    document.getElementById("status").innerText = msg;
}

// ================================
// EVENT
// ================================
document.getElementById("connectBtn").onclick = connectWallet;
document.getElementById("swapBtn").onclick = executeSwap;
