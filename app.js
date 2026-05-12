/**
 * SOVEREIGN ENGINE v91.4 — THE PAIR HEALTH SENTINEL
 * Final Rebuild:
 * - Pair Health Intelligence
 * - Reserve Validation
 * - Safe Route Discovery
 * - Recursive Hydration
 * - Wallet Lifecycle Awareness
 * - Atomic Preview Protection
 */

const SovereignEngine = (() => {

  const ZERO = "0x0000000000000000000000000000000000000000";

  const _CONFIG = Object.freeze({

    ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",

    FACTORY: "0x7856641544a04944474321798544D0860E21a8dE",

    WOPN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",

    EXPLORER_TX: "https://testnet.iopn.tech/tx/",

    ROUTER_ABI: [
      "function getAmountsOut(uint amountIn,address[] memory path) view returns (uint[] memory amounts)",
      "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline) payable",
      "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline)",
      "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline)"
    ],

    FACTORY_ABI: [
      "function getPair(address tokenA,address tokenB) external view returns(address pair)"
    ],

    ERC20_ABI: [
      "function balanceOf(address owner) view returns(uint256)",
      "function approve(address spender,uint256 amount) returns(bool)",
      "function allowance(address owner,address spender) view returns(uint256)"
    ],

    PAIR_ABI: [
      "function token0() view returns(address)",
      "function token1() view returns(address)",
      "function getReserves() view returns(uint112,uint112,uint32)"
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
        addr: "0xC52643194BebB20e03108465057d19A82D093a8B",
        dec: 18,
        slip: 5
      },

      tUSDT: {
        addr: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b",
        dec: 18,
        slip: 2
      },

      tbnb: {
        addr: "0x34151B19024D99fD18987b7C0428B715C8c29016",
        dec: 18,
        slip: 5
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

    logs: [],

    lastPreviewId: 0
  };

  let _provider = null;

  let _hydrateTimeout = null;

  let _notifyToken = 0;

  const _pairCache = new Map();

  const _core = {

    assetAddress(sym) {

      const asset = _CONFIG.ASSETS[sym];

      return asset.addr === "NATIVE"
        ? _CONFIG.WOPN
        : asset.addr;
    },

    notify(msg, type = "INFO") {

      const token = ++_notifyToken;

      if (type === "ERR") {
        _STATE.error = msg;
        _STATE.message = "";
      } else {

        _STATE.message = msg;
        _STATE.error = "";

        setTimeout(() => {

          if (_notifyToken === token) {

            _STATE.message = "";

            SovereignEngine.render();
          }

        }, 7000);
      }

      SovereignEngine.render();
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

    async validatePairHealth(pairAddr) {

      try {

        if (!pairAddr || pairAddr === ZERO) {
          return false;
        }

        const pair = new ethers.Contract(
          pairAddr,
          _CONFIG.PAIR_ABI,
          _provider
        );

        const reserves = await pair.getReserves();

        const r0 = reserves[0];
        const r1 = reserves[1];

        console.log("PAIR_HEALTH", pairAddr, r0.toString(), r1.toString());

        return r0 > 0n && r1 > 0n;

      } catch (e) {

        console.warn("PAIR_HEALTH_FAIL", e);

        return false;
      }
    },

    async getHealthyPair(t1, t2) {

      const key = [t1.toLowerCase(), t2.toLowerCase()]
        .sort()
        .join(":");

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

        if (!pair || pair === ZERO) {

          _pairCache.set(key, null);

          return null;
        }

        const healthy = await _core.validatePairHealth(pair);

        if (!healthy) {

          console.warn("PAIR_EXISTS_BUT_EMPTY", pair);

          _pairCache.set(key, null);

          return null;
        }

        _pairCache.set(key, pair);

        return pair;

      } catch (e) {

        console.warn("PAIR_LOOKUP_FAIL", e);

        return null;
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

      // DIRECT

      const directPair = await _core.getHealthyPair(aIn, aOut);

      if (directPair) {

        const directPath = [aIn, aOut];

        try {

          const q = await router.getAmountsOut(
            amtWei,
            directPath
          );

          if (q && q[q.length - 1] > 0n) {

            console.log("DIRECT_ROUTE_OK");

            return directPath;
          }

        } catch (e) {

          console.warn("DIRECT_QUOTE_FAIL", e);
        }
      }

      // BRIDGE VIA WOPN

      if (
        aIn !== _CONFIG.WOPN &&
        aOut !== _CONFIG.WOPN
      ) {

        const p1 = await _core.getHealthyPair(
          aIn,
          _CONFIG.WOPN
        );

        const p2 = await _core.getHealthyPair(
          _CONFIG.WOPN,
          aOut
        );

        if (p1 && p2) {

          const bridgePath = [
            aIn,
            _CONFIG.WOPN,
            aOut
          ];

          try {

            const q = await router.getAmountsOut(
              amtWei,
              bridgePath
            );

            if (q && q[q.length - 1] > 0n) {

              console.log("BRIDGE_ROUTE_OK");

              return bridgePath;
            }

          } catch (e) {

            console.warn("BRIDGE_QUOTE_FAIL", e);
          }
        }
      }

      throw new Error("NO_HEALTHY_ROUTE");
    },

    async getQuote(amtWei, path, sIn, sOut) {

      try {

        const router = new ethers.Contract(
          _CONFIG.ROUTER,
          _CONFIG.ROUTER_ABI,
          _provider
        );

        const amounts = await router.getAmountsOut(
          amtWei,
          path
        );

        let out = amounts[amounts.length - 1];

        if (
          _CONFIG.ASSETS[sIn].hasFee ||
          _CONFIG.ASSETS[sOut].hasFee
        ) {
          out = (out * 90n) / 100n;
        }

        const slip = BigInt(
          _CONFIG.ASSETS[sOut].slip || 5
        );

        const minOut =
          (out * (100n - slip)) / 100n;

        return {
          out,
          minOut
        };

      } catch {

        return {
          out: 0n,
          minOut: 0n
        };
      }
    }
  };

  return {

    getState: () => _STATE,

    async preview() {

      const previewId = ++_STATE.lastPreviewId;

      const sIn =
        document.getElementById("sel-in").value;

      const sOut =
        document.getElementById("sel-out").value;

      const val =
        document.getElementById("amt-in").value;

      const outEl =
        document.getElementById("amt-out");

      if (
        !val ||
        Number(val) <= 0 ||
        sIn === sOut
      ) {

        outEl.value = "";

        return;
      }

      try {

        const amtWei = ethers.parseUnits(
          val,
          _CONFIG.ASSETS[sIn].dec
        );

        const path =
          await _core.getValidatedPath(
            sIn,
            sOut,
            amtWei
          );

        const quote =
          await _core.getQuote(
            amtWei,
            path,
            sIn,
            sOut
          );

        if (
          previewId !== _STATE.lastPreviewId
        ) {
          return;
        }

        outEl.value =
          ethers.formatUnits(
            quote.minOut,
            _CONFIG.ASSETS[sOut].dec
          );

        _STATE.error = "";

      } catch (e) {

        if (
          previewId === _STATE.lastPreviewId
        ) {

          outEl.value = "0.0";

          _STATE.error = e.message;
        }
      }

      this.render();
    },

    async execute() {

      if (
        _STATE.status !== "IDLE" ||
        _STATE.error
      ) {
        return;
      }

      const sIn =
        document.getElementById("sel-in").value;

      const sOut =
        document.getElementById("sel-out").value;

      const val =
        document.getElementById("amt-in").value;

      try {

        _STATE.status = "PREPARING";

        this.render();

        const signer =
          await _provider.getSigner();

        const amtWei = ethers.parseUnits(
          val,
          _CONFIG.ASSETS[sIn].dec
        );

        const path =
          await _core.getValidatedPath(
            sIn,
            sOut,
            amtWei
          );

        const quote =
          await _core.getQuote(
            amtWei,
            path,
            sIn,
            sOut
          );

        if (quote.minOut <= 0n) {
          throw new Error(
            "INVALID_QUOTE"
          );
        }

        // APPROVAL

        if (
          _CONFIG.ASSETS[sIn].addr !==
          "NATIVE"
        ) {

          _STATE.status = "APPROVING";

          this.render();

          const token =
            new ethers.Contract(
              _CONFIG.ASSETS[sIn].addr,
              _CONFIG.ERC20_ABI,
              signer
            );

          const allowance =
            await token.allowance(
              _STATE.address,
              _CONFIG.ROUTER
            );

          if (allowance < amtWei) {

            const txApprove =
              await token.approve(
                _CONFIG.ROUTER,
                ethers.MaxUint256
              );

            await txApprove.wait();
          }
        }

        // SWAP

        _STATE.status = "SWAPPING";

        this.render();

        const router =
          new ethers.Contract(
            _CONFIG.ROUTER,
            _CONFIG.ROUTER_ABI,
            signer
          );

        const deadline =
          Math.floor(Date.now() / 1000) +
          600;

        let tx;

        if (sIn === "OPN") {

          tx =
            await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
              quote.minOut,
              path,
              _STATE.address,
              deadline,
              {
                value: amtWei
              }
            );

        } else if (sOut === "OPN") {

          tx =
            await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
              amtWei,
              quote.minOut,
              path,
              _STATE.address,
              deadline
            );

        } else {

          tx =
            await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
              amtWei,
              quote.minOut,
              path,
              _STATE.address,
              deadline
            );
        }

        _STATE.status = "CONFIRMING";

        this.render();

        const receipt =
          await tx.wait();

        _core.saveLog({
          pair: `${sIn}→${sOut}`,
          status: "SUCCESS",
          fullHash: receipt.hash
        });

        _core.notify(
          "MISSION ACCOMPLISHED",
          "OK"
        );

      } catch (e) {

        console.error(e);

        const reason =
          e.reason ||
          e.shortMessage ||
          e.message ||
          "UNKNOWN_ERROR";

        _core.saveLog({
          pair: `${sIn}→${sOut}`,
          status: "FAILED",
          reason
        });

        _core.notify(
          reason.slice(0, 50),
          "ERR"
        );

      } finally {

        _STATE.status = "IDLE";

        this.render();

        this.hydrate();
      }
    }
  };

})();
