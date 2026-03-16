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
    
    // 4. Recommendations & Detailed Metrics
    renderRecommendations(reportData);

    // 5. Total Health Score
    document.getElementById('totalHealthScore').innerText = reportData.healthScore;
}

function analyzeAllData(s1, s2, s3, s5, s6, s8) {
    const analysis = {
        healthScore: 0,
        metrics: {
            savings: 0,
            balance: 0,
            risk: 100,
            diversity: 0
        },
        recommendations: [],
        categories: { stock: 0, bond: 0, gold: 0, cash: 0 },
        processedAssets: []
    };

    // --- 1. Metric: Savings Strength ---
    if (s1 && s6) {
        const currentSavings = s1.monthlySavings || 0;
        const targetSavings = s6.monthlySavings || currentSavings;
        document.getElementById('currentSavingsText').innerText = formatVal(currentSavings, 'KRW');
        
        analysis.metrics.savings = targetSavings > 0 ? Math.min(100, Math.round((currentSavings / targetSavings) * 100)) : 100;
        
        const velocity = analysis.metrics.savings;
        document.getElementById('velocityBar').style.width = `${velocity}%`;
        
        if (velocity < 100) {
            const gap = targetSavings - currentSavings;
            document.getElementById('velocityFeedback').innerText = `목표 달성을 위해 월 ${formatVal(gap, 'KRW')} 추가 저축이 필요합니다.`;
            analysis.recommendations.push({ title: "저축 가속도 보완", desc: `현재 저축액이 시뮬레이션 목표보다 낮습니다. 지출을 줄여 월 ${gap}만 원을 더 확보하세요.`, icon: "💰" });
        } else {
            document.getElementById('velocityFeedback').innerText = `훌륭합니다! 현재 저축 속도로 목표를 초과 달성 중입니다.`;
        }
    }

    // --- 2. Metric: Balance & Diversity ---
    if (s8 && s8.assets) {
        let totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
        const categoriesFound = new Set();
        
        s8.assets.forEach(a => {
            const cat = classifyTicker(a.ticker);
            if (a.qty * a.price > 0) categoriesFound.add(cat);
            const weight = totalVal > 0 ? (a.qty * a.price / totalVal) * 100 : 0;
            analysis.categories[cat] += weight;
            
            const targetVal = totalVal * (a.targetWeight / 100);
            const currentVal = a.qty * a.price;
            const diffVal = targetVal - currentVal;
            const diffQty = (diffVal / a.price).toFixed(2);
            analysis.processedAssets.push({ ...a, diffQty, diffVal, currentWeight: weight.toFixed(1) });
        });

        // Balance Score: 100 - Deviance
        const deviance = analysis.processedAssets.reduce((sum, a) => sum + Math.abs(parseFloat(a.currentWeight) - a.targetWeight), 0);
        analysis.metrics.balance = Math.max(0, 100 - Math.round(deviance));

        // Diversity Score: How many of the 4 main categories are filled
        analysis.metrics.diversity = Math.round((categoriesFound.size / 4) * 100);
        if (analysis.metrics.diversity < 75) {
            analysis.recommendations.push({ title: "자산 다양성 부족", desc: "특정 자산군에 치우쳐 있습니다. 채권이나 금 비중을 검토하세요.", icon: "🧭" });
        }
    }

    // --- 3. Metric: Risk Alignment ---
    if (s3 && s5) {
        const isAggressiveModel = ['All Weather', '60/40'].includes(s5.selectedModel);
        if (s3.riskType === '안정형' && isAggressiveModel) {
            analysis.metrics.risk = 50;
            analysis.recommendations.push({ title: "투자 성향 불일치", desc: "안정형 성향에 비해 선택하신 전략의 변동성이 높습니다. 채권 비중 확대를 고려하세요.", icon: "⚠️" });
        }
    }

    // Total Health Score calculation
    analysis.healthScore = Math.round(
        (analysis.metrics.savings * 0.3) + 
        (analysis.metrics.balance * 0.4) + 
        (analysis.metrics.risk * 0.2) + 
        (analysis.metrics.diversity * 0.1)
    );

    return analysis;
}

function classifyTicker(ticker) {
    const t = ticker.toUpperCase();
    if (['GLD', 'IAU', 'IAUM', 'BAR', 'DBC', 'GSG', 'PDBC'].includes(t)) return 'gold';
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'EDV', 'TIP'].includes(t)) return 'bond';
    if (['CASH', 'USDT', 'KRW', 'USD'].includes(t)) return 'cash';
    return 'stock'; // Default fallback to stock
}

function renderExecutiveSummary(data) {
    const el = document.getElementById('advisorVerdict');
    let msg = "";
    if (data.healthScore >= 80) msg = "당신의 포트폴리오는 매우 견고합니다. 현재의 자산 배분 원칙을 유지하며 주기적인 리밸런싱만 수행하십시오.";
    else if (data.healthScore >= 60) msg = "전반적으로 양호하나 일부 지표에서 목표 비중과의 이탈이 관찰됩니다. 아래 리밸런싱 가이드에 따라 조정을 권고합니다.";
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
            labels: ['주식', '채권', '금/원자재', '현금'],
            datasets: [{
                data: [cats.stock, cats.bond, cats.gold, cats.cash],
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
        <tr class="border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="py-6 px-2"><p class="font-black">${a.ticker}</p><p class="text-[10px] text-slate-400">${classifyTicker(a.ticker).toUpperCase()}</p></td>
            <td class="py-6 px-2 font-bold">${a.currentWeight}%</td>
            <td class="py-6 px-2 font-bold">${a.targetWeight}%</td>
            <td class="py-6 px-2 text-right">
                <span class="px-3 py-1 rounded-full text-[10px] font-black ${parseFloat(a.diffQty) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                    ${parseFloat(a.diffQty) > 0 ? '매수' : '매도'} ${Math.abs(a.diffQty)}주
                </span>
                <p class="text-[10px] text-slate-400 mt-1">약 ${formatVal(Math.abs(a.diffVal))}</p>
            </td>
        </tr>
    `).join('');
}

function renderRecommendations(reportData) {
    const el = document.getElementById('recommendationList');
    const m = reportData.metrics;
    const recs = reportData.recommendations;

    const getStatusColor = (score) => score >= 80 ? 'text-emerald-500 bg-emerald-500/10' : score >= 60 ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-500/10';

    const auditStatus = `
        <div class="col-span-2 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center ${getStatusColor(m.savings)}">
                <p class="text-[9px] font-black uppercase mb-1">저축 체력</p>
                <p class="text-xl font-black">${m.savings}%</p>
            </div>
            <div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center ${getStatusColor(m.balance)}">
                <p class="text-[9px] font-black uppercase mb-1">전략 일치도</p>
                <p class="text-xl font-black">${m.balance}%</p>
            </div>
            <div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center ${getStatusColor(m.risk)}">
                <p class="text-[9px] font-black uppercase mb-1">성향 적합도</p>
                <p class="text-xl font-black">${m.risk}%</p>
            </div>
            <div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center ${getStatusColor(m.diversity)}">
                <p class="text-[9px] font-black uppercase mb-1">자산 다양성</p>
                <p class="text-xl font-black">${m.diversity}%</p>
            </div>
        </div>
    `;

    if (recs.length === 0) {
        el.innerHTML = auditStatus + '<div class="col-span-2 p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] text-slate-400 font-bold leading-relaxed">모든 지표가 우수합니다! 현재의 완벽한 밸런스를 유지하며 장기 투자를 이어가세요.</div>';
        return;
    }
    
    el.innerHTML = auditStatus + recs.map(r => `
        <div class="flex gap-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-blue-500/30 transition-all">
            <div class="text-2xl">${r.icon}</div>
            <div>
                <h4 class="font-black text-sm mb-1 text-slate-800 dark:text-white">${r.title}</h4>
                <p class="text-xs text-slate-500 leading-relaxed">${r.desc}</p>
            </div>
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
