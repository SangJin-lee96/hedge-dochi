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

    // 10년 시뮬레이션 로직
    for (let year = 1; year <= 10; year++) {
        // 1. 연간 잉여 현금 계산 (수입 - 지출)
        const annualSurplus = currentAnnualSalary - (currentMonthlyExpense * 12);
        
        // 2. 투자 수익 적용 (기존 자산 + 신규 유입액의 절반 정도가 투자되었다고 가정)
        currentWealth = (currentWealth + annualSurplus) * (1 + investmentReturn);
        
        // 3. 연봉 상승 및 물가 상승 반영 (다음 해를 위해)
        currentAnnualSalary *= (1 + salaryGrowth);
        currentMonthlyExpense *= (1 + inflationRate);
        
        yearlyData.push(Math.round(currentWealth));
        
        // 4. 실질 가치 계산 (물가 상승률로 할인)
        const realValue = currentWealth / Math.pow(1 + inflationRate, year);
        realYearlyData.push(Math.round(realValue));
    }

    const finalWealth = yearlyData[10];
    const finalRealWealth = realYearlyData[10];
    const avgNetSavings = Math.round((annualSalary - (monthlyExpense * 12)) / 12);

    // UI 업데이트
    document.getElementById('finalWealthText').innerText = (finalWealth / 10000).toFixed(1) + '억';
    document.getElementById('realValueText').innerText = (finalRealWealth / 10000).toFixed(1) + '억';
    document.getElementById('netSavingsText').innerText = avgNetSavings + '만';

    // 등급 결정 및 AI 인사이트
    updateWealthTier(finalRealWealth);
    renderChart(yearlyData, realYearlyData);
}

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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 다크모드 대응 차트 갱신
    const observer = new MutationObserver(() => {
        if (currentStep === 4) updateCalculation();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
