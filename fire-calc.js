// --- State Management ---
let currentStep = 1;

// --- Navigation ---
window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
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

// --- Calculation ---
window.calculateFIRE = function() {
    const monthlyExpense = parseFloat(document.getElementById('f-expense').value) || 0;
    const currentSeed = parseFloat(document.getElementById('f-seed').value) || 0;
    const annualSave = parseFloat(document.getElementById('f-annual-save').value) || 0;
    const rate = (parseFloat(document.getElementById('f-rate').value) || 0) / 100;
    const swr = (parseFloat(document.getElementById('f-swr').value) || 0) / 100;

    // 1. 목표 은퇴 자산 (FIRE Number) 계산
    // 공식: 연 생활비 / 인출률 (4% 법칙은 연 생활비 * 25)
    const annualExpense = monthlyExpense * 12;
    const fireGoal = annualExpense / swr;

    // 2. 목표 도달 기간 시뮬레이션
    let currentWealth = currentSeed;
    let months = 0;
    const monthlySave = annualSave / 12;
    const monthlyRate = rate / 12;

    // 최대 100년(1200개월)까지만 계산 (무한 루프 방지)
    while (currentWealth < fireGoal && months < 1200) {
        currentWealth = (currentWealth + monthlySave) * (1 + monthlyRate);
        months++;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const currentYear = new Date().getFullYear();
    const achievementYear = currentYear + years;

    // 3. 결과 렌더링
    document.getElementById('fireYearsResult').innerText = `${years}년 ${remainingMonths}개월 후`;
    document.getElementById('fireDateResult').innerText = `당신은 ${achievementYear}년 ${new Date().getMonth() + 1}월에 은퇴 가능합니다.`;
    document.getElementById('fireGoalAmount').innerText = formatKorean(fireGoal);
    document.getElementById('fireMonthlyIncome').innerText = formatKorean(monthlyExpense);

    // 전문가 조언 생성
    renderAdvice(fireGoal, currentSeed, years);
    
    goToStep(4);
};

function renderAdvice(goal, seed, years) {
    const adviceEl = document.getElementById('fireAdvice');
    let text = "";
    
    if (years <= 5) {
        text = "은퇴가 눈앞입니다! 이제는 자산의 증식보다 '인출 전략'과 '세금 관리'를 계획할 때입니다. 연금 저축 계좌를 점검하세요.";
    } else if (years <= 15) {
        text = "자산 형성의 황금기에 계십니다. 불필요한 지출을 10%만 더 줄여도 은퇴 시점을 2~3년 더 앞당길 수 있습니다.";
    } else {
        text = "긴 여정이 남아있지만, 복리는 시간이 흐를수록 강력해집니다. 지금은 수익률에 일희일비하기보다 '꾸준한 저축'과 '자산 배분'에 집중하세요.";
    }
    
    adviceEl.innerText = text;
}

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

// --- Init ---
goToStep(1);
