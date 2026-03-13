import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, getStepData } from './core.js';

let targetChart = null;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        document.getElementById('dashUserName').innerText = user.displayName || '투자자';
        document.getElementById('dashUserPhoto').src = user.photoURL || '';
        await refreshDashboard();
    } else {
        showToast("로그인이 필요합니다.");
        location.href = "index.html";
    }
});

async function refreshDashboard() {
    try {
        // 1. 모든 단계 데이터 로드
        const [s1, s2, s3, s5, s6] = await Promise.all([
            getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6)
        ]);

        // 2. 나의 페르소나 (Step 1 & 3)
        updatePersonaUI(s1, s3);

        // 3. 은퇴 목표 (Step 2)
        updateFireUI(s2);

        // 4. 복리 타겟 (Step 6)
        updateCompoundUI(s6);

        // 5. 투자 전략 및 권장 비중 (Step 5)
        updateStrategyUI(s5);

    } catch (e) {
        console.error("Dashboard Update Error:", e);
    }
}

function updatePersonaUI(s1, s3) {
    const nameEl = document.getElementById('personaName');
    const tierEl = document.getElementById('tierValue');
    const riskEl = document.getElementById('riskValue');
    const tagsEl = document.getElementById('personaTags');
    const iconEl = document.getElementById('personaIcon');

    if (s1 && s1.annualSalary) {
        const sim = calculateWealthSummary(s1);
        tierEl.innerText = sim.tier;
        nameEl.innerText = `${sim.tier} 등급 투자자`;
        iconEl.innerText = sim.icon;
    }

    if (s3 && s3.riskType) {
        riskEl.innerText = s3.riskType;
        tagsEl.innerHTML = `<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">${s3.riskType}</span>`;
        if (s1) nameEl.innerText = `${s3.riskType} ${nameEl.innerText}`;
    }
}

function updateFireUI(s2) {
    const container = document.getElementById('fireSummary');
    if (!s2) return;

    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">월 생활비 목표</span>
            <span class="font-black text-blue-600">${formatVal(s2.monthlyExpense, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">목표 수익률</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s2.investmentReturn}%</span>
        </div>
        <p class="text-[10px] text-slate-400 text-center mt-4">은퇴 설계 완료 ✓</p>
    `;
}

function updateCompoundUI(s6) {
    const container = document.getElementById('compoundSummary');
    if (!s6) return;

    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">최종 자산 목표</span>
            <span class="font-black text-emerald-500">${formatVal(s6.finalProjectedWealth / 10000, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">투자 기간</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s6.compoundPeriod}년</span>
        </div>
        <p class="text-[10px] text-slate-400 text-center mt-4">수익 시뮬레이션 완료 ✓</p>
    `;
}

function updateStrategyUI(s5) {
    const titleEl = document.getElementById('strategyTitle');
    const badgeEl = document.getElementById('strategyBadge');
    const legendEl = document.getElementById('targetLegend');

    if (!s5 || !s5.selectedModel) return;

    titleEl.innerText = s5.selectedModel;
    badgeEl.classList.remove('hidden');

    const models = {
        'All Weather': { labels: ['주식', '중기채', '장기채', '금/원자재'], data: [30, 15, 40, 15], colors: ['#3b82f6', '#60a5fa', '#1e40af', '#f59e0b'] },
        '60/40': { labels: ['주식', '채권'], data: [60, 40], colors: ['#3b82f6', '#94a3b8'] },
        'Permanent': { labels: ['주식', '채권', '현금', '금'], data: [25, 25, 25, 25], colors: ['#3b82f6', '#64748b', '#cbd5e1', '#f59e0b'] }
    };

    const config = models[s5.selectedModel] || models['All Weather'];
    renderDonutChart(config);

    legendEl.innerHTML = config.labels.map((l, i) => `
        <div class="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30">
            <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-full" style="background: ${config.colors[i]}"></div>
                <span class="text-sm font-bold text-slate-600 dark:text-slate-400">${l}</span>
            </div>
            <span class="font-black">${config.data[i]}%</span>
        </div>
    `).join('');
}

function renderDonutChart(config) {
    const ctx = document.getElementById('targetChart').getContext('2d');
    if (targetChart) targetChart.destroy();
    targetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: config.labels,
            datasets: [{ data: config.data, backgroundColor: config.colors, borderWidth: 0, hoverOffset: 10 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } }, animation: { animateScale: true } }
    });
}

function calculateWealthSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0, seed = parseFloat(d.initialSeed) || 0, expense = parseFloat(d.monthlyExpense) || 0;
    const growth = (parseFloat(d.salaryGrowth) || 0) / 100, returns = (parseFloat(d.investmentReturn) || 0) / 100, inflation = (parseFloat(d.inflationRate) || 0) / 100;
    let current = seed, curSalary = salary, curExpense = expense;
    for (let i = 1; i <= 10; i++) {
        const surplus = curSalary - (curExpense * 12);
        current = current + surplus + ((current + surplus / 2) * returns);
        curSalary *= (1 + growth); curExpense *= (1 + inflation);
    }
    const realWealth = current / Math.pow(1 + (d.baseCurrency === 'KRW' ? inflation : 0.03), 10);
    let tier = "브론즈", icon = "🥉";
    const val = realWealth / (d.baseCurrency === 'KRW' ? 1 : (1/1350 * 10000));
    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }
    return { tier, icon, rawNominal: current };
}

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + (v / 1000000).toFixed(2) + 'M';
}

async function renderMarketSentiment() {
    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;
        const sentiment = Math.max(5, Math.min(95, 50 + ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 1000)));
        const indicator = document.getElementById('sentimentIndicator');
        if (indicator) indicator.style.left = `${sentiment}%`;
    } catch (e) {}
}
