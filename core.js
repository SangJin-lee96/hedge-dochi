// core.js - Centralized Firebase, Auth, and Roadmap Logic
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
export let userProgress = parseInt(localStorage.getItem('roadmapProgress')) || 1;
export let isCoreReady = false;

export const ROADMAP_STEPS = [
    { id: 1, title: "나의 현재 위치 파악", path: "step1-asset.html", desc: "10년 후 내 자산 등급 시뮬레이션", icon: "📊" },
    { id: 2, title: "은퇴 목표 설정", path: "step2-fire.html", desc: "내가 꿈꾸는 노후를 위한 자산 설계", icon: "🏖️" },
    { id: 3, title: "투자 그릇 파악", path: "step3-risk.html", desc: "하락장을 견디는 나의 심리 상태 테스트", icon: "🧠" },
    { id: 4, title: "투자 기초 지식", path: "step4-guide.html", desc: "복리와 자산 배분의 기본 원리 이해", icon: "📚" },
    { id: 5, title: "투자 전략 선택", path: "step5-models.html", desc: "올웨더, 영구 포트폴리오 등 전략 선택", icon: "♟️" },
    { id: 6, title: "수익 시뮬레이션", path: "step6-simulate.html", desc: "배당 및 복리 수익 구체적 계산", icon: "📈" },
    { id: 7, title: "포트폴리오 구축", path: "step7-dashboard.html", desc: "실제 자산 등록 및 실시간 관리 시작", icon: "💼" },
    { id: 8, title: "주기적 리밸런싱", path: "step8-rebalance.html", desc: "시장 변화에 따른 자산 비중 최적화", icon: "⚖️" }
];

// --- Authentication UI Setup ---
export function setupAuthUI() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            const loginBtn = document.getElementById('loginBtn');
            const userProfile = document.getElementById('userProfile');
            
            if (user) {
                if (loginBtn) loginBtn.classList.add('hidden');
                if (userProfile) {
                    userProfile.classList.remove('hidden');
                    const photo = document.getElementById('userPhoto');
                    if (photo) photo.src = user.photoURL;
                }
                
                try {
                    const snap = await getDoc(doc(db, "simulations", user.uid));
                    if (snap.exists()) {
                        const dbProgress = snap.data().roadmapProgress || 1;
                        userProgress = Math.max(userProgress, dbProgress);
                        localStorage.setItem('roadmapProgress', userProgress);
                    }
                } catch (e) { console.error("Progress Load Error:", e); }
                
            } else {
                if (loginBtn) loginBtn.classList.remove('hidden');
                if (userProfile) userProfile.classList.add('hidden');
                userProgress = parseInt(localStorage.getItem('roadmapProgress')) || 1;
            }
            
            isCoreReady = true;
            document.dispatchEvent(new CustomEvent('coreDataReady', { detail: { user, userProgress } }));
            resolve({ user, userProgress });
        });

        document.getElementById('loginBtn')?.addEventListener('click', loginWithGoogle);
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.clear();
                location.reload();
            });
        });
    });
}

export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (e) { console.error("Login failed:", e); return null; }
}

// --- Roadmap Progress API ---
export async function saveProgress(stepId, additionalData = {}) {
    userProgress = Math.max(userProgress, stepId);
    localStorage.setItem('roadmapProgress', userProgress);
    
    if (currentUser) {
        try {
            const docRef = doc(db, "simulations", currentUser.uid);
            
            // FIX: Use nested object instead of dotted string to ensure Firestore nesting
            const updateObj = {
                roadmapProgress: userProgress,
                lastUpdated: new Date(),
                steps: {} 
            };
            
            if (Object.keys(additionalData).length > 0) {
                updateObj.steps[`step${stepId}`] = additionalData;
            }
            
            await setDoc(docRef, updateObj, { merge: true });
            console.log(`Step ${stepId} Saved Successfully.`);
        } catch (e) { console.error("Save failed", e); }
    } else {
        if (Object.keys(additionalData).length > 0) {
            localStorage.setItem(`step${stepId}Data`, JSON.stringify(additionalData));
        }
    }
}

export async function getStepData(stepId) {
    if (currentUser) {
        try {
            const snap = await getDoc(doc(db, "simulations", currentUser.uid));
            if (snap.exists()) {
                const data = snap.data();
                // FIX: Check both nested structure AND legacy dotted-string keys for robustness
                return data.steps?.[`step${stepId}`] || data[`steps.step${stepId}`] || null;
            }
        } catch (e) { console.error(`Step ${stepId} Load Error:`, e); }
    } else {
        const localData = localStorage.getItem(`step${stepId}Data`);
        return localData ? JSON.parse(localData) : null;
    }
    return null;
}

export async function checkAuthAndGo(path, stepId) {
    window.location.href = path;
}

export function goToNextStep(currentId) {
    const nextStep = ROADMAP_STEPS.find(s => s.id === currentId + 1);
    if (nextStep) {
        saveProgress(nextStep.id);
        window.location.href = nextStep.path;
    } else {
        window.location.href = 'index.html';
    }
}

export function showToast(msg, type = 'info') {
    let t = document.getElementById('hedge-toast');
    if (!t) {
        t = document.createElement('div'); t.id = 'hedge-toast'; document.body.appendChild(t);
        const style = document.createElement('style');
        style.innerHTML = `
            #hedge-toast {
                position: fixed; bottom: 3rem; left: 50%; transform: translateX(-50%) translateY(100px);
                background: rgba(15, 23, 42, 0.95); color: white; padding: 1rem 2.5rem;
                border-radius: 9999px; font-weight: 800; font-size: 0.9rem; z-index: 9999;
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                opacity: 0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px);
                display: flex; align-items: center; gap: 0.75rem; pointer-events: none;
            }
            #hedge-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
            #hedge-toast.success { border-color: rgba(16, 185, 129, 0.4); }
        `;
        document.head.appendChild(style);
    }
    const icon = type === 'success' ? '✅' : 'ℹ️';
    t.innerHTML = `<span>${icon}</span> ${msg}`;
    t.className = `show ${type}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', setupAuthUI);
