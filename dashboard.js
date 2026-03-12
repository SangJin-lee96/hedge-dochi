import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        
        // 대시보드 UI 업데이트
        document.getElementById('dashUserName').innerText = user.displayName;
        document.getElementById('dashUserPhoto').src = user.photoURL;
        
        loadDashboardData(user.uid);
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userProfile) userProfile.classList.add('hidden');
        alert("로그인이 필요한 페이지입니다. 홈으로 이동합니다.");
        location.href = "index.html";
    }
});

async function loadDashboardData(uid) {
    const activityLog = document.getElementById('dashActivityLog');
    activityLog.innerHTML = "";

    try {
        // 1. 투자 성향 데이터
        const riskSnap = await getDoc(doc(db, "risk_profiles", uid));
        if (riskSnap.exists()) {
            const data = riskSnap.data();
            document.getElementById('dashRiskType').innerText = data.type;
            document.getElementById('dashRiskDesc').innerText = `추천: ${data.portfolio}`;
            const icons = { "공격투자형": "🔥", "적극투자형": "🚀", "위험중립형": "⚖️", "안정추구형": "🛡️", "안정형": "💎" };
            document.getElementById('dashRiskIcon').innerText = icons[data.type] || "🧠";
            addLog(`투자 성향이 '${data.type}'으로 기록되었습니다.`);
        }

        // 2. 자산 시뮬레이션 데이터
        const simSnap = await getDoc(doc(db, "simulations", uid));
        if (simSnap.exists()) {
            const data = simSnap.snap ? simSnap.data() : simSnap.data(); // 기본값 처리
            // 간단 요약 (실제 계산 로직은 main.js에 있으므로 여기서는 데이터 존재 여부만)
            document.getElementById('dashTierName').innerText = "데이터 분석 완료";
            document.getElementById('dashTierIcon').innerText = "📈";
            addLog("자산 시뮬레이션 데이터가 업데이트 되었습니다.");
        }

        // 3. 리밸런싱 포트폴리오 데이터
        const portSnap = await getDoc(doc(db, "portfolios", uid));
        if (portSnap.exists()) {
            const assets = portSnap.data().assets || [];
            document.getElementById('dashScoreValue').innerText = assets.length > 0 ? "OK" : "--";
            addLog(`${assets.length}개의 자산이 포트폴리오에 등록되어 있습니다.`);
        }

        if (activityLog.innerHTML === "") {
            activityLog.innerHTML = "아직 기록된 활동이 없습니다. 도구를 사용하여 자산을 분석해보세요!";
        }

    } catch (e) { console.error("Load Error:", e); }
}

function addLog(msg) {
    const log = document.getElementById('dashActivityLog');
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fade-in-up";
    div.innerHTML = `<span class="text-blue-500">✔</span> <span>${msg}</span>`;
    log.appendChild(div);
}

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
