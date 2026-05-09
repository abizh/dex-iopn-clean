/**
 * SOVEREIGN ENGINE v91.0 - THE MAP READER
 * Core Logic for iOPN Testnet DEX integration
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
  let _hydrateEpoch = 0;
  let _notifyToken = 0;
  let _consecutiveFails = 0;
  let _pollTimeout = null;
  let _isDeepSleeping = false;
  const _pairCache = new Map();

  // Load Persisted Logs
  try {
    const raw = localStorage.getItem("bozzdex_v91_logs");
    _STATE.logs = raw ? JSON.parse(raw) : [];
  } catch { _STATE.logs = []; }

  const _core = {
    stopPolling() { if (_pollTimeout) clearTimeout(_pollTimeout); _pollTimeout = null; },

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

      // Check Direct
      if (await _core.pairExists(aIn, aOut)) {
        try { await router.getAmountsOut(amtWei, [aIn, aOut]); return [aIn, aOut]; } catch {}
      }
      // Check Bridge via WOPN
      if (aIn !== _CONFIG.WOPN && aOut !== _CONFIG.WOPN) {
        if (await _core.pairExists(aIn, _CONFIG.WOPN) && await _core.pairExists(_CONFIG.WOPN, aOut)) {
          try { await router.getAmountsOut(amtWei, [aIn, _CONFIG.WOPN, aOut]); return [aIn, _CONFIG.WOPN, aOut]; } catch {}
        }
      }
      throw new Error("NO_VALID_ROUTE_ON_MAP");
    },

    async getQuote(amtWei, path, sIn, sOut) {
      const router = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, _provider);
      const quotes = await router.getAmountsOut(amtWei, path);
      let qOut = quotes[quotes.length - 1];
      if (_CONFIG.ASSETS[sIn].hasFee || _CONFIG.ASSETS[sOut].hasFee) qOut = (qOut * 92n) / 100n;
      const slip = BigInt(_CONFIG.ASSETS[sOut].slip || 5);
      const minOut = (qOut * (100n - slip)) / 100n;
      return { qOut, minOut };
    },

    saveLog(entry) {
      _STATE.logs.unshift({ ...entry, ts: Date.now(), time: new Date().toLocaleTimeString() });
      if (_STATE.logs.length > 20) _STATE.logs.pop();
      localStorage.setItem("bozzdex_v91_logs", JSON.stringify(_STATE.logs));
    },

    notify(msg, type = "INFO") {
      const token = ++_notifyToken;
      if (type === "ERR") { _STATE.error = msg; _STATE.message = ""; }
      else { _STATE.message = msg; _STATE.error = ""; }
      SovereignEngine.render();
      if (type !== "ERR") setTimeout(() => { if (_notifyToken === token) { _STATE.message = ""; SovereignEngine.render(); } }, 7000);
    }
  };

  return {
    getState: () => _STATE,
    async preview() {
      if (!_STATE.address || document.hidden) return;
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;
      const outEl = document.getElementById("amt-out");
      if (!val || val <= 0 || sIn === sOut) { outEl.value = ""; return; }
      try {
        const amtWei = ethers.parseUnits(val, _CONFIG.ASSETS[sIn].dec);
        const path = await _core.getValidatedPath(sIn, sOut, amtWei);
        const { minOut } = await _core.getQuote(amtWei, path, sIn, sOut);
        outEl.value = ethers.formatUnits(minOut, _CONFIG.ASSETS[sOut].dec);
      } catch { outEl.value = ""; }
    },

    async hydrate() {
      if (!_STATE.address || _isDeepSleeping) return;
      const epoch = ++_hydrateEpoch;
      try {
        const res = {};
        for (const s of Object.keys(_CONFIG.ASSETS)) {
          const asset = _CONFIG.ASSETS[s];
          let bal;
          if (asset.addr === "NATIVE") bal = await _provider.getBalance(_STATE.address);
          else bal = await (new ethers.Contract(asset.addr, ["function balanceOf(address) view returns (uint256)"], _provider)).balanceOf(_STATE.address);
          res[s] = ethers.formatUnits(bal, asset.dec);
        }
        if (epoch === _hydrateEpoch) { _STATE.balances = res; _consecutiveFails = 0; this.render(); }
      } catch { _consecutiveFails++; }
      setTimeout(() => this.hydrate(), _consecutiveFails > 2 ? 30000 : 7000);
    },

    render() {
      // Element Mapping
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      document.getElementById("bal-in").innerText = parseFloat(_STATE.balances[sIn] || 0).toFixed(4);
      document.getElementById("bal-out").innerText = parseFloat(_STATE.balances[sOut] || 0).toFixed(4);
      
      const kernel = document.getElementById("kernelState");
      if (_STATE.error) { kernel.innerText = `[!] ${_STATE.error}`; kernel.className = "status-pill status-bad"; }
      else if (_STATE.message) { kernel.innerText = `[*] ${_STATE.message}`; kernel.className = "status-pill status-ok"; }
      else { kernel.innerText = `STATUS: ${_STATE.status}`; kernel.className = "status-pill status-ok"; }

      const execBtn = document.getElementById("exec-btn");
      execBtn.disabled = (_STATE.status !== "IDLE" || sIn === sOut);
      execBtn.innerText = _STATE.status === "IDLE" ? "EXECUTE MISSION" : `${_STATE.status}...`;

      // Fleet & Logs
      const intel = _STATE.logs.length ? { health: "OK", hb: _STATE.logs[0].time } : { health: "IDLE", hb: "NONE" };
      document.getElementById("fleet-overview").innerHTML = `
        <div class="fleet-bar"><span>● ${intel.health}</span><span>HB: ${intel.hb}</span></div>
        <div class="fleet-grid">
          <div class="fleet-card"><span>OPN</span><b>${parseFloat(_STATE.balances.OPN || 0).toFixed(2)}</b></div>
          <div class="fleet-card pret-focus"><span>PRET</span><b>${parseFloat(_STATE.balances.PRET || 0).toFixed(2)}</b></div>
          <div class="fleet-card"><span>tUSDT</span><b>${parseFloat(_STATE.balances.tUSDT || 0).toFixed(2)}</b></div>
        </div>
      `;

      document.getElementById("log-history").innerHTML = _STATE.logs.map(l => `
        <div class="log-item ${l.status === 'FAILED' ? 'failed' : ''}">
          <div class="log-meta">
            <div class="log-line">
              <span class="${l.status === 'SUCCESS' ? 'ok-tag' : 'err-tag'}">${l.status}</span>
              <span>${l.time} | ${l.pair}</span>
            </div>
            ${l.fullHash ? `<a class="log-hash" href="${_CONFIG.EXPLORER_TX}${l.fullHash}" target="_blank">🔗 ${l.fullHash.slice(0,12)}...</a>` : `<span class="warn-tag">${l.reason || ''}</span>`}
          </div>
        </div>
      `).join("");
    },

    async execute() {
      if (_STATE.status !== "IDLE") return;
      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;
      try {
        _STATE.status = "ROUTING"; this.render();
        const signer = await _provider.getSigner();
        const amtWei = ethers.parseUnits(val, _CONFIG.ASSETS[sIn].dec);
        const path = await _core.getValidatedPath(sIn, sOut, amtWei);
        const { minOut } = await _core.getQuote(amtWei, path, sIn, sOut);

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

        _STATE.status = "PENDING"; this.render();
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
      document.addEventListener("visibilitychange", () => { _isDeepSleeping = document.hidden; if(!_isDeepSleeping) this.hydrate(); });
    }
  };
})();

const UIHelper = {
  handleInput: () => SovereignEngine.preview(),
  execute: () => SovereignEngine.execute(),
  setMax: async () => {
    const sIn = document.getElementById("sel-in").value;
    const bal = SovereignEngine.getState().balances[sIn] || 0;
    document.getElementById("amt-in").value = sIn === "OPN" ? Math.max(0, bal - 0.5) : bal;
    SovereignEngine.preview();
  }
};
SovereignEngine.boot();
