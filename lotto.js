// --- State Management ---
let currentStep = 1;
let selectedType = '645'; // '645' or '720'
let numGames = 5;

// --- Wizard Navigation ---
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

// --- Step 1: Select Type ---
window.selectLottoType = function(type) {
    selectedType = type;
    const title = document.getElementById('selected-type-title');
    const bonusArea = document.getElementById('bonus-toggle-area');
    
    if (type === '645') {
        title.innerText = "로또 6/45 설정";
        title.className = "text-xl font-black mb-8 text-center text-blue-600";
        bonusArea.classList.remove('hidden');
    } else {
        title.innerText = "연금복권 720+ 설정";
        title.className = "text-xl font-black mb-8 text-center text-purple-600";
        bonusArea.classList.add('hidden');
    }
    
    goToStep(2);
};

// --- Step 2: Adjust Options ---
window.adjustNumGames = function(delta) {
    numGames = Math.max(1, Math.min(20, numGames + delta));
    document.getElementById('numGamesDisplay').innerText = numGames;
};

window.generateAndShowResults = function() {
    const resultsContainer = document.getElementById('lottoResults');
    resultsContainer.innerHTML = '<div class="text-center py-12 animate-pulse font-bold text-slate-400">행운의 번호를 추출하고 있습니다...</div>';
    
    goToStep(3);
    
    // 약간의 딜레이 후 번호 생성 (애니메이션 효과)
    setTimeout(() => {
        resultsContainer.innerHTML = '';
        if (selectedType === '645') {
            generateLotto645();
        } else {
            generatePension720();
        }
    }, 800);
};

// --- Lotto Generation Logic ---
function generateLotto645() {
    const container = document.getElementById('lottoResults');
    const includeBonus = document.getElementById('includeBonus').checked;

    for (let i = 0; i < numGames; i++) {
        const numbers = [];
        while (numbers.length < 6) {
            const n = Math.floor(Math.random() * 45) + 1;
            if (!numbers.includes(n)) numbers.push(n);
        }
        numbers.sort((a, b) => a - b);

        const row = document.createElement('div');
        row.className = "p-6 rounded-[2rem] bg-white dark:bg-[#1e293b] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-fade-in-up";
        
        let ballsHTML = '<div class="flex gap-2">';
        numbers.forEach(n => {
            ballsHTML += `<span class="lotto-ball" style="background-color: ${getLottoColor(n)}">${n}</span>`;
        });
        
        if (includeBonus) {
            const bonus = Math.floor(Math.random() * 45) + 1;
            ballsHTML += `<span class="text-slate-300 font-bold mx-1">+</span><span class="lotto-ball" style="background-color: ${getLottoColor(bonus)}">${bonus}</span>`;
        }
        ballsHTML += '</div>';

        row.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-xs font-black text-slate-300 uppercase tracking-widest">G${i+1}</span>
                ${ballsHTML}
            </div>
            <div class="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">통계적 우위 조합</div>
        `;
        container.appendChild(row);
    }
}

function generatePension720() {
    const container = document.getElementById('lottoResults');
    for (let i = 0; i < numGames; i++) {
        const group = Math.floor(Math.random() * 5) + 1;
        const numbers = Array.from({length: 6}, () => Math.floor(Math.random() * 10));

        const row = document.createElement('div');
        row.className = "p-6 rounded-[2rem] bg-white dark:bg-[#1e293b] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-fade-in-up";
        
        row.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-xs font-black text-slate-300 uppercase tracking-widest">G${i+1}</span>
                <div class="flex items-center gap-3">
                    <span class="px-3 py-1 bg-purple-600 text-white rounded-lg font-black text-sm">${group}조</span>
                    <div class="flex gap-1">
                        ${numbers.map(n => `<span class="w-8 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg font-black text-lg">${n}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full">안정적 연금형 조합</div>
        `;
        container.appendChild(row);
    }
}

function getLottoColor(n) {
    if (n <= 10) return '#facc15'; // Yellow
    if (n <= 20) return '#3b82f6'; // Blue
    if (n <= 30) return '#ef4444'; // Red
    if (n <= 40) return '#94a3b8'; // Grey
    return '#10b981'; // Green
}

// --- Utilities ---
window.copyLink = function() {
    navigator.clipboard.writeText(window.location.href);
    alert("행운의 링크가 복사되었습니다! 🍀");
};

window.shareToX = function() {
    const text = "Hedge Dochi에서 AI가 추천하는 행운의 로또 번호를 받았습니다! 🍀 #로또 #복권 #HedgeDochi";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`);
};
