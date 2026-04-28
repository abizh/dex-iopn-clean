// GLOBAL WALLET STATE
window.wallet = {
  address: null,
  provider: null,
  signer: null
};

function updateSystem(msg) {
  document.getElementById("output").innerHTML = msg;
}

// ENGINE INIT
window.initEngine = function() {
  fetchBalances();
  setupEventListeners();
  updateSystem("> SYSTEM: Online. Wallet Synced.");
};

// SIMULATION (IMPROVED)
function simulateExecution() {
  const amt = parseFloat(document.getElementById('amountIn').value);
  const tIn = document.getElementById('tokenIn').value;
  const tOut = document.getElementById('tokenOut').value;

  if (!amt || amt <= 0) return;

  const est = (amt * DEX_CONFIG.TOKENS[tIn].price) / DEX_CONFIG.TOKENS[tOut].price;

  const minOut = est * 0.95;

  document.getElementById('amountOut').value = est.toFixed(6);

  updateSystem(`
    > ROUTE: ${tIn} → ${tOut}
    <br>> EST: ${est.toFixed(6)}
    <br>> MIN OUT: ${minOut.toFixed(6)}
  `);
}

// EXECUTE (SAFE MODE)
async function executeSwap() {
  if (!window.wallet.address) {
    updateSystem("> ERROR: Wallet not connected");
    return;
  }

  updateSystem("> EXECUTION BLOCKED: Router ABI belum valid (SAFE MODE)");
}

// EVENT LISTENER CLEAN
function setupEventListeners() {
  ['amountIn','tokenIn','tokenOut'].forEach(id => {
    const el = document.getElementById(id);
    el.oninput = simulateExecution;
    el.onchange = simulateExecution;
  });
}

// BALANCE FETCH (SAFE)
async function fetchBalances() {
  if (!window.wallet.provider || !window.wallet.address) return;

  const grid = document.getElementById('balance-grid');
  grid.innerHTML = "...";

  try {
    const bal = await window.wallet.provider.getBalance(window.wallet.address);
    grid.innerHTML = `<div class="card"><small>OPN</small><div class="val">${ethers.utils.formatEther(bal)}</div></div>`;
  } catch(e) {
    console.error(e);
  }
}
