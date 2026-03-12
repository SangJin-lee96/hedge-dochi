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
window.calculateCompound = function() {
    const seed = parseFloat(document.getElementById('c-seed').value) || 0;
    const monthly = parseFloat(document.getElementById('c-monthly').value) || 0;
    const rate = (parseFloat(document.getElementById('c-rate').value) || 0) / 100;
    const period = parseInt(document.getElementById('c-period').value) || 0;

    let totalAmount = seed;
    let totalPrincipal = seed;
    const yearlyData = [];

    for (let year = 1; year <= period; year++) {
        // 매달 적립 및 수익률 적용 (월복리 계산)
        const monthlyRate = rate / 12;
        for (let month = 1; month <= 12; month++) {
            totalAmount = (totalAmount + monthly) * (1 + monthlyRate);
            totalPrincipal += monthly;
        }
        
        yearlyData.push({
            year,
            principal: totalPrincipal,
            total: totalAmount,
            profit: totalAmount - totalPrincipal
        });
    }

    // 결과 렌더링
    document.getElementById('totalCompoundResult').innerText = formatKorean(totalAmount);
    document.getElementById('totalProfitResult').innerText = `수익금: ${formatKorean(totalAmount - totalPrincipal)}`;
    document.getElementById('totalPrincipal').innerText = formatKorean(totalPrincipal);
    document.getElementById('profitRatio').innerText = `+${((totalAmount - totalPrincipal) / totalPrincipal * 100).toFixed(1)}%`;

    renderTable(yearlyData);
    goToStep(3);
};

function renderTable(data) {
    const tbody = document.getElementById('compoundTableBody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="py-4 text-slate-400">${row.year}년차</td>
            <td class="py-4">${formatKorean(row.principal)}</td>
            <td class="py-4 text-emerald-500">+${formatKorean(row.profit)}</td>
            <td class="py-4 text-right text-slate-800 dark:text-slate-200">${formatKorean(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

// --- Init ---
goToStep(1);
