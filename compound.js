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

// Import Firebase (Auth check는 auth-check.js에서 처리되므로 여기선 데이터 저장용으로만 사용)
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
const auth = getAuth();
onAuthStateChanged(auth, user => currentUser = user);

// --- Calculation ---
window.calculateCompound = function() {
    // ... (기존 계산 로직 동일)
// ... (중략)
    renderTable(yearlyData);
    goToStep(3);
    if (currentUser) saveCompoundData(seed, monthly, rate, period);
};

async function saveCompoundData(seed, monthly, rate, period) {
    try {
        const db = getFirestore();
        await setDoc(doc(db, "compound_settings", currentUser.uid), {
            seed, monthly, rate, period, updatedAt: new Date()
        }, { merge: true });
    } catch (e) { console.error(e); }
}

window.copyCompoundResult = function() {
    const total = document.getElementById('totalCompoundResult').innerText;
    const profit = document.getElementById('totalProfitResult').innerText;
    const accel = document.getElementById('profitRatio').innerText;

    const text = `⏳ Hedge Dochi 복리의 마법 리포트 ⏳\n\n` +
                 `💰 최종 자산: ${total}\n` +
                 `📈 ${profit}\n` +
                 `🚀 복리 가속도: ${accel}\n\n` +
                 `📍 당신의 적립식 투자 미래를 지금 확인해보세요!\n` +
                 `👉 https://hedge-dochi-live.pages.dev/compound.html`;

    navigator.clipboard.writeText(text).then(() => {
        alert("결과 리포트가 클립보드에 복사되었습니다! 🚀");
    });
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
