const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    T_IN: "0xBc022C9dEb5AF250A526321D16Ef52E39b4DBD84",
    T_OUT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d"
};

const ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
let provider, signer, userAddress;

async function updateBalances() {
    if (!userAddress) return;
    try {
        const cIn = new ethers.Contract(CONFIG.T_IN, ABI, provider);
        const cOut = new ethers.Contract(CONFIG.T_OUT, ABI, provider);
        const [bIn, dIn, bOut, dOut] = await Promise.all([
            cIn.balanceOf(userAddress), cIn.decimals(),
            cOut.balanceOf(userAddress), cOut.decimals()
        ]);
        document.getElementById("balIn").innerText = "Saldo: " + Number(ethers.formatUnits(bIn, dIn)).toFixed(4);
        document.getElementById("balOut").innerText = "Saldo: " + Number(ethers.formatUnits(bOut, dOut)).toFixed(4);
    } catch (e) { console.error(e); }
}

async function connect() {
    if (!window.ethereum) return alert("Gunakan MetaMask/OKX Browser!");
    provider = new ethers.BrowserProvider(window.ethereum);
    const acc = await provider.send("eth_requestAccounts", []);
    userAddress = acc[0];
    signer = await provider.getSigner();
    document.getElementById("btnConnect").innerText = userAddress.slice(0,6)+"..."+userAddress.slice(-4);
    document.getElementById("btnSwap").disabled = false;
    updateBalances();
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("inputAmount");
    const output = document.getElementById("outputAmount");

    input.oninput = (e) => {
        let el = e.target;
        let start = el.selectionStart; // Simpan posisi kursor
        
        // Aturan: Ganti koma ke titik, hapus selain angka & satu titik
        let val = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');

        if (el.value !== val) {
            el.value = val;
            el.setSelectionRange(start, start); // Paksa kursor balik ke posisi awal
        }
        output.value = val;
    };

    document.getElementById("btnConnect").onclick = connect;
});
