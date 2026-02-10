// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase project config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
} catch (e) {
    console.error("Firebase initialization error:", e);
}

// State Management
let currentUser = null;
let holdings = [
    // Default Preset
    { ticker: "S&P 500", qty: 10, price: 500, targetPercent: 70 },
    { ticker: "Nasdaq 100", qty: 20, price: 400, targetPercent: 30 }
];
let chartInstance = null;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('userProfile');
const userPhoto = document.getElementById('userPhoto');
const loginAlert = document.getElementById('loginAlert');
const appContent = document.getElementById('appContent');
const assetListBody = document.getElementById('assetListBody');
const addAssetBtn = document.getElementById('addAssetBtn');
const saveBtn = document.getElementById('saveBtn');

// Auth Logic
const provider = new GoogleAuthProvider();

loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("로그인에 실패했습니다: " + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        alert("로그아웃 되었습니다.");
        // Reset to defaults
        holdings = [
            { ticker: "S&P 500", qty: 10, price: 500, targetPercent: 70 },
            { ticker: "Nasdaq 100", qty: 20, price: 400, targetPercent: 30 }
        ];
        renderAssetList();
        updateCalculation();
    });
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // UI Update
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userPhoto.src = user.photoURL;
        loginAlert.classList.add('hidden');
        appContent.classList.remove('hidden');
        appContent.classList.add('grid'); // Restore grid layout
        
        // Load User Data
        await loadPortfolio();
    } else {
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
        loginAlert.classList.remove('hidden');
        appContent.classList.add('hidden');
        appContent.classList.remove('grid');
    }
});

// Firestore Logic
async function loadPortfolio() {
    if (!currentUser) return;
    const docRef = doc(db, "users", currentUser.uid);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.holdings && Array.isArray(data.holdings)) {
                holdings = data.holdings;
            }
        } else {
            // First time user, save default preset
            await savePortfolio(true);
        }
        renderAssetList();
        updateCalculation();
    } catch (e) {
        console.error("Error loading document:", e);
    }
}

async function savePortfolio(silent = false) {
    if (!currentUser) return;
    try {
        // Validate Total Target Percent
        const totalTarget = holdings.reduce((sum, item) => sum + item.targetPercent, 0);
        if (Math.abs(totalTarget - 100) > 0.1) {
            if (!silent) alert(`목표 비중의 합이 100%가 되어야 합니다. (현재: ${totalTarget.toFixed(1)}%)`);
            // We save anyway to not lose user work, but warn them
        }

        await setDoc(doc(db, "users", currentUser.uid), {
            uid: currentUser.uid,
            holdings: holdings,
            lastUpdated: new Date()
        });
        if (!silent) alert("포트폴리오가 저장되었습니다! 💾");
    } catch (e) {
        console.error("Error adding document:", e);
        if (!silent) alert("저장 실패: " + e.message);
    }
}

saveBtn.addEventListener('click', () => savePortfolio());

// UI & Calculation Logic
addAssetBtn.addEventListener('click', () => {
    holdings.push({ ticker: "New Asset", qty: 0, price: 0, targetPercent: 0 });
    renderAssetList();
});

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";
        
        tr.innerHTML = `
            <td class="py-3 px-2">
                <input type="text" value="${item.ticker}" class="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200" onchange="updateHolding(${index}, 'ticker', this.value)">
            </td>
            <td class="py-3 px-2">
                <input type="number" value="${item.qty}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'qty', this.value)">
            </td>
            <td class="py-3 px-2">
                <input type="number" value="${item.price}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'price', this.value)">
            </td>
            <td class="py-3 px-2">
                <input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)">
            </td>
            <td class="py-3 px-2 text-center">
                <button onclick="removeAsset(${index})" class="text-slate-400 hover:text-red-500 transition-colors">🗑️</button>
            </td>
        `;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = (index, field, value) => {
    if (field === 'qty' || field === 'price' || field === 'targetPercent') {
        holdings[index][field] = parseFloat(value) || 0;
    } else {
        holdings[index][field] = value;
    }
    updateCalculation();
};

window.removeAsset = (index) => {
    holdings.splice(index, 1);
    renderAssetList();
};

function updateCalculation() {
    let totalValue = 0;
    let totalTargetPercent = 0;

    // 1. Calculate Total Value
    holdings.forEach(item => {
        totalValue += item.qty * item.price;
        totalTargetPercent += item.targetPercent;
    });

    // 2. Update Summary UI
    document.getElementById('totalValueDisplay').innerText = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    const totalPercentDisplay = document.getElementById('totalPercentDisplay');
    totalPercentDisplay.innerText = `현재 목표 비중 합계: ${totalTargetPercent.toFixed(1)}%`;
    totalPercentDisplay.style.color = Math.abs(totalTargetPercent - 100) < 0.1 ? '#2563eb' : '#ef4444'; // Blue if 100%, Red otherwise

    // 3. Calculate Rebalancing Actions
    const actionPlanList = document.getElementById('actionPlanList');
    actionPlanList.innerHTML = '';
    let isBalanced = true;

    // Threshold for rebalancing (3% deviation)
    const THRESHOLD = 0.03; 

    const chartLabels = [];
    const currentWeights = [];
    const targetWeights = [];

    holdings.forEach(item => {
        const currentVal = item.qty * item.price;
        const currentWeight = totalValue > 0 ? (currentVal / totalValue) : 0;
        const targetVal = totalValue * (item.targetPercent / 100);
        const diffVal = targetVal - currentVal;
        
        // Chart Data
        chartLabels.push(item.ticker);
        currentWeights.push((currentWeight * 100).toFixed(1));
        targetWeights.push(item.targetPercent);

        // Action Logic
        if (totalValue > 0) {
            const deviation = Math.abs(diffVal / totalValue); // Deviation relative to total portfolio
            
            if (deviation > THRESHOLD) {
                isBalanced = false;
                const actionDiv = document.createElement('div');
                actionDiv.className = "flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm";
                
                let actionText = "";
                let badgeClass = "";
                
                if (diffVal > 0) {
                    // Buy
                    const buyQty = item.price > 0 ? (diffVal / item.price).toFixed(2) : 0;
                    actionText = `<span class="font-bold text-red-500">매수 (BUY)</span> <span class="text-sm ml-2">약 ${buyQty}주 ($${diffVal.toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                    badgeClass = "bg-red-50 text-red-600 border-red-100";
                } else {
                    // Sell
                    const sellQty = item.price > 0 ? (Math.abs(diffVal) / item.price).toFixed(2) : 0;
                    actionText = `<span class="font-bold text-blue-500">매도 (SELL)</span> <span class="text-sm ml-2">약 ${sellQty}주 ($${Math.abs(diffVal).toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                    badgeClass = "bg-blue-50 text-blue-600 border-blue-100";
                }

                actionDiv.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-slate-700 dark:text-slate-200">${item.ticker}</span>
                        <span class="text-xs px-2 py-1 rounded-full ${badgeClass} font-bold">${(currentWeight*100).toFixed(1)}% → ${item.targetPercent}%</span>
                    </div>
                    <div class="text-right">
                        ${actionText}
                    </div>
                `;
                actionPlanList.appendChild(actionDiv);
            }
        }
    });

    if (isBalanced) {
        actionPlanList.innerHTML = `
            <div class="text-center py-6 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p class="font-bold mb-1">🎉 완벽합니다!</p>
                <p class="text-sm">리밸런싱이 필요하지 않습니다.</p>
            </div>
        `;
        document.getElementById('statusIcon').innerText = "✅";
        document.getElementById('statusTitle').innerText = "상태 양호";
        document.getElementById('statusDesc').innerText = "현재 포트폴리오 비율이 목표와 일치합니다.";
    } else {
        document.getElementById('statusIcon').innerText = "⚠️";
        document.getElementById('statusTitle').innerText = "조정 필요";
        document.getElementById('statusDesc').innerText = "일부 자산이 목표 비율을 벗어났습니다.";
    }

    updateChart(chartLabels, currentWeights, targetWeights);
}

function updateChart(labels, currentData, targetData) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '현재 비중 (%)',
                    data: currentData,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)', // Indigo
                    borderRadius: 4,
                },
                {
                    label: '목표 비중 (%)',
                    data: targetData,
                    backgroundColor: 'rgba(16, 185, 129, 0.5)', // Emerald
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    type: 'line',
                    pointStyle: 'circle',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Initial render for default data (before login)
// The Auth listener will handle the actual data loading
renderAssetList();
