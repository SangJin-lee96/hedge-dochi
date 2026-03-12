// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- State Management ---
let currentStep = 1;
let baseCurrency = 'USD';
let exchangeRate = 1350;
let assets = [];
let chart = null;
let currentUser = null;

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

    if (step === 3) renderWeights();
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Currency Management ---
window.setCurrency = function(code) {
    baseCurrency = code;
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-currency-usd');
    const btnKrw = document.getElementById('btn-currency-krw');

    if (code === 'USD') {
        glider.style.left = '4px';
        btnUsd.classList.add('text-blue-600');
        btnKrw.classList.add('text-slate-400');
        btnKrw.classList.remove('text-blue-600');
    } else {
        glider.style.left = 'calc(50% - 4px)';
        btnKrw.classList.add('text-blue-600');
        btnUsd.classList.add('text-slate-400');
        btnUsd.classList.remove('text-blue-600');
    }
};

// --- Asset Management ---
window.addAsset = function(initialData = { ticker: '', qty: 0, price: 0 }) {
    const id = Date.now() + Math.random();
    const asset = { id, ...initialData };
    assets.push(asset);
    renderAssets();
};

window.removeAsset = function(id) {
    assets = assets.filter(a => a.id !== id);
    renderAssets();
};

window.quickAdd = async function(ticker) {
    try {
        const res = await fetch(`/api/price?ticker=${ticker}`);
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
        addAsset({ ticker, qty: 1, price: price });
    } catch (e) {
        addAsset({ ticker, qty: 1, price: 0 });
    }
};

function renderAssets() {
    const container = document.getElementById('assetContainer');
    container.innerHTML = '';
    assets.forEach(asset => {
        const div = document.createElement('div');
        div.className = "p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4 animate-fade-in-up";
        div.innerHTML = `
            <div class="flex-1 min-w-[120px]"><label class="block text-[10px] font-bold text-slate-400 mb-1">TICKER</label><input type="text" value="${asset.ticker}" onchange="updateAsset(${asset.id}, 'ticker', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold uppercase"></div>
            <div class="w-32"><label class="block text-[10px] font-bold text-slate-400 mb-1">QTY</label><input type="number" value="${asset.qty}" onchange="updateAsset(${asset.id}, 'qty', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold"></div>
            <div class="w-32"><label class="block text-[10px] font-bold text-slate-400 mb-1">PRICE (${baseCurrency})</label><input type="number" value="${asset.price}" onchange="updateAsset(${asset.id}, 'price', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold"></div>
            <button onclick="removeAsset(${asset.id})" class="mt-4 p-3 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">✕</button>
        `;
        container.appendChild(div);
    });
}

window.updateAsset = function(id, key, val) {
    const asset = assets.find(a => a.id === id);
    if (asset) {
        asset[key] = key === 'ticker' ? val.toUpperCase() : parseFloat(val);
    }
};

// --- Weight Management ---
function renderWeights() {
    const container = document.getElementById('weightContainer');
    container.innerHTML = '';
    const avgWeight = Math.floor(100 / assets.length);
    assets.forEach((asset, idx) => {
        if (!asset.targetWeight) asset.targetWeight = idx === assets.length - 1 ? 100 - (avgWeight * (assets.length - 1)) : avgWeight;
        const div = document.createElement('div');
        div.className = "space-y-2";
        div.innerHTML = `
            <div class="flex justify-between items-end px-2"><span class="font-black text-slate-800 dark:text-white">${asset.ticker || '자산 ' + (idx+1)}</span><span class="text-blue-600 font-black">${asset.targetWeight}%</span></div>
            <input type="range" value="${asset.targetWeight}" oninput="updateWeight(${asset.id}, this.value)" class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600">
        `;
        container.appendChild(div);
    });
    updateTotalWeight();
}

window.updateWeight = function(id, val) {
    const asset = assets.find(a => a.id === id);
    if (asset) asset.targetWeight = parseInt(val);
    renderWeights();
};

function updateTotalWeight() {
    const total = assets.reduce((sum, a) => sum + (a.targetWeight || 0), 0);
    const display = document.getElementById('totalWeight');
    const btn = document.getElementById('btn-final-step');
    display.innerText = total + '%';
    if (total === 100) {
        display.className = "text-2xl font-black text-emerald-500";
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        display.className = "text-2xl font-black text-red-500";
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// --- Calculation ---
window.calculateRebalance = async function() {
    const totalValue = assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
    const resultsContainer = document.getElementById('rebalanceResults');
    resultsContainer.innerHTML = '';

    assets.forEach(a => {
        const targetValue = totalValue * (a.targetWeight / 100);
        const diffValue = targetValue - (a.qty * a.price);
        const diffQty = a.price > 0 ? (diffValue / a.price).toFixed(2) : 0;
        
        const div = document.createElement('div');
        div.className = "p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center";
        const actionText = diffQty > 0 ? `<span class="text-emerald-500">매수 ${diffQty}주</span>` : `<span class="text-red-500">매도 ${Math.abs(diffQty)}주</span>`;
        div.innerHTML = `<span class="font-bold">${a.ticker}</span><div class="font-black">${diffQty == 0 ? '유지' : actionText}</div>`;
        resultsContainer.appendChild(div);
    });

    renderChart();
    updateHealthScore();
    goToStep(4);
    saveDataToFirebase();
};

function renderChart() {
    const ctx = document.getElementById('currentChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: assets.map(a => a.ticker),
            datasets: [{ data: assets.map(a => a.qty * a.price), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } } }
    });
}

function updateHealthScore() {
    const totalValue = assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
    let totalDeviance = 0;
    assets.forEach(a => {
        const currentWeight = totalValue > 0 ? (a.qty * a.price / totalValue) * 100 : 0;
        totalDeviance += Math.abs(currentWeight - a.targetWeight);
    });
    const score = Math.max(0, 100 - Math.round(totalDeviance));
    document.getElementById('healthScore').innerText = score;
}

// --- Auth & Firebase Persistence ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn'), userProfile = document.getElementById('userProfile'), authContainerMobile = document.getElementById('authContainerMobile');
    if (user) {
        loginBtn?.classList.add('hidden'); userProfile?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        if (authContainerMobile) {
            authContainerMobile.innerHTML = `<div class="flex items-center justify-between px-2"><div class="flex items-center gap-3"><img src="${user.photoURL}" class="w-8 h-8 rounded-full"><span class="font-bold text-sm">${user.displayName}</span></div><button id="logoutBtnMobile" class="text-xs text-red-500 font-bold">로그아웃</button></div>`;
            document.getElementById('logoutBtnMobile').addEventListener('click', () => signOut(auth).then(() => location.reload()));
        }
        // 데이터 로드
        const docSnap = await getDoc(doc(db, "portfolios", user.uid));
        if (docSnap.exists() && assets.length === 0) {
            assets = docSnap.data().assets;
            baseCurrency = docSnap.data().baseCurrency || 'USD';
            setCurrency(baseCurrency);
            renderAssets();
        }
    } else {
        loginBtn?.classList.remove('hidden'); userProfile?.classList.add('hidden');
        if (authContainerMobile) authContainerMobile.innerHTML = `<button onclick="document.getElementById('loginBtn').click()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">구글 로그인</button>`;
    }
});

async function saveDataToFirebase() {
    if (!currentUser) return;
    await setDoc(doc(db, "portfolios", currentUser.uid), { assets, baseCurrency, lastUpdated: new Date() }, { merge: true });
}

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

// --- Init ---
(async () => {
    try {
        const res = await fetch('/api/price?ticker=USDKRW=X');
        const data = await res.json();
        exchangeRate = data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1350;
        document.getElementById('exchangeRateDisplay').innerText = `현재 환율: ₩${exchangeRate.toLocaleString()}`;
    } catch (e) {}
    if (assets.length === 0) addAsset();
})();
