import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, saveProgress, goToNextStep, getStepData } from './core.js';

// --- State Management ---
let currentStep = 1;

async function autoSaveData() {
    const compoundData = {
        compoundSeed: parseFloat(document.getElementById('c-seed').value) || 0,
        monthlySavings: parseFloat(document.getElementById('c-monthly').value) || 0,
        compoundRate: parseFloat(document.getElementById('c-rate').value) || 5.0,
        compoundPeriod: parseInt(document.getElementById('c-period').value) || 10
    };
    await saveProgress(6, compoundData);
}

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        const step6Data = await getStepData(6);
        const step1Data = await getStepData(1);
        const step2Data = await getStepData(2);
        
        const d = step6Data || {};
        const s1 = step1Data || {};
        const s2 = step2Data || {};
        
        if (document.getElementById('c-seed')) document.getElementById('c-seed').value = d.compoundSeed || s2.initialSeed || s1.initialSeed || 3000;
        if (document.getElementById('c-rate')) document.getElementById('c-rate').value = d.compoundRate || s2.investmentReturn || s1.investmentReturn || 5.0;
        if (document.getElementById('c-monthly')) document.getElementById('c-monthly').value = d.monthlySavings || 50;
        if (document.getElementById('c-period')) document.getElementById('c-period').value = d.compoundPeriod || 10;

        if (step6Data && currentStep !== 3 && confirm("이전에 시뮬레이션하던 복리 데이터가 있습니다. 결과를 바로 확인하시겠습니까?")) {
            calculateCompound();
        }
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
window.calculateCompound = async function() {
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
    
    const compoundData = {
        compoundSeed: seed,
        monthlySavings: monthly,
        compoundRate: rate * 100,
        compoundPeriod: period,
        finalProjectedWealth: currentWealth
    };
    
    // 결과 확인 시점에 7단계로 진척도 업데이트
    await saveProgress(7, compoundData);
    showToast("복리 시뮬레이션 결과가 저장되었습니다. ⏳", "success");

    const actionContainer = document.querySelector('#step-3 .flex.flex-col') || document.querySelector('#step-3 .flex.justify-center');
    if (actionContainer) {
        actionContainer.innerHTML = `
            <button onclick="proceedToCurriculumStep7()" class="w-full md:w-auto px-10 py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-2xl hover:scale-105 transition-all active:scale-95 text-lg mb-4">
                7단계: 실전 포트폴리오 구축하기 ➔
            </button>
            <div class="flex gap-4">
                <button onclick="copyCompoundResult()" class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-slate-500">결과 복사</button>
                <button onclick="goToStep(1)" class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-slate-500">다시 계산</button>
            </div>
        `;
    }

    goToStep(3);
};

window.proceedToCurriculumStep7 = function() {
    goToNextStep(6);
};

window.copyCompoundResult = function() {
    const total = document.getElementById('totalCompoundResult').innerText;
    const profit = document.getElementById('totalProfitResult').innerText;
    const accel = document.getElementById('profitRatio').innerText;
    const text = `⏳ Hedge Dochi 복리의 마법 리포트 ⏳\n💰 최종 자산: ${total}\n📈 ${profit}\n🚀 복리 가속도: ${accel}\n👉 https://hedge-dochi-live.pages.dev/`;
    navigator.clipboard.writeText(text).then(() => showToast("결과 리포트가 클립보드에 복사되었습니다! 🚀"));
};

function renderTable(data) {
    const tbody = document.getElementById('compoundTableBody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `<td class="py-4 text-slate-400">${row.year}년차</td><td class="py-4 font-bold">${formatKorean(row.principal)}</td><td class="py-4 text-emerald-500 font-bold">+${formatKorean(row.profit)}</td><td class="py-4 text-right text-slate-800 dark:text-slate-200 font-bold">${formatKorean(row.total)}</td>`;
        tbody.appendChild(tr);
    });
}

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', autoSaveData);
    });
});

goToStep(1);
