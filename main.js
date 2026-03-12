// --- State Management ---
let currentStep = 1;
let wealthChart = null;
let baseCurrency = 'KRW'; // 메인 시뮬레이터는 기본 원화 세팅
let exchangeRate = 1350;

// --- Wizard Navigation ---
window.goToStep = async function(step) {
    // 환율 정보 가져오기 (필요 시)
    if (step === 1 || step === 4) {
        try {
            const res = await fetch('/api/price?ticker=USDKRW=X');
            const data = await res.json();
            const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (rate) exchangeRate = rate;
        } catch (e) { console.error("환율 로드 실패", e); }
    }

    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        if (idx + 1 <= step) {
            dot.classList.remove('bg-slate-200');
            dot.classList.add('bg-blue-600');
        } else {
            dot.classList.remove('bg-blue-600');
            dot.classList.add('bg-slate-200');
        }
    });

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Currency Management ---
window.setCurrency = function(code) {
    baseCurrency = code;
    const isUSD = code === 'USD';
    
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-currency-usd');
    const btnKrw = document.getElementById('btn-currency-krw');
    const symbolWizard = document.getElementById('currency-symbol-wizard');
    const labels = document.querySelectorAll('.currency-label');

    if (isUSD) {
        if (glider) glider.style.left = '4px';
        btnUsd?.classList.add('text-blue-600');
        btnKrw?.classList.add('text-slate-400');
        btnUsd?.classList.remove('text-slate-400');
        btnKrw?.classList.remove('text-blue-600');
        if (symbolWizard) symbolWizard.innerText = '$';
        labels.forEach(l => l.innerText = 'USD');
    } else {
        if (glider) glider.style.left = '50%';
        btnKrw?.classList.add('text-blue-600');
        btnUsd?.classList.add('text-slate-400');
        btnKrw?.classList.remove('text-slate-400');
        btnUsd?.classList.remove('text-blue-600');
        if (symbolWizard) symbolWizard.innerText = '₩';
        labels.forEach(l => l.innerText = '만원');
    }
};

function formatValue(val) {
    if (baseCurrency === 'KRW') {
        if (val >= 10000) return (val / 10000).toFixed(1) + '억';
        return Math.round(val).toLocaleString() + '만';
    } else {
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'K';
        return '$' + Math.round(val).toLocaleString();
    }
}

// --- Final Calculation & Show Result ---
window.calculateAndShowResult = function() {
    updateCalculation();
    goToStep(4);
};

function updateCalculation() {
    const annualSalary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const initialSeed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflationRate = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = initialSeed;
    let currentAnnualSalary = annualSalary;
    let currentMonthlyExpense = monthlyExpense;
    
    const yearlyData = [initialSeed];
    const realYearlyData = [initialSeed];
    const tableData = [];

    for (let year = 1; year <= 10; year++) {
        const annualSurplus = currentAnnualSalary - (currentMonthlyExpense * 12);
        const profit = (currentWealth + (annualSurplus / 2)) * investmentReturn;
        currentWealth = currentWealth + annualSurplus + profit;
        
        tableData.push({ year, salary: currentAnnualSalary, profit: profit, total: currentWealth });

        currentAnnualSalary *= (1 + salaryGrowth);
        currentMonthlyExpense *= (1 + inflationRate);
        
        yearlyData.push(Math.round(currentWealth));
        const realValue = currentWealth / Math.pow(1 + (baseCurrency === 'KRW' ? inflationRate : 0.03), year); // 달러는 고정 물가 3% 가정 가능
        realYearlyData.push(Math.round(realValue));
    }

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    const avgNetSavings = Math.round((annualSalary - (monthlyExpense * 12)) / 12);
    document.getElementById('netSavingsText').innerText = formatValue(avgNetSavings).replace('$', '');

    renderYearlyTable(tableData);
    updateWealthTier(realYearlyData[10]);
    renderChart(yearlyData, realYearlyData);
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-2 text-slate-400">${row.year}년차</td>
            <td class="py-4 px-2 text-blue-500">${formatValue(row.salary)}</td>
            <td class="py-4 px-2 text-emerald-500">+${formatValue(row.profit)}</td>
            <td class="py-4 px-2 text-right text-slate-800 dark:text-slate-200">${formatValue(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateWealthTier(realWealth) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600";
    let desc = "기초를 다지는 단계입니다. 저축액을 늘려 시드를 모으는 데 집중하세요.";
    
    // 통화별 기준값 조정 (KRW 만원 단위 vs USD)
    const threshold = baseCurrency === 'KRW' ? 1 : (1/exchangeRate * 10000); 
    const val = realWealth / threshold;

    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; color = "from-indigo-500 via-purple-500 to-pink-500"; desc = "경제적 자유 달성! 당신은 상위 1%의 자산가입니다."; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; color = "from-blue-400 to-indigo-600"; desc = "안정적인 자산가! 품격 있는 삶이 기다리고 있습니다."; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; color = "from-amber-400 to-orange-600"; desc = "풍요로운 중산층! 복리의 힘을 믿고 나아가세요."; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; color = "from-slate-300 to-slate-500"; desc = "안정적인 시작! 자산 배분을 통해 리스크를 관리하세요."; }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeDesc').innerText = desc;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
}

function renderChart(nominalData, realData) {
    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const col = isDark ? '#94a3b8' : '#64748b';
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '명목 자산', data: nominalData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, pointRadius: 4 },
                { label: '실질 가치', data: realData, borderColor: '#10b981', borderDash: [5, 5], fill: false, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: col, font: { weight: 'bold' } } } }, scales: { y: { grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, ticks: { color: col, callback: v => formatValue(v) } }, x: { ticks: { color: col } } } }
    });
}

const strategyContent = {
    "다이아몬드": { icon: "💎", title: "다이아몬드 등급 전략", content: "이미 본 궤도에 오르셨습니다. 베타 가속과 절세에 집중하세요." },
    "플래티넘": { icon: "💍", title: "플래티넘 등급 전략", content: "60:40 포트폴리오를 통해 안정적인 우상향을 추구하세요." },
    "골드": { icon: "🥇", title: "골드 등급 전략", content: "복리가 일할 수 있도록 시장 지수 적립식 투자를 추천합니다." },
    "실버": { icon: "🥈", title: "실버 등급 전략", content: "비상금을 확보하고 자산 배분의 기초를 다지세요." },
    "브론즈": { icon: "🥉", title: "브론즈 등급 전략", content: "지금은 수익률보다 저축률이 압도적으로 중요한 시기입니다." }
};

window.toggleStrategyModal = function(show) {
    const modal = document.getElementById('strategyModal'), container = document.getElementById('modalContainer');
    if (!modal || !container) return;
    if (show) {
        const tier = document.getElementById('gradeTitle').innerText;
        const data = strategyContent[tier] || strategyContent["브론즈"];
        document.getElementById('modalContent').innerHTML = `<div class="text-center mb-6"><div class="text-6xl mb-4">${data.icon}</div><h4 class="text-xl font-bold text-blue-600">${data.title}</h4></div><div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl leading-relaxed">${data.content}</div>`;
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => container.classList.remove('scale-95', 'opacity-0'), 10);
    } else {
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
};

window.toggleYearlyTable = function() {
    const container = document.getElementById('yearly-table-container'), arrow = document.getElementById('table-arrow');
    container.classList.toggle('hidden');
    arrow.style.transform = container.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showStrategyBtn')?.addEventListener('click', () => toggleStrategyModal(true));
    document.getElementById('closeModal')?.addEventListener('click', () => toggleStrategyModal(false));
    const observer = new MutationObserver(() => { if (currentStep === 4) updateCalculation(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
