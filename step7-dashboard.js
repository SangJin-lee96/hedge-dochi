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
        // 1. 모든 단계 데이터 병렬 로드
        const [s1, s2, s3, s5, s6] = await Promise.all([
            getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6)
        ]);

        // 2. UI 업데이트
        updatePersonaUI(s1, s3);
        updateFireUI(s2);
        updateCompoundUI(s6);
        updateStrategyUI(s5);
        
        // 3. AI 코멘트 생성 (모든 데이터 로드 후)
        generateAIComment(s1, s2, s3, s5, s6);

    } catch (e) {
        console.error("Dashboard Sync Error:", e);
        document.getElementById('aiComment').innerText = "데이터 분석 중 오류가 발생했습니다. 새로고침을 시도해 주세요.";
    }
}

function updatePersonaUI(s1, s3) {
    const nameEl = document.getElementById('personaName');
    const tierEl = document.getElementById('tierValue');
    const riskEl = document.getElementById('riskValue');
    const savingsEl = document.getElementById('savingsValue');
    const iconEl = document.getElementById('personaIcon');
    const tagsEl = document.getElementById('personaTags');

    if (s1) {
        const sim = calculateWealthSummary(s1);
        if (tierEl) tierEl.innerText = sim.tier;
        if (nameEl) nameEl.innerText = `${sim.tier} 등급 투자자`;
        if (iconEl) iconEl.innerText = sim.icon;
        // 월 평균 저축액 표시
        if (savingsEl) {
            const savings = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
            savingsEl.innerText = formatVal(savings, 'KRW');
        }
    }

    if (s3 && s3.riskType) {
        if (riskEl) riskEl.innerText = s3.riskType;
        if (tagsEl) tagsEl.innerHTML = `<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">${s3.riskType}</span>`;
        if (s1 && nameEl) nameEl.innerText = `${s3.riskType} ${nameEl.innerText}`;
    }
}

function updateFireUI(s2) {
    const container = document.getElementById('fireSummary');
    if (!container) return;
    if (!s2) {
        container.innerHTML = `<a href="step2-fire.html" class="text-blue-500 font-bold">Step 2 설계하기 ➔</a>`;
        return;
    }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">월 생활비 목표</span>
            <span class="font-black text-blue-600">${formatVal(s2.monthlyExpense, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">목표 수익률</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s2.investmentReturn}%</span>
        </div>
    `;
}

function updateCompoundUI(s6) {
    const container = document.getElementById('compoundSummary');
    if (!container) return;
    if (!s6) {
        container.innerHTML = `<a href="step6-simulate.html" class="text-emerald-500 font-bold">Step 6 시뮬레이션 ➔</a>`;
        return;
    }
    container.innerHTML = `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">최종 자산 목표</span>
            <span class="font-black text-emerald-500">${formatVal(s6.finalProjectedWealth / 10000, 'KRW')}</span>
        </div>
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
            <span class="text-xs font-bold text-slate-400 uppercase">투자 기간</span>
            <span class="font-black text-slate-700 dark:text-slate-200">${s6.compoundPeriod}년</span>
        </div>
    `;
}

function updateStrategyUI(s5) {
    const titleEl = document.getElementById('strategyTitle');
    const badgeEl = document.getElementById('strategyBadge');
    const legendEl = document.getElementById('targetLegend');
    if (!legendEl) return;

    if (!s5 || !s5.selectedModel) {
        legendEl.innerHTML = `<a href="step5-models.html" class="text-blue-500 font-bold">Step 5 전략 선택하기 ➔</a>`;
        return;
    }

    if (titleEl) titleEl.innerText = s5.selectedModel;
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
            <div class="flex items-center gap-3"><div class="w-3 h-3 rounded-full" style="background: ${config.colors[i]}"></div><span class="text-sm font-bold text-slate-600 dark:text-slate-400">${l}</span></div>
            <span class="font-black">${config.data[i]}%</span>
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
        commentEl.innerText = "아직 분석 데이터가 부족합니다. 모든 단계를 완료하시면 정교한 AI 투자 인사이트를 제공해 드립니다.";
        return;
    }

    const sim = calculateWealthSummary(s1);
    const savings = s1.monthlySavings || Math.max(0, Math.round((s1.annualSalary / 12) - s1.monthlyExpense));
    
    let message = "";
    
    // 1. 등급 및 성향 분석
    message += `반갑습니다! 분석 결과 당신은 **${sim.tier}** 등급의 **${s3.riskType}** 투자자시군요. `;
    
    // 2. 전략 및 저축 평가
    if (s5.selectedModel === 'All Weather') {
        message += `선택하신 '올웨더' 전략은 ${s3.riskType === '공격투자형' ? '성향에 비해 보수적일 수 있지만' : '매우 현명한 선택이며'}, 어떤 시장 상황에서도 자산을 안전하게 지켜줄 것입니다. `;
    }
    
    // 3. 저축 및 목표 조언
    if (savings > 200) {
        message += `월 ${formatVal(savings, 'KRW')}의 저축액은 매우 훌륭합니다! 이 추세라면 `;
    } else {
        message += `현재 월 저축액(${formatVal(savings, 'KRW')})은 목표 달성을 위해 조금 더 늘릴 필요가 있어 보입니다. `;
    }

    if (s6) {
        const targetWealth = s6.finalProjectedWealth / 10000;
        message += `설정하신 ${formatVal(targetWealth, 'KRW')} 자산 목표는 충분히 달성 가능한 범위에 있습니다. `;
    }

    message += `이제 8단계에서 실제 포트폴리오를 구축해 봅시다! 🚀`;
    
    commentEl.innerHTML = message;
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
    return { tier, icon };
}

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + Math.round(v).toLocaleString();
}
