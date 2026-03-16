import { db, currentUser, getStepData, saveProgress, exchangeRate as coreExchangeRate, showToast } from './core.js';

let auditChart = null;
let currentAssets = []; 
let baseCurrency = 'USD';

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        const nameEl = document.getElementById('userName');
        const photoEl = document.getElementById('userPhoto');
        const dateEl = document.getElementById('currentDate');

        if (nameEl) nameEl.innerText = user.displayName || '투자자';
        if (photoEl) photoEl.src = user.photoURL || '';
        if (dateEl) dateEl.innerText = new Date().toLocaleDateString();
        
        await generateComprehensiveReport();
    } else {
        location.href = 'index.html';
    }
});

async function generateComprehensiveReport() {
    console.log("[MasterPlan] Starting report generation...");
    const [s1, s2, s3, s5, s6, s8] = await Promise.all([
        getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6), getStepData(8)
    ]);

    baseCurrency = s8?.baseCurrency || 'USD';
    const reportData = analyzeAllData(s1, s2, s3, s5, s6, s8);

    renderExecutiveSummary(reportData, s1, s3, s5, s6);
    renderAssetAudit(reportData, s5?.selectedModel);
    
    currentAssets = (reportData.processedAssets || []).map(a => ({
        ...a,
        locked: false,
        targetWeight: parseFloat(a.targetWeight) || 0
    }));
    
    renderRebalanceTable();
    renderRecommendations(reportData);
    
    const healthEl = document.getElementById('totalHealthScore');
    if (healthEl) healthEl.innerText = reportData.healthScore;
}

function analyzeAllData(s1, s2, s3, s5, s6, s8) {
    const analysis = {
        healthScore: 0,
        metrics: { savings: 0, balance: 0, risk: 100, diversity: 0 },
        recommendations: [],
        categories: { stock: 0, bond: 0, gold: 0, cash: 0 },
        processedAssets: []
    };

    // 1. Savings Logic
    if (s1 && s6) {
        const actualSavings = s1.monthlySavings || 0;
        const targetSavings = s6.monthlySavings || actualSavings;
        const savingsTextEl = document.getElementById('currentSavingsText');
        const projectedWealthEl = document.getElementById('projectedWealthSmall');
        
        if (savingsTextEl) savingsTextEl.innerText = formatVal(actualSavings, 'KRW');
        if (projectedWealthEl) projectedWealthEl.innerText = formatVal(s6.finalProjectedWealth || 0, 'KRW');
        
        const velocity = targetSavings > 0 ? Math.min(100, Math.round((actualSavings / targetSavings) * 100)) : 100;
        analysis.metrics.savings = velocity;
        
        const velocityBar = document.getElementById('velocityBar');
        const velocityFeedback = document.getElementById('velocityFeedback');
        if (velocityBar) velocityBar.style.width = `${velocity}%`;
        if (velocityFeedback) {
            velocityFeedback.innerText = velocity >= 100 ? "목표를 상회하는 자산 가속도가 붙고 있습니다." : `월 ${formatVal(targetSavings - actualSavings, 'KRW')} 추가 저축 시 목표 달성 가능`;
        }
    }

    // 2. Asset Logic
    if (s8 && s8.assets) {
        let totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
        const categoriesFound = new Set();
        
        s8.assets.forEach(a => {
            const cat = classifyTicker(a.ticker);
            if (a.qty * a.price > 0) categoriesFound.add(cat);
            const weight = totalVal > 0 ? (a.qty * a.price / totalVal) * 100 : 0;
            analysis.categories[cat] += weight;
            
            const targetWeight = parseFloat(a.targetWeight) || 0;
            const targetVal = totalVal * (targetWeight / 100);
            const diffVal = targetVal - (a.qty * a.price);
            const diffQty = (diffVal / a.price).toFixed(2);
            analysis.processedAssets.push({ ...a, diffQty, diffVal, currentWeight: weight.toFixed(1), targetWeight });
        });

        const deviance = analysis.processedAssets.reduce((sum, a) => sum + Math.abs(parseFloat(a.currentWeight) - a.targetWeight), 0);
        analysis.metrics.balance = Math.max(0, 100 - Math.round(deviance));
        analysis.metrics.diversity = Math.round((categoriesFound.size / 4) * 100);
    }

    analysis.healthScore = Math.round((analysis.metrics.savings * 0.3) + (analysis.metrics.balance * 0.4) + (analysis.metrics.risk * 0.2) + (analysis.metrics.diversity * 0.1));
    return analysis;
}

function renderExecutiveSummary(report, s1, s3, s5, s6) {
    const el = document.getElementById('advisorVerdict');
    if (!el) return;
    if (!s1 || !s3 || !s5) {
        el.innerHTML = `<p class='text-slate-500'>데이터를 분석하기 위해 모든 단계를 완료해 주세요.</p>`;
        return;
    }

    el.innerHTML = `
        <div class="space-y-6 text-slate-700 dark:text-slate-300">
            <p class="text-lg font-bold">도치의 종합 평어: "당신은 현재 <span class="text-blue-600">${s1.tier || '브론즈'}</span> 등급의 자산을 운용 중인 <span class="text-blue-600">${s3.riskType || '미진단'}</span> 투자자입니다."</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div class="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h4 class="font-black text-xs uppercase text-slate-400 mb-3">📍 현금 흐름 분석</h4>
                    <p class="text-sm font-medium">${report.metrics.savings >= 90 ? '저축 체력이 우수합니다. 현재의 수입-지출 구조를 유지하세요.' : '저축 체력이 목표 대비 낮습니다. 고정비 절감이 절실합니다.'}</p>
                </div>
                <div class="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h4 class="font-black text-xs uppercase text-slate-400 mb-3">📍 포트폴리오 전략</h4>
                    <p class="text-sm font-medium">${report.metrics.balance >= 80 ? '선택하신 전략에 맞게 자산이 잘 배분되어 있습니다.' : '목표 비중과 실제 자산의 괴리가 커 조정이 필요합니다.'}</p>
                </div>
            </div>
        </div>
    `;
}

function renderAssetAudit(analysis, strategyName) {
    const strategyTag = document.getElementById('selectedStrategyTag');
    if (strategyTag) strategyTag.innerText = `Strategy: ${strategyName || 'Custom'}`;
    
    const ctx = document.getElementById('auditChart')?.getContext('2d');
    if (ctx) {
        const cats = analysis.categories;
        if (auditChart) auditChart.destroy();
        auditChart = new Chart(ctx, { 
            type: 'doughnut', 
            data: { labels: ['주식', '채권', '금', '현금'], datasets: [{ data: [cats.stock, cats.bond, cats.gold, cats.cash], backgroundColor: ['#3b82f6', '#64748b', '#f59e0b', '#cbd5e1'], borderWidth: 0 }] }, 
            options: { cutout: '85%', plugins: { legend: { display: false } } } 
        });
    }

    const balanceEl = document.getElementById('balancePercent');
    if (balanceEl) balanceEl.innerText = `${analysis.healthScore}%`;

    const listEl = document.getElementById('auditList');
    if (listEl) {
        const catNames = { stock: '주식/성장주', bond: '국채/안전채권', gold: '금/대체자산', cash: '현금/유동성' };
        listEl.innerHTML = Object.keys(catNames).map(key => {
            const val = Math.round(analysis.categories[key] || 0);
            return `
                <div class="space-y-2">
                    <div class="flex justify-between text-[10px] font-black uppercase"><span class="text-slate-500">${catNames[key]}</span><span>${val}%</span></div>
                    <div class="audit-bar"><div class="audit-progress" style="width: ${val}%; background: ${getCatColor(key)}"></div></div>
                </div>
            `;
        }).join('');
    }
}

function getCatColor(key) { return { stock: '#3b82f6', bond: '#64748b', gold: '#f59e0b', cash: '#cbd5e1' }[key] || '#eee'; }

window.updateSimWeight = function(index, newVal) {
    const val = parseFloat(newVal) || 0;
    currentAssets[index].targetWeight = val;
    currentAssets[index].locked = true; 
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
    if (sumLocked > 100) { currentAssets[changedIndex].targetWeight -= (sumLocked - 100); return distributeRemainingWeight(changedIndex); }
    if (unlockedAssets.length > 0) {
        const remaining = 100 - sumLocked;
        const perAsset = remaining / unlockedAssets.length;
        currentAssets.forEach(a => { if (!a.locked) a.targetWeight = parseFloat(perAsset.toFixed(1)); });
    }
}

function renderRebalanceTable() {
    const tbody = document.getElementById('rebalanceTableBody');
    if (!tbody) return;
    let totalSimWeight = 0;
    const totalVal = currentAssets.reduce((sum, a) => sum + (a.qty * a.price), 0);

    tbody.innerHTML = currentAssets.map((a, i) => {
        totalSimWeight += a.targetWeight;
        const targetV = totalVal * (a.targetWeight / 100);
        const diffV = targetV - (a.qty * a.price);
        const diffQ = (diffV / a.price).toFixed(2);
        return `
            <tr class="border-b dark:border-slate-800/50">
                <td class="py-6 px-2"><p class="font-black">${a.ticker}</p></td>
                <td class="py-6 px-2 font-bold">${a.currentWeight}%</td>
                <td class="py-6 px-2"><input type="number" value="${a.targetWeight}" onchange="window.updateSimWeight(${i}, this.value)" class="weight-input" step="0.5" min="0" max="100">%</td>
                <td class="py-6 px-2 text-center"><button onclick="window.toggleLock(${i})" class="lock-btn ${a.locked ? 'active' : ''}">${a.locked ? '🔒' : '🔓'}</button></td>
                <td class="py-6 px-2 text-right">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black ${parseFloat(diffQ) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">${parseFloat(diffQ) > 0 ? '매수' : '매도'} ${Math.abs(diffQ)}주</span>
                    <p class="text-[10px] text-slate-400 mt-1">약 ${formatVal(Math.abs(diffV), baseCurrency)}</p>
                </td>
            </tr>
        `;
    }).join('');

    const totalEl = document.getElementById('totalWeightDisplay');
    if (totalEl) {
        totalEl.innerText = `${Math.round(totalSimWeight)}%`;
        totalEl.className = Math.round(totalSimWeight) === 100 ? "text-xl font-black text-emerald-500" : "text-xl font-black text-red-500";
    }
}

window.saveSimulatedStrategy = async function() {
    const btn = document.getElementById('btn-save-strategy');
    if (btn) { btn.disabled = true; btn.innerText = "저장 중..."; }
    try {
        const payload = { assets: currentAssets.map(a => ({ ticker: a.ticker, qty: a.qty, price: a.price, targetWeight: a.targetWeight })), lastUpdated: new Date() };
        await saveProgress(8, payload, true);
        showToast("나의 커스텀 전략이 저장되었습니다.", "success");
    } catch (e) { showToast("저장 오류 발생"); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "이 비중으로 나의 전략 확정 및 저장 💾"; } }
};

function renderRecommendations(data) {
    const el = document.getElementById('recommendationList');
    if (!el) return;
    const m = data.metrics;
    const auditStatus = `<div class="col-span-2 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">${Object.entries({ '저축 체력': m.savings, '전략 일치도': m.balance, '성향 적합도': m.risk, '자산 다양성': m.diversity }).map(([k, v]) => `<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center"><p class="text-[9px] font-black text-slate-400 uppercase mb-1">${k}</p><p class="text-xl font-black ${v >= 80 ? 'text-emerald-500' : v >= 60 ? 'text-amber-500' : 'text-red-500'}">${v}%</p></div>`).join('')}</div>`;
    el.innerHTML = auditStatus + data.recommendations.map(r => `<div class="flex gap-4 p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm"><div><h4 class="font-black text-sm mb-1">${r.title}</h4><p class="text-xs text-slate-500">${r.desc}</p></div></div>`).join('');
}

function classifyTicker(ticker) {
    const t = ticker.toUpperCase();
    if (['GLD', 'IAU', 'IAUM', 'BAR', 'DBC', 'GSG', 'PDBC'].includes(t)) return 'gold';
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'EDV', 'TIP'].includes(t)) return 'bond';
    if (['CASH', 'USDT', 'KRW', 'USD'].includes(t)) return 'cash';
    return 'stock';
}

function formatVal(v, curr = 'KRW') {
    if (curr === 'KRW') {
        if (v >= 10000) return (v / 10000).toFixed(1) + '억 원';
        return Math.round(v).toLocaleString() + '만 원';
    }
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-save-strategy')?.addEventListener('click', window.saveSimulatedStrategy);
});
