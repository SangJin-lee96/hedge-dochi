// Firebase SDK Imports (Using same versions as auth-check.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Roadmap Steps Definition
const ROADMAP_STEPS = [
    { id: 1, title: "내 자산 알아보기", path: "index.html" },
    { id: 2, title: "은퇴 목표 설정", path: "fire-calc.html" },
    { id: 3, title: "투자 성향 확인", path: "risk-test.html" },
    { id: 4, title: "기초 금융 학습", path: "guides.html" },
    { id: 5, title: "투자 모델 탐색", path: "guide-models.html" },
    { id: 6, title: "수익 시뮬레이션", path: "dividend.html" },
    { id: 7, title: "포트폴리오 구축", path: "dashboard.html" },
    { id: 8, title: "주기적 리밸런싱", path: "rebalance.html" }
];

let currentUser = null;
let userProgress = 1;

// Initialize Roadmap Widget
async function initRoadmapTracker() {
    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #roadmap-tracker {
            position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
            z-index: 200; width: 90%; max-width: 600px;
            background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
            padding: 1rem 2rem; border-radius: 2rem; border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex; align-items: center; justify-content: space-between; gap: 1rem;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0; pointer-events: none;
        }
        #roadmap-tracker.show { opacity: 1; pointer-events: auto; }
        .roadmap-info { flex: 1; }
        .roadmap-title { color: white; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.25rem; }
        .roadmap-prog-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; }
        .roadmap-prog-fill { height: 100%; background: #4f46e5; width: 0%; transition: width 0.5s; }
        #next-step-btn {
            background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem;
            border-radius: 1rem; font-weight: 900; font-size: 0.8rem; cursor: pointer;
            transition: all 0.2s; white-space: nowrap;
        }
        #next-step-btn:hover { background: #6366f1; transform: translateY(-2px); }
        #next-step-btn:disabled { background: #334155; opacity: 0.5; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Create UI
    const tracker = document.createElement('div');
    tracker.id = 'roadmap-tracker';
    tracker.innerHTML = `
        <div class="roadmap-info">
            <div class="roadmap-title" id="rt-title">로드맵 진행 중...</div>
            <div class="roadmap-prog-bar"><div class="roadmap-prog-fill" id="rt-fill"></div></div>
        </div>
        <button id="next-step-btn">다음 단계로 ➔</button>
    `;
    document.body.appendChild(tracker);

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            const snap = await getDoc(doc(db, "simulations", user.uid));
            if (snap.exists()) {
                userProgress = snap.data().roadmapProgress || 1;
            }
            updateTrackerUI();
        } else {
            // Unlogged users start at step 1 or from sessionStorage
            userProgress = parseInt(sessionStorage.getItem('roadmapProgress')) || 1;
            updateTrackerUI();
        }
    });
}

function updateTrackerUI() {
    const tracker = document.getElementById('roadmap-tracker');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const currentStep = ROADMAP_STEPS.find(s => s.path === currentPath);
    
    if (currentStep) {
        tracker.classList.add('show');
        document.getElementById('rt-title').innerText = `${currentStep.id}단계: ${currentStep.title}`;
        document.getElementById('rt-fill').style.width = `${(currentStep.id / ROADMAP_STEPS.length) * 100}%`;
        
        const nextBtn = document.getElementById('next-step-btn');
        nextBtn.onclick = async () => {
            const nextStep = ROADMAP_STEPS.find(s => s.id === currentStep.id + 1);
            if (nextStep) {
                if (currentUser) {
                    await setDoc(doc(db, "simulations", currentUser.uid), {
                        roadmapProgress: Math.max(userProgress, nextStep.id)
                    }, { merge: true });
                } else {
                    sessionStorage.setItem('roadmapProgress', nextStep.id);
                }
                window.location.href = nextStep.path;
            } else {
                alert("축하합니다! 모든 로드맵 단계를 완료하셨습니다. 🏆");
            }
        };
    }
}

initRoadmapTracker();
