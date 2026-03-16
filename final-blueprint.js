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
    const [s1, s2, s3, s6, s8] = await Promise.all([
        getStepData(1), getStepData(2), getStepData(3), getStepData(6), getStepData(8)
    ]);

    // 1. Identity Summary
    if (s1 && s3) {
        document.getElementById('riskTypeDisplay').innerText = s3.riskType || '미진단';
        document.getElementById('tierDisplay').innerText = calculateTier(s1);
        document.getElementById('personaIconBig').innerText = s1.baseCurrency === 'USD' ? '🦅' : '🦔';
        document.getElementById('identityDesc').innerText = `당신은 월 ${formatVal(s1.monthlySavings || 0)}원씩 저축하여 ${s2?.fireYear || 10}년 후 경제적 자유를 꿈꾸는 현명한 투자자입니다.`;
        document.getElementById('fireYear').innerText = `${s2?.fireYear || 10}년 후`;
        document.getElementById('monthlySavings').innerText = formatVal(s1.monthlySavings || 0);
    }

    // 2. Action List (From Step 8)
    const actionContainer = document.getElementById('actionList');
    if (s8 && s8.assets) {
        // 리밸런싱 로직을 재실행하여 액션 아이템 추출
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
            actionContainer.innerHTML = '<div class="p-8 text-center bg-emerald-500/10 text-emerald-400 rounded-3xl font-bold">✓ 현재 포트폴리오 비중이 완벽합니다! 추가 액션이 필요 없습니다.</div>';
        }
    } else {
        actionContainer.innerHTML = '<p class="text-slate-500 italic">8단계 리밸런싱 데이터가 없습니다. 먼저 포트폴리오를 구성해 주세요.</p>';
    }

    // 3. Vision Chart (From Step 6)
    if (s6) {
        document.getElementById('finalWealth').innerText = formatVal(s6.finalProjectedWealth || 0);
        renderVisionChart(s6);
    }
}

function calculateTier(s1) {
    // Step 1의 로직 재활용
    const val = (s1.annualSalary * 10); // 단순화된 로직
    if (val >= 200000) return "다이아몬드";
    if (val >= 100000) return "플래티넘";
    if (val >= 50000) return "골드";
    return "브론즈";
}

function calculateActions(s8) {
    const actions = [];
    const totalVal = s8.assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
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
    return '$' + v.toLocaleString();
}

function renderVisionChart(s6) {
    const ctx = document.getElementById('visionChart').getContext('2d');
    const labels = Array.from({length: s6.compoundPeriod + 1}, (_, i) => `${i}년`);
    const data = [s6.compoundSeed];
    let current = s6.compoundSeed;
    for (let i = 1; i <= s6.compoundPeriod; i++) {
        current = current * (1 + s6.compoundRate/100) + (s6.monthlySavings * 12);
        data.push(Math.round(current));
    }

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
            scales: { y: { display: false }, x: { grid: { display: false } } }
        }
    });
}

function createConfetti() {
    const container = document.getElementById('confetti-container');
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
