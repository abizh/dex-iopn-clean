/**
 * BOZZDEX V2.1 - FINAL STABLE BUILD
 */

// ===============================
// CONFIG
// ===============================
const CONFIG = {
    ROUTER: ethers.getAddress("0x98cbC837fD05cA7b0ed075990667E93ae0EE1961"),
    T_IN: ethers.getAddress("0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84"),
    T_OUT: ethers.getAddress("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d")
};

const ABIS = {
    ROUTER: ["function swap(address,address,uint256,uint256) external"],
    ERC20: [
        "function approve(address,uint256) external returns (bool)",
        "function allowance(address,address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

// ===============================
// STATE
// ===============================
let provider = null;
let signer = null;
let userAddress = null;
let tokenDecimals = 18;

// ===============================
// LOGGER
// ===============================
function log(msg) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = "> " + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// WALLET CONNECT
// ===============================
async function connectWallet() {
    if (!window.ethereum) {
        alert("Gunakan Metamask / OKX Wallet");
        return;
    }

    try {
        log("Meminta koneksi...");

        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts.length) throw new Error("No account");

        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // UI Update
        document.getElementById("btnConnect").innerText =
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

        const badge = document.getElementById("networkBadge");
        badge.innerText = "Online";
        badge.style.background = "#238636";

        document.getElementById("btnSwap").disabled = false;

        log("Wallet terhubung ✅");

        await updateBalances();

    } catch (err) {
        log("Error koneksi ❌");
        console.error(err);
    }
}

// ===============================
// AUTO CONNECT (AMAN)
// ===============================
async function initAutoConnect() {
    if (!window.ethereum) return;

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts.length > 0) {
            userAddress = accounts[0].address;
            signer = await provider.getSigner();

            log("Auto reconnect...");

            document.getElementById("btnConnect").innerText =
                userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

            document.getElementById("networkBadge").innerText = "Online";
            document.getElementById("btnSwap").disabled = false;

            await updateBalances();
        }
    } catch (err) {
        console.error(err);
    }
}

// ===============================
// BALANCE ENGINE (FIXED)
// ===============================
async function updateBalances() {
    if (!userAddress || !provider) return;

    try {
        const tIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const tOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);

        const [b1, d1, b2, d2] = await Promise.all([
            tIn.balanceOf(userAddress),
            tIn.decimals(),
            tOut.balanceOf(userAddress),
            tOut.decimals()
        ]);

        tokenDecimals = d1;

        document.getElementById("balIn").innerText =
            "Saldo: " + ethers.formatUnits(b1, d1).slice(0, 10);

        document.getElementById("balOut").innerText =
            "Saldo: " + ethers.formatUnits(b2, d2).slice(0, 10);

    } catch (err) {
        log("Gagal ambil saldo");
        console.error(err);
    }
}

// ===============================
// SWAP ENGINE
// ===============================
async function executeSwap() {
    const val = document.getElementById("inputAmount").value;
    if (!val || val <= 0) return log("Input kosong!");

    try {
        const amt = ethers.parseUnits(val, tokenDecimals);

        const token = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek approval...");

        const allowance = await token.allowance(userAddress, CONFIG.ROUTER);

        if (allowance < amt) {
            log("Approve token...");
            await (await token.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait();
        }

        log("Swap jalan...");

        const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        await tx.wait();

        log("Swap sukses 🔥");
        updateBalances();

    } catch (err) {
        log("Swap gagal ❌");
        console.error(err);
    }
}

// ===============================
// INIT (SATU PINTU)
// ===============================
window.addEventListener("load", () => {

    initAutoConnect();

    // input sync
    const input = document.getElementById("inputAmount");
    input.addEventListener("input", (e) => {
        document.getElementById("outputAmount").value = e.target.value;
    });

    // wallet listener
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", () => location.reload());
        window.ethereum.on("chainChanged", () => location.reload());
    }

    // 🔥 auto refresh balance (BONUS UX)
    setInterval(updateBalances, 10000);
});
