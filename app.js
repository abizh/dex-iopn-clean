// ==========================================================
// BOZZDEX MASTER V2 - GOD-EYE PROTOCOL
// ==========================================================
const CONFIG = {
 RPC: "https://testnet-rpc2.iopn.tech",
 CHAIN_ID: "0x3d8",
 T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),
 T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d"),
 OFFICIAL_ROUTER: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885", // Oracle
 BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961", // Execution
 SLIPPAGE: 2 // Toleransi 2%
};
let walletProvider, rpcProvider, signer, userAddress, debounceTimer;
const ABI_TOKEN = [
 "function balanceOf(address) view returns (uint256)",
 "function decimals() view returns (uint8)"
];
const ABI_ROUTER = [
 "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] 
memory)",
 "function swap(address,address,uint256,uint256) external"
];
function log(msg, isErr=false) {
 const el = document.getElementById("statusLog");
 if(el) el.innerText = (isErr ? " " : "> ") + msg;
}

// ===============================
// 🔗 CONNECT WALLET (FIX TOTAL)
// ===============================
async function connect() {
    if (!window.ethereum) {
        alert("Gunakan MetaMask / OKX Wallet!");
        return;
    }

    try {
        log("Menghubungkan wallet...");

        // Request akun
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        userAddress = accounts[0];

        // Wallet provider
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();

        // RPC provider (INDEPENDENT)
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);

        // VALIDASI CHAIN
        const chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CONFIG.CHAIN_ID) {
            log("Switch ke iOPN...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CONFIG.CHAIN_ID }]
            });
        }

        // UI update
        console.log("Provider test jalan...");
const testProvider = new ethers.JsonRpcProvider(CONFIG.RPC);
const block = await testProvider.getBlockNumber();
console.log("BLOCK:", block);
        
        document.getElementById("btnConnect").innerText =
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

        document.getElementById("btnSwap").disabled = false;

        log("Wallet connected");

        // LOAD BALANCE
        await updateBalances();

        // AUTO REFRESH
        setInterval(updateBalances, 10000);

    } catch (err) {
        log("Koneksi gagal ❌");
        console.error(err);
    }
}

// ===============================
// 💰 UPDATE BALANCE (FIX UTAMA)
// ===============================
async function updateBalances() {
    if (!userAddress || !rpcProvider) return;

    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ABI, rpcProvider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABI, rpcProvider);

        const [bIn, dIn, bOut, dOut] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress),
            cOut.decimals()
        ]);

        const balIn = ethers.formatUnits(bIn, dIn);
        const balOut = ethers.formatUnits(bOut, dOut);

        document.getElementById("balIn").innerText =
            "Saldo: " + parseFloat(balIn).toFixed(4);

        document.getElementById("balOut").innerText =
            "Saldo: " + parseFloat(balOut).toFixed(4);

        log("Balance updated ✅");

    } catch (err) {
        log("Gagal ambil saldo ❌");
        console.error(err);
    }
}

// ===============================
// 📡 MIRROR PRICE ENGINE (DEX RESMI)
// ===============================
async function getLivePrice() {
    try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC);

        const router = new ethers.Contract(
            "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885", // router resmi
            ["function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory)"],
            provider
        );

        const amountIn = ethers.parseUnits("1", 18); // 1 WOPN

        const path = [
            CONFIG.T_IN,  // WOPN
            CONFIG.T_OUT  // OPNT
        ];

        const amounts = await router.getAmountsOut(amountIn, path);

        const price = ethers.formatUnits(amounts[1], 18);

        // 🔥 tampilkan ke UI
        const logEl = document.getElementById("marketPrice").innerText =
   "Market: 1 WOPN = " + Number(price).toFixed(6) + " OPNT";

        return price;

    } catch (err) {
        console.error("Price error:", err);
        log("Gagal ambil harga market ❌");
    }
            }

// --- INPUT SYNC + DEBOUNCE (ORACLE MODE) ---
function setupInput() {
 const input = document.getElementById("inputAmount");
 const output = document.getElementById("outputAmount");
 input.oninput = (e) => {
 let val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
 const parts = val.split(".");
 if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
input.value = val;
 clearTimeout(debounceTimer);
 if (!val || val <= 0) { output.value = ""; return; }
 output.value = "...";
 debounceTimer = setTimeout(async () => {
 try {
 const router = new ethers.Contract(CONFIG.OFFICIAL_ROUTER, ABI_ROUTER, 
rpcProvider);
 const amounts = await router.getAmountsOut(ethers.parseUnits(val, 18), 
[CONFIG.T_IN, CONFIG.T_OUT]);
 output.value = ethers.formatUnits(amounts[1], 18);
 log("Price Synced ");
 } catch (err) { 
 output.value = "Error"; 
 }
 }, 500); // 500ms Debounce agar Infinix tidak lag
 };
}

// --- EXECUTE SWAP DENGAN SLIPPAGE GUARD ---
async function executeSwap() {
 const valInput = document.getElementById("inputAmount").value;
 if (!valInput || valInput <= 0) return log("Isi jumlah dulu!", true);
 try {
 log("Validasi Slippage...");
 const routerOracle = new ethers.Contract(CONFIG.OFFICIAL_ROUTER, ABI_ROUTER, 
rpcProvider);
 const amtIn = ethers.parseUnits(valInput, 18);
 // 1. Ambil Quotes Resmi dari iOPN
 const amounts = await routerOracle.getAmountsOut(amtIn, [CONFIG.T_IN, 
CONFIG.T_OUT]);
 const expectedOut = amounts[1];
 // 2. Hitung Batas Bawah (Min Amount Out)
 const slippageFactor = BigInt(100 - CONFIG.SLIPPAGE);
 const minOut = (expectedOut * slippageFactor) / BigInt(100);
 log(`Min Acceptable: ${ethers.formatUnits(minOut, 18)}`);
 const dex = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);
 // 3. Eksekusi Swap dengan Proteksi Ketat
 const tx = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut);
 log("Konfirmasi Blockchain...");
 await tx.wait();
 log("Swap Berhasil & Aman! 🔥🚀");
 await updateBalances();
 } catch (err) {
 log("Swap Gagal: Slippage/Harga Melenceng!", true);
 console.error(err);
 }
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
 setupInput();
 document.getElementById("btnConnect").onclick = connect;
 document.getElementById("btnSwap").onclick = executeSwap;
log("GOD-EYE Mode Active.");
});

// Refresh balances every 5s
setInterval(() => {
 if (userAddress) {
 updateBalances();
 }
}, 5000);
