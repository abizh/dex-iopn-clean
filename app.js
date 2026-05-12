/**
 * SOVEREIGN ENGINE v91.3 - THE ENDURANCE BUILD
 * Stable / Race-Safe / Wallet-Aware / Memory-Safe
 */

const SovereignEngine = (() => {

  const ZERO = "0x0000000000000000000000000000000000000000";
  const GAS_RESERVE = ethers.parseUnits("0.2", 18);

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

    FACTORY_ABI: [
      "function getPair(address, address) view returns (address)"
    ],

    ERC20_ABI: [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
      "function allowance(address,address) view returns (uint256)"
    ],

    ASSETS: {
      OPN: {
        addr: "NATIVE",
        dec: 18,
        slip: 2
      },

      WOPN: {
        addr: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
        dec: 18,
        slip: 1
      },

      OPNT: {
        addr: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d",
        dec: 18,
        slip: 3
      },

      tUSDT: {
        addr: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b",
        dec: 18,
        slip: 2
      },

      PRET: {
        addr: "0xEcbf04b23f5b15492794dE22Da5A9819b60B88FD",
        dec: 18,
        slip: 12,
        hasFee: true
      }
    }
  });

  const _STATE = {
    address: null,
    balances: {},
    status: "IDLE",
    error: "",
    message: "",
    logs: []
  };

  let _provider = null;

  let _hydrateTimer = null;
  let _previewEpoch = 0;
  let _notifyEpoch = 0;

  const _pairCache = new Map();

  try {
    const raw = localStorage.getItem("bozzdex_v91_logs");
    _STATE.logs = raw ? JSON.parse(raw) : [];
  } catch {
    _STATE.logs = [];
  }

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const _core = {

    assetAddress(sym) {
      const asset = _CONFIG.ASSETS[sym];
      return asset.addr === "NATIVE"
        ? _CONFIG.WOPN
        : asset.addr;
    },

    async pairExists(t1, t2) {
      const key = [
        t1.toLowerCase(),
        t2.toLowerCase()
      ].sort().join(":");

      if (_pairCache.has(key)) {
        return _pairCache.get(key);
      }

      try {
        const factory = new ethers.Contract(
          _CONFIG.FACTORY,
          _CONFIG.FACTORY_ABI,
          _provider
        );

        const pair = await factory.getPair(t1, t2);

        const exists = pair && pair !== ZERO;

        _pairCache.set(key, exists);

        return exists;

      } catch {
        return false;
      }
    },

    async getValidatedPath(sIn, sOut, amtWei) {

      const aIn = _core.assetAddress(sIn);
      const aOut = _core.assetAddress(sOut);

      const router = new ethers.Contract(
        _CONFIG.ROUTER,
        _CONFIG.ROUTER_ABI,
        _provider
      );

      if (await _core.pairExists(aIn, aOut)) {

        const directPath = [aIn, aOut];

        try {
          await router.getAmountsOut(amtWei, directPath);
          return directPath;
        } catch {}
      }

      if (
        aIn !== _CONFIG.WOPN &&
        aOut !== _CONFIG.WOPN
      ) {

        const hasBridgeIn = await _core.pairExists(aIn, _CONFIG.WOPN);
        const hasBridgeOut = await _core.pairExists(_CONFIG.WOPN, aOut);

        if (hasBridgeIn && hasBridgeOut) {

          const bridgePath = [
            aIn,
            _CONFIG.WOPN,
            aOut
          ];

          try {
            await router.getAmountsOut(amtWei, bridgePath);
            return bridgePath;
          } catch {}
        }
      }

      throw new Error("NO_ROUTE");
    },

    async getQuote(amtWei, path, sIn, sOut) {

      try {

        const router = new ethers.Contract(
          _CONFIG.ROUTER,
          _CONFIG.ROUTER_ABI,
          _provider
        );

        const quotes = await router.getAmountsOut(
          amtWei,
          path
        );

        let qOut = quotes[quotes.length - 1];

        if (
          _CONFIG.ASSETS[sIn].hasFee ||
          _CONFIG.ASSETS[sOut].hasFee
        ) {
          qOut = (qOut * 90n) / 100n;
        }

        const slip = BigInt(
          _CONFIG.ASSETS[sOut].slip || 5
        );

        const minOut =
          (qOut * (100n - slip)) / 100n;

        return {
          qOut,
          minOut
        };

      } catch {
        return {
          qOut: 0n,
          minOut: 0n
        };
      }
    },

    saveLog(entry) {

      _STATE.logs.unshift({
        ...entry,
        ts: Date.now(),
        time: new Date().toLocaleTimeString()
      });

      if (_STATE.logs.length > 20) {
        _STATE.logs.pop();
      }

      localStorage.setItem(
        "bozzdex_v91_logs",
        JSON.stringify(_STATE.logs)
      );
    },

    notify(msg, type = "INFO") {

      const epoch = ++_notifyEpoch;

      if (type === "ERR") {

        _STATE.error = msg;
        _STATE.message = "";

      } else {

        _STATE.message = msg;
        _STATE.error = "";

        setTimeout(() => {

          if (epoch === _notifyEpoch) {
            _STATE.message = "";
            SovereignEngine.render();
          }

        }, 7000);
      }

      SovereignEngine.render();
    }
  };

  return {

    getState: () => _STATE,

    async preview() {

      const epoch = ++_previewEpoch;

      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;

      const outEl = document.getElementById("amt-out");

      if (
        !val ||
        Number(val) <= 0 ||
        sIn === sOut
      ) {

        outEl.value = "";
        _STATE.error = "";
        this.render();
        return;
      }

      try {

        const amtWei = ethers.parseUnits(
          val,
          _CONFIG.ASSETS[sIn].dec
        );

        const path = await _core.getValidatedPath(
          sIn,
          sOut,
          amtWei
        );

        const { minOut } = await _core.getQuote(
          amtWei,
          path,
          sIn,
          sOut
        );

        if (epoch !== _previewEpoch) return;

        outEl.value = minOut > 0n
          ? ethers.formatUnits(
              minOut,
              _CONFIG.ASSETS[sOut].dec
            )
          : "0.0";

        _STATE.error = "";

      } catch (e) {

        if (epoch !== _previewEpoch) return;

        outEl.value = "0.0";
        _STATE.error = e.message || "QUOTE_FAILED";
      }

      this.render();
    },

    async execute() {

      if (_STATE.status !== "IDLE") return;

      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;
      const val = document.getElementById("amt-in").value;

      try {

        _STATE.error = "";
        _STATE.message = "";

        _STATE.status = "SEC_CHECK";
        this.render();

        const signer = await _provider.getSigner();

        const nativeBal = await _provider.getBalance(
          _STATE.address
        );

        if (nativeBal < GAS_RESERVE) {
          throw new Error("LOW_NATIVE_GAS");
        }

        const amtWei = ethers.parseUnits(
          val,
          _CONFIG.ASSETS[sIn].dec
        );

        const path = await _core.getValidatedPath(
          sIn,
          sOut,
          amtWei
        );

        const { minOut } = await _core.getQuote(
          amtWei,
          path,
          sIn,
          sOut
        );

        if (minOut <= 0n) {
          throw new Error("INSUFFICIENT_LIQUIDITY");
        }

        if (_CONFIG.ASSETS[sIn].addr !== "NATIVE") {

          _STATE.status = "APPROVING";
          this.render();

          const token = new ethers.Contract(
            _CONFIG.ASSETS[sIn].addr,
            _CONFIG.ERC20_ABI,
            signer
          );

          const allowance = await token.allowance(
            _STATE.address,
            _CONFIG.ROUTER
          );

          if (allowance < amtWei) {

            const txApprove = await token.approve(
              _CONFIG.ROUTER,
              ethers.MaxUint256
            );

            await txApprove.wait();
          }
        }

        _STATE.status = "SWAPPING";
        this.render();

        const router = new ethers.Contract(
          _CONFIG.ROUTER,
          _CONFIG.ROUTER_ABI,
          signer
        );

        const deadline =
          Math.floor(Date.now() / 1000) + 600;

        let tx;

        if (sIn === "OPN") {

          tx = await router
            .swapExactETHForTokensSupportingFeeOnTransferTokens(
              minOut,
              path,
              _STATE.address,
              deadline,
              {
                value: amtWei
              }
            );

        } else if (sOut === "OPN") {

          tx = await router
            .swapExactTokensForETHSupportingFeeOnTransferTokens(
              amtWei,
              minOut,
              path,
              _STATE.address,
              deadline
            );

        } else {

          tx = await router
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(
              amtWei,
              minOut,
              path,
              _STATE.address,
              deadline
            );
        }

        _STATE.status = "PENDING";
        this.render();

        const receipt = await tx.wait();

        _core.saveLog({
          pair: `${sIn}→${sOut}`,
          fullHash: receipt.hash,
          status: "SUCCESS"
        });

        _core.notify(
          "MISSION ACCOMPLISHED",
          "OK"
        );

      } catch (e) {

        const reason =
          e?.shortMessage ||
          e?.reason ||
          e?.message ||
          "UNKNOWN_ERROR";

        _core.saveLog({
          pair: `${sIn}→${sOut}`,
          status: "FAILED",
          reason
        });

        _core.notify(reason, "ERR");

      } finally {

        _STATE.status = "IDLE";
        this.render();
        this.hydrate();
      }
    },

    async hydrate() {

      if (_hydrateTimer) {
        clearTimeout(_hydrateTimer);
      }

      if (
        !_STATE.address ||
        document.hidden
      ) {
        return;
      }

      try {

        const balances = {};

        for (const symbol of Object.keys(_CONFIG.ASSETS)) {

          const asset = _CONFIG.ASSETS[symbol];

          let bal;

          if (asset.addr === "NATIVE") {

            bal = await _provider.getBalance(
              _STATE.address
            );

          } else {

            const token = new ethers.Contract(
              asset.addr,
              ["function balanceOf(address) view returns (uint256)"],
              _provider
            );

            bal = await token.balanceOf(
              _STATE.address
            );
          }

          balances[symbol] = ethers.formatUnits(
            bal,
            asset.dec
          );
        }

        _STATE.balances = balances;

        this.render();

      } catch (e) {
        console.warn("HYDRATE_FAIL", e);
      }

      _hydrateTimer = setTimeout(
        () => this.hydrate(),
        10000
      );
    },

    render() {

      const sIn = document.getElementById("sel-in").value;
      const sOut = document.getElementById("sel-out").value;

      document.getElementById("bal-in").innerText =
        Number(_STATE.balances[sIn] || 0)
          .toFixed(4);

      document.getElementById("bal-out").innerText =
        Number(_STATE.balances[sOut] || 0)
          .toFixed(4);

      const kernel = document.getElementById("kernelState");

      if (_STATE.error) {

        kernel.innerText = `[!] ${_STATE.error}`;
        kernel.className = "status-pill status-bad";

      } else if (_STATE.message) {

        kernel.innerText = `[*] ${_STATE.message}`;
        kernel.className = "status-pill status-ok";

      } else {

        kernel.innerText = `STATUS: ${_STATE.status}`;
        kernel.className = "status-pill status-ok";
      }

      const execBtn = document.getElementById("exec-btn");

      const amtIn = document.getElementById("amt-in").value;
      const amtOut = document.getElementById("amt-out").value;

      const outNum = Number(amtOut);

      const isInvalid =
        !amtIn ||
        Number(amtIn) <= 0 ||
        !amtOut ||
        !Number.isFinite(outNum) ||
        outNum <= 0;

      execBtn.disabled =
        _STATE.status !== "IDLE" ||
        sIn === sOut ||
        isInvalid;

      execBtn.innerText =
        _STATE.status === "IDLE"
          ? "EXECUTE MISSION"
          : `${_STATE.status}...`;

      document.getElementById("fleet-overview").innerHTML = `
        <div class="fleet-grid">

          <div class="fleet-card">
            <span>OPN</span>
            <b>${Number(_STATE.balances.OPN || 0).toFixed(2)}</b>
          </div>

          <div class="fleet-card pret-focus">
            <span>PRET</span>
            <b>${Number(_STATE.balances.PRET || 0).toFixed(2)}</b>
          </div>

          <div class="fleet-card">
            <span>tUSDT</span>
            <b>${Number(_STATE.balances.tUSDT || 0).toFixed(2)}</b>
          </div>

        </div>
      `;

      document.getElementById("log-history").innerHTML =
        _STATE.logs.map(log => `

          <div class="log-item">

            <div class="log-line">
              <span class="${log.status === "SUCCESS" ? "ok-tag" : "err-tag"}">
                ${esc(log.status)}
              </span>

              <span>
                ${esc(log.time)} | ${esc(log.pair || "UNKNOWN")}
              </span>
            </div>

            ${log.fullHash
              ? `
                <a
                  class="log-hash"
                  href="${_CONFIG.EXPLORER_TX}${esc(log.fullHash)}"
                  target="_blank"
                >
                  🔗 View Tx
                </a>
              `
              : `
                <div class="err-tag">
                  ${esc(log.reason || "FAILED")}
                </div>
              `
            }

          </div>

        `).join("");
    },

    boot() {

      if (!window.ethereum) {
        _core.notify("NO_WALLET", "ERR");
        return;
      }

      _provider = new ethers.BrowserProvider(
        window.ethereum
      );

      window.ethereum
        .request({
          method: "eth_requestAccounts"
        })
        .then(accs => {

          _STATE.address = accs[0] || null;

          this.hydrate();
        })
        .catch(() => {
          _core.notify(
            "WALLET_CONNECTION_REJECTED",
            "ERR"
          );
        });

      window.ethereum.on(
        "accountsChanged",
        (accs) => {

          _STATE.address = accs[0] || null;

          _core.notify(
            "ACCOUNT_CHANGED",
            "OK"
          );

          this.hydrate();
        }
      );

      window.ethereum.on(
        "chainChanged",
        () => {
          window.location.reload();
        }
      );

      window.ethereum.on(
        "disconnect",
        () => {

          _STATE.address = null;

          _core.notify(
            "WALLET_DISCONNECTED",
            "ERR"
          );

          this.render();
        }
      );

      document.addEventListener(
        "visibilitychange",
        () => {

          if (!document.hidden) {
            this.hydrate();
          }
        }
      );
    }
  };
})();

const UIHelper = {

  handleInput() {
    SovereignEngine.preview();
  },

  execute() {
    SovereignEngine.execute();
  },

  setMax() {

    const sIn = document.getElementById("sel-in").value;

    const bal =
      SovereignEngine.getState().balances[sIn] || "0";

    if (sIn === "OPN") {

      const wei = ethers.parseUnits(bal, 18);

      const reserve = ethers.parseUnits(
        "0.2",
        18
      );

      const finalWei =
        wei > reserve
          ? wei - reserve
          : 0n;

      document.getElementById("amt-in").value =
        ethers.formatUnits(finalWei, 18);

    } else {

      document.getElementById("amt-in").value = bal;
    }

    SovereignEngine.preview();
  }
};

SovereignEngine.boot();
