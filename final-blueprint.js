import { db, currentUser, getStepData, exchangeRate as coreExchangeRate } from './core.js';

let visionChart = null;

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        document.getElementById('userName').innerText = user.displayName || '투자자';
        document.getElementById('userPhoto').src = user.photoURL || '';
        await generateFinalPlan();
        createConfetti();
    } else {
        location.href = 'index.html';
    }
});

async function generateFinalPlan() {
    const [s1, s2, s3, s5, s6, s8] = await Promise.all([
        getStepData(1), getStepData(2), getStepData(3), getStepData(5), getStepData(6), getStepData(8)
    ]);

    // 1. Identity Summary
    if (s1 && s3) {
        document.getElementById('riskTypeDisplay').innerText = s3.riskType || '미진단';
        document.getElementById('tierDisplay').innerText = calculateTier(s1);
        document.getElementById('personaIconBig').innerText = s3.riskType === '공격투자형' ? '🦅' : '🦔';
        document.getElementById('identityDesc').innerText = `당신은 월 ${formatVal(s1.monthlySavings || 0)}원씩 저축하여 ${s2?.fireYear || 10}년 후 경제적 자유를 꿈꾸는 현명한 투자자입니다.`;
        document.getElementById('fireYear').innerText = `${s2?.fireYear || 10}년 후`;
        document.getElementById('monthlySavings').innerText = formatVal(s1.monthlySavings || 0);
    }

    // 2. Economic Shield Analysis
    if (s5 && s5.selectedModel) {
        document.getElementById('selectedModelName').innerText = s5.selectedModel;
        updateShieldUI(s5.selectedModel);
    }

    // 3. Execution List & Recommendations (Advanced)
    const actionContainer = document.getElementById('actionList');
    const recommendationArea = document.getElementById('recommendationArea');
    
    if (s8 && s8.assets) {
        const actions = calculateActions(s8);
        if (actions.length > 0) {
            actionContainer.innerHTML = actions.map(a => `
                <div class="action-item p-6 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                    <div>
                        <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase ${a.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} mb-2 inline-block">${a.type === 'BUY' ? '매수' : '매도'}</span>
                        <h4 class="text-xl font-black">${a.ticker}</h4>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black ${a.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}">${Math.abs(a.qty)}주 ${a.type === 'BUY' ? '추가 확보' : '비중 축소'}</p>
                        <p class="text-xs text-slate-500">예상 금액: ${a.priceText}</p>
                    </div>
                </div>
            `).join('');
        } else {
            actionContainer.innerHTML = '<div class="p-8 text-center bg-emerald-500/10 text-emerald-400 rounded-3xl font-bold">✓ 현재 모든 종목의 비중이 목표치와 일치합니다.</div>';
        }

        // --- 부족한 자산군 추천 로직 ---
        const missingCategories = checkMissingCategories(s8.assets, s5?.selectedModel);
        if (missingCategories.length > 0) {
            recommendationArea.innerHTML = `
                <h4 class="text-sm font-black text-amber-400 uppercase tracking-widest mb-6">⚠️ 전략 완성을 위해 보완이 필요한 자산</h4>
                ${missingCategories.map(cat => `
                    <div class="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row justify-between gap-6">
                        <div class="space-y-2">
                            <div class="flex items-center gap-2"><span class="text-xl">${cat.icon}</span><span class="font-black text-amber-400">${cat.name} 비중 0%</span></div>
                            <p class="text-xs text-slate-400 leading-relaxed">${cat.reason}</p>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl min-w-[200px]">
                            <p class="text-[10px] font-bold text-slate-500 mb-2 uppercase">추천 대표 상품 (Ticker)</p>
                            <div class="flex flex-wrap gap-2">
                                ${cat.tickers.map(t => `<span class="px-3 py-1 bg-slate-800 rounded-lg text-xs font-black text-blue-400 border border-blue-400/30">${t}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            `;
        }
    }

    // 4. Vision Chart
    if (s6) {
        document.getElementById('finalWealth').innerText = formatVal(s6.finalProjectedWealth || 0);
        renderVisionChart(s6);
    }
}

function calculateTier(s1) {
    const val = (s1.annualSalary * 10) + (s1.initialSeed || 0);
    if (val >= 200000) return "다이아몬드";
    if (val >= 100000) return "플래티넘";
    if (val >= 50000) return "골드";
    return "브론즈";
}

function updateShieldUI(model) {
    const shields = {
        'All Weather': { inflation: '금/원자재 (15%)', deflation: '장기채 (40%)', growth: '주식 (30%)', recession: '중기채 (15%)' },
        '60/40': { inflation: '방어취약', deflation: '채권 (40%)', growth: '주식 (60%)', recession: '채권 (40%)' },
        'Permanent': { inflation: '금 (25%)', deflation: '장기채 (25%)', growth: '주식 (25%)', recession: '현금 (25%)' }
    };
    const data = shields[model] || shields['All Weather'];
    document.getElementById('shield-inflation').innerText = data.inflation;
    document.getElementById('shield-deflation').innerText = data.deflation;
    document.getElementById('shield-growth').innerText = data.growth;
    document.getElementById('shield-recession').innerText = data.recession;
}

function checkMissingCategories(assets, modelName) {
    const categories = [];
    const tickers = assets.map(a => a.ticker.toUpperCase());
    
    // 단순화된 카테고리 체크 (실제로는 티커 DB가 필요하지만 대표 티커로 판별)
    const hasGold = tickers.some(t => ['GLD', 'IAU', 'IAUM', 'BAR', '069500.KS'].includes(t)); // 금
    const hasBonds = tickers.some(t => ['TLT', 'IEF', 'SHY', 'BND', 'AGG'].includes(t)); // 채권
    const hasCommodities = tickers.some(t => ['DBC', 'GSG', 'PDBC'].includes(t)); // 원자재

    if (modelName === 'All Weather') {
        if (!hasGold) categories.push({ name: '금 (Gold)', icon: '✨', reason: '고물가 시기에 화폐 가치 하락을 방어하는 핵심 안전 자산입니다.', tickers: ['GLD', 'IAU', 'IAUM'] });
        if (!hasCommodities) categories.push({ name: '원자재 (Commodity)', icon: '🛢️', reason: '경기 부양 및 인플레이션 초기 단계에서 가장 강력한 수익을 냅니다.', tickers: ['DBC', 'PDBC'] });
        if (!hasBonds) categories.push({ name: '채권 (Bonds)', icon: '📉', reason: '경기 침체 및 디플레이션 시기 주식 하락을 상쇄하는 쿠션 역할을 합니다.', tickers: ['TLT', 'IEF', 'BND'] });
    } else if (modelName === 'Permanent') {
        if (!hasGold) categories.push({ name: '금 (Gold)', icon: '✨', reason: '영구 포트폴리오의 4대 축 중 하나로, 인플레이션 방어의 핵심입니다.', tickers: ['GLD', 'IAU'] });
    }
    
    return categories;
}

function calculateActions(s8) {
    const actions = [];
    let totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
    const exRate = s8.manualExchangeRate || coreExchangeRate;

    s8.assets.forEach(a => {
        const targetVal = totalVal * (a.targetWeight / 100);
        const currentVal = a.qty * a.price;
        const diffVal = targetVal - currentVal;
        const diffQty = (diffVal / a.price).toFixed(2);

        if (Math.abs(diffQty) >= 0.01) {
            actions.push({
                ticker: a.ticker,
                type: diffQty > 0 ? 'BUY' : 'SELL',
                qty: diffQty,
                priceText: formatVal(Math.abs(diffVal), s8.baseCurrency === 'USD' ? 'USD' : 'KRW', exRate)
            });
        }
    });
    return actions;
}

function formatVal(v, curr = 'KRW', rate = 1350) {
    if (curr === 'KRW') {
        if (v >= 10000) return (v / 10000).toFixed(1) + '억';
        return Math.round(v).toLocaleString() + '만 원';
    }
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function renderVisionChart(s6) {
    const ctx = document.getElementById('visionChart')?.getContext('2d');
    if (!ctx) return;
    const labels = Array.from({length: s6.compoundPeriod + 1}, (_, i) => `${i}년`);
    const data = [s6.compoundSeed];
    let current = s6.compoundSeed;
    for (let i = 1; i <= s6.compoundPeriod; i++) {
        current = current * (1 + s6.compoundRate/100) + (s6.monthlySavings * 12);
        data.push(Math.round(current));
    }

    if (visionChart) visionChart.destroy();
    visionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: '#3b82f6',
                borderWidth: 4,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
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

function createConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.backgroundColor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)];
        c.style.animationDelay = Math.random() * 3 + 's';
        container.appendChild(c);
    }
}

window.printReport = function() {
    window.print();
};
