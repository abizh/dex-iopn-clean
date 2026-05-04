// CONFIGURATION - SINKRON DENGAN REMIX & POOL
const CONTRACTS = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84", // Token A
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d" // Token B/wOPN
};

const ABIS = {
    ROUTER: [
        "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external",
        "function getPool(address, address) view returns (address)",
        "function fee() view returns (uint256)"
    ],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

let signer = null;
let provider = null;

// LOGGING SYSTEM
function logger(msg) {
    const consoleElem = document.getElementById('logConsole');
    consoleElem.innerText = msg;
    console.log(`[BOZZDEX]: ${msg}`);
}

// CONNECT WALLET
async function connectWallet() {
    if (!window.ethereum) return alert("Pasang Metamask/OKX Wallet!");
    
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
    const addr = await signer.getAddress();
    document.getElementById('btnConnect').innerText = addr.substring(0,6) + "..." + addr.substring(38);
    document.getElementById('networkStatus').innerText = "Terhubung: OPN Testnet";
    document.getElementById('btnSwap').disabled = false;
    
    updateBalances(addr);
    logger("Wallet Terhubung: " + addr);
}

// UPDATE REAL-TIME BALANCE
async function updateBalances(userAddr) {
    const tokenIn = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, provider);
    const tokenOut = new ethers.Contract(CONTRACTS.T_OUT, ABIS.ERC20, provider);
    
    const [balIn, balOut] = await Promise.all([
        tokenIn.balanceOf(userAddr),
        tokenOut.balanceOf(userAddr)
    ]);
    
    document.getElementById('balanceIn').innerText = "Saldo: " + ethers.formatEther(balIn);
    document.getElementById('balanceOut').innerText = "Saldo: " + ethers.formatEther(balOut);
}

// CORE SWAP LOGIC - AUDITED
async function executeSwap() {
    const amountInput = document.getElementById('inputAmount').value;
    if (!amountInput || amountInput <= 0) return logger("Input tidak valid!");

    try {
        const userAddr = await signer.getAddress();
        const amountWei = ethers.parseEther(amountInput);
        
        const tokenInContract = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, signer);
        const dexContract = new ethers.Contract(CONTRACTS.ROUTER, ABIS.ROUTER, signer);

        // STEP 1: AUDIT SALDO
        logger("Memverifikasi Saldo...");
        const balance = await tokenInContract.balanceOf(userAddr);
        if (balance < amountWei) throw new Error("Saldo Token A tidak cukup!");

        // STEP 2: AUDIT APPROVAL (Celah terbesar jika terlewati)
        logger("Memeriksa Izin Kontrak (Allowance)...");
        const currentAllowance = await tokenInContract.allowance(userAddr, CONTRACTS.ROUTER);
        
        if (currentAllowance < amountWei) {
            logger("Meminta Persetujuan (Approve)...");
            const txApprove = await tokenInContract.approve(CONTRACTS.ROUTER, ethers.MaxUint256);
            await txApprove.wait();
            logger("Approval Berhasil!");
        }

        // STEP 3: EKSEKUSI SWAP
        logger("Menghitung Gas & Eksekusi Swap...");
        // Menggunakan minOut 0 untuk fleksibilitas testing likuiditas rendah
        const txSwap = await dexContract.swap(
            CONTRACTS.T_IN,
            CONTRACTS.T_OUT,
            amountWei,
            0 
        );

        logger("Transaksi dikirim ke Blockchain...");
        const receipt = await txSwap.wait();
        
        if (receipt.status === 1) {
            logger("SWAP SUKSES!");
            alert("Swap Berhasil!\nHash: " + receipt.hash);
            updateBalances(userAddr);
        } else {
            throw new Error("Transaksi Gagal di Blockchain (Reverted)");
        }

    } catch (err) {
        logger("Gagal: " + (err.reason || err.message));
        console.error(err);
    }
}

// ESTIMASI (OPSIONAL - BISA DIKEMBANGKAN)
function calculateEstimate() {
    const val = document.getElementById('inputAmount').value;
    document.getElementById('outputAmount').value = val; // Estimasi 1:1 untuk testing
}
