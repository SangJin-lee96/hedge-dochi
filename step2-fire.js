import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData } from './core.js';

let currentStep = 1;
let fireChart = null;

async function autoSaveData() {
    const fireData = {
        monthlyExpense: parseFloat(document.getElementById('f-expense').value) || 200,
        initialSeed: parseFloat(document.getElementById('f-seed').value) || 0,
        annualSave: parseFloat(document.getElementById('f-annual-save').value) || 0,
        investmentReturn: parseFloat(document.getElementById('f-rate').value) || 5.0,
        inflationRate: parseFloat(document.getElementById('f-inflation').value) || 2.5
    };
    await saveProgress(2, fireData);
}

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        const step2Data = await getStepData(2);
        const step1Data = await getStepData(1);
        
        const d = step2Data || {};
        const s1 = step1Data || {};
        
        if (document.getElementById('f-expense')) document.getElementById('f-expense').value = d.monthlyExpense || s1.monthlyExpense || 200;
        if (document.getElementById('f-seed')) document.getElementById('f-seed').value = d.initialSeed || s1.initialSeed || 3000;
        if (document.getElementById('f-annual-save')) {
            if (d.annualSave !== undefined) {
                document.getElementById('f-annual-save').value = d.annualSave;
            } else {
                const annualSave = (parseFloat(s1.annualSalary) || 4500) - (parseFloat(s1.monthlyExpense) || 200) * 12;
                document.getElementById('f-annual-save').value = Math.max(0, annualSave);
            }
        }
        if (document.getElementById('f-rate')) document.getElementById('f-rate').value = d.investmentReturn || s1.investmentReturn || 5.0;
        if (document.getElementById('f-inflation')) document.getElementById('f-inflation').value = d.inflationRate || s1.inflationRate || 2.5;

        if (step2Data && currentStep !== 4 && confirm("이전에 설계하던 은퇴 데이터가 있습니다. 결과를 바로 확인하시겠습니까?")) {
            calculateFire();
        }
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

window.calculateFire = async function() {
    const targetIncome = parseFloat(document.getElementById('f-expense').value) || 200;
    const withdrawRate = parseFloat(document.getElementById('f-withdraw-rate').value) || 4.0;
    const seed = parseFloat(document.getElementById('f-seed').value) || 0;
    const annualSave = parseFloat(document.getElementById('f-annual-save').value) || 0;
    const returnRate = (parseFloat(document.getElementById('f-rate').value) || 0) / 100;
    const inflRate = (parseFloat(document.getElementById('f-inflation').value) || 0) / 100;

    const realRate = returnRate - inflRate;
    const fireGoal = (targetIncome * 12) / (withdrawRate / 100);

    let currentWealth = seed;
    let years = 0;
    const chartLabels = [];
    const chartData = [];
    chartLabels.push('현재');
    chartData.push(currentWealth);

    while (currentWealth < fireGoal && years < 50) {
        years++;
        const profit = currentWealth * realRate;
        currentWealth = currentWealth + annualSave + profit;
        chartLabels.push(`${years}년`);
        chartData.push(Math.round(currentWealth));
    }

    const targetYear = new Date().getFullYear() + years;
    document.getElementById('fireYearsResult').innerText = years >= 50 ? '50년+ (불가)' : `${years}년`;
    document.getElementById('fireDateResult').innerText = years >= 50 ? '목표 하향 필요' : `${targetYear}년`;
    document.getElementById('fireGoalAmount').innerText = formatKorean(fireGoal);
    document.getElementById('fireMonthlyIncome').innerText = `${formatKorean(targetIncome)}/월`;
    
    renderAdvice(years);
    renderFireChart(chartLabels, chartData);
    
    const fireData = {
        monthlyExpense: targetIncome,
        initialSeed: seed,
        annualSave: annualSave,
        investmentReturn: returnRate * 100,
        inflationRate: inflRate * 100
    };
    
    // 결과 확인 시점에 3단계로 업데이트
    await saveProgress(3, fireData);
    showToast("은퇴 설계 결과가 저장되었습니다. 🏝️", "success");

    const actionContainer = document.querySelector('#step-4 .flex.flex-col') || document.querySelector('#step-4 .flex.flex-row');
    if (actionContainer) {
        actionContainer.innerHTML = `
            <button onclick="window.proceedToCurriculumStep3()" class="flex-[2] py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-2xl hover:scale-105 transition-all active:scale-95 text-lg">
                3단계: 투자 성향 파악하기 ➔
            </button>
            <button onclick="window.copyFireResult()" class="flex-1 py-5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                <span>📋 복사</span>
            </button>
            <button onclick="window.goToStep(1)" class="flex-1 py-5 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-slate-500">다시 계산</button>
        `;
    }

    window.goToStep(4);
};

window.proceedToCurriculumStep3 = function() {
    goToNextStep(2); 
};

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
    const text = `🏁 Hedge Dochi FIRE 리포트 🏁\n🏝️ 은퇴까지: ${years}\n📅 예상 시점: ${date}\n💰 목표 자산: ${goal}\n💵 월 예상 수입: ${income}\n👉 https://hedge-dochi-live.pages.dev/`;
    navigator.clipboard.writeText(text).then(() => showToast("결과가 복사되었습니다! 🚀"));
};

function formatKorean(val) {
    return val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', autoSaveData);
    });
});

window.goToStep(1);
