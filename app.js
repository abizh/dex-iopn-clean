/**
 * SOVEREIGN ENGINE v71.0 - INDUSTRIAL FINALITY
 * The definitive Master Build: Atomic, Parallel, & Lifecycle-Aware.
 */

const SovereignEngine = (() => {
    // --- 1. CORE CONFIGURATION ---
    const _CONFIG = Object.freeze({
        CHAIN_ID: 2047,
        RPC: "https://testnet-rpc2.iopn.tech",
        WOPN: "0x826496be2340356C193566190802777174e929f9",
        GHOST_TTL: 600000,
        TX_TIMEOUT: 90000,
        HEARTBEAT_INTERVAL: 8000,
        PERSISTENCE_MAX_AGE: 86400000 // 24 Hours
    });

    // --- 2. INTEGRITY TOOLS ---
    const _deepSeal = (obj, visited = new WeakSet()) => {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return obj;
        visited.add(obj);
        Object.seal(obj);
        Object.values(obj).forEach(v => _deepSeal(v, visited));
        return obj;
    };

    // --- 3. INTERNAL RUNTIME STATE ---
    const _INTERNAL = {
        state: _deepSeal({
            vault: { address: null, balanceIn: "0", balanceOut: "0" },
            kernel: { status: "IDLE", txQueue: [] },
            network: { chainId: null, connected: false, rpcStatus: "OK" }
        }),
        settlements: new Map(),
        ghosts: new Map(),
        provider: null,
        staticProvider: new ethers.JsonRpcProvider(_CONFIG.RPC),
        abortController: new AbortController(),
        lock: false,
        inflightHydration: false,
        hydrationScheduled: false,
        epoch: 0,
        syncScheduled: false,
        heartbeatId: null,
        handlers: { accounts: null, chain: null }
    };

    // --- 4. CORE ENGINE LOGIC ---
    const _core = {
        async getProvider() {
            if (!_INTERNAL.provider && window.ethereum) {
                _INTERNAL.provider = new ethers.BrowserProvider(window.ethereum);
            }
            if (!_INTERNAL.provider) throw new Error("NO_PROVIDER");
            return _INTERNAL.provider;
        },

        mutate(updates) {
            let changed = false;
            updates.forEach(([path, value]) => {
                const keys = path.split('.');
                let target = _INTERNAL.state;
                for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
                const lastKey = keys[keys.length - 1];
                if (target[lastKey] !== value) {
                    target[lastKey] = value;
                    changed = true;
                }
            });
            if (changed) {
                this.triggerSync();
                this.persist();
            }
        },

        triggerSync() {
            if (_INTERNAL.syncScheduled || !window.syncSovereignUI) return;
            _INTERNAL.syncScheduled = true;
            queueMicrotask(() => {
                try {
                    const snapshot = window.structuredClone 
                        ? structuredClone(_INTERNAL.state) 
                        : JSON.parse(JSON.stringify(_INTERNAL.state));
                    window.syncSovereignUI(snapshot);
                } finally {
                    _INTERNAL.syncScheduled = false;
                }
            });
        },

        persist() {
            try {
                const now = Date.now();
                const cleanSettlements = [..._INTERNAL.settlements.entries()]
                    .filter(([_, v]) => now - v.ts < _CONFIG.PERSISTENCE_MAX_AGE)
                    .slice(-50);

                localStorage.setItem('SOVEREIGN_JOURNAL', JSON.stringify({
                    queue: _INTERNAL.state.kernel.txQueue,
                    settlements: cleanSettlements
                }));
            } catch {}
        },

        loadPersistence() {
            try {
                const raw = localStorage.getItem('SOVEREIGN_JOURNAL');
                if (!raw) return;
                const { queue, settlements } = JSON.parse(raw);
                _INTERNAL.settlements = new Map(settlements || []);
                this.mutate([['kernel.txQueue', queue || []]]);
            } catch {}
        },

        dedupeQueue(queue) {
            const seen = new Set();
            return queue.filter(entry => {
                if (!entry.hash) return true;
                if (seen.has(entry.hash)) return false;
                seen.add(entry.hash);
                return true;
            });
        }
    };

    // --- 5. PUBLIC API & LIFECYCLE ---
    return {
        async execute(type, payload) {
            if (_INTERNAL.lock || _INTERNAL.state.kernel.status !== "IDLE") return;

            const amount = payload?.amount?.toString() || "0";
            if (isNaN(amount) || parseFloat(amount) <= 0) return;

            _INTERNAL.lock = true;
            let timeoutId = null;

            try {
                const provider = await _core.getProvider();
                const network = await provider.getNetwork();
                if (Number(network.chainId) !== _CONFIG.CHAIN_ID) throw new Error("WRONG_NETWORK");

                const accounts = await provider.send("eth_accounts", []);
                if (!accounts?.length) throw new Error("WALLET_DISCONNECTED");

                const signer = await provider.getSigner();
                _core.mutate([['kernel.status', 'SIGNING']]);

                const contract = new ethers.Contract(_CONFIG.WOPN, [
                    "function deposit() payable", "function withdraw(uint256)"
                ], signer);

                const tx = (payload.mode === 'DEPOSIT') 
                    ? await contract.deposit({ value: ethers.parseUnits(amount, 18) }) 
                    : await contract.withdraw(ethers.parseUnits(amount, 18));

                _core.mutate([['kernel.status', 'OBSERVING']]);
                _INTERNAL.ghosts.set(tx.hash, { ts: Date.now(), type });

                const receipt = await Promise.race([
                    tx.wait(1),
                    new Promise((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), _CONFIG.TX_TIMEOUT);
                        const onAbort = () => reject(new Error("ABORTED"));
                        _INTERNAL.abortController.signal.addEventListener('abort', onAbort, { once: true });
                    })
                ]);

                if (receipt) this.finalize(receipt.hash, type, "SUCCESS");
            } catch (err) {
                if (err.message !== "ABORTED") {
                    this.finalize(null, type, "FAILED", err.reason || err.message);
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                _INTERNAL.lock = false;
                _core.mutate([['kernel.status', 'IDLE']]);
            }
        },

        finalize(hash, type, status, error = null) {
            const now = Date.now();
            if (hash) {
                const prev = _INTERNAL.settlements.get(hash);
                if (prev?.status === "SUCCESS") {
                    _INTERNAL.ghosts.delete(hash);
                    return;
                }
                _INTERNAL.settlements.set(hash, { status, ts: now });
            }

            _INTERNAL.ghosts.delete(hash);
            const entry = { hash, type, status, error, ts: now };
            const queue = _core.dedupeQueue([entry, ..._INTERNAL.state.kernel.txQueue]).slice(0, 10);

            _core.mutate([['kernel.txQueue', queue]]);
            this.scheduleHydrate();
        },

        scheduleHydrate() {
            if (_INTERNAL.hydrationScheduled) return;
            _INTERNAL.hydrationScheduled = true;
            queueMicrotask(() => {
                _INTERNAL.hydrationScheduled = false;
                this.hydrate();
            });
        },

        async hydrate() {
            const addr = _INTERNAL.state.vault.address;
            if (!_INTERNAL.state.network.connected || !addr || _INTERNAL.inflightHydration) return;

            const addrSnapshot = addr;
            _INTERNAL.inflightHydration = true;
            const currentEpoch = ++_INTERNAL.epoch;

            try {
                const started = Date.now();
                const token = new ethers.Contract(_CONFIG.WOPN, ["function balanceOf(address) view returns (uint256)"], _INTERNAL.staticProvider);
                const [eth, wopn] = await Promise.all([
                    _INTERNAL.staticProvider.getBalance(addrSnapshot),
                    token.balanceOf(addrSnapshot)
                ]);

                if (currentEpoch === _INTERNAL.epoch && addrSnapshot === _INTERNAL.state.vault.address) {
                    _core.mutate([
                        ['vault.balanceIn', ethers.formatEther(eth)],
                        ['vault.balanceOut', ethers.formatEther(wopn)],
                        ['network.rpcStatus', (Date.now() - started > 5000) ? 'STALE' : 'OK']
                    ]);
                }
            } catch {
                _core.mutate([['network.rpcStatus', 'DEGRADED']]);
            } finally {
                _INTERNAL.inflightHydration = false;
            }
        },

        startHeartbeat() {
            if (_INTERNAL.heartbeatId) return;
            _INTERNAL.heartbeatId = setInterval(async () => {
                if (_INTERNAL.ghosts.size === 0) return;
                const jobs = Array.from(_INTERNAL.ghosts.entries()).map(async ([hash, meta]) => {
                    if (!_INTERNAL.ghosts.has(hash)) return;
                    if (Date.now() - meta.ts > _CONFIG.GHOST_TTL) {
                        _INTERNAL.ghosts.delete(hash);
                        return;
                    }
                    try {
                        const receipt = await _INTERNAL.staticProvider.getTransactionReceipt(hash);
                        if (receipt && _INTERNAL.ghosts.has(hash)) {
                            this.finalize(hash, meta.type, "SUCCESS");
                        }
                    } catch {}
                });
                await Promise.allSettled(jobs);
            }, _CONFIG.HEARTBEAT_INTERVAL);
        },

        boot: async function() {
            if (window.__SOVEREIGN_LOADED__ || !window.ethereum) return;
            _core.loadPersistence();

            _INTERNAL.handlers.accounts = (accs) => {
                const addr = accs[0] || null;
                _core.mutate([
                    ['vault.address', addr], ['vault.balanceIn', '0'], ['vault.balanceOut', '0'],
                    ['network.connected', !!addr]
                ]);
                if (addr) this.scheduleHydrate();
            };

            _INTERNAL.handlers.chain = (hex) => {
                const chainId = parseInt(hex, 16);
                _INTERNAL.provider = null;
                _INTERNAL.ghosts.clear();
                _INTERNAL.abortController.abort();
                _INTERNAL.abortController = new AbortController();
                _core.mutate([
                    ['network.chainId', chainId],
                    ['network.rpcStatus', chainId === _CONFIG.CHAIN_ID ? 'OK' : 'WRONG_NETWORK']
                ]);
                if (chainId === _CONFIG.CHAIN_ID) this.scheduleHydrate();
            };

            try {
                const eth = window.ethereum;
                const [accs, chain] = await Promise.all([
                    eth.request({ method: 'eth_accounts' }),
                    eth.request({ method: 'eth_chainId' })
                ]);

                _INTERNAL.handlers.accounts(accs);
                _INTERNAL.handlers.chain(chain);

                eth.on('accountsChanged', _INTERNAL.handlers.accounts);
                eth.on('chainChanged', _INTERNAL.handlers.chain);

                this.startHeartbeat();
                window.__SOVEREIGN_LOADED__ = true;
                console.log("%c SOVEREIGN ENGINE v71.0 LOADED ", "background:#111;color:#00ff00;font-weight:bold;");
            } catch (e) {
                console.error("BOOT_FAILED", e);
            }
        },

        unmount() {
            const eth = window.ethereum;
            if (eth && _INTERNAL.handlers.accounts) {
                eth.removeListener('accountsChanged', _INTERNAL.handlers.accounts);
                eth.removeListener('chainChanged', _INTERNAL.handlers.chain);
            }
            if (_INTERNAL.heartbeatId) {
                clearInterval(_INTERNAL.heartbeatId);
                _INTERNAL.heartbeatId = null;
            }
            _INTERNAL.abortController.abort();
            window.__SOVEREIGN_LOADED__ = false;
            console.log("%c SOVEREIGN UNMOUNTED ", "background:#111;color:#ff5555");
        }
    };
})();

// AUTO-BOOT
SovereignEngine.boot();
window.KernelDispatcher = SovereignEngine;
                
