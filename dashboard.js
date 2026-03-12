import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtn'), userProfile = document.getElementById('userProfile');
    if (user) {
        currentUser = user;
        loginBtn?.classList.add('hidden'); userProfile?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        document.getElementById('dashUserName').innerText = user.displayName;
        document.getElementById('dashUserPhoto').src = user.photoURL;
        loadDashboardData(user.uid);
        renderMarketSentiment();
    } else {
        alert("로그인이 필요합니다."); location.href = "index.html";
    }
});

async function loadDashboardData(uid) {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(c => c.classList.add('skeleton'));
    const activityLog = document.getElementById('dashActivityLog');
    activityLog.innerHTML = "";

    try {
        const [riskSnap, simSnap, portSnap, lottoSnap, goalSnap, fireSnap] = await Promise.all([
            getDoc(doc(db, "risk_profiles", uid)),
            getDoc(doc(db, "simulations", uid)),
            getDoc(doc(db, "portfolios", uid)),
            getDoc(doc(db, "lotto_history", uid)),
            getDoc(doc(db, "user_goals", uid)),
            getDoc(doc(db, "fire_goals", uid))
        ]);

        // ... (투자 성향, 시뮬레이션, 포트폴리오 로직 동일)
// ... (생략)
        if (lottoSnap.exists()) {
            // ... (로또 로직 동일)
        }

        // 5. 은퇴 목표 데이터 (신설)
        if (fireSnap.exists()) {
            const d = fireSnap.data();
            document.getElementById('dashFireRemaining').innerText = `${d.remainingYears}년 남음`;
            document.getElementById('dashFireDate').innerText = `${d.targetYear}년 은퇴 예정`;
            document.getElementById('dashFireIcon').innerText = d.remainingYears <= 5 ? "🥂" : "🏝️";
            addLog(`경제적 자유까지 약 ${d.remainingYears}년 남았습니다.`);
        }

        if (goalSnap.exists() && simResult) {
            const goalEok = goalSnap.data().amount;
            updateGoalUI(simResult.rawNominal, goalEok);
        }

        renderDailyQuote();
    } catch (e) { console.error(e); }
    finally { cards.forEach(c => c.classList.remove('skeleton')); }
}

function calculateSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0, seed = parseFloat(d.initialSeed) || 0, expense = parseFloat(d.monthlyExpense) || 0;
    const growth = (parseFloat(d.salaryGrowth) || 0) / 100, returns = (parseFloat(d.investmentReturn) || 0) / 100, inflation = (parseFloat(d.inflationRate) || 0) / 100;
    let current = seed, curSalary = salary, curExpense = expense;
    for (let i = 1; i <= 10; i++) {
        const surplus = curSalary - (curExpense * 12);
        current = current + surplus + ((current + surplus / 2) * returns);
        curSalary *= (1 + growth); curExpense *= (1 + inflation);
    }
    const realWealth = current / Math.pow(1 + inflation, 10);
    let tier = "브론즈", icon = "🥉";
    const val = realWealth / (d.baseCurrency === 'KRW' ? 1 : (1/1350 * 10000));
    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }
    return { tier, icon, nominalWealth: formatVal(current, d.baseCurrency), realWealth: formatVal(realWealth, d.baseCurrency), rawNominal: current };
}

function updateGoalUI(currentWealth, goalEok) {
    const goalMan = goalEok * 10000;
    const percent = Math.min(100, Math.round((currentWealth / goalMan) * 100));
    document.getElementById('goalPercent').innerText = percent + '%';
    document.getElementById('goalProgressBar').style.width = percent + '%';
    document.getElementById('goalTargetText').innerText = `목표: ${goalEok}억`;
    document.getElementById('currentWealthLabel').innerText = `현재 추정 자산: ${Math.round(currentWealth / 1000 * 10) / 100}억`;
    document.getElementById('goalInput').value = goalEok;
}

window.saveFinancialGoal = async function() {
    const amount = parseFloat(document.getElementById('goalInput').value);
    if (!amount || !currentUser) return;
    await setDoc(doc(db, "user_goals", currentUser.uid), { amount, updatedAt: new Date() });
    alert("목표가 저장되었습니다! 🎯"); location.reload();
};

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + (v / 1000000).toFixed(2) + 'M';
}

function addLog(msg) {
    const log = document.getElementById('dashActivityLog');
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fade-in-up";
    div.innerHTML = `<span class="text-blue-500">✔</span> <span>${msg}</span>`;
    log.appendChild(div);
}

function renderDailyQuote() {
    const quotes = ["자산 배분은 공짜 점심입니다.", "가장 좋은 투자 시기는 오늘입니다.", "시장의 소음이 아닌 비중에 집중하세요.", "복리는 세상의 8번째 불가사의입니다."];
    addLog(`💡 오늘의 팁: ${quotes[Math.floor(Math.random() * quotes.length)]}`);
}

async function renderMarketSentiment() {
    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;
        const sentiment = Math.max(5, Math.min(95, 50 + ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 1000)));
        document.getElementById('sentimentIndicator').style.left = `${sentiment}%`;
        document.getElementById('sentimentValue').innerText = Math.round(sentiment);
    } catch (e) {}
}

function renderDashChart(assets) {
    const ctx = document.getElementById('dashTotalChart').getContext('2d');
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    new Chart(ctx, {
        type: 'doughnut',
        data: { labels: assets.map(a => a.ticker), datasets: [{ data: assets.map(a => a.qty * (a.price || 0)), backgroundColor: colors, borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function calculateHealthScore(assets) {
    const total = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    if (total === 0) return 0;
    let dev = 0;
    assets.forEach(a => dev += Math.abs(((a.qty * (a.price || 0)) / total * 100) - (a.targetWeight || 0)));
    return Math.max(0, 100 - Math.round(dev));
}

window.quickPriceSearch = async function() {
    const ticker = document.getElementById('quickSearchInput').value.trim().toUpperCase();
    const resEl = document.getElementById('quickSearchResult');
    if (!ticker) return;
    resEl.innerHTML = '<div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>';
    try {
        const res = await fetch(`/api/price?ticker=${ticker}`);
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const color = meta.regularMarketPrice >= meta.chartPreviousClose ? 'text-red-500' : 'text-blue-500';
        resEl.innerHTML = `<div class="flex items-baseline gap-2 animate-fade-in-up"><span class="text-lg font-black">${ticker}</span><span class="text-base font-bold">${meta.regularMarketPrice.toLocaleString()}</span><span class="text-xs font-bold ${color}">${((meta.regularMarketPrice - meta.chartPreviousClose)/meta.chartPreviousClose*100).toFixed(2)}%</span></div>`;
    } catch (e) { resEl.innerHTML = '<p class="text-[10px] text-red-400">찾을 수 없음</p>'; }
};

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
