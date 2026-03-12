// core.js - Centralized Firebase, Auth, and Roadmap Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        
        if (user) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userProfile) {
                userProfile.classList.remove('hidden');
                document.getElementById('userPhoto').src = user.photoURL;
            }
            
            // Fetch progress from Firebase
            try {
                const snap = await getDoc(doc(db, "simulations", user.uid));
                if (snap.exists() && snap.data().roadmapProgress) {
                    userProgress = snap.data().roadmapProgress;
                }
            } catch (e) { console.error("Failed to load progress:", e); }
            
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userProfile) userProfile.classList.add('hidden');
            userProgress = parseInt(sessionStorage.getItem('roadmapProgress')) || 1;
        }
        
        document.dispatchEvent(new CustomEvent('coreDataReady', { detail: { user, userProgress } }));
    });

    document.getElementById('loginBtn')?.addEventListener('click', loginWithGoogle);
    document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
}

export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (e) {
        console.error("Login failed:", e);
        return null;
    }
}

// --- Roadmap Progress API ---
export async function saveProgress(stepId) {
    userProgress = Math.max(userProgress, stepId);
    if (currentUser) {
        try {
            await setDoc(doc(db, "simulations", currentUser.uid), {
                roadmapProgress: userProgress,
                lastUpdated: new Date()
            }, { merge: true });
        } catch (e) { console.error("Save progress failed", e); }
    } else {
        sessionStorage.setItem('roadmapProgress', userProgress);
    }
}

export async function checkAuthAndGo(path, stepId) {
    if (!currentUser) {
        if (confirm("진행 상황을 저장하고 이어서 하시려면 로그인이 필요합니다. 로그인하시겠습니까?")) {
            const user = await loginWithGoogle();
            if (user) window.location.href = path;
        } else {
            // Allow guest access but warn
            window.location.href = path;
        }
    } else {
        window.location.href = path;
    }
}

export function goToNextStep(currentId) {
    const nextStep = ROADMAP_STEPS.find(s => s.id === currentId + 1);
    if (nextStep) {
        saveProgress(nextStep.id);
        window.location.href = nextStep.path;
    } else {
        alert("모든 교육 과정을 완수하셨습니다! 당신은 이제 스마트한 투자자입니다. ✨");
        window.location.href = 'index.html';
    }
}

// Auto-setup Auth UI on load
document.addEventListener('DOMContentLoaded', setupAuthUI);
