import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, getStepData } from './core.js';

let targetChart = null;
let growthChart = null;
let globalExchangeRate = 1350;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        document.getElementById('dashUserName').innerText = user.displayName || '투자자';
        document.getElementById('dashUserPhoto').src = user.photoURL || '';
        await initDashboard();
    } else {
        showToast("로그인이 필요합니다.");
        location.href = "index.html";
    }
});

async function initDashboard() {
    // 실시간 환율 우선 확보
    try {
        const res = await fetch('/api/price?ticker=USDKRW=X');
        const data = await res.json();
        const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (rate) globalExchangeRate = rate;
    } catch (e) {}
    
    await refreshDashboard();
}

async function refreshDashboard() {
    try {
        const [s1, s2, s3, s5, s6] = await Promise.all([
            getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6)
        ]);

        updatePersonaUI(s1, s3);
        updateFireUI(s2);
        updateCompoundUI(s6);
        updateStrategyUI(s5);
        renderGrowthChart(s6, s1);
        generateAIComment(s1, s2, s3, s5, s6);
        renderMarketSentiment();

    } catch (e) {
        console.error("Dashboard Error:", e);
        document.getElementById('aiComment').innerText = "데이터 분석 중 오류가 발생했습니다.";
    }
}

function updatePersonaUI(s1, s3) {
    const tierEl = document.getElementById('tierValue');
    const riskEl = document.getElementById('riskValue');
    const savingsEl = document.getElementById('savingsValue');
    const nameEl = document.getElementById('personaName');
    const iconEl = document.getElementById('personaIcon');

    if (s1) {
        const sim = calculateWealthSummary(s1);
        if (tierEl) tierEl.innerText = sim.tier;
        if (iconEl) iconEl.innerText = sim.icon;
        if (nameEl) nameEl.innerText = `${sim.tier} 등급 투자자`;
        
        const monthlySave = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
        if (savingsEl) savingsEl.innerText = formatVal(monthlySave, 'KRW');
    }

    if (s3 && s3.riskType) {
        if (riskEl) riskEl.innerText = s3.riskType;
        const tagsEl = document.getElementById('personaTags');
        if (tagsEl) tagsEl.innerHTML = `<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">${s3.riskType}</span>`;
        if (s1 && nameEl) nameEl.innerText = `${s3.riskType} ${nameEl.innerText}`;
    }
}

function updateFireUI(s2) {
    const container = document.getElementById('fireSummary');
    if (!container) return;
    if (!s2) { container.innerHTML = `<div class="py-6 text-slate-300 text-xs text-center">Step 2 미완료</div>`; return; }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">월 생활비 목표</span>
            <span class="font-black text-blue-600">${formatVal(s2.monthlyExpense, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">목표 수익률</span>
            <span class="font-black">${s2.investmentReturn}%</span>
        </div>
    `;
}

function updateCompoundUI(s6) {
    const container = document.getElementById('compoundSummary');
    if (!container) return;
    if (!s6) { container.innerHTML = `<div class="py-6 text-slate-300 text-xs text-center">Step 6 미완료</div>`; return; }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">최종 자산 목표</span>
            <span class="font-black text-emerald-500">${formatVal(s6.finalProjectedWealth / 10000, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">투자 기간</span>
            <span class="font-black">${s6.compoundPeriod}년</span>
        </div>
    `;
}

function updateStrategyUI(s5) {
    const titleEl = document.getElementById('strategyTitle');
    const legendEl = document.getElementById('targetLegend');
    if (!legendEl) return;

    if (!s5 || !s5.selectedModel) {
        legendEl.innerHTML = `<div class="py-6 text-slate-300 text-xs text-center">전략 미선택</div>`;
        return;
    }

    if (titleEl) titleEl.innerText = s5.selectedModel;
    document.getElementById('strategyBadge')?.classList.remove('hidden');

    const models = {
        'All Weather': { labels: ['주식', '중기채', '장기채', '금/원자재'], data: [30, 15, 40, 15], colors: ['#3b82f6', '#60a5fa', '#1e40af', '#f59e0b'] },
        '60/40': { labels: ['주식', '채권'], data: [60, 40], colors: ['#3b82f6', '#94a3b8'] },
        'Permanent': { labels: ['주식', '채권', '현금', '금'], data: [25, 25, 25, 25], colors: ['#3b82f6', '#64748b', '#cbd5e1', '#f59e0b'] }
    };

    const config = models[s5.selectedModel] || models['All Weather'];
    renderDonutChart(config);

    legendEl.innerHTML = config.labels.map((l, i) => `
        <div class="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30">
            <div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full" style="background: ${config.colors[i]}"></div><span class="text-xs font-bold">${l}</span></div>
            <span class="text-xs font-black">${config.data[i]}%</span>
        </div>
    `).join('');
}

function renderDonutChart(config) {
    const ctx = document.getElementById('targetChart')?.getContext('2d');
    if (!ctx) return;
    if (targetChart) targetChart.destroy();
    targetChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: config.labels, datasets: [{ data: config.data, backgroundColor: config.colors, borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function renderGrowthChart(s6, s1) {
    const ctx = document.getElementById('growthChart')?.getContext('2d');
    if (!ctx) return;
    if (growthChart) growthChart.destroy();

    const period = s6?.compoundPeriod || 10;
    const seed = s1?.initialSeed || 0;
    const rate = s6?.compoundRate / 100 || 0.05;
    const monthly = s6?.monthlySavings || 50;
    
    let current = seed;
    const labels = Array.from({length: period + 1}, (_, i) => `${i}년`);
    const data = [seed];
    for (let i = 1; i <= period; i++) {
        current = current * (1 + rate) + (monthly * 12);
        data.push(Math.round(current));
    }

    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: '#3b82f6',
                borderWidth: 3,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
            }
        }
    });
}

function generateAIComment(s1, s2, s3, s5, s6) {
    const commentEl = document.getElementById('aiComment');
    if (!commentEl) return;

    if (!s1 || !s3 || !s5) {
        commentEl.innerHTML = "<b>분석 대기 중...</b><br>자산 정보, 투자 성향, 전략 선택을 완료하시면 AI 도치의 인사이트가 공개됩니다.";
        return;
    }

    const sim = calculateWealthSummary(s1);
    const savings = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
    
    let msg = `<b>도치의 투자 제언:</b><br>`;
    msg += `현재 <b>${sim.tier}</b> 등급의 자산을 운용 중인 <b>${s3.riskType}</b> 투자자시군요. `;
    
    if (s5.selectedModel === 'All Weather') msg += `선택하신 '올웨더' 전략은 성향과 관계없이 가장 완벽한 자산 방어막입니다. `;
    
    if (savings > 200) msg += `월 ${formatVal(savings, 'KRW')}의 저축액은 경제적 자유를 위한 핵심 동력입니다. `;
    else msg += `현재 월 저축액(${formatVal(savings, 'KRW')})은 목표 달성을 위해 조금 더 늘릴 여지가 있습니다. `;

    if (s6) msg += `<br>예상 자산 <b>${formatVal(s6.finalProjectedWealth / 10000, 'KRW')}</b>을 향해 8단계 실전 투자를 시작해 보세요! 🚀`;

    commentEl.innerHTML = msg;
}

function calculateWealthSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0, seed = parseFloat(d.initialSeed) || 0, expense = parseFloat(d.monthlyExpense) || 0;
    const returns = (parseFloat(d.investmentReturn) || 0) / 100;
    let current = seed;
    for (let i = 1; i <= 10; i++) {
        current = current + (salary - (expense * 12)) + (current * returns);
    }
    const realWealth = current / Math.pow(1 + 0.03, 10);
    const exRate = globalExchangeRate;
    let tier = "브론즈", icon = "🥉";
    const val = realWealth / (d.baseCurrency === 'KRW' ? 1 : (1/exRate * 10000));
    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }
    return { tier, icon };
}

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + Math.round(v).toLocaleString();
}

async function renderMarketSentiment() {
    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const sentiment = Math.max(5, Math.min(95, 50 + ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 1000)));
        const indicator = document.getElementById('sentimentIndicator');
        if (indicator) indicator.style.left = `${sentiment}%`;
    } catch (e) {}
}
