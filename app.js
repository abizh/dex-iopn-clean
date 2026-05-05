/**
 * BOZZDEX V3.0 - STABLE PRODUCTION
 * All Fixed: Network, Decimal, and Brackets.
 */

const CONFIG = {
    CHAIN_ID: "0x3d8", // 984
    CHAIN_NAME: "OPN Testnet",
    RPC_URL: "https://testnet-rpc2.iopn.tech",
    EXPLORER: "https://testnet.iopn.tech",
    SYMBOL: "OPN",
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const ABIS = {
    ROUTER: ["function swap(address,address,uint256,uint256) external"],
    ERC20: [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function approve(address,uint256) external returns (bool)",
        "function allowance(address,address) view returns (uint256)"
    ]
};

let provider, signer, userAddress;
let decimalsIn = 18;

function log(msg, err = false) {
    const el = document.getElementById("statusLog");
    if (el) {
        el.innerText = "> " + msg;
        el.style.color = err ? "#f85149" : "#7ee787";
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.CHAIN_ID }],
        });
    } catch (error) {
        if (error.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: CONFIG.CHAIN_ID,
                    chainName: CONFIG.CHAIN_NAME,
                    rpcUrls: [CONFIG.RPC_URL],
                    nativeCurrency: { name: "OPN", symbol: CONFIG.SYMBOL, decimals: 18 },
                    blockExplorerUrls: [CONFIG.EXPLORER]
                }],
            });
        }
    }
}

async function connectWallet() {
    if (!window.ethereum) return alert("Buka di MetaMask!");
    try {
        log("Sinkronisasi Network...");
        await switchNetwork();
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        document.getElementById("btnConnect").innerText = userAddress.slice(0,6)+"..."+userAddress.slice(-4);
        document.getElementById("networkBadge").innerText = "OPN ONLINE";
        document.getElementById("btnSwap").disabled = false;

        log("Siap Swap, Bray! ✅");
        await updateBalances();
    } catch (err) {
        log("Koneksi Batal/Gagal ❌", true);
        console.error(err);
    }
}

async function updateBalances() {
    if (!userAddress || !provider) return;
    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, provider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABIS.ERC20, provider);

        const [b1, d1, b2, d2] = await Promise.all([
            cIn.balanceOf(userAddress),
            cIn.decimals(),
            cOut.balanceOf(userAddress),
            cOut.decimals()
        ]);

        decimalsIn = Number(d1);
        
        // Formatting saldo: paksa pake titik dan rapih 4 desimal
        const f1 = parseFloat(ethers.formatUnits(b1, d1)).toFixed(4);
        const f2 = parseFloat(ethers.formatUnits(b2, d2)).toFixed(4);

        document.getElementById("balIn").innerText = "Saldo: " + f1.replace(',', '.');
        document.getElementById("balOut").innerText = "Saldo: " + f2.replace(',', '.');
    } catch (e) {
        console.log("Gagal tarik saldo");
    }
}

async function executeSwap() {
    const val = document.getElementById("inputAmount").value;
    if (!val || val <= 0) return log("Input Kosong!", true);

    try {
        log("Validasi Swap...");
        const amt = ethers.parseUnits(val.toString(), decimalsIn);
        const tIn = new ethers.Contract(CONFIG.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONFIG.ROUTER, ABIS.ROUTER, signer);

        log("Cek Approval...");
        const allowance = await tIn.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amt) {
            log("Approve Token...");
            const txA = await tIn.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await txA.wait();
        }

        log("Kirim Transaksi...");
        const txS = await dex.swap(CONFIG.T_IN, CONFIG.T_OUT, amt, 0);
        log("Menunggu Konfirmasi...");
        await txS.wait();
        
        log("Swap Berhasil! 🔥🚀");
        await updateBalances();
    } catch (e) {
        log("Transaksi Gagal!", true);
    }
}

// ===============================
// INITIALIZER (SECURELY CLOSED)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    const btnC = document.getElementById("btnConnect");
    const btnS = document.getElementById("btnSwap");
    const inputA = document.getElementById("inputAmount");

    if (btnC) btnC.onclick = connectWallet;
    if (btnS) btnS.onclick = executeSwap;
    
    if (inputA) {
        inputA.oninput = (e) => {
            let cleanVal = e.target.value.replace(',', '.');
            e.target.value = cleanVal;
            const out = document.getElementById("outputAmount");
            if (out) out.value = cleanVal;
        };
    }

    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' })
            .then(acc => { if (acc.length > 0) connectWallet(); });
    }
});
