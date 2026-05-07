/**
 * SOVEREIGN SENTINEL v46.0 (The Historian-Grade Final)
 * Distributed Transactional Kernel for Hostile Runtime (Mobile Browser)
 */

// --- CONFIGURATION & CONSTANTS ---
const CONFIG = {
    BOZZ_ROUTER: "0xYourRouterAddressHere",
    T_IN: "0xTokenInAddress",
    T_OUT: "0xTokenOutAddress",
    LEASE_TTL: 15000, // 15s lock survival
    HEARTBEAT_INTERVAL: 10000 // 10s update
};

const SESSION_ID = Math.random().toString(36).substring(2, 10);

// --- LAYER 0: THE IMMUTABLE NAMESPACE & STORAGE ENGINE ---

const generateEpoch = () => {
    const ts = Date.now();
    const entropy = Math.random().toString(36).substring(2, 7);
    return `EP_${ts}_${SESSION_ID}_${entropy}`;
};

const safeParse = (raw, factory = () => ({})) => {
    if (!raw) return factory();
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn("[SENTINEL] Evidence Corrupted. Using fallback.");
        return factory();
    }
};

const getLatestIdxFromStorage = (epoch) => {
    return Number(localStorage.getItem(`bozz_ledger_${epoch}_latest`) || 0);
};

const commitToLedgerAbsolute = (epoch, event) => {
    const latest = getLatestIdxFromStorage(epoch);
    const eventIdx = latest + 1;

    const pageKey = `bozz_ledger_${epoch}_${String(eventIdx).padStart(4, '0')}`;
    const entry = {
        ...event,
        idx: eventIdx,
        epoch: epoch,
        localTs: performance.now(), // Monotonic local physics
        wallTs: Date.now(),        // Cluster consensus
        sid: SESSION_ID
    };

    localStorage.setItem(pageKey, JSON.stringify(entry));
    localStorage.setItem(`bozz_ledger_${epoch}_latest`, eventIdx.toString());

    // CAS-ish Verification
    if (localStorage.getItem(`bozz_ledger_${epoch}_latest`) !== eventIdx.toString()) {
        console.error("[SENTINEL] Ledger Race! Overwritten at idx:", eventIdx);
    }
    return entry;
};

// --- LAYER 1: LEADERSHIP & LEASE MANAGEMENT ---

const claimLeadership = (epoch) => {
    const token = `${epoch}_${SESSION_ID}`;
    const raw = localStorage.getItem('bozz_global_lock');
    const currentLock = safeParse(raw, () => null);

    // Reclaim logic: Jika lock kosong atau sudah expire
    if (!currentLock || (Date.now() - currentLock.ts > CONFIG.LEASE_TTL) || currentLock.status === "RELEASED_BY_LEADER") {
        const newLock = {
            token,
            epoch,
            ts: Date.now(),
            seq: 0,
            status: "ACTIVE"
        };
        localStorage.setItem('bozz_global_lock', JSON.stringify(newLock));
        return newLock;
    }
    return null; // Leadership denied
};

const safeReleaseLeadership = (mandate) => {
    const raw = localStorage.getItem('bozz_global_lock');
    const finalLock = safeParse(raw, () => null);

    // Tombstone Protocol: Jangan hapus, tandai kematian secara resmi
    if (finalLock && finalLock.token === mandate.token) {
        localStorage.setItem('bozz_global_lock', JSON.stringify({
            ...finalLock,
            status: "RELEASED_BY_LEADER",
            ts: Date.now(),
            seq: (finalLock.seq || 0) + 1
        }));
        return true;
    }
    return false;
};

// --- LAYER 2: AIRLOCK & ASYNC GUARDS ---

const createAirlock = (runtime) => {
    const controller = new AbortController();
    runtime.terminate = () => {
        runtime.alive = false;
        controller.abort();
    };
    return controller.signal;
};

const cryoGuard = (runtime) => {
    if (!runtime.alive) throw new Error("AIRLOCK_BREACHED: Runtime is dead.");
};

const guardedAwait = async (runtime, promise, signal) => {
    cryoGuard(runtime);
    if (signal?.aborted) throw new Error("PRE_ABORT_SIGNAL");
    
    const result = await promise;
    
    cryoGuard(runtime);
    if (signal?.aborted) throw new Error("POST_ABORT_SIGNAL");
    return result;
};

// --- LAYER 3: MONITORING & HEARTBEAT ---

const validateLeadershipDiscontinuity = (runtime, mandate) => {
    let lastLocalCheck = performance.now();

    const handler = () => {
        const now = performance.now();
        if (now - lastLocalCheck > 15000) {
            console.warn("[SENTINEL] Suspend detected via Monotonic Drift.");
        }
        lastLocalCheck = now;

        const lock = safeParse(localStorage.getItem('bozz_global_lock'));
        if (lock.token !== mandate.token || lock.status !== "ACTIVE") {
            runtime.terminate();
        }
    };

    window.addEventListener("focus", handler);
    window.addEventListener("visibilitychange", handler);
    return () => {
        window.removeEventListener("focus", handler);
        window.removeEventListener("visibilitychange", handler);
    };
};

const startHeartbeatHardened = (mandate, runtime) => {
    return setInterval(() => {
        if (!runtime.alive) return;
        const lock = safeParse(localStorage.getItem('bozz_global_lock'));
        if (lock.token === mandate.token) {
            localStorage.setItem('bozz_global_lock', JSON.stringify({
                ...lock,
                ts: Date.now(),
                seq: (lock.seq || 0) + 1
            }));
        } else {
            runtime.terminate();
        }
    }, CONFIG.HEARTBEAT_INTERVAL);
};

// --- LAYER 4: THE MAIN KERNEL EXECUTION ---

window.executeRemoveLiquidity = async function(targetIdx) {
    const runtime = { alive: true };
    const abortSignal = createAirlock(runtime);
    const currentEpoch = generateEpoch();
    
    const mandate = claimLeadership(currentEpoch);
    if (!mandate) {
        console.error("[SENTINEL] Failed to acquire Leadership. Tab Busy.");
        return;
    }

    const stopGuards = validateLeadershipDiscontinuity(runtime, mandate);
    const hb = startHeartbeatHardened(mandate, runtime);

    try {
        console.log(`[SENTINEL] New Flight Initiated: ${currentEpoch}`);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await guardedAwait(runtime, provider.getSigner(), abortSignal);

        // PHASE 1: INTENT COMMIT (Commander Mode)
        commitToLedgerAbsolute(currentEpoch, { 
            type: "INTENT_COMMIT", 
            nonce: await guardedAwait(runtime, signer.getNonce("pending"), abortSignal),
            targetIdx
        });

        // PHASE 2: BROADCAST (The Point of No Return)
        // Mocking the DEX call - ganti dengan kontrak asli lu
        const tx = await guardedAwait(runtime, signer.sendTransaction({
            to: CONFIG.BOZZ_ROUTER,
            data: "0x8904791e..." // Method ID lu
        }), abortSignal);

        commitToLedgerAbsolute(currentEpoch, { type: "HASH_ACQUIRED", hash: tx.hash });

        // PHASE 3: OBSERVATION (Historian Mode)
        const receipt = await guardedAwait(runtime, tx.wait(3), abortSignal);
        
        commitToLedgerAbsolute(currentEpoch, { 
            type: "FINALIZED", 
            status: receipt.status === 1 ? "SUCCESS" : "REVERTED",
            block: receipt.blockNumber
        });

        console.log("[SENTINEL] Flight Success.");

    } catch (e) {
        const type = e.name === 'AbortError' || !runtime.alive ? "TERMINATED" : "FAULT";
        commitToLedgerAbsolute(currentEpoch, { type, message: e.message });
        console.error(`[SENTINEL] Flight ${type}:`, e.message);
    } finally {
        runtime.terminate(); 
        stopGuards();
        clearInterval(hb);
        safeReleaseLeadership(mandate);
    }
};
    
