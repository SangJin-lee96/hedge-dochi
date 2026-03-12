import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentStep = 1;
let fireChart = null;
let currentUser = null;

onAuthStateChanged(auth, user => currentUser = user);

window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.calculateFIRE = function() {
    const monthlyExpense = parseFloat(document.getElementById('f-expense').value) || 0;
    const currentSeed = parseFloat(document.getElementById('f-seed').value) || 0;
    const annualSave = parseFloat(document.getElementById('f-annual-save').value) || 0;
    const rate = (parseFloat(document.getElementById('f-rate').value) || 0) / 100;
    const swr = 0.04; // 4% 법칙 고정

    const fireGoal = (monthlyExpense * 12) / swr;
    let currentWealth = currentSeed;
    let months = 0;
    const monthlySave = annualSave / 12;
    const monthlyRate = rate / 12;
    const chartData = [currentSeed];
    const chartLabels = ["현재"];

    while (currentWealth < fireGoal && months < 600) { // 최대 50년
        currentWealth = (currentWealth + monthlySave) * (1 + monthlyRate);
        months++;
        if (months % 12 === 0) {
            chartData.push(Math.round(currentWealth));
            chartLabels.push(`${months/12}년`);
        }
    }

    const years = Math.floor(months / 12);
    const achievementYear = new Date().getFullYear() + years;

    document.getElementById('fireYearsResult').innerText = `${years}년 후`;
    document.getElementById('fireDateResult').innerText = `당신은 ${achievementYear}년에 은퇴 가능합니다.`;
    document.getElementById('fireGoalAmount').innerText = formatKorean(fireGoal);
    document.getElementById('fireMonthlyIncome').innerText = formatKorean(monthlyExpense);

    renderFireChart(chartLabels, chartData);
    renderAdvice(years);
    if (currentUser) saveFireData(fireGoal, years, achievementYear);
    
    goToStep(4);
};

function renderFireChart(labels, data) {
    const ctx = document.getElementById('fireChart').getContext('2d');
    if (fireChart) fireChart.destroy();
    fireChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: '자산 성장', data: data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });
}

async function saveFireData(goal, years, targetYear) {
    try {
        await setDoc(doc(db, "fire_goals", currentUser.uid), {
            goalAmount: goal,
            remainingYears: years,
            targetYear: targetYear,
            updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

function renderAdvice(years) {
    const el = document.getElementById('fireAdvice');
    if (years <= 10) el.innerText = "은퇴가 가깝습니다! 이제는 자산의 하락 방어와 인출 전략을 구체화하세요.";
    else if (years <= 20) el.innerText = "안정적인 궤도입니다. 저축률을 5%만 높여도 은퇴를 3년 앞당길 수 있습니다.";
    else el.innerText = "긴 여정이지만 복리의 힘은 마지막에 폭발합니다. 꾸준함이 정답입니다.";
}

window.copyFireResult = function() {
    const years = document.getElementById('fireYearsResult').innerText;
    const date = document.getElementById('fireDateResult').innerText;
    const goal = document.getElementById('fireGoalAmount').innerText;
    const income = document.getElementById('fireMonthlyIncome').innerText;

    const text = `🏁 Hedge Dochi 경제적 자유(FIRE) 리포트 🏁\n\n` +
                 `🏝️ 은퇴까지 남은 기간: ${years}\n` +
                 `📅 은퇴 가능 예상 시점: ${date}\n` +
                 `💰 목표 은퇴 자산: ${goal}\n` +
                 `💵 은퇴 후 월 예상 수입: ${income}\n\n` +
                 `📍 당신은 언제 은퇴할 수 있을까요? 지금 확인해보세요!\n` +
                 `👉 https://hedge-dochi-live.pages.dev/fire-calc.html`;

    navigator.clipboard.writeText(text).then(() => {
        alert("은퇴 리포트가 클립보드에 복사되었습니다! 🚀");
    });
};

function formatKorean(val) {
    return val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만';
}

goToStep(1);
