// --- State Management ---
let currentStep = 1;
let wealthChart = null;

// --- Wizard Navigation ---
window.goToStep = function(step) {
    // 모든 섹션 숨기기
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    // 대상 섹션 보이기
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // 인디케이터 업데이트
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        if (idx + 1 <= step) {
            dot.classList.remove('bg-slate-200');
            dot.classList.add('bg-blue-600');
        } else {
            dot.classList.remove('bg-blue-600');
            dot.classList.add('bg-slate-200');
        }
    });

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Final Calculation & Show Result ---
window.calculateAndShowResult = function() {
    updateCalculation();
    goToStep(4);
};

function updateCalculation() {
    // 입력값 가져오기
    const annualSalary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const initialSeed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflationRate = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = initialSeed;
    let currentAnnualSalary = annualSalary;
    let currentMonthlyExpense = monthlyExpense;
    
    const yearlyData = [initialSeed];
    const realYearlyData = [initialSeed];
    const tableData = [];

    // 10년 시뮬레이션 로직
    for (let year = 1; year <= 10; year++) {
        const prevWealth = currentWealth;
        // 1. 연간 잉여 현금 계산
        const annualSurplus = currentAnnualSalary - (currentMonthlyExpense * 12);
        
        // 2. 투자 수익 적용
        const profit = (currentWealth + (annualSurplus / 2)) * investmentReturn; // 유입 현금은 평균적으로 연중 절반 정도 투자된다고 가정
        currentWealth = currentWealth + annualSurplus + profit;
        
        // 테이블 데이터 저장
        tableData.push({
            year,
            salary: currentAnnualSalary,
            profit: profit,
            total: currentWealth
        });

        // 3. 연봉 상승 및 물가 상승 반영
        currentAnnualSalary *= (1 + salaryGrowth);
        currentMonthlyExpense *= (1 + inflationRate);
        
        yearlyData.push(Math.round(currentWealth));
        
        // 4. 실질 가치 계산
        const realValue = currentWealth / Math.pow(1 + inflationRate, year);
        realYearlyData.push(Math.round(realValue));
    }

    const finalWealth = yearlyData[10];
    const finalRealWealth = realYearlyData[10];
    const avgNetSavings = Math.round((annualSalary - (monthlyExpense * 12)) / 12);

    // UI 업데이트
    document.getElementById('finalWealthText').innerText = formatToKoreanUnit(finalWealth);
    document.getElementById('realValueText').innerText = formatToKoreanUnit(finalRealWealth);
    document.getElementById('netSavingsText').innerText = avgNetSavings.toLocaleString() + '만';

    // 테이블 렌더링
    renderYearlyTable(tableData);
    
    // 등급 결정 및 AI 인사이트
    updateWealthTier(finalRealWealth);
    renderChart(yearlyData, realYearlyData);
}

function formatToKoreanUnit(val) {
    if (val >= 10000) {
        return (val / 10000).toFixed(1) + '억';
    }
    return val.toLocaleString() + '만';
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-2 text-slate-400">${row.year}년차</td>
            <td class="py-4 px-2 text-blue-500">${Math.round(row.salary).toLocaleString()}만</td>
            <td class="py-4 px-2 text-emerald-500">+${Math.round(row.profit).toLocaleString()}만</td>
            <td class="py-4 px-2 text-right text-slate-800 dark:text-slate-200">${formatToKoreanUnit(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.toggleYearlyTable = function() {
    const container = document.getElementById('yearly-table-container');
    const arrow = document.getElementById('table-arrow');
    const isHidden = container.classList.contains('hidden');
    
    if (isHidden) {
        container.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        container.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

function updateWealthTier(realWealth) {
    let tier = "브론즈";
    let icon = "🥉";
    let desc = "기초를 다지는 단계입니다. 저축액을 늘려 시드를 모으는 데 집중하세요.";
    let color = "from-slate-400 to-slate-600";

    if (realWealth >= 200000) {
        tier = "다이아몬드"; icon = "💎";
        desc = "경제적 자유 달성! 10년 후 당신은 상위 1%의 삶을 누리게 됩니다.";
        color = "from-indigo-500 via-purple-500 to-pink-500";
    } else if (realWealth >= 100000) {
        tier = "플래티넘"; icon = "💍";
        desc = "상위권 진입! 안정적인 자산가로서의 삶이 기다리고 있습니다.";
        color = "from-blue-400 to-indigo-600";
    } else if (realWealth >= 50000) {
        tier = "골드"; icon = "🥇";
        desc = "풍요로운 중산층! 복리의 힘이 본격적으로 작동하는 시기입니다.";
        color = "from-amber-400 to-orange-600";
    } else if (realWealth >= 20000) {
        tier = "실버"; icon = "🥈";
        desc = "안정적인 시작! 자산 배분을 통해 리스크를 관리하며 성장하세요.";
        color = "from-slate-300 to-slate-500";
    }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeDesc').innerText = desc;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
    
    document.getElementById('aiInsight').innerText = `${tier} 등급 도달을 축하드립니다! 현재 설정된 연 ${((parseFloat(document.getElementById('investmentReturn').value)||0)).toFixed(1)}%의 수익률을 유지하면서 물가 상승을 방어하는 것이 핵심입니다.`;
}

function renderChart(nominalData, realData) {
    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                {
                    label: '명목 자산 (숫자)',
                    data: nominalData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#3b82f6'
                },
                {
                    label: '실질 가치 (구매력)',
                    data: realData,
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { weight: 'bold' } } }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: v => (v / 10000).toFixed(0) + '억' }
                },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

// --- Strategy Modal ---
const strategyContent = {
    "다이아몬드": {
        icon: "💎",
        title: "다이아몬드 등급을 위한 공격적 자산 증식",
        content: "이미 자산 형성의 본 궤도에 오르셨습니다. 이제는 단순한 저축보다는 '베타 가속'에 집중할 때입니다. <br><br>1. 주식 비중을 70% 이상으로 유지하되, 일부를 레버리지 ETF나 가상자산에 배분하여 수익률을 극대화하세요. <br>2. 절세 계좌(ISA, IRP)를 풀 가동하여 복리 효과를 저해하는 세금을 최소화하세요."
    },
    "플래티넘": {
        icon: "💍",
        title: "플래티넘 등급을 위한 스마트 리밸런싱",
        content: "상위권 진입이 눈앞입니다. 이제부터는 '잃지 않는 투자'와 '공격'의 균형이 중요합니다. <br><br>1. 60:40 또는 올웨더 포트폴리오를 참고하여 자산 배분을 시작하세요. <br>2. 분기별 리밸런싱을 통해 고점 매도, 저점 매수를 기계적으로 실천하세요."
    },
    "골드": {
        icon: "🥇",
        title: "골드 등급을 위한 시드 가속화 전략",
        content: "복리의 마법이 본격적으로 시작되는 지점입니다. 시드의 크기를 키우는 것이 최우선입니다. <br><br>1. 불필요한 지출을 10%만 더 줄여 투자 원금을 늘리세요. <br>2. 시장 지수(S&P500, 나스닥) 위주의 적립식 투자를 추천합니다."
    },
    "실버": {
        icon: "🥈",
        title: "실버 등급을 위한 기초 체력 다지기",
        content: "안정적인 자산가로 가는 첫 단추를 잘 끼우셨습니다. <br><br>1. 비상금을 먼저 확보한 뒤 투자를 시작하세요. <br>2. 개별 종목보다는 전세계 주식(VT)이나 국내외 대형 우량주 위주로 경험을 쌓으세요."
    },
    "브론즈": {
        icon: "🥉",
        title: "브론즈 등급을 위한 탈출 전략",
        content: "지금은 투자 수익률보다 '저축률'이 압도적으로 중요한 시기입니다. <br><br>1. 몸값을 높여 파이프라인을 늘리는 데 투자하세요. <br>2. 금융 공부를 병행하며 월 10만 원이라도 꾸준히 인덱스 펀드에 넣는 습관을 만드세요."
    }
};

window.toggleStrategyModal = function(show) {
    const modal = document.getElementById('strategyModal');
    const container = document.getElementById('modalContainer');
    if (!modal || !container) return;

    if (show) {
        const tier = document.getElementById('gradeTitle').innerText;
        const data = strategyContent[tier] || strategyContent["브론즈"];
        
        document.getElementById('modalContent').innerHTML = `
            <div class="text-center mb-6"><div class="text-6xl mb-4">${data.icon}</div><h4 class="text-xl font-bold text-blue-600">${data.title}</h4></div>
            <div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl leading-relaxed text-slate-600 dark:text-slate-300">${data.content}</div>
        `;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }, 300);
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 이벤트 리스너 등록
    document.getElementById('showStrategyBtn')?.addEventListener('click', () => toggleStrategyModal(true));
    document.getElementById('closeModal')?.addEventListener('click', () => toggleStrategyModal(false));
    document.getElementById('closeModalBtn')?.addEventListener('click', () => toggleStrategyModal(false));
    
    // 다크모드 대응 차트 갱신
    const observer = new MutationObserver(() => {
        if (currentStep === 4) updateCalculation();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
