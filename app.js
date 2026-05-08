/**
 * SOVEREIGN ENGINE v71.5 - BOZZDEX
 * Master Build: Multi-Asset, Spender-Aware, & Real-time Sync.
 */

const SovereignEngine = (() => {
    // --- 1. CORE CONFIGURATION (Kitab Suci BozzDex) ---
    const _CONFIG = Object.freeze({
        CHAIN_ID: 984,
        RPC: "https://testnet-rpc2.iopn.tech",
        // Router & Infrastructure
        ROUTER_BOZZ: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961", // Spender Utama
        ROUTER_OFFICIAL: "0xB489bce5c9c9364da2D1D1Bc5CE4274F63141885",
        POOL_BOZZ: "0x650dFfD3154Ec4cbE72127845aEBE4A93a0693a8",
        // Assets Inventory
        ASSETS: {
            WOPN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
            OPNT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d",
            tUSDT: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b",
            tBNB: "0x92cF36713a5622351c9489D5556B90B321873607",
            TETE: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E"
        },
        HEARTBEAT_INTERVAL: 3000, // Auto-refresh 3 detik
        TX_TIMEOUT: 90000
    });

    // --- 2. INTERNAL RUNTIME STATE ---
    const _INTERNAL = {
        state: {
            vault: { 
                address: null, 
                balances: { WOPN: "0", OPNT: "0", tUSDT: "0", tBNB: "0", TETE: "0", OPN: "0" } 
            },
            kernel: { status: "IDLE", txQueue: [], slippage: 0.5, currentRate: 0.24 },
            network: { chainId: null, connected: false, rpcStatus: "OK" }
        },
        provider: null,
        staticProvider: new ethers.JsonRpcProvider(_CONFIG.RPC),
        inflightHydration: false,
        epoch: 0,
        handlers: { accounts: null, chain: null }
    };

    // --- 3. CORE ENGINE LOGIC ---
    const _core = {
        mutate(updates) {
            updates.forEach(([path, value]) => {
                const keys = path.split('.');
                let target = _INTERNAL.state;
                for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
                target[keys[keys.length - 1]] = value;
            });
            // Sinkronkan ke UI via global handler
            if (window.syncSovereignUI) {
                window.syncSovereignUI(JSON.parse(JSON.stringify(_INTERNAL.state)));
            }
        }
    };

    // --- 4. PUBLIC API ---
    return {
        // Eksekusi Swap dengan Approval ke Router BozzDex
        async execute(type, payload) {
            if (_INTERNAL.state.kernel.status !== "IDLE") return;
            
            const { amount, tokenIn, tokenOut, slippage } = payload;
            _core.mutate([['kernel.status', 'PREPARING']]);

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const tokenContract = new ethers.Contract(_CONFIG.ASSETS[tokenIn], [
                    "function approve(address,uint256) returns (bool)",
                    "function allowance(address,address) view returns (uint256)"
                ], signer);

                const amountWei = ethers.parseUnits(amount.toString(), 18);

                // 1. Mandatory Approval Step ke Router BozzDex
                _core.mutate([['kernel.status', 'APPROVING']]);
                const allowance = await tokenContract.allowance(_INTERNAL.state.vault.address, _CONFIG.ROUTER_BOZZ);
                
                if (allowance < amountWei) {
                    const appTx = await tokenContract.approve(_CONFIG.ROUTER_BOZZ, amountWei);
                    await appTx.wait(1);
                }

                // 2. Execution Step (Simulasi Swap/Add Liq)
                _core.mutate([['kernel.status', 'SIGNING']]);
                // Di sini lu bisa panggil contract Router BozzDex lu bray
                // const router = new ethers.Contract(_CONFIG.ROUTER_BOZZ, ABI, signer);
                
                // Dummy Success for UI Testing
                setTimeout(() => {
                    this.finalize(null, `${tokenIn} ➔ ${tokenOut}`, "SUCCESS");
                }, 2000);

            } catch (err) {
                this.finalize(null, type, "FAILED", err.message);
            }
        },

        // Hydration: Tarik semua saldo asset sekaligus
        async hydrate() {
            const addr = _INTERNAL.state.vault.address;
            if (!addr || _INTERNAL.inflightHydration) return;
            
            _INTERNAL.inflightHydration = true;
            try {
                const results = {};
                
                // Get Native OPN Balance
                const nativeBal = await _INTERNAL.staticProvider.getBalance(addr);
                results['OPN'] = ethers.formatEther(nativeBal);

                // Get All Token Balances
                const calls = Object.entries(_CONFIG.ASSETS).map(async ([symbol, ca]) => {
                    const contract = new ethers.Contract(ca, ["function balanceOf(address) view returns (uint256)"], _INTERNAL.staticProvider);
                    const bal = await contract.balanceOf(addr);
                    results[symbol] = ethers.formatEther(bal);
                });

                await Promise.all(calls);
                
                _core.mutate([
                    ['vault.balances', results],
                    ['network.rpcStatus', 'OK']
                ]);
            } catch (e) {
                _core.mutate([['network.rpcStatus', 'DEGRADED']]);
            } finally {
                _INTERNAL.inflightHydration = false;
            }
        },

        finalize(hash, type, status, error = null) {
            const entry = { hash, type, status, error, ts: Date.now() };
            const queue = [entry, ..._INTERNAL.state.kernel.txQueue].slice(0, 10);
            _core.mutate([
                ['kernel.txQueue', queue],
                ['kernel.status', 'IDLE']
            ]);
            this.hydrate();
        },

        boot: async function() {
            if (window.__SOVEREIGN_LOADED__ || !window.ethereum) return;
            
            try {
                const eth = window.ethereum;
                const accs = await eth.request({ method: 'eth_accounts' });
                const chain = await eth.request({ method: 'eth_chainId' });

                const addr = accs[0] || null;
                _core.mutate([
                    ['vault.address', addr],
                    ['network.connected', !!addr],
                    ['network.chainId', parseInt(chain, 16)]
                ]);

                // Listeners
                eth.on('accountsChanged', (a) => {
                    _core.mutate([['vault.address', a[0]], ['network.connected', !!a[0]]]);
                    this.hydrate();
                });

                // Auto-Refresh Engine
                setInterval(() => this.hydrate(), _CONFIG.HEARTBEAT_INTERVAL);

                this.hydrate();
                window.__SOVEREIGN_LOADED__ = true;
                console.log("%c BOZZDEX ONLINE ", "background:#d4af37;color:#000;font-weight:bold;");
            } catch (e) { console.error("BOOT_ERROR", e); }
        },

        disconnect() {
            _core.mutate([['vault.address', null], ['network.connected', false]]);
            localStorage.clear();
            location.reload();
        }
    };
})();

// Initialize
SovereignEngine.boot();
window.KernelDispatcher = SovereignEngine;

