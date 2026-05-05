// ===============================
// ⚙️ CONFIG
// ===============================
const CONFIG = {
    RPC: "https://testnet-rpc.iopn.tech",
    CHAIN_ID: "0x3d8", // 984
    T_IN: ethers.getAddress("0xbc022c9deb5af250a526321d16ef52e39b4dbd84"),
    T_OUT: ethers.getAddress("0x2aec1db9197ff284011a6a1d0752ad03f5782b0d")
};

const ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// ===============================
// 🌐 PROVIDERS
// ===============================
let walletProvider; // dari wallet
let rpcProvider;    // langsung ke RPC
let signer, userAddress;

// ===============================
// 🧠 LOGGER
// ===============================
function log(msg) {
    const el = document.getElementById("statusLog");
    if (el) el.innerText = "> " + msg;
    console.log("[BOZZDEX]", msg);
}

// ===============================
// 🔗 CONNECT WALLET (FIX TOTAL)
// ===============================
let balanceInterval = null;

async function connect() {
    if (!window.ethereum) {
        alert("Gunakan MetaMask / OKX Wallet!");
        return;
    }

    try {
        log("Menghubungkan wallet...");

        // 1. Request akun
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts || accounts.length === 0) {
            throw new Error("User tidak memilih akun");
        }

        userAddress = accounts[0];

        // 2. Provider dari wallet
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner();

        // 3. Provider RPC (untuk baca data stabil)
        rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC);

        // 4. Validasi jaringan
        let chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CONFIG.CHAIN_ID) {
            log("Switch ke iOPN...");

            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: CONFIG.CHAIN_ID }]
                });

                // refresh chainId setelah switch
                chainId = await window.ethereum.request({ method: "eth_chainId" });

            } catch (switchError) {
                log("Gagal switch network ❌");
                console.error(switchError);
                return;
            }
        }

        // 5. Update UI
        const btn = document.getElementById("btnConnect");
        const swapBtn = document.getElementById("btnSwap");

        if (btn) {
            btn.innerText =
                userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
        }

        if (swapBtn) swapBtn.disabled = false;

        log("Wallet connected ✅");

        // 6. Load balance pertama
        await updateBalances();

        // 7. AUTO REFRESH (anti dobel interval)
        if (!balanceInterval) {
            balanceInterval = setInterval(async () => {
                try {
                    await updateBalances();
                    log("Auto refresh balance 🔄");
                } catch (e) {
                    console.error(e);
                }
            }, 10000);
        }

    } catch (err) {
        log("Error koneksi ❌");
        console.error(err);
    }
    }

        // UI update
        document.getElementById("btnConnect").innerText =
            userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

        document.getElementById("btnSwap").disabled = false;

        log("Wallet connected ✅");

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
// 🔄 INPUT SYNC
// ===============================
function setupInput() {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");

    input.oninput = (e) => {
        let val = e.target.value
            .replace(",", ".")
            .replace(/[^0-9.]/g, "");

        const parts = val.split(".");
        if (parts.length > 2) {
            val = parts[0] + "." + parts.slice(1).join("");
        }

        input.value = val;
        output.value = val;
    };
}

// ===============================
// 🎬 INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    setupInput();
    document.getElementById("btnConnect").onclick = connect;
});
