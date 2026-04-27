// ==========================================================
// DEX EXECUTION BRIDGE (SAFE MODE READY)
// ==========================================================

let provider;
let signer;
let userAddress;

// ===== CONTRACT =====
const EXECUTOR_ADDRESS = "0x1bc2220B0a863d4c7c85d399A31AE08BB74e7407";

const EXECUTOR_ABI = [
  "function executeRoute((address pool,address tokenIn,address tokenOut,uint256 amountIn)[] steps,uint256 minOut,address recipient) external returns (uint256)"
];

// ===== CONNECT WALLET =====
async function connectWallet() {
  let ethProvider = null;

  // 🔍 DETECT MULTI WALLET
  if (window.ethereum) {
    ethProvider = window.ethereum;
  } else if (window.okxwallet) {
    ethProvider = window.okxwallet;
  } else if (window.rabby) {
    ethProvider = window.rabby;
  }

  if (!ethProvider) {
    alert("Wallet tidak terdeteksi. Gunakan MetaMask / Trust / OKX Wallet DApp Browser");
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(ethProvider);

    await provider.send("eth_requestAccounts", []);

    const signer = provider.getSigner();
    const address = await signer.getAddress();

    document.getElementById("wallet").innerText =
      address.slice(0, 6) + "..." + address.slice(-4);

  } catch (err) {
    console.error(err);
    alert("Wallet terdeteksi tapi gagal konek (cek permission / jaringan)");
  }
}

// ===== FETCH ROUTE =====
async function getRoute(amount) {
  const res = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenIn: "OPN",
      tokenOut: "OPNT",
      amount
    })
  });

  return await res.json();
}

// ===== MOCK POOL ADDRESS MAP =====
// (sementara hardcoded, nanti kita dynamic)
const POOL_MAP = {
  "OPN/WOPN": "0x1111111111111111111111111111111111111111",
  "WOPN/OPNT": "0x2222222222222222222222222222222222222222",
  "OPN/OPNT": "0x3333333333333333333333333333333333333333",
  "OPN/tBNB": "0x4444444444444444444444444444444444444444",
  "tBNB/OPNT": "0x5555555555555555555555555555555555555555"
};

// ===== TOKEN MAP =====
const TOKEN_MAP = {
  OPN: "0x0000000000000000000000000000000000000001",
  WOPN: "0x0000000000000000000000000000000000000002",
  OPNT: "0x0000000000000000000000000000000000000003",
  tBNB: "0x0000000000000000000000000000000000000004"
};

// ===== BUILD STEPS =====
function buildSteps(route, amount) {
  let steps = [];
  let currentAmount = ethers.utils.parseUnits(amount.toString(), 18);

  for (let r of route) {
    const [t0, t1] = r.split("/");

    steps.push({
      pool: POOL_MAP[r],
      tokenIn: TOKEN_MAP[t0],
      tokenOut: TOKEN_MAP[t1],
      amountIn: currentAmount
    });
  }

  return steps;
}

// ===== SIMULATION ONLY =====
async function simulateExecution() {
  const amount = parseFloat(document.getElementById("amountIn").value);

  const routeData = await getRoute(amount);

  document.getElementById("route").innerText =
    routeData.route.join(" → ");

  document.getElementById("output").innerText =
    routeData.expectedOut;

  alert("Simulation OK — Ready for execution");
}

// ===== EXECUTE (REAL) =====
async function executeSwap() {
  const amount = parseFloat(document.getElementById("amountIn").value);

  const routeData = await getRoute(amount);

  const steps = buildSteps(routeData.route, amount);

  const contract = new ethers.Contract(
    EXECUTOR_ADDRESS,
    EXECUTOR_ABI,
    signer
  );

  const minOut = 0; // nanti kita hitung slippage

  const tx = await contract.executeRoute(
    steps,
    minOut,
    userAddress
  );

  alert("TX SENT: " + tx.hash);

  await tx.wait();

  alert("SWAP SUCCESS");
}
