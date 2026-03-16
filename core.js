// core.js - Centralized Bulletproof Data Logic with Heavy Logging
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let currentUser = null;
export let userProgress = 1;
export let exchangeRate = 1350; 

export const ROADMAP_STEPS = [
    { id: 1, title: "나의 현재 위치 파악", path: "step1-asset.html", desc: "10년 후 내 자산 등급 시뮬레이션", icon: "📊" },
    { id: 2, title: "은퇴 목표 설정", path: "step2-fire.html", desc: "내가 꿈꾸는 노후를 위한 자산 설계", icon: "🏖️" },
    { id: 3, title: "투자 그릇 파악", path: "step3-risk.html", desc: "하락장을 견디는 나의 심리 상태 테스트", icon: "🧠" },
    { id: 4, title: "투자 기초 지식", path: "step4-guide.html", desc: "복리와 자산 배분의 기본 원리 이해", icon: "📚" },
    { id: 5, title: "투자 전략 선택", path: "step5-models.html", desc: "올웨더, 영구 포트폴리오 등 전략 선택", icon: "♟️" },
    { id: 6, title: "수익 시뮬레이션", path: "step6-simulate.html", desc: "배당 및 복리 수익 구체적 계산", icon: "📈" },
    { id: 7, title: "포트폴리오 구축", path: "step7-dashboard.html", desc: "실제 자산 등록 및 실시간 관리 시작", icon: "💼" },
    { id: 8, title: "주기적 리밸런싱", path: "step8-rebalance.html", desc: "시장 변화에 따른 자산 비중 최적화", icon: "⚖️" },
    { id: 9, title: "마스터 플랜 실행", path: "final-blueprint.html", desc: "최종 요약 및 실전 투자 실행 가이드", icon: "🏁" }
];

export function setupAuthUI() {
    return new Promise(async (resolve) => {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                console.log("%c[Auth] User Logged In:", "color: #3b82f6; font-weight: bold;", user.email);
                
                // Cloud Data Fetch
                const docRef = doc(db, "simulations", user.uid);
                const snap = await getDoc(docRef);
                
                if (snap.exists()) {
                    const data = snap.data();
                    console.log("%c[Cloud] Full Data Received:", "color: #10b981; font-weight: bold;", data);
                    
                    userProgress = data.roadmapProgress || 1;
                    localStorage.setItem('roadmapProgress', userProgress);
                    
                    if (data.steps) {
                        Object.keys(data.steps).forEach(key => {
                            const stepValue = data.steps[key];
                            localStorage.setItem(`${key}Data`, JSON.stringify(stepValue));
                            console.log(`%c[Sync] LocalStorage Updated for ${key}:`, "color: #8b5cf6;", stepValue);
                        });
                    }
                } else {
                    console.log("%c[Cloud] No simulation data found for this user.", "color: #f59e0b;");
                }
            }
            document.dispatchEvent(new CustomEvent('coreDataReady', { detail: { user, userProgress, exchangeRate } }));
            resolve({ user, userProgress, exchangeRate });
        });
    });
}

export async function saveProgress(stepId, additionalData = {}, immediate = false) {
    console.log(`%c[Save Request] Step ${stepId}:`, "color: #ef4444; font-weight: bold;", additionalData);
    
    userProgress = Math.max(userProgress, stepId);
    localStorage.setItem('roadmapProgress', userProgress);
    localStorage.setItem(`step${stepId}Data`, JSON.stringify(additionalData));

    if (!currentUser) return;

    const performSave = async () => {
        try {
            const docRef = doc(db, "simulations", currentUser.uid);
            const updateObj = {
                roadmapProgress: userProgress,
                lastUpdated: new Date(),
                steps: {}
            };
            
            // 기존 steps 데이터를 보존하기 위해 기존 스냅샷을 먼저 읽음 (병합 강화)
            const snap = await getDoc(docRef);
            let finalSteps = {};
            if (snap.exists()) {
                finalSteps = snap.data().steps || {};
            }
            finalSteps[`step${stepId}`] = additionalData;
            updateObj.steps = finalSteps;

            await setDoc(docRef, updateObj, { merge: true });
            console.log(`%c[Cloud Save] Step ${stepId} Success ✅`, "color: #10b981; font-weight: bold;");
        } catch (e) { console.error("[Cloud Save] Error:", e); }
    };

    if (immediate) await performSave();
    else {
        if (window.saveTimer) clearTimeout(window.saveTimer);
        window.saveTimer = setTimeout(performSave, 1000);
    }
}

export async function getStepData(stepId) {
    const localData = localStorage.getItem(`step${stepId}Data`);
    const parsed = localData ? JSON.parse(localData) : null;
    console.log(`%c[Data Fetch] Step ${stepId}:`, "color: #6366f1;", parsed);
    return parsed;
}

export function checkAuthAndGo(path) {
    if (!currentUser) { showToast("로그인이 필요한 서비스입니다."); return; }
    location.href = path;
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (e) { console.error("Login error", e); }
}

export async function logout() {
    try { await signOut(auth); localStorage.clear(); location.href = 'index.html'; }
    catch (e) { console.error("Logout error", e); }
}

export function goToNextStep(currentId) {
    const nextStep = ROADMAP_STEPS.find(s => s.id === currentId + 1);
    if (nextStep) {
        saveProgress(nextStep.id, {}, true);
        window.location.href = nextStep.path;
    } else { location.href = 'index.html'; }
}

export function showToast(msg, type = 'info') {
    let t = document.getElementById('hedge-toast');
    if (!t) {
        t = document.createElement('div'); t.id = 'hedge-toast'; document.body.appendChild(t);
        const style = document.createElement('style');
        style.innerHTML = `#hedge-toast { position: fixed; bottom: 3rem; left: 50%; transform: translateX(-50%) translateY(100px); background: rgba(15, 23, 42, 0.95); color: white; padding: 1rem 2.5rem; border-radius: 9999px; font-weight: 800; font-size: 0.9rem; z-index: 9999; transition: all 0.5s; opacity: 0; display: flex; align-items: center; gap: 0.75rem; pointer-events: none; } #hedge-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }`;
        document.head.appendChild(style);
    }
    t.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
    t.className = `show ${type}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'loginBtn') signInWithGoogle();
    if (e.target.id === 'logoutBtn') logout();
});

document.addEventListener('DOMContentLoaded', setupAuthUI);
