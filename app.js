// ==========================================
// BOZZDEX MASTER LOGIC (FIXED)
// ==========================================

// --- CONFIG ---
const RAW_ADDR = {
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const CONTRACTS = {
    ROUTER: ethers.getAddress(RAW_ADDR.ROUTER),
    T_IN: ethers.getAddress(RAW_ADDR.T_IN),
    T_OUT: ethers.getAddress(RAW_ADDR.T_OUT)
};

const ABIS = {
    ROUTER: [
        "function swap(address tIn, address tOut, uint256 amtIn, uint256 minOut) external"
    ],
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
    ]
};

// --- STATE ---
let provider, signer, userAddress;

// --- LOGGER ---
function log(msg) {
    document.getElementById('statusLog').innerText = "> " + msg;
    console.log("[DEX]", msg);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {

    const btnConnect = document.getElementById('btnConnect');
    const btnSwap = document.getElementById('btnSwap');
    const inputAmt = document.getElementById('inputAmount');

    btnConnect.addEventListener('click', connectWallet);
    btnSwap.addEventListener('click', executeSwap);

    inputAmt.addEventListener('input', (e) => {
        document.getElementById('outputAmount').value = e.target.value;
    });

    checkExistingConnection();
});

// --- AUTO CONNECT ---
async function checkExistingConnection() {
    if (!window.ethereum) return;

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts.length > 0) {
        userAddress = accounts[0];
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        updateUI();
        updateBalances();
        log("Auto connected");
    }
}

// --- CONNECT WALLET ---
async function connectWallet() {
    if (!window.ethereum) {
        alert("Install Metamask dulu!");
        return;
    }

    try {
        log("Connecting wallet...");

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        updateUI();
        updateBalances();

        log("Connected ✔");

    } catch (err) {
        log("Error: " + err.message);
    }
}

// --- UPDATE UI ---
function updateUI() {
    document.getElementById('btnConnect').innerText =
        userAddress.slice(0,6) + "..." + userAddress.slice(-4);

    document.getElementById('networkBadge').innerText = "Online";

    document.getElementById('btnSwap').disabled = false;
}

// --- BALANCE ---
async function updateBalances() {
    try {
        const tIn = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, provider);
        const tOut = new ethers.Contract(CONTRACTS.T_OUT, ABIS.ERC20, provider);

        const [b1, b2] = await Promise.all([
            tIn.balanceOf(userAddress),
            tOut.balanceOf(userAddress)
        ]);

        document.getElementById('balIn').innerText =
            "Saldo: " + ethers.formatUnits(b1, 18);

        document.getElementById('balOut').innerText =
            "Saldo: " + ethers.formatUnits(b2, 18);

    } catch {
        log("Gagal ambil saldo");
    }
}

// --- SWAP ---
async function executeSwap() {

    const val = document.getElementById('inputAmount').value;
    if (!val || val <= 0) return log("Isi amount dulu");

    try {
        const amountWei = ethers.parseUnits(val, 18);

        const token = new ethers.Contract(CONTRACTS.T_IN, ABIS.ERC20, signer);
        const dex = new ethers.Contract(CONTRACTS.ROUTER, ABIS.ROUTER, signer);

        log("Check allowance...");
        const allowance = await token.allowance(userAddress, CONTRACTS.ROUTER);

        if (allowance < amountWei) {
            log("Approve token...");
            const tx = await token.approve(CONTRACTS.ROUTER, ethers.MaxUint256);
            await tx.wait();
        }

        log("Swapping...");
        const tx = await dex.swap(
            CONTRACTS.T_IN,
            CONTRACTS.T_OUT,
            amountWei,
            0
        );

        await tx.wait();

        log("SWAP SUCCESS 🔥");
        updateBalances();

    } catch (err) {
        log("Swap failed ❌");
        console.error(err);
    }
}

// --- EVENT WALLET ---
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => location.reload());
    window.ethereum.on('chainChanged', () => location.reload());
}
