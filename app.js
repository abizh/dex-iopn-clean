/**
 * SOVEREIGN ENGINE v90.8 - THE FINAL SENTINEL (Standalone JS)
 * Protokol: Deep Sleep, Adaptive Backoff, Epoch Guard, & Forensic Mapping
 */

const SovereignEngine = (() => {
    // --- 1. KONFIGURASI MISI ---
    const _CONFIG = Object.freeze({
        ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
        WOPN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
        ROUTER_ABI: [
            "function getAmountsOut(uint amtIn, address[] path) view returns (uint[] amts)",
            "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amtIn, uint amtOutMin, address[] path, address to, uint deadline)",
            "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amtOutMin, address[] path, address to, uint deadline) payable",
            "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amtIn, uint amtOutMin, address[] path, address to, uint deadline)"
        ],
        ASSETS: {
            OPN:   { addr: "NATIVE", dec: 18, slip: 2 },
            WOPN:  { addr: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84", dec: 18, slip: 1 },
            OPNT:  { addr: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d", dec: 18, slip: 3 },
            tUSDT: { addr: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b", dec: 18, slip: 2 },
            PRET:  { addr: "0xEcbf04b23f5b15492794dE22Da5A9819b60B88FD", dec: 18, slip: 12, hasFee: true }
        }
    });

    // --- 2. INTERNAL STATE & REGISTRY ---
    let _hydrateEpoch = 0;
    let _notifyToken = 0;
    let _consecutiveFails = 0;
    let _pollTimeout = null;
    let _savedLogs = [];
    
    try { 
        _savedLogs = JSON.parse(localStorage.getItem('bozzdex_v90_logs')) || []; 
    } catch(e) { 
        _savedLogs = []; 
    }

    const _STATE = { 
        address: null, 
        balances: {}, 
        status: "IDLE", 
        error: "", 
        message: "", 
        logs: _savedLogs 
    };

    let _provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null;

    // --- 3. CORE UTILITIES (The Black Box & Engines) ---
    const _core = {
        async fetchRawBalance(sym, provider, address) {
            const asset = _CONFIG.ASSETS[sym];
            if (asset.addr === "NATIVE") return await provider.getBalance(address);
            const contract = new ethers.Contract(asset.addr, ["function balanceOf(address) view returns (uint256)"], provider);
            return await contract.balanceOf(address);
        },

        async getValidatedPath(sIn, sOut, amtWei) {
            const aIn = _CONFIG.ASSETS[sIn].addr === "NATIVE" ? _CONFIG.WOPN : _CONFIG.ASSETS[sIn].addr;
            const aOut = _CONFIG.ASSETS[sOut].addr === "NATIVE" ? _CONFIG.WOPN : _CONFIG.ASSETS[sOut].addr;
            const direct = [aIn, aOut];
            const bridge = [aIn, _CONFIG.WOPN, aOut];
            try {
                const r = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, _provider);
                const q = await r.getAmountsOut(amtWei, direct);
                if (q[1] > 0n) return direct;
            } catch (e) {}
            return bridge;
        },

        saveLog(entry) {
            try {
                const atomicEntry = { 
                    ts: Date.now(), 
                    time: new Date().toLocaleTimeString(), 
                    ...entry 
                };
                _STATE.logs.unshift(atomicEntry);
                if (_STATE.logs.length > 20) _STATE.logs.pop();
                localStorage.setItem('bozzdex_v90_logs', JSON.stringify(_STATE.logs));
            } catch (e) { console.warn("Black Box Full"); }
        },

        notify(msg, type = "INFO") {
            const token = ++_notifyToken;
            if (type === "ERR") {
                _STATE.error = msg;
                _STATE.message = "";
            } else {
                _STATE.message = msg;
                _STATE.error = "";
                // Auto-clear message (not error) after 7s if not replaced
                setTimeout(() => {
                    if (_notifyToken === token) {
                        _STATE.message = "";
                        SovereignEngine.render();
                    }
                }, 7000);
            }
            SovereignEngine.render();
        },

        getFleetIntelligence() {
            if (_STATE.logs.length === 0) return { health: "STANDBY", lastSuccess: "NONE", lastHeartbeat: "NONE", count: 0 };
            const sorted = [..._STATE.logs].sort((a, b) => b.ts - a.ts);
            const window = sorted.slice(0, 10);
            const fails = window.filter(l => l.status === "FAILED").length;
            
            let h = "OPERATIONAL";
            if (fails >= 4) h = "CRITICAL"; 
            else if (fails >= 2) h = "WARNING";

            return { 
                health: h, 
                lastSuccess: sorted.find(l => l.status === "SUCCESS")?.time || "NEVER", 
                lastHeartbeat: sorted[0]?.time || "NONE", 
                count: _STATE.logs.length 
            };
        }
    };

    // --- 4. PUBLIC NAVIGATOR ---
    return {
        async hydrate() {
            if (_pollTimeout) clearTimeout(_pollTimeout);
            
            // DEEP SLEEP PROTOCOL: Zero-Pulse when hidden
            if (document.hidden || !_STATE.address || !_provider) {
                console.log("SENTINEL_HIBERNATION: Active (Pulse Stopped)");
                return;
            }

            const epoch = ++_hydrateEpoch;
            const res = {};
            try {
                for (const s of Object.keys(_CONFIG.ASSETS)) {
                    if (epoch !== _hydrateEpoch) return;
                    const bal = await _core.fetchRawBalance(s, _provider, _STATE.address);
                    res[s] = ethers.formatUnits(bal, _CONFIG.ASSETS[s].dec);
                }
                
                if (epoch !== _hydrateEpoch) return;
                _STATE.balances = res;
                _consecutiveFails = 0; // Reset network health
                this.render();
            } catch (e) {
                _consecutiveFails++;
                if (_consecutiveFails >= 3) _core.notify("NETWORK_UNSTABLE", "ERR");
                console.warn(`HYDRATE_FAIL_${_consecutiveFails}`);
            } finally {
                // Ensure pulse continues only if still visible
                if (!document.hidden) this.scheduleHydrate();
            }
        },

        scheduleHydrate() {
            if (document.hidden) return;
            // ADAPTIVE BACKOFF: 5s -> 10s -> 20s -> 60s
            let delay = 5000;
            if (_consecutiveFails === 1) delay = 10000;
            else if (_consecutiveFails === 2) delay = 20000;
            else if (_consecutiveFails >= 3) delay = 60000;

            _pollTimeout = setTimeout(() => this.hydrate(), delay);
        },

        render() {
            const sIn = document.getElementById('sel-in').value;
            const sOut = document.getElementById('sel-out').value;
            
            // UI Element Updates
            const bIn = document.getElementById('bal-in');
            const bOut = document.getElementById('bal-out');
            if (bIn) bIn.innerText = parseFloat(_STATE.balances[sIn] || 0).toFixed(4);
            if (bOut) bOut.innerText = parseFloat(_STATE.balances[sOut] || 0).toFixed(4);
            
            const k = document.getElementById('kernelState');
            if (k) {
                if (_STATE.error) {
                    k.innerText = `[!] ALERT: ${_STATE.error}`;
                    k.className = "status-pill status-bad";
                } else if (_STATE.message) {
                    k.innerText = `[*] INFO: ${_STATE.message}`;
                    k.className = "status-pill status-ok";
                } else {
                    k.innerText = `SYSTEM: ${_STATE.status}`;
                    k.className = "status-pill status-ok";
                }
            }

            const btn = document.getElementById('exec-btn');
            if (btn) btn.disabled = (_STATE.status !== "IDLE" || sIn === sOut);

            // Fleet Radar Rendering
            const intel = _core.getFleetIntelligence();
            const fleet = document.getElementById('fleet-overview');
            if (fleet) {
                const assets = ['OPN', 'PRET', 'tUSDT'];
                fleet.innerHTML = `
                    <div class="fleet-status-bar">
                        <span style="color:${intel.health==='CRITICAL'?'#ff4444':intel.health==='WARNING'?'#ffcc00':'#00ff88'}">● ${intel.health}</span>
                        <span style="color:#555">HB: ${intel.lastHeartbeat} | MIS: ${intel.count}</span>
                    </div>
                    <div class="fleet-grid">
                        ${assets.map(s => `
                            <div class="fleet-card ${s==='PRET'?'focus':'active'}">
                                <span>${s} POS</span>
                                <b>${parseFloat(_STATE.balances[s]||0).toFixed(3)}</b>
                            </div>`).join('')}
                    </div>
                `;
            }

            // Forensic Logbook Rendering
            const logBox = document.getElementById('log-history');
            if (logBox) {
                logBox.innerHTML = _STATE.logs.map(log => 
                    log.status === "SUCCESS" ? 
                    `<div class="log-item"><span class="tag-success">SUCCESS</span><span>${log.pair} | +${log.net}</span><a class="log-hash" href="https://testnet.iopn.tech/tx/${log.hash}" target="_blank">🔗</a></div>` :
                    `<div class="log-item failed"><span class="tag-fail">${log.phase}</span><span>${log.reason}</span></div>`
                ).join('');
            }
        },

        async execute() {
            if (_STATE.status !== "IDLE") return;
            
            // Path Sterilization
            _STATE.error = ""; _STATE.message = "";
            const sIn = document.getElementById('sel-in').value;
            const sOut = document.getElementById('sel-out').value;
            const val = document.getElementById('amt-in').value;
            let currentPhase = "PRE-FLIGHT";

            if (!val || val <= 0) return _core.notify("INVALID_AMOUNT", "ERR");

            try {
                const signer = await _provider.getSigner();
                const router = new ethers.Contract(_CONFIG.ROUTER, _CONFIG.ROUTER_ABI, signer);
                const amtWei = ethers.parseUnits(val, _CONFIG.ASSETS[sIn].dec);

                currentPhase = "ROUTING"; _STATE.status = currentPhase; this.render();
                const path = await _core.getValidatedPath(sIn, sOut, amtWei);

                currentPhase = "QUOTING"; _STATE.status = currentPhase; this.render();
                const quotes = await router.getAmountsOut(amtWei, path);
                let qOut = quotes[quotes.length - 1];
                
                // Fee-on-transfer protection
                if (_CONFIG.ASSETS[sIn].hasFee || _CONFIG.ASSETS[sOut].hasFee) qOut = (qOut * 92n) / 100n;
                const minOut = (qOut * BigInt(100 - (_CONFIG.ASSETS[sOut].slip || 5))) / 100n;

                const balBefore = await _core.fetchRawBalance(sOut, _provider, _STATE.address);

                // Approval Logic
                if (_CONFIG.ASSETS[sIn].addr !== "NATIVE") {
                    currentPhase = "APPROVING"; _STATE.status = currentPhase; this.render();
                    const tok = new ethers.Contract(_CONFIG.ASSETS[sIn].addr, ["function approve(address,uint256) returns (bool)"], signer);
                    const txApp = await tok.approve(_CONFIG.ROUTER, amtWei);
                    await txApp.wait();
                }

                currentPhase = "SWAPPING"; _STATE.status = currentPhase; this.render();
                const deadline = Math.floor(Date.now() / 1000) + 1200;
                let tx;
                
                if (sIn === "OPN") {
                    tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(minOut, path, _STATE.address, deadline, { value: amtWei });
                } else if (sOut === "OPN") {
                    tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(amtWei, minOut, path, _STATE.address, deadline);
                } else {
                    tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amtWei, minOut, path, _STATE.address, deadline);
                }

                _STATE.status = "MINING"; this.render();
                const receipt = await tx.wait();

                // Diff Calculation
                const balAfter = await _core.fetchRawBalance(sOut, _provider, _STATE.address);
                let diff = balAfter - balBefore;
                if (sOut === "OPN") {
                    const gasUsed = receipt.gasUsed * (receipt.effectiveGasPrice || receipt.gasPrice);
                    diff += gasUsed;
                }

                _core.saveLog({ 
                    pair: `${sIn}→${sOut}`, 
                    net: ethers.formatUnits(diff, _CONFIG.ASSETS[sOut].dec).slice(0, 8), 
                    hash: receipt.hash, 
                    status: "SUCCESS" 
                });
                
                _STATE.status = "SUCCESS";
                _core.notify("MISSION ACCOMPLISHED", "OK");

            } catch (e) {
                // Forensic Mapping
                const isReject = e.code === "ACTION_REJECTED" || e.code === 4001;
                const isNetwork = e.code === "NETWORK_ERROR" || e.message?.includes("network") || e.cause?.code === "ECONNREFUSED";
                
                const actor = isReject ? "USER_ABORT" : (isNetwork ? "NETWORK_FAIL" : "CONTRACT_REVERT");
                const reason = e.shortMessage || e.reason || e.message || "UNKNOWN";

                _core.saveLog({ 
                    pair: `${sIn}→${sOut}`, 
                    phase: currentPhase, 
                    reason: `${actor}: ${reason.slice(0, 20)}`, 
                    status: "FAILED" 
                });
                
                _core.notify(`${actor} @ ${currentPhase}`, "ERR");
                _STATE.status = "ERROR";
            } finally {
                // Post-mission cooldown
                setTimeout(() => { 
                    _STATE.status = "IDLE"; 
                    _STATE.error = ""; 
                    this.hydrate(); 
                }, 5000);
            }
        },

        boot() {
            if (!_provider) {
                _core.notify("WEB3_PROVIDER_MISSING", "ERR");
                return;
            }

            // Sync with Environment
            window.ethereum.on('accountsChanged', () => window.location.reload());
            window.ethereum.on('chainChanged', () => window.location.reload());
            
            // Immediate Recovery Protocol
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    console.log("SENTINEL_WAKE: Immediate Recovery");
                    this.hydrate();
                }
            });

            // Initial Login
            window.ethereum.request({ method: 'eth_requestAccounts' }).then(accs => {
                _STATE.address = accs[0];
                this.hydrate(); // Start Adaptive Polling
            }).catch(() => {
                _core.notify("CONNECTION_REJECTED", "ERR");
            });
        }
    };
})();

// Initiate Engine
SovereignEngine.boot();
