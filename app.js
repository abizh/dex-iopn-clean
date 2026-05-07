/**
 * 🚀 BOZZDEX MEGA-MASTER CODE - V46.0 (Unified Sentinel Edition)
 * Melindungi Transaksi di Lingkungan Android Low-End & Hostile Browser
 */

const CONFIG = {
    RPC: "https://testnet-rpc2.iopn.tech",
    CHAIN_ID: "0x3d8",
    T_IN: "0xbc022c9deb5af250a526321d16ef52e39b4dbd84",
    T_OUT: "0x2aec1db9197ff284011a6a1d0752ad03f5782b0d",
    BOZZ_ROUTER: "0x98cbC837fD05cA7b0ed075990667E93ae0EE1961",
    LEASE_TTL: 15000,
    HEARTBEAT_INTERVAL: 10000
};

const ABI_TOKEN = ["function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function approve(address,uint256) external returns (bool)"];
const ABI_ROUTER = [
    "function swap(address,address,uint256,uint256) external",
    "function addLiquidity(address tA, address tB, uint256 amtA, uint256 amtB) external",
    "function removeLiquidityMulti(address tA, address tB, uint8 percentChoice, bool toNative) external",
    "function getPool(address,address) view returns (address)"
];

// --- CORE KERNEL STATE ---
const SESSION_ID = Math.random().toString(36).substring(2, 10);
let debounceTimer;

// --- LAYER 0: STORAGE & LEDGER ENGINE ---

const generateEpoch = () => `EP_${Date.now()}_${SESSION_ID}_${Math.random().toString(36).substring(2, 5)}`;

const safeParse = (raw, factory = () => ({})) => {
    try { return raw ? JSON.parse(raw) : factory(); } catch { return factory(); }
};

const commitToLedger = (epoch, event) => {
    const latest = Number(localStorage.getItem(`bozz_ledger_${epoch}_latest`) || 0);
    const idx = latest + 1;
    const pageKey = `bozz_ledger_${epoch}_${String(idx).padStart(4, '0')}`;
    
    const entry = { ...event, idx, epoch, wallTs: Date.now(), sid: SESSION_ID };
    localStorage.setItem(pageKey, JSON.stringify(entry));
    localStorage.setItem(`bozz_ledger_${epoch}_latest`, idx.toString());
    
    // UI Replay History Bridge (Gabungan v2.5)
    if (event.hash) saveToHistoryUI(event.type, event.hash, event.status || "Pending");
    return entry;
};

function saveToHistoryUI(type, hash, status) {
    let history = JSON.parse(localStorage.getItem("bozz_history") || "[]");
    history.unshift({ type, hash, time: new Date().toLocaleTimeString(), status });
    if (history.length > 10) history.pop();
    localStorage.setItem("bozz_history", JSON.stringify(history));
    if (window.renderHistory) window.renderHistory();
}

// --- LAYER 1: LEADERSHIP & AIRLOCK ---

const claimLeadership = (epoch) => {
    const token = `${epoch}_${SESSION_ID}`;
    const currentLock = safeParse(localStorage.getItem('bozz_global_lock'), () => null);
    
    if (!currentLock || (Date.now() - currentLock.ts > CONFIG.LEASE_TTL) || currentLock.status === "RELEASED") {
        const newLock = { token, epoch, ts: Date.now(), seq: 0, status: "ACTIVE" };
        localStorage.setItem('bozz_global_lock', JSON.stringify(newLock));
        return newLock;
    }
    return null;
};

const createAirlock = (runtime) => {
    const controller = new AbortController();
    runtime.terminate = () => { runtime.alive = false; controller.abort(); };
    return controller.signal;
};

const guardedAwait = async (runtime, promise, signal) => {
    if (!runtime.alive || signal?.aborted) throw new Error("AIRLOCK_CLOSED");
    const res = await promise;
    if (!runtime.alive || signal?.aborted) throw new Error("AIRLOCK_TERMINATED_POST_AWAIT");
    return res;
};

// --- LAYER 2: TRANSACTION WRAPPERS (The Engine) ---

async function ensureApproval(signer, runtime, signal, tokenAddr, amount) {
    const token = new ethers.Contract(tokenAddr, ABI_TOKEN, signer);
    const user = await signer.getAddress();
    const allowance = await guardedAwait(runtime, token.allowance(user, CONFIG.BOZZ_ROUTER), signal);
    
    if (allowance < amount) {
        log("Approving Token... ⏳");
        const tx = await guardedAwait(runtime, token.approve(CONFIG.BOZZ_ROUTER, ethers.MaxUint256), signal);
        await guardedAwait(runtime, tx.wait(), signal);
        log("Approved ✅");
    }
}

// --- MAIN KERNEL EXECUTION ---

window.executeKernelAction = async function(actionType, params) {
    const runtime = { alive: true };
    const abortSignal = createAirlock(runtime);
    const epoch = generateEpoch();
    const mandate = claimLeadership(epoch);

    if (!mandate) return log("System Busy / Tab Lain Aktif", true);

    // Heartbeat & Guard
    const hb = setInterval(() => {
        const lock = safeParse(localStorage.getItem('bozz_global_lock'));
        if (lock?.token === mandate.token) {
            localStorage.setItem('bozz_global_lock', JSON.stringify({...lock, ts: Date.now(), seq: (lock.seq||0)+1}));
        } else { runtime.terminate(); }
    }, 10000);

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await guardedAwait(runtime, provider.getSigner(), abortSignal);
        const router = new ethers.Contract(CONFIG.BOZZ_ROUTER, ABI_ROUTER, signer);

        log(`${actionType} Initiated... ⏳`);

        if (actionType === "SWAP") {
            const { amtIn, minOut } = params;
            await ensureApproval(signer, runtime, abortSignal, CONFIG.T_IN, amtIn);
            commitToLedger(epoch, { type: "SWAP_START", amtIn: amtIn.toString() });
            const tx = await guardedAwait(runtime, router.swap(CONFIG.T_IN, CONFIG.T_OUT, amtIn, minOut), abortSignal);
            commitToLedger(epoch, { type: "HASH_ACQUIRED", hash: tx.hash });
            const receipt = await guardedAwait(runtime, tx.wait(1), abortSignal);
            commitToLedger(epoch, { type: "SWAP_SUCCESS", hash: tx.hash, status: "Success" });
        } 
        
        else if (actionType === "ADD_LIQUIDITY") {
            const { amtA, amtB } = params;
            await ensureApproval(signer, runtime, abortSignal, CONFIG.T_IN, amtA);
            await ensureApproval(signer, runtime, abortSignal, CONFIG.T_OUT, amtB);
            const tx = await guardedAwait(runtime, router.addLiquidity(CONFIG.T_IN, CONFIG.T_OUT, amtA, amtB), abortSignal);
            commitToLedger(epoch, { type: "HASH_ACQUIRED", hash: tx.hash });
            await guardedAwait(runtime, tx.wait(1), abortSignal);
            commitToLedger(epoch, { type: "ADD_LIQ_SUCCESS", hash: tx.hash, status: "Success" });
        }

        else if (actionType === "REMOVE_LIQUIDITY") {
            const tx = await guardedAwait(runtime, router.removeLiquidityMulti(CONFIG.T_IN, CONFIG.T_OUT, params.percent, false), abortSignal);
            commitToLedger(epoch, { type: "HASH_ACQUIRED", hash: tx.hash });
            await guardedAwait(runtime, tx.wait(1), abortSignal);
            commitToLedger(epoch, { type: "REMOVE_LIQ_SUCCESS", hash: tx.hash, status: "Success" });
        }

        log("Action Success! 🔥");
        if (window.updateBalances) window.updateBalances();

    } catch (e) {
        log(e.message.includes("REJECT") ? "User Rejected" : "Execution Error", true);
        commitToLedger(epoch, { type: "ERROR", message: e.message });
    } finally {
        runtime.terminate();
        clearInterval(hb);
        const lock = safeParse(localStorage.getItem('bozz_global_lock'));
        if (lock?.token === mandate.token) {
            localStorage.setItem('bozz_global_lock', JSON.stringify({...lock, status: "RELEASED", ts: Date.now()}));
        }
    }
};

// --- UI HELPERS ---
function log(msg, isError = false) {
    const el = document.getElementById("statusLog");
    if (el) {
        el.innerHTML = msg;
        el.style.color = isError ? "#ff4444" : "#00ff88";
    }
}

window.renderHistory = function() {
    const list = document.getElementById("txList");
    let history = JSON.parse(localStorage.getItem("bozz_history") || "[]");
    if (!list) return;
    if (history.length === 0) return list.innerHTML = `<div style="text-align:center; color:#555; padding:10px;">No history</div>`;
    list.innerHTML = history.map(tx => `
        <div style="background:#16161a; padding:10px; border-radius:8px; border:1px solid #333; margin-bottom:8px; font-size:11px;">
            <div style="display:flex; justify-content:space-between;">
                <b style="color:${tx.status==='Success'?'#00ff88':'#ff4444'}">${tx.type}</b>
                <span style="color:#555">${tx.time}</span>
            </div>
            <a href="https://testnet-explorer.iopn.tech/tx/${tx.hash}" target="_blank" style="color:#58a6ff; text-decoration:none;">${tx.hash.slice(0,12)}... ↗</a>
        </div>
    `).join('');
};

document.addEventListener("DOMContentLoaded", () => {
    window.renderHistory();
    // Setup listeners untuk tombol lu di sini
});
        
