import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep } from './core.js';

let currentStep = 1;
let fireChart = null;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        try {
            const snap = await getDoc(doc(db, "simulations", user.uid));
            if (snap.exists()) {
                const d = snap.data();
                if (document.getElementById('f-expense')) document.getElementById('f-expense').value = d.monthlyExpense || 200;
                if (document.getElementById('f-seed')) document.getElementById('f-seed').value = d.initialSeed || 3000;
                if (document.getElementById('f-annual-save')) {
                    const annualSave = (parseFloat(d.annualSalary) || 4500) - (parseFloat(d.monthlyExpense) || 200) * 12;
                    document.getElementById('f-annual-save').value = Math.max(0, annualSave);
                }
                if (document.getElementById('f-rate')) document.getElementById('f-rate').value = d.investmentReturn || 5.0;
            }
        } catch (e) { console.error("Data Load Error:", e); }
    }
});

window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.calculateFire = function() {
    const targetIncome = parseFloat(document.getElementById('f-expense').value) || 200;
    const withdrawRate = parseFloat(document.getElementById('f-withdraw-rate').value) || 4.0;
    const seed = parseFloat(document.getElementById('f-seed').value) || 0;
    const annualSave = parseFloat(document.getElementById('f-annual-save').value) || 0;
    const returnRate = (parseFloat(document.getElementById('f-rate').value) || 0) / 100;
    const inflRate = (parseFloat(document.getElementById('f-inflation').value) || 0) / 100;

    // 실질 수익률 (수익률 - 물가상승률)
    const realRate = returnRate - inflRate;

    // 목표 은퇴 자금 = (월 필요 금액 * 12) / (인출률 / 100)
    const fireGoal = (targetIncome * 12) / (withdrawRate / 100);

    let currentWealth = seed;
    let years = 0;
    const chartLabels = [];
    const chartData = [];

    chartLabels.push('현재');
    chartData.push(currentWealth);

    // 자산이 목표치에 도달할 때까지 연도별 계산 (최대 50년 제한)
    while (currentWealth < fireGoal && years < 50) {
        years++;
        const profit = currentWealth * realRate;
        currentWealth = currentWealth + annualSave + profit;
        chartLabels.push(`${years}년`);
        chartData.push(Math.round(currentWealth));
    }

    if (years >= 50) {
        document.getElementById('fireYearsResult').innerText = '50년+ (불가)';
        document.getElementById('fireDateResult').innerText = '목표 하향 필요';
        document.getElementById('fireDateResult').classList.add('text-red-500');
    } else {
        const targetYear = new Date().getFullYear() + years;
        document.getElementById('fireYearsResult').innerText = `${years}년`;
        document.getElementById('fireDateResult').innerText = `${targetYear}년`;
        document.getElementById('fireDateResult').classList.remove('text-red-500');
        
        if (currentUser) saveFireData(fireGoal, years, targetYear);
    }

    document.getElementById('fireGoalAmount').innerText = formatKorean(fireGoal);
    document.getElementById('fireMonthlyIncome').innerText = `${formatKorean(targetIncome)}/월`;
    
    renderAdvice(years);
    renderFireChart(chartLabels, chartData);
    syncToMainSimulation();
    
    // Set up the Next Step button for the curriculum in STEP 4
    const actionContainer = document.querySelector('#step-4 .flex.flex-col') || document.querySelector('#step-4 .flex.flex-row');
    
    if (actionContainer) {
        actionContainer.innerHTML = `
            <button onclick="proceedToCurriculumStep3()" class="flex-[2] py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-2xl hover:scale-105 transition-all active:scale-95 text-lg">
                3단계: 투자 성향 파악하기 ➔
            </button>
            <button onclick="copyFireResult()" class="flex-1 py-5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                <span>📋 복사</span>
            </button>
            <button onclick="goToStep(1)" class="flex-1 py-5 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-slate-500">다시 계산</button>
        `;
    }

    goToStep(4);
};

window.proceedToCurriculumStep3 = function() {
    goToNextStep(2); // Go to Step 3
};

async function syncToMainSimulation() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "simulations", currentUser.uid), {
            monthlyExpense: document.getElementById('f-expense').value,
            initialSeed: document.getElementById('f-seed').value,
            investmentReturn: document.getElementById('f-rate').value,
            inflationRate: document.getElementById('f-inflation').value,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (e) {}
}

function renderFireChart(labels, data) {
    const ctx = document.getElementById('fireChart').getContext('2d');
    if (fireChart) fireChart.destroy();
    fireChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: '자산 성장', data: data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });
}

async function saveFireData(goal, years, targetYear) {
    try {
        await setDoc(doc(db, "fire_goals", currentUser.uid), {
            goalAmount: goal,
            remainingYears: years,
            targetYear: targetYear,
            updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

function renderAdvice(years) {
    const el = document.getElementById('fireAdvice');
    if (!el) return;
    if (years <= 10) el.innerText = "은퇴가 가깝습니다! 이제는 자산의 하락 방어와 인출 전략을 구체화하세요.";
    else if (years <= 20) el.innerText = "안정적인 궤도입니다. 저축률을 5%만 높여도 은퇴를 3년 앞당길 수 있습니다.";
    else el.innerText = "긴 여정이지만 복리의 힘은 마지막에 폭발합니다. 꾸준함이 정답입니다.";
}

window.copyFireResult = function() {
    const years = document.getElementById('fireYearsResult').innerText;
    const date = document.getElementById('fireDateResult').innerText;
    const goal = document.getElementById('fireGoalAmount').innerText;
    const income = document.getElementById('fireMonthlyIncome').innerText;

    const text = `🏁 Hedge Dochi 경제적 자유(FIRE) 리포트 🏁\n\n` +
                 `🏝️ 은퇴까지 남은 기간: ${years}\n` +
                 `📅 은퇴 가능 예상 시점: ${date}\n` +
                 `💰 목표 은퇴 자산: ${goal}\n` +
                 `💵 은퇴 후 월 예상 수입: ${income}\n\n` +
                 `📍 당신은 언제 은퇴할 수 있을까요? 지금 확인해보세요!\n` +
                 `👉 https://hedge-dochi-live.pages.dev/step2-fire.html`;

    navigator.clipboard.writeText(text).then(() => {
        alert("은퇴 리포트가 클립보드에 복사되었습니다! 🚀");
    });
};

function formatKorean(val) {
    return val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만';
}

goToStep(1);
