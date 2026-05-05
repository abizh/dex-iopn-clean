/**
 * BOZZDEX V2.4 - THE GOD-EYE FIX
 */

const CONFIG = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) view returns (uint256)"
];

const ROUTER_ABI = ["function swap(address,address,uint256,uint256) external"];

let provider, signer, userAddress;
let decimalsIn = 18;

function log(msg, err = false) {
    const el = document.getElementById("statusLog");
    if (el) {
        el.innerText = "> " + msg;
        el.style.color = err ? "#f85149" : "#7ee787";
    }
}

async function connectWallet() {
    if (!window.ethereum) return alert("Buka di App Metamask/OKX!");

    try {
        log("Membuka dompet...");
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];

        // RE-INIT PROVIDER (V6 STABLE)
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // PASTIIN NETWORK KONEK DULU
        await provider.getNetwork();
        
        // AMBIL SIGNER SECARA ASYNC
        signer = await provider.getSigner();

        // UPDATE UI
        document.getElementById("btnConnect").innerText = userAddress.slice(0,6)+"..."+userAddress.slice(-4);
        document.getElementById("networkBadge").innerText = "Online";
        document.getElementById("networkBadge").style.background = "#238636";
        document.getElementById("btnSwap").disabled = false;

        log("Wallet Terhubung! ✅");
        await updateBalances();

    } catch (err) {
        log("Error: " + (err.message.slice(0,25)), true);
        console.error(err);
    }
}

async function updateBalances() {
    if (!userAddress || !provider) return;
    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ERC20_ABI, provider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ERC20_ABI, provider);

        const [b1, d1, b2] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress)
        ]);

        decimalsIn = Number(d1);
        document.getElementById("balIn").innerText = "Saldo: " + ethers.formatUnits(b1, d1);
        document.getElementById("balOut").innerText = "Saldo: " + ethers.formatUnits(b2, 18);
    } catch (e) { console.log(e); }
}

async function executeSwap() {
    const val = document.getElementById("inputAmount").value;
    if (!val || val <= 0) return log("Input Kosong!", true);

    try {
        log("Proses Swap...");
        const amt = ethers.parseUnits(val.toString(), decimalsIn);
        const tIn = new ethers.Contract(CONFIG.T_IN, ERC20_ABI, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);

        log("Cek Approval...");
        const allowance = await tIn.allowance(userAddress, CONFIG.ROUTER);
        
        if (allowance < amt) {
            log("Approve Token...");
            const tx = await tIn.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await tx.wait();
        }

        log("Kirim Swap...");
        const txS = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        await txS.wait();

        log("Sukses! 🔥🚀");
        updateBalances();
    } catch (e) {
        log("Gagal!", true);
    }
}

// SATU PINTU INITIALIZER
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnConnect");
    const swap = document.getElementById("btnSwap");
    const input = document.getElementById("inputAmount");

    if (btn) btn.onclick = connectWallet;
    if (swap) swap.onclick = executeSwap;
    if (input) input.oninput = (e) => {
        document.getElementById("outputAmount").value = e.target.value;
    };

    // Auto reconnect jika sudah pernah login
    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
            if (accounts.length > 0) connectWallet();
        });
        
        window.ethereum.on("accountsChanged", () => location.reload());
        window.ethereum.on("chainChanged", () => location.reload());
    }
});
