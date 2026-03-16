import { db, currentUser, getStepData, exchangeRate as coreExchangeRate } from './core.js';

let auditChart = null;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        document.getElementById('userName').innerText = user.displayName || '투자자';
        document.getElementById('userPhoto').src = user.photoURL || '';
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString();
        await generateComprehensiveReport();
    } else {
        location.href = 'index.html';
    }
});

async function generateComprehensiveReport() {
    const [s1, s2, s3, s5, s6, s8] = await Promise.all([
        getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6), getStepData(8)
    ]);

    const reportData = analyzeAllData(s1, s2, s3, s5, s6, s8);

    // 1. Executive Summary & Velocity
    renderExecutiveSummary(reportData);
    
    // 2. Asset Allocation Audit
    renderAssetAudit(reportData, s5?.selectedModel);
    
    // 3. Rebalancing Table
    renderRebalanceTable(reportData.processedAssets, s8?.baseCurrency);
    
    // 4. Recommendations
    renderRecommendations(reportData.recommendations);

    // 5. Total Health Score
    document.getElementById('totalHealthScore').innerText = reportData.healthScore;
}

function analyzeAllData(s1, s2, s3, s5, s6, s8) {
    const analysis = {
        healthScore: 100,
        recommendations: [],
        categories: { stock: 0, bond: 0, gold: 0, cash: 0, other: 0 },
        targetCategories: { stock: 0, bond: 0, gold: 0, cash: 0 },
        processedAssets: []
    };

    // --- 1. Velocity Check (Savings) ---
    if (s1 && s6) {
        const currentSavings = s1.monthlySavings || 0;
        const targetSavings = s6.monthlySavings || 0;
        document.getElementById('currentSavingsText').innerText = formatVal(currentSavings, 'KRW');
        
        const velocity = Math.min(100, (currentSavings / targetSavings) * 100);
        document.getElementById('velocityBar').style.width = `${velocity}%`;
        
        if (velocity < 100) {
            const gap = targetSavings - currentSavings;
            document.getElementById('velocityFeedback').innerText = `목표 달성을 위해 월 ${formatVal(gap, 'KRW')} 추가 저축이 필요합니다.`;
            analysis.healthScore -= 15;
            analysis.recommendations.push({ title: "저축 가속도 보완", desc: `현재 저축액이 시뮬레이션 목표보다 낮습니다. 지출을 줄여 월 ${gap}만 원을 더 확보하세요.`, icon: "💰" });
        } else {
            document.getElementById('velocityFeedback').innerText = `훌륭합니다! 현재 저축 속도로 목표를 초과 달성 중입니다.`;
        }
    }

    // --- 2. Category Audit ---
    if (s8 && s8.assets) {
        let totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
        
        s8.assets.forEach(a => {
            const cat = classifyTicker(a.ticker);
            analysis.categories[cat] += (a.qty * a.price / totalVal) * 100;
            
            const targetVal = totalVal * (a.targetWeight / 100);
            const currentVal = a.qty * a.price;
            const diffVal = targetVal - currentVal;
            const diffQty = (diffVal / a.price).toFixed(2);
            analysis.processedAssets.push({ ...a, diffQty, diffVal, currentWeight: totalVal > 0 ? (currentVal / totalVal * 100).toFixed(1) : 0 });
        });

        // Calculate Deviance
        const deviance = analysis.processedAssets.reduce((sum, a) => sum + Math.abs(a.currentWeight - a.targetWeight), 0);
        analysis.healthScore -= Math.min(40, Math.round(deviance));
    }

    // --- 3. Strategy Fit Check ---
    if (s3 && s5) {
        const isAggressiveModel = ['All Weather', '60/40'].includes(s5.selectedModel);
        if (s3.riskType === '안정형' && isAggressiveModel) {
            analysis.recommendations.push({ title: "투자 성향 불일치", desc: "안정형 성향에 비해 선택하신 전략의 변동성이 높습니다. 채권 비중 확대를 고려하세요.", icon: "⚠️" });
            analysis.healthScore -= 10;
        }
    }

    return analysis;
}

function classifyTicker(ticker) {
    const t = ticker.toUpperCase();
    if (['GLD', 'IAU', 'IAUM', 'BAR'].includes(t)) return 'gold';
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'EDV'].includes(t)) return 'bond';
    if (['VOO', 'SPY', 'QQQ', 'VTI', 'VT', 'IVV'].includes(t) || t.endsWith('.KS') || t.endsWith('.KQ')) return 'stock';
    if (t === 'CASH') return 'cash';
    return 'other';
}

function renderExecutiveSummary(data) {
    const el = document.getElementById('advisorVerdict');
    let msg = "";
    if (data.healthScore >= 80) msg = "당신의 포트폴리오는 매우 견고합니다. 현재의 자산 배분 원칙을 유지하며 주기적인 리밸런싱만 수행하십시오.";
    else if (data.healthScore >= 60) msg = "전반적으로 양호하나 일부 자산군에서 목표 비중과의 이탈이 관찰됩니다. 아래 실행 가이드에 따라 조정을 권고합니다.";
    else msg = "포트폴리오의 재정비가 시급합니다. 전략적 목표 비중과 실제 자산 구성 사이의 괴리가 크며, 저축 체력 보완이 필요합니다.";
    el.innerHTML = msg;
}

function renderAssetAudit(analysis, strategyName) {
    document.getElementById('selectedStrategyTag').innerText = `Strategy: ${strategyName || 'Custom'}`;
    const ctx = document.getElementById('auditChart')?.getContext('2d');
    const cats = analysis.categories;
    
    if (auditChart) auditChart.destroy();
    auditChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['주식', '채권', '금/원자재', '현금/기타'],
            datasets: [{
                data: [cats.stock, cats.bond, cats.gold, cats.cash + cats.other],
                backgroundColor: ['#3b82f6', '#64748b', '#f59e0b', '#cbd5e1'],
                borderWidth: 0
            }]
        },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });

    document.getElementById('balancePercent').innerText = `${analysis.healthScore}%`;

    const listEl = document.getElementById('auditList');
    const catNames = { stock: '주식/성장주', bond: '국채/안전채권', gold: '금/대체자산', cash: '현금/유동성' };
    listEl.innerHTML = Object.keys(catNames).map(key => {
        const val = Math.round(analysis.categories[key] || 0);
        return `
            <div class="space-y-2">
                <div class="flex justify-between text-[10px] font-black uppercase"><span class="text-slate-500">${catNames[key]}</span><span class="text-slate-900 dark:text-white">${val}%</span></div>
                <div class="audit-bar"><div class="audit-progress" style="width: ${val}%; background: ${getCatColor(key)}"></div></div>
            </div>
        `;
    }).join('');
}

function getCatColor(key) {
    return { stock: '#3b82f6', bond: '#64748b', gold: '#f59e0b', cash: '#cbd5e1' }[key] || '#eee';
}

function renderRebalanceTable(assets, curr) {
    const tbody = document.getElementById('rebalanceTableBody');
    tbody.innerHTML = assets.map(a => `
        <tr class="border-b dark:border-slate-800/50">
            <td class="py-6 px-2"><p class="font-black">${a.ticker}</p><p class="text-[10px] text-slate-400">${classifyTicker(a.ticker).toUpperCase()}</p></td>
            <td class="py-6 px-2 font-bold">${a.currentWeight}%</td>
            <td class="py-6 px-2 font-bold">${a.targetWeight}%</td>
            <td class="py-6 px-2 text-right">
                <span class="px-3 py-1 rounded-full text-[10px] font-black ${parseFloat(a.diffQty) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                    ${parseFloat(a.diffQty) > 0 ? '매수' : '매도'} ${Math.abs(a.diffQty)}주
                </span>
                <p class="text-[10px] text-slate-400 mt-1">약 ${formatVal(Math.abs(analysisToCurrency(a.diffVal, curr)))}</p>
            </td>
        </tr>
    `).join('');
}

function renderRecommendations(recs) {
    const el = document.getElementById('recommendationList');
    if (recs.length === 0) {
        el.innerHTML = '<div class="col-span-2 p-8 text-center text-slate-400 font-bold">✓ 현재 모든 지표가 안정적입니다.</div>';
        return;
    }
    el.innerHTML = recs.map(r => `
        <div class="flex gap-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
            <div class="text-2xl">${r.icon}</div>
            <div><h4 class="font-black text-sm mb-1">${r.title}</h4><p class="text-xs text-slate-500 leading-relaxed">${r.desc}</p></div>
        </div>
    `).join('');
}

function formatVal(v, curr = 'KRW') {
    if (curr === 'KRW') {
        if (v >= 10000) return (v / 10000).toFixed(1) + '억 원';
        return Math.round(v).toLocaleString() + '만 원';
    }
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function analysisToCurrency(v, curr) {
    // Helper to keep values in units compatible with formatVal
    return v;
}
