/**
 * SOVEREIGN ENGINE v91.2 - THE SENTINEL REBUILT
 * Optimized for iOPN Testnet DEX integration & Revyl Testing
 */

const SovereignEngine = (() => {
  const ZERO = "0x0000000000000000000000000000000000000000";

  const _CONFIG = Object.freeze({
    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    FACTORY: "0x7856641544a04944474321798544D0860E21a8dE",
    WOPN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
    EXPLORER_TX: "https://testnet.iopn.tech/tx/",
    ROUTER_ABI: [
      "function getAmountsOut(uint amtIn, address[] path) view returns (uint[] amts)",
      "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amtIn, uint amtOutMin, address[] path, address to, uint deadline)",
      "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amtOutMin, address[] path, address to, uint deadline) payable",
      "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amtIn, uint amtOutMin, address[] path, address to, uint deadline)"
    ],
    FACTORY_ABI: ["function getPair(address, address) view returns (address)"],
    ASSETS: {
      OPN:   { addr: "NATIVE", dec: 18, slip: 2 },
      WOPN:  { addr: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84", dec: 18, slip: 1 },
      OPNT:  { addr: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", dec: 18, slip: 3 },
      tUSDT: { addr: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b", dec: 18, slip: 2 },
      PRET:  { addr: "0xEcbf04b23f5b15492794dE22Da5A9819b60B88FD", dec: 18, slip: 12, hasFee: true }
    }
  });

  const _STATE = {
    address: null, balances: {}, status: "IDLE",
    error: "", message: "", logs: []
  };

  let _provider = null;
  const _pairCache = new Map();

  // Load Persisted Logs
  try {
    const raw = localStorage.getItem("bozzdex_v91_logs");
    _STATE.logs = raw ? JSON.parse(raw) : [];
  } catch { _STATE.logs = []; }

  const _core = {
    assetAddress(sym) {
      const a = _CONFIG.ASSETS[sym];
      return a.addr === "NATIVE" ? _CONFIG.WOPN : a.addr;
    },

    async pairExists(t1, t2) {
      const key = [t1.toLowerCase(), t2.toLowerCase()].sort().join(":");
      if (_pairCache.has(key)) return _pairCache.get(key);
      try {
        const factory = new ethers.Contract(_CONFIG.FACTORY, _CONFIG.FACTORY_ABI, _provider);
        const pair = await factory.getPair(t1, t2);
        const exists = pair && pair !== ZERO;
        _pairCache.set(key, exists);
        return exists;
      } catch { return false; }
    },

    async getValidatedPath(sIn, sOut, amtWei) {
      const aIn = _core.assetAddress(sIn);
      const aOut = _core.assetAddress(sOut);
      const router = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, _provider);

      if (await _core.pairExists(aIn, aOut)) {
        try { await router.getAmountsOut(amtWei, [aIn, aOut]); return [aIn, aOut]; } catch {}
      }
      if (aIn !== _CONFIG.WOPN && aOut !== _CONFIG.WOPN) {
        if (await _core.pairExists(aIn, _CONFIG.WOPN) && await _core.pairExists(_CONFIG.WOPN, aOut)) {
          try { await router.getAmountsOut(amtWei, [aIn, _CONFIG.WOPN, aOut]); return [aIn, _CONFIG.WOPN, aOut]; } catch {}
        }
      }
      throw new Error("NO_ROUTE");
    },

    async getQuote(amtWei, path, sIn, sOut) {
      try {
        const router = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, _provider);
        const quotes = await router.getAmountsOut(amtWei, path);
        let qOut = quotes[quotes.length - 1];
        if (_CONFIG.ASSETS[sIn].hasFee || _CONFIG.ASSETS[sOut].hasFee) qOut = (qOut * 90n) / 100n;
        const slip = BigInt(_CONFIG.ASSETS[sOut].slip || 5);
        const minOut = (qOut * (100n - slip)) / 100n;
        return { qOut, minOut };
      } catch { return { qOut: 0n, minOut: 0n }; }
    },

    saveLog(entry) {
      _STATE.logs.unshift({ ...entry, ts: Date.now(), time: new Date().toLocaleTimeString() });
      if (_STATE.logs.length > 20) _STATE.logs.pop();
      localStorage.setItem("bozzdex_v91_logs", JSON.stringify(_STATE.logs));
    },

    notify(msg, type = "INFO") {
      if (type === "ERR") { _STATE.error = msg; _STATE.message = ""; }
      else { _STATE.message = msg; _STATE.error = ""; }
      SovereignEngine.render();
    }
  };

  return {
    getState: () => _STATE,
    async preview() {
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;
      const outEl = document.getElementById("amt-out");
      if (!val || val <= 0 || sIn === sOut) { outEl.value = ""; this.render(); return; }
      try {
        const amtWei = ethers.parseUnits(val, _CONFIG.ASSETS[sIn].dec);
        const path = await _core.getValidatedPath(sIn, sOut, amtWei);
        const { minOut } = await _core.getQuote(amtWei, path, sIn, sOut);
        outEl.value = minOut > 0n ? ethers.formatUnits(minOut, _CONFIG.ASSETS[sOut].dec) : "0.0";
      } catch { outEl.value = "0.0"; }
      this.render();
    },

    async hydrate() {
      if (!_STATE.address) return;
      try {
        const res = {};
        for (const s of Object.keys(_CONFIG.ASSETS)) {
          const asset = _CONFIG.ASSETS[s];
          let bal;
          if (asset.addr === "NATIVE") bal = await _provider.getBalance(_STATE.address);
          else bal = await (new ethers.Contract(asset.addr, ["function balanceOf(address) view returns (uint256)"], _provider)).balanceOf(_STATE.address);
          res[s] = ethers.formatUnits(bal, asset.dec);
        }
        _STATE.balances = res; this.render();
      } catch (e) { console.error("Hydrate Error", e); }
      setTimeout(() => this.hydrate(), 10000);
    },

    render() {
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const amtIn = document.getElementById("amt-in").value;
      const amtOut = document.getElementById("amt-out").value;

      document.getElementById("bal-in").innerText = parseFloat(_STATE.balances[sIn] || 0).toFixed(4);
      document.getElementById("bal-out").innerText = parseFloat(_STATE.balances[sOut] || 0).toFixed(4);

      const kernel = document.getElementById("kernelState");
      if (_STATE.error) { kernel.innerText = `[!] ${_STATE.error}`; kernel.className = "status-pill status-bad"; }
      else if (_STATE.message) { kernel.innerText = `[*] ${_STATE.message}`; kernel.className = "status-pill status-ok"; }
      else { kernel.innerText = `STATUS: ${_STATE.status}`; kernel.className = "status-pill status-ok"; }

      const execBtn = document.getElementById("exec-btn");
      const isInvalid = !amtIn || parseFloat(amtIn) <= 0 || !amtOut || parseFloat(amtOut) <= 0;
      execBtn.disabled = (_STATE.status !== "IDLE" || sIn === sOut || isInvalid);
      execBtn.innerText = _STATE.status === "IDLE" ? "EXECUTE MISSION" : `${_STATE.status}...`;

      document.getElementById("fleet-overview").innerHTML = `
        <div class="fleet-grid">
          <div class="fleet-card"><span>OPN</span><b>${parseFloat(_STATE.balances.OPN || 0).toFixed(2)}</b></div>
          <div class="fleet-card pret-focus"><span>PRET</span><b>${parseFloat(_STATE.balances.PRET || 0).toFixed(2)}</b></div>
          <div class="fleet-card"><span>tUSDT</span><b>${parseFloat(_STATE.balances.tUSDT || 0).toFixed(2)}</b></div>
        </div>
      `;

      document.getElementById("log-history").innerHTML = _STATE.logs.map(l => `
        <div class="log-item">
          <div class="log-line">
            <span class="${l.status === 'SUCCESS' ? 'ok-tag' : 'err-tag'}">${l.status}</span>
            <span>${l.time} | ${l.pair}</span>
          </div>
          ${l.fullHash ? `<a class="log-hash" href="${_CONFIG.EXPLORER_TX}${l.fullHash}" target="_blank">🔗 View Tx</a>` : ''}
        </div>
      `).join("");
    },

    async execute() {
      if (_STATE.status !== "IDLE") return;
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;
      try {
        _STATE.status = "INITIATING"; this.render();
        const signer = await _provider.getSigner();
        const amtWei = ethers.parseUnits(val, _CONFIG.ASSETS[sIn].dec);
        const path = await _core.getValidatedPath(sIn, sOut, amtWei);
        const { minOut } = await _core.getQuote(amtWei, path, sIn, sOut);

        if (minOut === 0n) throw new Error("INSUFFICIENT_LIQUIDITY");

        if (_CONFIG.ASSETS[sIn].addr !== "NATIVE") {
          _STATE.status = "APPROVING"; this.render();
          const token = new ethers.Contract(_CONFIG.ASSETS[sIn].addr, ["function approve(address,uint256) returns (bool)"], signer);
          await (await token.approve(_CONFIG.ROUTER, amtWei)).wait();
        }

        _STATE.status = "SWAPPING"; this.render();
        const router = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, signer);
        const deadline = Math.floor(Date.now() / 1000) + 600;
        let tx;
        if (sIn === "OPN") tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(minOut, path, _STATE.address, deadline, { value: amtWei });
        else if (sOut === "OPN") tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(amtWei, minOut, path, _STATE.address, deadline);
        else tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amtWei, minOut, path, _STATE.address, deadline);

        const receipt = await tx.wait();
        _core.saveLog({ pair: `${sIn}→${sOut}`, fullHash: receipt.hash, status: "SUCCESS" });
        _core.notify("MISSION SUCCESS", "OK");
      } catch (e) {
        _core.saveLog({ pair: `${sIn}→${sOut}`, status: "FAILED", reason: e.reason || "REVERTED" });
        _core.notify("MISSION FAILED", "ERR");
      } finally { _STATE.status = "IDLE"; this.render(); this.hydrate(); }
    },

    boot() {
      if (!window.ethereum) return _core.notify("NO WALLET", "ERR");
      _provider = new ethers.BrowserProvider(window.ethereum);
      window.ethereum.request({ method: "eth_requestAccounts" }).then(accs => {
        _STATE.address = accs[0];
        this.hydrate();
      });
    }
  };
})();

const UIHelper = {
  handleInput: () => SovereignEngine.preview(),
  execute: () => SovereignEngine.execute(),
  setMax: async () => {
    const sIn = document.getElementById("sel-in").value;
    const bal = SovereignEngine.getState().balances[sIn] || 0;
    document.getElementById("amt-in").value = sIn === "OPN" ? Math.max(0, bal - 0.2).toString() : bal;
    SovereignEngine.preview();
  }
};
SovereignEngine.boot();
