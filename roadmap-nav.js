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

function getCurrentStep() {
    const path = window.location.pathname;
    // Default to first step if at root
    if (path === '/' || path === '/index.html') return ROADMAP_STEPS[0];
    return ROADMAP_STEPS.find(s => path.includes(s.path)) || ROADMAP_STEPS[0];
}

async function initRoadmapTracker() {
    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #roadmap-tracker {
            position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
            z-index: 9999; width: 90%; max-width: 600px;
            background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px);
            padding: 1.25rem 2.25rem; border-radius: 2.5rem; border: 2px solid rgba(79, 70, 229, 0.3);
            box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);
            display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0; transform: translateX(-50%) translateY(100px);
            pointer-events: none;
        }
        #roadmap-tracker.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
        .roadmap-info { flex: 1; overflow: hidden; }
        .roadmap-title { color: white; font-weight: 800; font-size: 0.95rem; margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .roadmap-prog-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; }
        .roadmap-prog-fill { height: 100%; background: linear-gradient(90deg, #4f46e5, #818cf8); width: 0%; transition: width 0.8s ease-in-out; }
        #next-step-btn {
            background: #4f46e5; color: white; border: none; padding: 0.85rem 1.75rem;
            border-radius: 1.25rem; font-weight: 900; font-size: 0.85rem; cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap;
            box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.4);
        }
        #next-step-btn:hover { background: #6366f1; transform: scale(1.05); box-shadow: 0 15px 25px -5px rgba(79, 70, 229, 0.5); }
        #next-step-btn:active { transform: scale(0.95); }
    `;
    document.head.appendChild(style);

    // Create UI
    const tracker = document.createElement('div');
    tracker.id = 'roadmap-tracker';
    tracker.innerHTML = `
        <div class="roadmap-info">
            <div class="roadmap-title" id="rt-title">투자 로드맵 시작하기...</div>
            <div class="roadmap-prog-bar"><div class="roadmap-prog-fill" id="rt-fill"></div></div>
        </div>
        <button id="next-step-btn">다음 단계로 ➔</button>
    `;
    document.body.appendChild(tracker);

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            try {
                const snap = await getDoc(doc(db, "simulations", user.uid));
                if (snap.exists()) {
                    userProgress = snap.data().roadmapProgress || 1;
                }
            } catch (e) { console.error("Progress fetch failed", e); }
        } else {
            userProgress = parseInt(sessionStorage.getItem('roadmapProgress')) || 1;
        }
        updateTrackerUI();
    });
}

function updateTrackerUI() {
    const tracker = document.getElementById('roadmap-tracker');
    if (!tracker) return;

    const currentStep = getCurrentStep();
    
    if (currentStep) {
        setTimeout(() => tracker.classList.add('show'), 500);
        
        document.getElementById('rt-title').innerText = `${currentStep.id}단계: ${currentStep.title}`;
        document.getElementById('rt-fill').style.width = `${(currentStep.id / ROADMAP_STEPS.length) * 100}%`;
        
        const nextBtn = document.getElementById('next-step-btn');
        const nextStep = ROADMAP_STEPS.find(s => s.id === currentStep.id + 1);
        
        if (nextStep) {
            nextBtn.innerText = "다음 단계로 ➔";
            nextBtn.onclick = async () => {
                const newProgress = Math.max(userProgress, nextStep.id);
                // Save progress (Don't wait for it to move to next page for better UX)
                if (currentUser) {
                    setDoc(doc(db, "simulations", currentUser.uid), {
                        roadmapProgress: newProgress
                    }, { merge: true }).catch(console.error);
                } else {
                    sessionStorage.setItem('roadmapProgress', newProgress);
                }
                window.location.href = nextStep.path;
            };
        } else {
            nextBtn.innerText = "로드맵 완료! 🏆";
            nextBtn.onclick = () => alert("모든 단계를 완수하셨습니다! 당신은 이제 스마트한 투자자입니다. ✨");
        }
    }
}

initRoadmapTracker();
