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

// Import Firebase
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
const auth = getAuth();
onAuthStateChanged(auth, user => currentUser = user);

// --- State Management ---
// ... (기존 변수 유지)

// --- Calculation ---
window.calculateDividend = function() {
    const total = parseFloat(document.getElementById('d-total').value) || 0;
    const yieldRate = (parseFloat(document.getElementById('d-yield').value) || 0) / 100;
    const taxRate = (parseFloat(document.getElementById('d-tax').value) || 0) / 100;
    const isReinvest = document.getElementById('d-reinvest').checked;

    const annualNet = (total * yieldRate) * (1 - taxRate);
    const monthlyNet = annualNet / 12;

    // ... (10년 시뮬레이션 로직 유지)
    // ... (결과 렌더링 로직 유지)

    goToStep(4);
    if (currentUser) saveDividendData(monthlyNet, annualNet);
};

async function saveDividendData(monthly, annual) {
    try {
        const db = getFirestore();
        await setDoc(doc(db, "dividend_goals", currentUser.uid), {
            monthlyIncome: monthly,
            annualIncome: annual,
            updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

window.copyDividendResult = function() {
    const monthly = document.getElementById('monthlyDividendResult').innerText;
    const annual = document.getElementById('annualDividendResult').innerText;
    const text = `💰 Hedge Dochi 배당금 리포트 💰\n\n💵 예상 월 세후 배당금: ${monthly}\n📅 ${annual}\n\n📍 나의 꼬박꼬박 들어오는 현금흐름, 지금 확인해보세요!\n👉 https://hedge-dochi-live.pages.dev/dividend.html`;
    navigator.clipboard.writeText(text).then(() => alert("배당 리포트가 복사되었습니다! 🚀"));
};

function formatKorean(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + '억';
    return Math.round(val).toLocaleString() + '만';
}

// --- Init ---
goToStep(1);
