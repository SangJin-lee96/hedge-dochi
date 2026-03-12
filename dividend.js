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
let dividendPeriod = 12; 
let dividendChart = null;
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        try {
            const snap = await getDoc(doc(db, "simulations", user.uid));
            if (snap.exists()) {
                const d = snap.data();
                if (document.getElementById('d-total')) document.getElementById('d-total').value = d.initialSeed || 3000;
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

window.setPeriod = function(val) {
    dividendPeriod = val;
    document.querySelectorAll('.period-btn').forEach(btn => {
        const isSelected = parseInt(btn.dataset.val) === val;
        btn.className = `period-btn p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-xs border-2 ${isSelected ? 'selected border-blue-500' : 'border-transparent'}`;
    });
};

// --- Calculation ---
window.calculateDividend = function() {
    const total = parseFloat(document.getElementById('d-total').value) || 0;
    const yieldRate = (parseFloat(document.getElementById('d-yield').value) || 0) / 100;
    const taxRate = (parseFloat(document.getElementById('d-tax').value) || 0) / 100;
    const isReinvest = document.getElementById('d-reinvest').checked;

    const annualNet = (total * yieldRate) * (1 - taxRate);
    const monthlyNet = annualNet / 12;

    let currentWealth = total;
    const periodsPerYear = dividendPeriod; 
    const yieldPerPeriod = yieldRate / periodsPerYear;
    const taxFactor = (1 - taxRate);
    const chartData = [total];
    const chartLabels = ["현재"];

    for (let year = 1; year <= 10; year++) {
        for (let p = 0; p < periodsPerYear; p++) {
            if (isReinvest) {
                const div = currentWealth * yieldPerPeriod * taxFactor;
                currentWealth += div;
            }
        }
        chartData.push(Math.round(currentWealth));
        chartLabels.push(`${year}년`);
    }

    document.getElementById('monthlyDividendResult').innerText = formatKorean(monthlyNet);
    document.getElementById('annualDividendResult').innerText = formatKorean(annualNet);
    document.getElementById('growthResultText').innerText = `10년 후 예상 자산: ${formatKorean(currentWealth)}`;

    renderChart(chartLabels, chartData);
    goToStep(3);
    if (currentUser) {
        saveDividendData(total, yieldRate * 100, monthlyNet);
        syncToGlobalProfile(total);
    }
};

async function syncToGlobalProfile(seed) {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "simulations", currentUser.uid), {
            initialSeed: seed,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (e) {}
}

async function saveDividendData(total, yieldRate, monthlyIncome) {
    try {
        await setDoc(doc(db, "dividend_goals", currentUser.uid), {
            totalInvested: total,
            yieldRate: yieldRate,
            monthlyIncome: monthlyIncome,
            updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

function renderChart(labels, data) {
    const ctx = document.getElementById('dividendChart').getContext('2d');
    if (dividendChart) dividendChart.destroy();
    dividendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: '자산 성장', data: data, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, pointRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });
}

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

goToStep(1);
