import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, getStepData, exchangeRate as coreExchangeRate } from './core.js';

let targetChart = null;
let growthChart = null;
let globalExchangeRate = 1350;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    globalExchangeRate = e.detail.exchangeRate || coreExchangeRate;
    
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
    console.log("[Dashboard] Refreshing data...");
    try {
        const [s1, s2, s3, s5, s6] = await Promise.all([
            getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6)
        ]);

        console.log("[Dashboard] Fetched Step 1:", s1);
        console.log("[Dashboard] Fetched Step 3:", s3);

        updatePersonaUI(s1, s3);
        updateFireUI(s2);
        updateCompoundUI(s6);
        updateStrategyUI(s5);
        renderGrowthChart(s6, s1);
        generateAIComment(s1, s2, s3, s5, s6);
        renderMarketSentiment();

    } catch (e) {
        console.error("Dashboard Error:", e);
    }
}

function updatePersonaUI(s1, s3) {
    const tierEl = document.getElementById('tierValue');
    const iconEl = document.getElementById('personaIcon');
    const nameEl = document.getElementById('personaName');
    const riskEl = document.getElementById('riskValue');
    const savingsEl = document.getElementById('savingsValue');

    if (s1) {
        // Step 1에 저장된 등급이 있으면 그대로 사용
        const tier = s1.tier || calculateTierFallback(s1);
        const icon = getTierIcon(tier);
        
        console.log(`[Dashboard] Applying Tier: ${tier}`);
        
        if (tierEl) tierEl.innerText = tier;
        if (iconEl) iconEl.innerText = icon;
        if (nameEl) nameEl.innerText = `${tier} 등급 투자자`;
        
        const monthlySave = s1.monthlySavings || 0;
        if (savingsEl) savingsEl.innerText = formatVal(monthlySave, 'KRW');
    }

    if (s3 && s3.riskType) {
        if (riskEl) riskEl.innerText = s3.riskType;
        const tagsEl = document.getElementById('personaTags');
        if (tagsEl) tagsEl.innerHTML = `<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">${s3.riskType}</span>`;
        if (s1 && nameEl) nameEl.innerText = `${s3.riskType} ${nameEl.innerText}`;
    }
}

function getTierIcon(tier) {
    const icons = { "다이아몬드": "💎", "플래티넘": "💍", "골드": "🥇", "실버": "🥈", "브론즈": "🥉" };
    return icons[tier] || "🥉";
}

// 만약 Tier 데이터가 없을 경우를 대비한 최소한의 계산 로직 (Step 1과 동일 기준)
function calculateTierFallback(s1) {
    const realWealth = s1.finalRealWealth || 0;
    const val = realWealth / (s1.baseCurrency === 'KRW' ? 1 : (1/globalExchangeRate * 10000));
    if (val >= 200000) return "다이아몬드";
    if (val >= 100000) return "플래티넘";
    if (val >= 50000) return "골드";
    if (val >= 20000) return "실버";
    return "브론즈";
}

function updateFireUI(s2) {
    const container = document.getElementById('fireSummary');
    if (!container || !s2) return;
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">월 생활비 목표</span>
            <span class="font-black text-blue-600">${formatVal(s2.monthlyExpense, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">목표 수익률</span>
            <span class="font-black">${s2.investmentReturn || 0}%</span>
        </div>
    `;
}

function updateCompoundUI(s6) {
    const container = document.getElementById('compoundSummary');
    if (!container || !s6) return;
    const finalWealth = s6.finalProjectedWealth || 0;
    const principal = s6.totalPrincipal || s6.compoundSeed || 0;
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">최종 자산 목표</span>
            <span class="font-black text-emerald-500">${formatVal(finalWealth, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">총 투입 원금</span>
            <span class="font-black text-slate-600 dark:text-slate-300">${formatVal(principal, 'KRW')}</span>
        </div>
    `;
}

function updateStrategyUI(s5) {
    const legendEl = document.getElementById('targetLegend');
    if (!legendEl || !s5 || !s5.selectedModel) return;
    document.getElementById('strategyTitle').innerText = s5.selectedModel;
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
    if (!ctx || !s6) return;
    if (growthChart) growthChart.destroy();
    const period = s6.compoundPeriod || 10, seed = s1?.initialSeed || 0, rate = s6.compoundRate / 100 || 0.05, monthly = s6.monthlySavings || 50;
    let current = seed;
    const labels = Array.from({length: period + 1}, (_, i) => `${i}년`), data = [seed];
    for (let i = 1; i <= period; i++) { current = current * (1 + rate) + (monthly * 12); data.push(Math.round(current)); }
    growthChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ data: data, borderColor: '#3b82f6', borderWidth: 3, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.05)', tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } } }
    });
}

function generateAIComment(s1, s2, s3, s5, s6) {
    const commentEl = document.getElementById('aiComment');
    if (!commentEl || !s1 || !s3 || !s5) return;
    const tier = s1.tier || "브론즈";
    const savings = s1.monthlySavings || 0;
    let msg = `<b>AI 도치의 진단:</b><br>당신은 <b>${tier}</b> 등급의 자산을 운용 중인 <b>${s3.riskType}</b> 투자자입니다. `;
    msg += s5.selectedModel === 'All Weather' ? `'올웨더' 전략은 어떤 시장 상황에서도 당신을 보호할 것입니다. ` : `선택하신 전략을 통해 목표를 향해 꾸준히 나아가세요. `;
    if (s6) msg += `<br>10년 후 예상 자산 <b>${formatVal(s6.finalProjectedWealth, 'KRW')}</b> 달성을 위해 오늘부터 포트폴리오를 관리해 보세요! 🚀`;
    commentEl.innerHTML = msg;
}

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만 원';
    return '$' + Math.round(v).toLocaleString();
}

async function renderMarketSentiment() {
    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta) {
            const sentiment = Math.max(5, Math.min(95, 50 + ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 1000)));
            const indicator = document.getElementById('sentimentIndicator');
            if (indicator) indicator.style.left = `${sentiment}%`;
        }
    } catch (e) {}
}
