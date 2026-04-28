<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GOLD OPTIMIZER V1.4.0 - STABLE</title>

<style>
:root {
  --gold-grad: linear-gradient(135deg,#bf953f,#fcf6ba,#b38728,#fbf5b7,#aa771c);
  --dark-bg:#05070a;
  --card-bg:#10141b;
}
body {
  background:var(--dark-bg);
  color:#e0e0e0;
  font-family:'Segoe UI';
  margin:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding:20px;
}
.header {
  width:100%;
  max-width:450px;
  display:flex;
  justify-content:space-between;
  margin-bottom:20px;
}
h2 {
  font-size:14px;
  background:var(--gold-grad);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}
.btn-connect {
  background:var(--gold-grad);
  border:none;
  padding:10px;
  border-radius:20px;
  cursor:pointer;
  font-weight:bold;
}
.grid {
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:10px;
  width:100%;
  max-width:450px;
  margin-bottom:20px;
}
.card {
  background:var(--card-bg);
  padding:12px;
  border-radius:12px;
  border-left:3px solid gold;
}
.swap-container {
  background:var(--card-bg);
  padding:20px;
  border-radius:20px;
  width:100%;
  max-width:400px;
}
.input-group {margin-bottom:10px;}
input,select {
  width:100%;
  padding:10px;
  margin-top:5px;
  background:black;
  color:white;
  border:1px solid #333;
  border-radius:10px;
}
.btn-swap {
  width:100%;
  padding:15px;
  margin-top:15px;
  background:var(--gold-grad);
  border:none;
  border-radius:15px;
  font-weight:bold;
  cursor:pointer;
}
.output-log {
  margin-top:20px;
  background:black;
  padding:12px;
  border-radius:10px;
  font-family:monospace;
  font-size:12px;
  color:gold;
  max-width:420px;
  width:100%;
}
</style>
</head>

<body>

<div class="header">
  <h2>Gold Optimizer</h2>
  <button id="btnConnect" onclick="connectWallet()" class="btn-connect">
    CONNECT
  </button>
</div>

<div id="balance-grid" class="grid"></div>

<div class="swap-container">
  <div class="input-group">
    <label>You Sell</label>
    <input id="amountIn" type="number" value="1">
    <select id="tokenIn">
      <option value="WOPN">WOPN</option>
      <option value="tUSDT">tUSDT</option>
      <option value="TETE">TETE</option>
    </select>
  </div>

  <div class="input-group">
    <label>You Get</label>
    <input id="amountOut" readonly>
    <select id="tokenOut">
      <option value="OPNT">OPNT</option>
      <option value="TETE">TETE</option>
      <option value="WOPN">WOPN</option>
    </select>
  </div>

  <button id="btnSwap" onclick="executeSwap()" disabled class="btn-swap">
    INITIATE SWAP
  </button>
</div>

<div id="output" class="output-log">
> SYSTEM: Loading...
</div>

<!-- ERROR HANDLER -->
<script>
window.addEventListener("error", e => {
  document.body.innerHTML =
    "<pre style='color:red'>" + e.message + "</pre>";
});
</script>

<!-- LIB -->
<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>

<!-- MASTER APP -->
<script>

/* ================= SAFE INIT ================= */
if (typeof ethers === "undefined") {
  document.body.innerHTML = "Ethers failed load";
  throw new Error("ethers not loaded");
}

function safeAddr(a){
  try { return ethers.utils.getAddress(a); }
  catch { return a; }
}

/* ================= CONFIG ================= */
const EXECUTOR_ADDR = safeAddr("0x7253EFaaeca3DdA533d2646fb21e9d50142D601f");

const TOKENS = {
  WOPN:  {price:1.25, address:safeAddr("0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84")},
  OPNT:  {price:1.15, address:safeAddr("0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d")},
  TETE:  {price:0.05, address:safeAddr("0x771699B159F5DEC9608736DC9C6c901Ddb7Afe3E")},
  tUSDT: {price:1.0,  address:safeAddr("0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b")}
};

let wallet = {};

/* ================= UI ================= */
function log(msg){
  const el = document.getElementById("output");
  if(el) el.innerHTML = msg;
}

/* ================= WALLET ================= */
async function connectWallet(){
  if(!window.ethereum) return alert("Install wallet");

  const acc = await ethereum.request({method:"eth_requestAccounts"});

  wallet.provider = new ethers.providers.Web3Provider(window.ethereum);
  wallet.signer = wallet.provider.getSigner();
  wallet.address = acc[0];

  document.getElementById("btnConnect").innerText =
    acc[0].slice(0,6)+"..."+acc[0].slice(-4);

  document.getElementById("btnSwap").disabled = false;

  init();
}

/* ================= INIT ================= */
function init(){
  simulate();
  fetchBal();

  ["amountIn","tokenIn","tokenOut"].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.oninput = simulate;
      el.onchange = simulate;
    }
  });

  log("> SYSTEM: READY");
}

/* ================= SIMULATION ================= */
function simulate(){
  const amt = parseFloat(document.getElementById("amountIn").value);
  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;

  if(!amt || amt<=0) return;

  const est = (amt * TOKENS[tIn].price) / TOKENS[tOut].price;
  document.getElementById("amountOut").value = est.toFixed(6);

  log(`> ROUTE ${tIn} → ${tOut}<br>> EST ${est.toFixed(6)}`);
}

/* ================= EXECUTE ================= */
async function executeSwap(){
  if(!wallet.address) return log("> Wallet belum connect");

  try{
    const amt = document.getElementById("amountIn").value;
    const tIn = document.getElementById("tokenIn").value;
    const tOut = document.getElementById("tokenOut").value;

    const path = [TOKENS[tIn].address, TOKENS[tOut].address];
    const pools = [EXECUTOR_ADDR];

    const amtWei = ethers.utils.parseUnits(amt,18);

    const executor = new ethers.Contract(
      EXECUTOR_ADDR,
      ["function executeRoute(address[],address[],uint256,uint256)"],
      wallet.signer
    );

    log("> APPROVING...");
    const token = new ethers.Contract(
      path[0],
      ["function approve(address,uint256)"],
      wallet.signer
    );

    await (await token.approve(EXECUTOR_ADDR, amtWei)).wait();

    log("> EXECUTING...");
    const tx = await executor.executeRoute(pools,path,amtWei,0);

    log("> TX: "+tx.hash);
    await tx.wait();

    log("> SUCCESS");

  }catch(e){
    log("> ERROR: "+e.message);
  }
}

/* ================= BALANCE ================= */
async function fetchBal(){
  if(!wallet.address) return;

  const grid = document.getElementById("balance-grid");
  grid.innerHTML = "...";

  try{
    let html="";
    for(const k in TOKENS){
      const c = new ethers.Contract(
        TOKENS[k].address,
        ["function balanceOf(address) view returns(uint256)"],
        wallet.provider
      );
      const b = await c.balanceOf(wallet.address);
      html += `<div class="card">${k}<br>${ethers.utils.formatUnits(b,18)}</div>`;
    }
    grid.innerHTML = html;
  }catch{}
}

</script>

</body>
</html>
