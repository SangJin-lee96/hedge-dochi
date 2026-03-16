import { db, currentUser, getStepData, saveProgress, exchangeRate as coreExchangeRate } from './core.js';

let auditChart = null;
let currentAssets = []; // Rebalancing simulation state
let baseCurrency = 'USD';

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        document.getElementById('userName').innerText = user.displayName || '투자자';
        document.getElementById('userPhoto').src = user.photoURL || '';
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString();
        
        await saveProgress(9, { completedAt: new Date() }, true);
        await generateComprehensiveReport();
    } else {
        location.href = 'index.html';
    }
});

async function generateComprehensiveReport() {
    const [s1, s2, s3, s5, s6, s8] = await Promise.all([
        getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6), getStepData(8)
    ]);

    baseCurrency = s8?.baseCurrency || 'USD';
    const reportData = analyzeAllData(s1, s2, s3, s5, s6, s8);

    renderExecutiveSummary(reportData);
    renderAssetAudit(reportData, s5?.selectedModel);
    
    // Initial Asset State for Simulation
    currentAssets = reportData.processedAssets.map(a => ({
        ...a,
        locked: false,
        targetWeight: parseFloat(a.targetWeight)
    }));
    
    renderRebalanceTable();
    renderRecommendations(reportData);
    document.getElementById('totalHealthScore').innerText = reportData.healthScore;
}

function analyzeAllData(s1, s2, s3, s5, s6, s8) {
    const analysis = {
        healthScore: 0,
        metrics: { savings: 0, balance: 0, risk: 100, diversity: 0 },
        recommendations: [],
        categories: { stock: 0, bond: 0, gold: 0, cash: 0 },
        processedAssets: []
    };

    if (s1 && s6) {
        const currentSavings = s1.monthlySavings || 0;
        const targetSavings = s6.monthlySavings || currentSavings;
        document.getElementById('currentSavingsText').innerText = formatVal(currentSavings, 'KRW');
        analysis.metrics.savings = targetSavings > 0 ? Math.min(100, Math.round((currentSavings / targetSavings) * 100)) : 100;
        const velocity = analysis.metrics.savings;
        document.getElementById('velocityBar').style.width = `${velocity}%`;
        if (velocity < 100) {
            const gap = targetSavings - currentSavings;
            document.getElementById('velocityFeedback').innerText = `월 ${formatVal(gap, 'KRW')} 추가 저축 권장`;
            analysis.recommendations.push({ title: "저축 속도 보완 필요", desc: "목표 달성을 위해 저축액 증액이 필요합니다.", icon: "💰" });
        }
    }

    if (s8 && s8.assets) {
        let totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
        const categoriesFound = new Set();
        s8.assets.forEach(a => {
            const cat = classifyTicker(a.ticker);
            if (a.qty * a.price > 0) categoriesFound.add(cat);
            const weight = totalVal > 0 ? (a.qty * a.price / totalVal) * 100 : 0;
            analysis.categories[cat] += weight;
            const targetVal = totalVal * (a.targetWeight / 100);
            const diffVal = targetVal - (a.qty * a.price);
            const diffQty = (diffVal / a.price).toFixed(2);
            analysis.processedAssets.push({ ...a, diffQty, diffVal, currentWeight: weight.toFixed(1) });
        });
        const deviance = analysis.processedAssets.reduce((sum, a) => sum + Math.abs(parseFloat(a.currentWeight) - a.targetWeight), 0);
        analysis.metrics.balance = Math.max(0, 100 - Math.round(deviance));
        analysis.metrics.diversity = Math.round((categoriesFound.size / 4) * 100);
    }

    analysis.healthScore = Math.round((analysis.metrics.savings * 0.3) + (analysis.metrics.balance * 0.4) + (analysis.metrics.risk * 0.2) + (analysis.metrics.diversity * 0.1));
    return analysis;
}

// --- Interactive Rebalancing Simulation ---

window.updateSimWeight = function(index, newVal) {
    const val = parseFloat(newVal) || 0;
    currentAssets[index].targetWeight = val;
    currentAssets[index].locked = true; // 유저가 수정한 것은 자동 잠금
    
    distributeRemainingWeight(index);
    renderRebalanceTable();
};

window.toggleLock = function(index) {
    currentAssets[index].locked = !currentAssets[index].locked;
    renderRebalanceTable();
};

function distributeRemainingWeight(changedIndex) {
    const lockedAssets = currentAssets.filter((a, idx) => a.locked);
    const unlockedAssets = currentAssets.filter((a, idx) => !a.locked);
    
    const sumLocked = lockedAssets.reduce((sum, a) => sum + a.targetWeight, 0);
    
    if (sumLocked > 100) {
        // 100% 초과 시 현재 입력값을 깎음
        currentAssets[changedIndex].targetWeight -= (sumLocked - 100);
        return distributeRemainingWeight(changedIndex);
    }

    if (unlockedAssets.length > 0) {
        const remaining = 100 - sumLocked;
        const perAsset = remaining / unlockedAssets.length;
        currentAssets.forEach(a => {
            if (!a.locked) a.targetWeight = parseFloat(perAsset.toFixed(1));
        });
    }
}

function renderRebalanceTable() {
    const tbody = document.getElementById('rebalanceTableBody');
    if (!tbody) return;

    let totalSimWeight = 0;
    const totalPortfolioVal = currentAssets.reduce((sum, a) => sum + (a.qty * a.price), 0);

    tbody.innerHTML = currentAssets.map((a, i) => {
        totalSimWeight += a.targetWeight;
        
        // 실시간 매매 수량 재계산
        const targetVal = totalPortfolioVal * (a.targetWeight / 100);
        const currentVal = a.qty * a.price;
        const diffVal = targetVal - currentVal;
        const diffQty = (diffVal / a.price).toFixed(2);

        return `
            <tr class="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="py-6 px-2"><p class="font-black">${a.ticker}</p><p class="text-[10px] text-slate-400">${classifyTicker(a.ticker).toUpperCase()}</p></td>
                <td class="py-6 px-2 font-bold">${a.currentWeight}%</td>
                <td class="py-6 px-2">
                    <input type="number" value="${a.targetWeight}" 
                        onchange="window.updateSimWeight(${i}, this.value)" 
                        class="weight-input" step="0.5" min="0" max="100">%
                </td>
                <td class="py-6 px-2">
                    <button onclick="window.toggleLock(${i})" class="lock-btn ${a.locked ? 'active' : ''} text-lg">
                        ${a.locked ? '🔒' : '🔓'}
                    </button>
                </td>
                <td class="py-6 px-2 text-right">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black ${parseFloat(diffQty) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                        ${parseFloat(diffQty) > 0 ? '매수' : '매도'} ${Math.abs(diffQty)}주
                    </span>
                    <p class="text-[10px] text-slate-400 mt-1">약 ${formatVal(Math.abs(diffVal), baseCurrency)}</p>
                </td>
            </tr>
        `;
    }).join('');

    const totalEl = document.getElementById('totalWeightDisplay');
    if (totalEl) {
        totalEl.innerText = `${Math.round(totalSimWeight)}%`;
        totalEl.className = Math.round(totalSimWeight) === 100 ? "font-black text-emerald-500" : "font-black text-red-500";
    }
}

// --- Helper Functions ---

function classifyTicker(ticker) {
    const t = ticker.toUpperCase();
    if (['GLD', 'IAU', 'IAUM', 'BAR', 'DBC', 'GSG', 'PDBC'].includes(t)) return 'gold';
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'EDV', 'TIP'].includes(t)) return 'bond';
    if (['CASH', 'USDT', 'KRW', 'USD'].includes(t)) return 'cash';
    return 'stock';
}

function renderExecutiveSummary(data) {
    const el = document.getElementById('advisorVerdict');
    let msg = data.healthScore >= 80 ? "당신의 포트폴리오는 매우 견고합니다." : data.healthScore >= 60 ? "일부 지표 보완을 권고합니다." : "포트폴리오 재정비가 시급합니다.";
    el.innerHTML = msg;
}

function renderAssetAudit(analysis, strategyName) {
    document.getElementById('selectedStrategyTag').innerText = `Strategy: ${strategyName || 'Custom'}`;
    const ctx = document.getElementById('auditChart')?.getContext('2d');
    const cats = analysis.categories;
    if (auditChart) auditChart.destroy();
    auditChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['주식', '채권', '금/원자재', '현금'], datasets: [{ data: [cats.stock, cats.bond, cats.gold, cats.cash], backgroundColor: ['#3b82f6', '#64748b', '#f59e0b', '#cbd5e1'], borderWidth: 0 }] },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });
    document.getElementById('balancePercent').innerText = `${analysis.healthScore}%`;
    const listEl = document.getElementById('auditList');
    const catNames = { stock: '주식/성장주', bond: '국채/안전채권', gold: '금/대체자산', cash: '현금/유동성' };
    listEl.innerHTML = Object.keys(catNames).map(key => {
        const val = Math.round(analysis.categories[key] || 0);
        return `<div class="space-y-2"><div class="flex justify-between text-[10px] font-black uppercase"><span class="text-slate-500">${catNames[key]}</span><span>${val}%</span></div><div class="audit-bar"><div class="audit-progress" style="width: ${val}%; background: ${getCatColor(key)}"></div></div></div>`;
    }).join('');
}

function getCatColor(key) { return { stock: '#3b82f6', bond: '#64748b', gold: '#f59e0b', cash: '#cbd5e1' }[key] || '#eee'; }

function renderRecommendations(reportData) {
    const el = document.getElementById('recommendationList');
    const m = reportData.metrics;
    const getStatusColor = (score) => score >= 80 ? 'text-emerald-500 bg-emerald-500/10' : score >= 60 ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-500/10';
    const auditStatus = `<div class="col-span-2 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">${Object.entries({ '저축 체력': m.savings, '전략 일치도': m.balance, '성향 적합도': m.risk, '자산 다양성': m.diversity }).map(([k, v]) => `<div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center ${getStatusColor(v)}"><p class="text-[9px] font-black uppercase mb-1">${k}</p><p class="text-xl font-black">${v}%</p></div>`).join('')}</div>`;
    el.innerHTML = auditStatus + reportData.recommendations.map(r => `<div class="flex gap-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50"><div><h4 class="font-black text-sm mb-1">${r.title}</h4><p class="text-xs text-slate-500">${r.desc}</p></div></div>`).join('');
}

function formatVal(v, curr = 'KRW') {
    if (curr === 'KRW') {
        if (v >= 10000) return (v / 10000).toFixed(1) + '억 원';
        return Math.round(v).toLocaleString() + '만 원';
    }
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2 });
}
