import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- State Management ---
let currentStep = 1;
let dividendPeriod = 12; 
let dividendChart = null;
let currentUser = null;

const auth = getAuth();
onAuthStateChanged(auth, user => currentUser = user);

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
            const dividend = currentWealth * yieldPerPeriod;
            if (isReinvest) currentWealth += (dividend * taxFactor);
        }
        chartData.push(Math.round(currentWealth));
        chartLabels.push(`${year}년`);
    }

    document.getElementById('monthlyDividendResult').innerText = formatKorean(monthlyNet);
    document.getElementById('annualDividendResult').innerText = `연간 총 배당금(세후): ${formatKorean(annualNet)}`;
    document.getElementById('tenYearResult').innerText = formatKorean(currentWealth);
    document.getElementById('tenYearGrowth').innerText = `+${((currentWealth - total) / total * 100).toFixed(1)}%`;

    renderDividendChart(chartLabels, chartData);
    goToStep(4);
    if (currentUser) saveDividendData(monthlyNet, annualNet);
};

function renderDividendChart(labels, data) {
    const ctx = document.getElementById('dividendChart').getContext('2d');
    if (dividendChart) dividendChart.destroy();
    dividendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: '자산 성장', data: data, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });
}

async function saveDividendData(monthly, annual) {
    try {
        const db = getFirestore();
        await setDoc(doc(db, "dividend_goals", currentUser.uid), { monthlyIncome: monthly, annualIncome: annual, updatedAt: new Date() }, { merge: true });
    } catch (e) { console.error(e); }
}

window.copyDividendResult = function() {
    const monthly = document.getElementById('monthlyDividendResult').innerText;
    const annual = document.getElementById('annualDividendResult').innerText;
    const text = `💰 Hedge Dochi 배당금 리포트 💰\n\n💵 예상 월 세후 배당금: ${monthly}\n📅 ${annual}\n\n📍 나의 꼬박꼬박 들어오는 현금흐름, 지금 확인해보세요!\n👉 https://hedge-dochi-live.pages.dev/dividend.html`;
    navigator.clipboard.writeText(text).then(() => alert("배당 리포트가 복사되었습니다! 🚀"));
};

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

goToStep(1);
