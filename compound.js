import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// --- State Management ---
let currentStep = 1;
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        try {
            const snap = await getDoc(doc(db, "simulations", user.uid));
            if (snap.exists()) {
                const d = snap.data();
                if (document.getElementById('c-seed')) document.getElementById('c-seed').value = d.initialSeed || 3000;
                if (document.getElementById('c-rate')) document.getElementById('c-rate').value = d.investmentReturn || 5.0;
            }
        } catch (e) {}
    }
});

// --- Navigation ---
window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Calculation ---
window.calculateCompound = function() {
    const seed = parseFloat(document.getElementById('c-seed').value) || 0;
    const monthly = parseFloat(document.getElementById('c-monthly').value) || 0;
    const rate = (parseFloat(document.getElementById('c-rate').value) || 0) / 100;
    const period = parseInt(document.getElementById('c-period').value) || 10;

    let currentWealth = seed;
    let totalPrincipal = seed;
    const monthlyRate = rate / 12;
    const yearlyData = [];

    for (let year = 1; year <= period; year++) {
        let yearlyProfit = 0;
        for (let month = 1; month <= 12; month++) {
            const interest = currentWealth * monthlyRate;
            yearlyProfit += interest;
            currentWealth += interest + monthly;
            totalPrincipal += monthly;
        }
        yearlyData.push({ year, total: currentWealth, principal: totalPrincipal, profit: currentWealth - totalPrincipal });
    }

    const finalProfit = currentWealth - totalPrincipal;
    document.getElementById('totalCompoundResult').innerText = formatKorean(currentWealth);
    document.getElementById('totalProfitResult').innerText = `수익금: ${formatKorean(finalProfit)}`;
    document.getElementById('profitRatio').innerText = `${((finalProfit / totalPrincipal) * 100).toFixed(1)}% 성장`;
    
    renderTable(yearlyData);
    goToStep(3);
    if (currentUser) {
        saveCompoundData(seed, monthly, rate * 100, period);
        syncToGlobalProfile(seed, rate * 100);
    }
};

async function syncToGlobalProfile(seed, rate) {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "simulations", currentUser.uid), {
            initialSeed: seed,
            investmentReturn: rate,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (e) {}
}

async function saveCompoundData(seed, monthly, rate, period) {
    try {
        await setDoc(doc(db, "compound_settings", currentUser.uid), {
            seed, monthly, rate, period, updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

window.copyCompoundResult = function() {
    const total = document.getElementById('totalCompoundResult').innerText;
    const profit = document.getElementById('totalProfitResult').innerText;
    const accel = document.getElementById('profitRatio').innerText;

    const text = `⏳ Hedge Dochi 복리의 마법 리포트 ⏳\n\n💰 최종 자산: ${total}\n📈 ${profit}\n🚀 복리 가속도: ${accel}\n\n📍 당신의 적립식 투자 미래를 지금 확인해보세요!\n👉 https://hedge-dochi-live.pages.dev/compound.html`;

    navigator.clipboard.writeText(text).then(() => {
        alert("결과 리포트가 클립보드에 복사되었습니다! 🚀");
    });
};

function renderTable(data) {
    const tbody = document.getElementById('compoundTableBody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="py-4 text-slate-400">${row.year}년차</td>
            <td class="py-4 font-bold">${formatKorean(row.principal)}</td>
            <td class="py-4 text-emerald-500 font-bold">+${formatKorean(row.profit)}</td>
            <td class="py-4 text-right text-slate-800 dark:text-slate-200 font-bold">${formatKorean(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

goToStep(1);
