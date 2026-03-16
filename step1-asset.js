import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData, exchangeRate as coreExchangeRate } from './core.js';

let wealthChart = null;
let baseCurrency = 'KRW';
let exchangeRate = 1350;
let liveExchangeRate = 1350;

// --- Debugging Helper ---
function logClick(btnName, data = {}) {
    console.log(`[Step 1] ${btnName} 버튼 클릭됨`, {
        timestamp: new Date().toISOString(),
        currentStep: getCurrentVisibleStep(),
        data: data
    });
}

function getCurrentVisibleStep() {
    const visibleSec = document.querySelector('.step-section:not(.hidden)');
    return visibleSec ? visibleSec.id : 'unknown';
}

// --- Wizard Logic ---
window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Action Functions ---
async function autoSaveData(immediate = false) {
    const salary = parseFloat(document.getElementById('annualSalary')?.value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense')?.value) || 0;
    const monthlySavings = Math.max(0, Math.round((salary / 12) - expense));

    const data = {
        annualSalary: salary,
        initialSeed: parseFloat(document.getElementById('initialSeed')?.value) || 0,
        monthlyExpense: expense,
        monthlySavings: monthlySavings,
        salaryGrowth: parseFloat(document.getElementById('salaryGrowth')?.value) || 0,
        investmentReturn: parseFloat(document.getElementById('investmentReturn')?.value) || 0,
        inflationRate: parseFloat(document.getElementById('inflationRate')?.value) || 0,
        baseCurrency: baseCurrency,
        manualExchangeRate: parseFloat(document.getElementById('manualExchangeRate')?.value) || exchangeRate
    };
    
    if (salary > 0 || data.initialSeed > 0) {
        await saveProgress(1, data, immediate);
    }
    return data;
}

async function calculateAndShowResult() {
    const data = await autoSaveData(true);
    logClick('결과 보기', data);
    updateCalculation();
    window.goToStep(4);
}

function updateCalculation() {
    const salary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const seed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const returns = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflation = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = seed;
    const yearlyData = [seed];
    const realYearlyData = [seed];
    const tableBody = document.getElementById('yearlyTableBody');
    if (tableBody) tableBody.innerHTML = '';

    for (let year = 1; year <= 10; year++) {
        const annualSavings = (salary - (expense * 12));
        const profit = currentWealth * returns;
        currentWealth = currentWealth + annualSavings + profit;
        
        yearlyData.push(Math.round(currentWealth));
        realYearlyData.push(Math.round(currentWealth / Math.pow(1 + 0.03, year)));

        if (tableBody) {
            const tr = document.createElement('tr');
            tr.className = "border-b dark:border-slate-800";
            tr.innerHTML = `
                <td class="py-4 px-2">${year}년차</td>
                <td class="py-4 px-2">${formatValue(salary)}</td>
                <td class="py-4 px-2 text-emerald-500">+${formatValue(profit)}</td>
                <td class="py-4 px-2 text-right font-black">${formatValue(currentWealth)}</td>
            `;
            tableBody.appendChild(tr);
        }
    }

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    document.getElementById('netSavingsText').innerText = formatValue(Math.max(0, Math.round((salary/12) - expense)));
    
    updateWealthTier(realYearlyData[10]);
    renderChart(yearlyData, realYearlyData);
    generateAIInsight(yearlyData[10], realYearlyData[10]);
}

function updateWealthTier(realWealth) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600", desc = "";
    const val = realWealth / (baseCurrency === 'KRW' ? 1 : (1/exchangeRate * 10000));

    if (val >= 200000) { 
        tier = "다이아몬드"; icon = "💎"; color = "from-indigo-500 via-purple-500 to-pink-500"; 
        desc = "상위 0.1%의 압도적인 자산가입니다. 이제 자산 수명을 늘리는 인출 전략에 집중하세요.";
    } else if (val >= 100000) { 
        tier = "플래티넘"; icon = "💍"; color = "from-blue-400 to-indigo-600";
        desc = "경제적 자유를 목전에 둔 자산가입니다. 공격적인 투자보다 리스크 관리가 중요한 시점입니다.";
    } else if (val >= 50000) { 
        tier = "골드"; icon = "🥇"; color = "from-amber-400 to-orange-600";
        desc = "탄탄한 중산층 이상의 자산을 구축했습니다. 복리의 가속도가 붙기 시작하는 단계입니다.";
    } else if (val >= 20000) { 
        tier = "실버"; icon = "🥈"; color = "from-slate-300 to-slate-500";
        desc = "기초 자산 형성을 완료했습니다. 이제 본격적인 자산 배분을 통해 성장을 꾀할 때입니다.";
    } else {
        desc = "자산 형성의 초기 단계입니다. 투자 수익률보다 '저축액'을 늘리는 것이 가장 빠른 지름길입니다.";
    }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeDesc').innerText = desc;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
}

function renderChart(nominalData, realData) {
    const ctxEl = document.getElementById('wealthChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    if (wealthChart) wealthChart.destroy();
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '명목 목표', data: nominalData, borderColor: '#3b82f6', borderWidth: 4, pointRadius: 6, pointBackgroundColor: '#3b82f6', fill: false, tension: 0.3 },
                { label: '실질 가치 (물가 반영)', data: realData, borderColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0.3 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: true, position: 'bottom', labels: { font: { weight: 'bold' } } } }, 
            scales: { 
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } }, 
                x: { grid: { display: false } } 
            } 
        }
    });
}

function formatValue(val) {
    if (baseCurrency === 'KRW') return (val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만');
    return '$' + Math.round(val).toLocaleString();
}

function generateAIInsight(nominal, real) {
    const el = document.getElementById('aiInsight');
    if (!el) return;
    const diff = nominal - real;
    el.innerHTML = `10년 후 당신의 자산은 <b>${formatValue(nominal)}</b>에 도달하지만, 물가 상승을 고려한 실제 구매력은 <b>${formatValue(real)}</b> 수준입니다. 즉, 인플레이션으로 인해 약 <b>${formatValue(diff)}</b>의 가치가 희석됩니다. 이를 방어하기 위해 최소 연 5% 이상의 수익률을 내는 자산 배분이 필수적입니다.`;
}

// --- Event Handlers ---
function setCurrency(code) {
    baseCurrency = code;
    logClick(`통화 설정: ${code}`);
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-set-usd');
    const btnKrw = document.getElementById('btn-set-krw');

    if (glider) glider.style.left = (code === 'USD') ? '4px' : '50%';
    
    // 버튼 색상 업데이트
    if (btnUsd && btnKrw) {
        if (code === 'USD') {
            btnUsd.classList.replace('text-slate-400', 'text-blue-600');
            btnUsd.classList.add('dark:text-blue-400');
            btnKrw.classList.replace('text-blue-600', 'text-slate-400');
            btnKrw.classList.remove('dark:text-blue-400');
        } else {
            btnKrw.classList.replace('text-slate-400', 'text-blue-600');
            btnKrw.classList.add('dark:text-blue-400');
            btnUsd.classList.replace('text-blue-600', 'text-slate-400');
            btnUsd.classList.remove('dark:text-blue-400');
        }
    }

    const labels = document.querySelectorAll('.currency-label');
    labels.forEach(l => l.innerText = (code === 'KRW' ? '만원' : '달러'));
    
    autoSaveData(false);
}

function resetToLiveExchangeRate() {
    logClick('실시간 환율 리셋');
    const input = document.getElementById('manualExchangeRate');
    if (input) {
        input.value = Math.round(liveExchangeRate);
        exchangeRate = liveExchangeRate;
        showToast("실시간 환율이 적용되었습니다.", "success");
        autoSaveData(true);
    }
}

window.copySimulationResult = function() {
    logClick('결과 복사');
    const tier = document.getElementById('gradeTitle').innerText;
    const wealth = document.getElementById('finalWealthText').innerText;
    const text = `📊 Hedge Dochi 자산 시뮬레이션 결과\n📍 나의 10년 후 등급: ${tier}\n📍 예상 자산: ${wealth}\n\n👉 지금 바로 확인하기: https://sangjin-lee96.github.io/hedge-dochi/`;
    navigator.clipboard.writeText(text).then(() => showToast("결과가 복사되었습니다!", "success"));
};

window.downloadResultImage = function() {
    logClick('이미지 저장');
    const area = document.querySelector('.capture-area');
    if (!area) return;
    showToast("이미지를 생성 중입니다...", "info");
    html2canvas(area, { useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `HedgeDochi_Asset_Report.png`;
        link.href = canvas.toDataURL();
        link.click();
        showToast("저장이 완료되었습니다!", "success");
    });
};

window.toggleYearlyTable = function() {
    const container = document.getElementById('yearly-table-container');
    const arrow = document.getElementById('table-arrow');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        container.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

// --- Initialization & Binding ---
document.addEventListener('coreDataReady', (e) => {
    liveExchangeRate = e.detail.exchangeRate || coreExchangeRate;
    exchangeRate = liveExchangeRate;
    restoreData();
});

async function restoreData() {
    const data = await getStepData(1);
    if (data) {
        const fields = ['annualSalary', 'initialSeed', 'monthlyExpense', 'salaryGrowth', 'investmentReturn', 'inflationRate', 'manualExchangeRate'];
        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = data[f] || el.value;
        });
        if (data.baseCurrency) setCurrency(data.baseCurrency);
        if (data.annualSalary && data.initialSeed) {
            updateCalculation();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. 통화 스위처
    document.getElementById('btn-set-usd')?.addEventListener('click', () => setCurrency('USD'));
    document.getElementById('btn-set-krw')?.addEventListener('click', () => setCurrency('KRW'));

    // 2. 단계 이동
    document.getElementById('btn-step1-next')?.addEventListener('click', () => { logClick('Step 1 -> 2'); window.goToStep(2); });
    document.getElementById('btn-step2-prev')?.addEventListener('click', () => { logClick('Step 2 -> 1'); window.goToStep(1); });
    document.getElementById('btn-step2-next')?.addEventListener('click', () => { logClick('Step 2 -> 3'); window.goToStep(3); });
    document.getElementById('btn-step3-prev')?.addEventListener('click', () => { logClick('Step 3 -> 2'); window.goToStep(2); });

    // 3. 계산 및 리셋
    document.getElementById('btn-step3-calculate')?.addEventListener('click', calculateAndShowResult);
    document.getElementById('btn-step3-reset-rate')?.addEventListener('click', resetToLiveExchangeRate);

    // 4. 결과 페이지 도구
    document.getElementById('btn-step4-copy')?.addEventListener('click', window.copySimulationResult);
    document.getElementById('btn-step4-download')?.addEventListener('click', window.downloadResultImage);
    document.getElementById('btn-step4-retry')?.addEventListener('click', () => { logClick('다시하기'); window.goToStep(1); });
    document.getElementById('btn-step4-toggle-table')?.addEventListener('click', window.toggleYearlyTable);
    
    // 핵심 버튼: 2단계 은퇴 설계로 이동
    document.getElementById('btn-step1-to-step2')?.addEventListener('click', () => {
        logClick('Step 1 -> Step 2 Curriculum');
        goToNextStep(1);
    });

    // 5. 모달 제어
    const modal = document.getElementById('strategyModal');
    document.getElementById('showStrategyBtn')?.addEventListener('click', () => {
        logClick('전략 모달 열기');
        const content = document.getElementById('modalContent');
        const tier = document.getElementById('gradeTitle').innerText;
        content.innerHTML = `<p class="font-bold text-indigo-600">${tier} 등급을 위한 맞춤 조언:</p><ul class="list-disc ml-5 space-y-2"><li>월 지출 중 불필요한 구독료나 고정비를 5%만 줄여도 10년 후 자산은 1,500만원 이상 늘어납니다.</li><li>현재 수익률 설정치(5%)는 시장 평균 수준입니다. 자산의 30%를 지수 ETF(VOO, QQQ)에 배분하는 것을 고려해보세요.</li></ul>`;
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('modalContainer').classList.add('scale-100', 'opacity-100'), 10);
    });
    const closeModal = () => {
        document.getElementById('modalContainer').classList.remove('scale-100', 'opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);

    // 6. 실시간 저장
    document.querySelectorAll('input').forEach(i => i.addEventListener('input', () => autoSaveData(false)));
});
