import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData } from './core.js';

// --- Risk Test Questions Data ---
const questions = [
    {
        q: "당신의 연령대는 어떻게 되시나요?",
        options: [
            { text: "20대 - 30대 (공격적 투자 가능)", score: 5 },
            { text: "40대 - 50대 (안정적 성장 필요)", score: 3 },
            { text: "60대 이상 (자산 보존 우선)", score: 1 }
        ]
    },
    {
        q: "투자할 수 있는 기간은 어느 정도인가요?",
        options: [
            { text: "10년 이상 장기 투자", score: 5 },
            { text: "3년 ~ 5년 중기 투자", score: 3 },
            { text: "1년 이내 단기 투자", score: 1 }
        ]
    },
    {
        q: "투자 경험이 얼마나 되시나요?",
        options: [
            { text: "주식, 파생상품 등 고위험 자산 유경험자", score: 5 },
            { text: "펀드, ETF 위주의 중위험 자산 유경험자", score: 3 },
            { text: "예적금 위주의 안전 자산 선호", score: 1 }
        ]
    },
    {
        q: "자산의 20%가 하락했다면 어떻게 행동하시겠나요?",
        options: [
            { text: "오히려 저가 매수의 기회로 삼고 더 산다", score: 5 },
            { text: "계획대로 비중을 유지하며 지켜본다", score: 3 },
            { text: "불안해서 즉시 매도하여 손실을 확정한다", score: 1 }
        ]
    },
    {
        q: "기대 수익률과 감수할 위험 중 무엇이 중요한가요?",
        options: [
            { text: "손실 위험이 커도 고수익이 중요하다", score: 5 },
            { text: "적당한 수익과 적당한 위험이 좋다", score: 3 },
            { text: "수익이 낮아도 원금 보존이 최우선이다", score: 1 }
        ]
    },
    {
        q: "수입의 얼마를 저축/투자하시나요?",
        options: [
            { text: "50% 이상 (여유 자금 풍부)", score: 5 },
            { text: "20% ~ 40% (보통)", score: 3 },
            { text: "10% 이하 (지출이 많음)", score: 1 }
        ]
    },
    {
        q: "투자 목적이 무엇인가요?",
        options: [
            { text: "자산의 공격적인 증식 (파이어족)", score: 5 },
            { text: "주택 자금 등 특정 목적의 목돈 마련", score: 3 },
            { text: "안정적인 노후 생활 자금", score: 1 }
        ]
    }
];

let currentQuestion = 0;
let totalScore = 0;

document.addEventListener('coreDataReady', async (e) => {
    const riskData = await getStepData(3);
    if (riskData && riskData.riskType) {
        showResult(riskData);
    }
});

window.startQuiz = function() {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    
    document.getElementById('test-header').classList.remove('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    currentQuestion = 0;
    totalScore = 0;
    renderQuestion();
};

function renderQuestion() {
    const qData = questions[currentQuestion];
    
    const progressText = document.getElementById('progress-text');
    const progressInner = document.getElementById('progress-inner');

    if (progressText) progressText.innerText = `${currentQuestion + 1} / ${questions.length}`;
    if (progressInner) progressInner.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
    
    const container = document.getElementById('quiz-container');
    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-700 animate-fade-in-up">
            <h2 class="text-2xl md:text-3xl font-black mb-10 text-center leading-tight">${qData.q}</h2>
            <div class="space-y-4" id="options-container"></div>
        </div>
    `;

    const optionsContainer = document.getElementById('options-container');
    qData.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = "w-full p-6 text-left rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all group";
        btn.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 font-bold flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                    ${String.fromCharCode(65 + index)}
                </div>
                <span class="font-bold text-lg text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${opt.text}</span>
            </div>
        `;
        btn.onclick = () => window.selectOption(opt.score);
        optionsContainer.appendChild(btn);
    });
}

window.selectOption = function(score) {
    totalScore += score;
    currentQuestion++;

    if (currentQuestion < questions.length) {
        renderQuestion();
    } else {
        const result = calculateResult(totalScore);
        showResult(result);
        saveProgress(3, result);
        saveRiskProfile(result.riskType, result.recommendedPortfolio);
    }
};

function calculateResult(score) {
    let result = { riskType: "", icon: "", color: "", desc: "", recommendedPortfolio: "", score: score };

    if (score >= 30) {
        result = { riskType: "공격투자형", icon: "🔥", color: "text-red-500", desc: "높은 변동성을 견딜 준비가 된 투자자입니다. 시장 평균 이상의 수익을 위해 주식 비중을 높이세요.", recommendedPortfolio: "주식 80%, 채권 10%, 코인 10%" };
    } else if (score >= 22) {
        result = { riskType: "적극투자형", icon: "🚀", color: "text-orange-500", desc: "자산 증식에 적극적이지만 어느 정도의 안전 장치도 필요로 합니다.", recommendedPortfolio: "주식 70%, 채권 20%, 대체자산 10%" };
    } else if (score >= 15) {
        result = { riskType: "위험중립형", icon: "⚖️", color: "text-blue-500", desc: "수익과 안정의 균형을 중시합니다. 전통적인 60:40 포트폴리오가 잘 어울립니다.", recommendedPortfolio: "주식 60%, 채권 40%" };
    } else if (score >= 10) {
        result = { riskType: "안정추구형", icon: "🛡️", color: "text-emerald-500", desc: "원금 손실을 싫어하며 예적금보다 약간 더 높은 수익을 원합니다.", recommendedPortfolio: "주식 30%, 채권 60%, 현금 10%" };
    } else {
        result = { riskType: "안정형", icon: "💎", color: "text-slate-500", desc: "자산의 보존이 최우선입니다. 변동성이 극도로 낮은 자산 위주로 구성하세요.", recommendedPortfolio: "채권 80%, 현금 20%" };
    }
    return result;
}

function showResult(result) {
    const startScreen = document.getElementById('start-screen');
    const header = document.getElementById('test-header');
    const quizContainer = document.getElementById('quiz-container');
    const resultContainer = document.getElementById('result-container');

    if (startScreen) startScreen.classList.add('hidden');
    header.classList.add('hidden');
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');

    resultContainer.innerHTML = `
        <div class="text-center space-y-6">
            <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 text-5xl mb-4 shadow-inner">
                ${result.icon}
            </div>
            <p class="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">나의 투자 성향 분석 결과</p>
            <h2 class="text-4xl md:text-6xl font-black">당신은 <span class="${result.color}">${result.riskType}</span></h2>
            <p class="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">${result.desc}</p>
        </div>

        <div class="p-10 rounded-[3rem] bg-white dark:bg-[#1e293b] shadow-2xl border border-slate-100 dark:border-slate-800">
            <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 text-center">추천 포트폴리오 비중</h4>
            <div class="text-2xl font-black text-center text-blue-600 mb-8">${result.recommendedPortfolio || result.portfolio}</div>
            <div class="flex flex-col gap-4 mt-10">
                <button onclick="proceedToCurriculumStep4()" class="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl text-center shadow-xl hover:scale-105 transition-all text-lg">
                    4단계: 투자 기초 지식 학습하기 ➔
                </button>
                <div class="flex gap-4">
                    <button onclick="copyRiskTestResult()" class="flex-1 py-4 bg-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-800 transition-all flex items-center justify-center gap-2">
                        <span>📋 결과 공유</span>
                    </button>
                    <button onclick="location.reload()" class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-slate-500">다시 테스트</button>
                </div>
            </div>
        </div>

        <div id="save-status" class="p-8 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-center mt-8">
            <p class="text-sm text-blue-800 dark:text-blue-200">진단 결과가 자동 저장되었습니다.</p>
        </div>
    `;
}

window.proceedToCurriculumStep4 = function() {
    goToNextStep(3); // Go to Step 4
};

window.copyRiskTestResult = function() {
    const type = document.querySelector('#result-container h2 span').innerText;
    const portfolio = document.querySelector('#result-container .text-2xl').innerText;
    
    const text = \`🧠 Hedge Dochi 투자 성향 진단 결과 🧠\n\n\` +
                 \`나의 투자 스타일은: [ \${type} ]\n\` +
                 \`📊 추천 포트폴리오: \${portfolio}\n\n\` +
                 \`📍 당신의 투자 성향을 지금 진단해보세요!\n\` +
                 \`👉 https://hedge-dochi-live.pages.dev/step3-risk.html\`;

    navigator.clipboard.writeText(text).then(() => {
        showToast("진단 결과가 클립보드에 복사되었습니다! 🚀\n당신의 투자 스타일을 공유해보세요.");
    });
};

async function saveRiskProfile(type, portfolio) {
    if(!currentUser) return;
    try {
        await setDoc(doc(db, "risk_profiles", currentUser.uid), {
            type,
            portfolio,
            score: totalScore,
            updatedAt: new Date()
        }, { merge: true });
        
        const statusEl = document.getElementById('save-status');
        if (statusEl) {
            statusEl.innerHTML = \`<p class="text-sm text-emerald-600 font-bold">✅ 진단 결과가 대시보드에 안전하게 저장되었습니다!</p>\`;
        }
    } catch (e) { console.error("Save Error:", e); }
}
