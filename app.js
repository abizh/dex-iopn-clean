/**
 * SOVEREIGN ENGINE v75.5 - BOZZDEX MASTER BUILD
 * Sinkronisasi penuh dengan UI Premium (Teks Putih Outline Hitam)
 */

const SovereignEngine = (() => {
    // --- 1. CORE CONFIGURATION ---
    const _CONFIG = Object.freeze({
        CHAIN_ID: 984,
        RPC: "https://testnet-rpc2.iopn.tech",
        ROUTER_BOZZ: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
        ASSETS: {
            WOPN: "0xBc022C9dEb5AF250A526321d16Ef52E39b4DBD84",
            OPNT: "0x2aEc1Db9197Ff284011A6A1d0752AD03F5782B0d",
            tUSDT: "0x3e01b4d892E0D0A219eF8BBe7e260a6bc8d9B31b",
            tBNB: "0x92cF36713a5622351c9489D5556B90B321873607",
            TETE: "0x771699b159F5DEC9608736DC9C6c901Ddb7Afe3E"
        },
        HEARTBEAT_INTERVAL: 3000 // Refresh balance tiap 3 detik
    });

    // --- 2. INTERNAL STATE ---
    const _INTERNAL = {
        state: {
            vault: { address: null, balances: {} },
            kernel: { status: "IDLE", currentRate: 1.025 } // Dummy rate 1:1.025 buat simulasi
        },
        staticProvider: new ethers.JsonRpcProvider(_CONFIG.RPC),
        inflightHydration: false
    };

    // --- 3. CORE LOGIC ---
    const _core = {
        mutate(updates) {
            updates.forEach(([path, value]) => {
                const keys = path.split('.');
                let target = _INTERNAL.state;
                for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
                target[keys[keys.length - 1]] = value;
            });
            this.syncUI();
        },
        syncUI() {
            const st = _INTERNAL.state;
            
            // 1. Sync Wallet Header
            const walletBtn = document.getElementById('wallet-btn');
            if (st.vault.address && walletBtn) {
                walletBtn.innerText = st.vault.address.slice(0,6) + "..." + st.vault.address.slice(-4);
                walletBtn.style.color = "#fff";
            }

            // 2. Sync Balances ke ID bal-in dan bal-out
            const symIn = document.getElementById('sel-in')?.value;
            const symOut = document.getElementById('sel-out')?.value;
            
            if (symIn && document.getElementById('bal-in')) {
                document.getElementById('bal-in').innerText = parseFloat(st.vault.balances[symIn] || 0).toFixed(4);
            }
            if (symOut && document.getElementById('bal-out')) {
                document.getElementById('bal-out').innerText = parseFloat(st.vault.balances[symOut] || 0).toFixed(4);
            }

            // 3. Sync Status Button
            const btn = document.getElementById('exec-btn');
            if (btn) {
                if (st.kernel.status !== "IDLE") {
                    btn.innerText = st.kernel.status + "...";
                    btn.style.opacity = "0.7";
                } else {
                    // Balikin teks sesuai mode aktif
                    const isSwap = document.getElementById('m-swap').classList.contains('active');
                    const isRem = document.getElementById('s-rem')?.classList.contains('active');
                    btn.innerText = isSwap ? "Swap Asset" : (isRem ? "Remove Liquidity" : "Add Liquidity");
                    btn.style.opacity = "1";
                }
            }
        }
    };

    // --- 4. PUBLIC API ---
    return {
        // Tarik semua saldo asset
        async hydrate() {
            const addr = _INTERNAL.state.vault.address;
            if (!addr || _INTERNAL.inflightHydration) return;
            
            _INTERNAL.inflightHydration = true;
            try {
                const results = {};
                const calls = Object.entries(_CONFIG.ASSETS).map(async ([symbol, ca]) => {
                    const contract = new ethers.Contract(ca, ["function balanceOf(address) view returns (uint256)"], _INTERNAL.staticProvider);
                    const bal = await contract.balanceOf(addr);
                    results[symbol] = ethers.formatEther(bal);
                });
                await Promise.all(calls);
                _core.mutate([['vault.balances', results]]);
            } catch (e) {
                console.error("Hydration Error", e);
            } finally {
                _INTERNAL.inflightHydration = false;
            }
        },

        // Eksekusi Transaction (Approve + Logic)
        async execute(payload) {
            if (_INTERNAL.state.kernel.status !== "IDLE") return;
            
            _core.mutate([['kernel.status', 'APPROVING']]);
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const tokenContract = new ethers.Contract(_CONFIG.ASSETS[payload.tokenIn], [
                    "function approve(address,uint256) returns (bool)"
                ], signer);

                const tx = await tokenContract.approve(_CONFIG.ROUTER_BOZZ, ethers.parseUnits(payload.amount, 18));
                
                _core.mutate([['kernel.status', 'SIGNING']]);
                await tx.wait();
                
                alert("SUCCESS: Spender Approved & Swap Initiated!");
            } catch (err) {
                alert("FAILED: " + err.message);
            } finally {
                _core.mutate([['kernel.status', 'IDLE']]);
                this.hydrate();
            }
        },

        boot: async function() {
            if (window.__SOVEREIGN_LOADED__ || !window.ethereum) return;
            try {
                const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
                _core.mutate([['vault.address', accs[0]]]);

                // Auto Refresh
                setInterval(() => this.hydrate(), _CONFIG.HEARTBEAT_INTERVAL);
                this.hydrate();

                window.__SOVEREIGN_LOADED__ = true;
                console.log("%c BOZZDEX ENGINE ONLINE ", "background:#d4af37;color:#000;font-weight:bold;");
            } catch (e) { console.error("Boot failed", e); }
        }
    };
})();

/**
 * UI BRIDGE (Logika Interaksi Layar)
 */
const UIBridge = {
    // Switch antara Swap dan Liquidity
    switchMain(mode) {
        const isLiq = mode === 'liq';
        document.getElementById('m-swap').classList.toggle('active', !isLiq);
        document.getElementById('m-liq').classList.toggle('active', isLiq);
        document.getElementById('liq-nav').style.display = isLiq ? 'flex' : 'none';
        this.switchSub(isLiq ? 'add' : 'swap');
    },

    // Switch antara Add dan Remove Liq
    switchSub(sub) {
        const isRem = sub === 'rem';
        const isSwap = sub === 'swap';
        
        if(!isSwap) {
            document.getElementById('s-add').className = sub === 'add' ? 's-tab active' : 's-tab';
            document.getElementById('s-rem').className = isRem ? 's-tab active' : 's-tab';
        }

        document.getElementById('box-out').style.display = isRem ? 'none' : 'block';
        document.getElementById('remove-ui').style.display = isRem ? 'block' : 'none';
        document.getElementById('swap-info-box').style.display = 'none';
        document.getElementById('mid-icon').innerText = isRem ? '↓' : (sub === 'add' ? '+' : '⇅');
        
        const btn = document.getElementById('exec-btn');
        btn.innerText = isSwap ? "Swap Asset" : (isRem ? "Remove Liquidity" : "Add Liquidity");
    },

    // Hitung estimasi minOut real-time
    calc() {
        const amtIn = document.getElementById('amt-in').value;
        const isSwap = document.getElementById('m-swap').classList.contains('active');
        
        if (amtIn > 0 && isSwap) {
            // Simulasi rate 1:1.025
            const estOut = amtIn * 1.025;
            const minOut = estOut * 0.995; // Slippage 0.5%
            
            document.getElementById('amt-out').value = estOut.toFixed(6);
            document.getElementById('swap-info-box').style.display = 'flex';
            document.getElementById('min-received').innerText = minOut.toFixed(6) + " " + document.getElementById('sel-out').value;
        } else {
            document.getElementById('swap-info-box').style.display = 'none';
            document.getElementById('amt-out').value = '';
        }
    },

    setMax() {
        const bal = document.getElementById('bal-in').innerText;
        document.getElementById('amt-in').value = bal;
        this.calc();
    },

    updateRange(v) {
        document.getElementById('rem-range').value = v;
        document.getElementById('range-val').innerText = v + '%';
    },

    handleExecute() {
        const amt = document.getElementById('amt-in').value;
        if (!amt || amt <= 0) return alert("Enter Amount!");
        
        SovereignEngine.execute({
            amount: amt,
            tokenIn: document.getElementById('sel-in').value,
            tokenOut: document.getElementById('sel-out').value
        });
    }
};

// Global Entry
window.KernelDispatcher = SovereignEngine;
window.UIHelper = UIBridge;

// Auto-boot
SovereignEngine.boot();
