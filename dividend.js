// --- State Management ---
let currentStep = 1;
let dividendPeriod = 12; // Default: Monthly

// --- Navigation ---
window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setPeriod = function(val) {
    dividendPeriod = val;
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (parseInt(btn.dataset.val) === val) {
            btn.classList.add('selected', 'border-blue-500');
            btn.classList.remove('border-transparent');
        } else {
            btn.classList.remove('selected', 'border-blue-500');
            btn.classList.add('border-transparent');
        }
    });
};

// --- Calculation ---
window.calculateDividend = function() {
    const total = parseFloat(document.getElementById('d-total').value) || 0;
    const yieldRate = (parseFloat(document.getElementById('d-yield').value) || 0) / 100;
    const taxRate = (parseFloat(document.getElementById('d-tax').value) || 0) / 100;
    const isReinvest = document.getElementById('d-reinvest').checked;

    // 1. 기초 세후 배당금 계산
    const annualGross = total * yieldRate;
    const annualNet = annualGross * (1 - taxRate);
    const monthlyNet = annualNet / 12;

    // 2. 10년 재투자 시뮬레이션
    let currentWealth = total;
    const periodsPerYear = dividendPeriod; 
    const yieldPerPeriod = yieldRate / periodsPerYear;
    const taxFactor = (1 - taxRate);

    for (let i = 0; i < 10 * periodsPerYear; i++) {
        const dividend = currentWealth * yieldPerPeriod;
        if (isReinvest) {
            currentWealth += (dividend * taxFactor);
        }
    }

    // 3. 결과 렌더링
    document.getElementById('monthlyDividendResult').innerText = formatKorean(monthlyNet);
    document.getElementById('annualDividendResult').innerText = `연간 총 배당금(세후): ${formatKorean(annualNet)}`;
    document.getElementById('tenYearResult').innerText = formatKorean(currentWealth);
    document.getElementById('tenYearGrowth').innerText = `+${((currentWealth - total) / total * 100).toFixed(1)}%`;

    goToStep(4);
};

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

// --- Init ---
goToStep(1);
