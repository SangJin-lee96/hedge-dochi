import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, getStepData } from './core.js';

let targetChart = null;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        const nameEl = document.getElementById('dashUserName');
        const photoEl = document.getElementById('dashUserPhoto');
        if (nameEl) nameEl.innerText = user.displayName || '투자자';
        if (photoEl) photoEl.src = user.photoURL || '';
        await refreshDashboard();
    } else {
        showToast("로그인이 필요합니다.");
        location.href = "index.html";
    }
});

async function refreshDashboard() {
    try {
        const [s1, s2, s3, s5, s6] = await Promise.all([
            getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6)
        ]);

        updatePersonaUI(s1, s3);
        updateFireUI(s2);
        updateCompoundUI(s6);
        updateStrategyUI(s5);
        
        generateAIComment(s1, s2, s3, s5, s6);
    } catch (e) {
        console.error("Dashboard Sync Error:", e);
        const aiEl = document.getElementById('aiComment');
        if (aiEl) aiEl.innerText = "데이터 로드 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    }
}

function updatePersonaUI(s1, s3) {
    const nameEl = document.getElementById('personaName');
    const tierEl = document.getElementById('tierValue');
    const riskEl = document.getElementById('riskValue');
    const savingsEl = document.getElementById('savingsValue');
    const iconEl = document.getElementById('personaIcon');

    if (s1) {
        const sim = calculateWealthSummary(s1);
        if (tierEl) tierEl.innerText = sim.tier;
        if (nameEl) nameEl.innerText = `${sim.tier} 등급 투자자`;
        if (iconEl) iconEl.innerText = sim.icon;
        
        // 월 평균 저축액 (저장된 값 우선, 없으면 계산)
        if (savingsEl) {
            const savings = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
            savingsEl.innerText = formatVal(savings, 'KRW');
        }
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
    if (!s2) { container.innerHTML = `<div class="text-center py-6 text-slate-300 text-xs">설계 데이터 없음</div>`; return; }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">월 생활비 목표</span>
            <span class="font-black text-blue-600">${formatVal(s2.monthlyExpense, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">목표 수익률</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s2.investmentReturn}%</span>
        </div>
    `;
}

function updateCompoundUI(s6) {
    const container = document.getElementById('compoundSummary');
    if (!container) return;
    if (!s6) { container.innerHTML = `<div class="text-center py-6 text-slate-300 text-xs">시뮬레이션 데이터 없음</div>`; return; }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">최종 자산 목표</span>
            <span class="font-black text-emerald-500">${formatVal(s6.finalProjectedWealth, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mt-3">
            <span class="text-xs font-bold text-slate-400 uppercase">투자 기간</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s6.compoundPeriod}년</span>
        </div>
    `;
}

function updateStrategyUI(s5) {
    const titleEl = document.getElementById('strategyTitle');
    const legendEl = document.getElementById('targetLegend');
    if (!s5 || !s5.selectedModel || !legendEl) return;

    if (titleEl) titleEl.innerText = s5.selectedModel;
    const badgeEl = document.getElementById('strategyBadge');
    if (badgeEl) badgeEl.classList.remove('hidden');

    const models = {
        'All Weather': { labels: ['주식', '중기채', '장기채', '금/원자재'], data: [30, 15, 40, 15], colors: ['#3b82f6', '#60a5fa', '#1e40af', '#f59e0b'] },
        '60/40': { labels: ['주식', '채권'], data: [60, 40], colors: ['#3b82f6', '#94a3b8'] },
        'Permanent': { labels: ['주식', '채권', '현금', '금'], data: [25, 25, 25, 25], colors: ['#3b82f6', '#64748b', '#cbd5e1', '#f59e0b'] }
    };

    const config = models[s5.selectedModel] || models['All Weather'];
    renderDonutChart(config);

    legendEl.innerHTML = config.labels.map((l, i) => `
        <div class="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30">
            <div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full" style="background: ${config.colors[i]}"></div><span class="text-xs font-bold text-slate-600 dark:text-slate-400">${l}</span></div>
            <span class="text-xs font-black">${config.data[i]}%</span>
        </div>
    `).join('');
}

function renderDonutChart(config) {
    const ctxEl = document.getElementById('targetChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    if (targetChart) targetChart.destroy();
    targetChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: config.labels, datasets: [{ data: config.data, backgroundColor: config.colors, borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function generateAIComment(s1, s2, s3, s5, s6) {
    const commentEl = document.getElementById('aiComment');
    if (!commentEl) return;

    if (!s1 || !s3 || !s5) {
        commentEl.innerHTML = "<b>분석 데이터가 부족합니다.</b><br>자산 등급, 투자 성향, 투자 전략 선택을 모두 완료하시면 정교한 AI 투자 인사이트를 제공해 드립니다.";
        return;
    }

    const sim = calculateWealthSummary(s1);
    const savings = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
    
    let message = `<b>${currentUser.displayName || '투자자'}님을 위한 도치 분석:</b><br>`;
    message += `현재 당신은 **${sim.tier}** 등급의 자산을 보유한 **${s3.riskType}** 투자자입니다. `;
    
    if (s5.selectedModel === 'All Weather') {
        message += `선택하신 '올웨더' 전략은 성향과 관계없이 가장 완벽한 방어막이 될 것입니다. `;
    }
    
    if (savings > 200) {
        message += `월 ${formatVal(savings, 'KRW')}의 저축 규모는 매우 이상적입니다. `;
    } else {
        message += `현재 월 저축액(${formatVal(savings, 'KRW')})은 목표 달성을 위해 조금 더 관리할 여지가 있습니다. `;
    }

    if (s6) {
        message += `시뮬레이션된 **${formatVal(s6.finalProjectedWealth, 'KRW')}** 자산 목표는 꾸준한 리밸런싱을 통해 현실이 될 수 있습니다. 8단계로 넘어가 실전 구축을 시작해 보세요! 🚀`;
    }

    commentEl.innerHTML = message;
}

function calculateWealthSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0, seed = parseFloat(d.initialSeed) || 0, expense = parseFloat(d.monthlyExpense) || 0;
    const growth = (parseFloat(d.salaryGrowth) || 0) / 100, returns = (parseFloat(d.investmentReturn) || 0) / 100, inflation = (parseFloat(d.inflationRate) || 0) / 100;
    let current = seed, curSalary = salary, curExpense = expense;
    for (let i = 1; i <= 10; i++) {
        const annualSavings = (curSalary - (curExpense * 12));
        current = current + annualSavings + (current * returns);
        curSalary *= (1 + (growth/2)); curExpense *= (1 + (inflation/2));
    }
    const realWealth = current / Math.pow(1 + 0.03, 10);
    const exRate = d.liveExchangeRate || 1350;
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
