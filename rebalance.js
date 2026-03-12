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
let liveExchangeRate = 1350;
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
        if (glider) glider.style.left = '4px';
        btnUsd?.classList.add('text-blue-600');
        btnKrw?.classList.add('text-slate-400');
        btnKrw?.classList.remove('text-blue-600');
    } else {
        if (glider) glider.style.left = 'calc(50% - 4px)';
        btnKrw?.classList.add('text-blue-600');
        btnUsd?.classList.add('text-slate-400');
        btnUsd?.classList.remove('text-blue-600');
    }
};

window.resetToLiveExchangeRate = function() {
    const input = document.getElementById('manualExchangeRate');
    if (input) {
        input.value = Math.round(liveExchangeRate);
        exchangeRate = liveExchangeRate;
        const display = document.getElementById('exchangeRateDisplay');
        if (display) display.innerText = `현재 환율: ₩${liveExchangeRate.toLocaleString()}`;
    }
};

// --- Search & Modal ---
window.toggleSearchModal = function(show) {
    const modal = document.getElementById('searchModal');
    const container = document.getElementById('searchModalContainer');
    if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
            document.getElementById('assetSearchInput').focus();
        }, 10);
    } else {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }
};

window.searchAsset = async function() {
    const q = document.getElementById('assetSearchInput').value.trim();
    if (!q) return;
    const resContainer = document.getElementById('searchResults');
    resContainer.innerHTML = '<div class="text-center py-8 animate-pulse text-xs text-slate-400">검색 중...</div>';
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const quotes = data?.quotes || [];
        if (quotes.length === 0) { resContainer.innerHTML = '<p class="text-xs text-center py-8">결과가 없습니다.</p>'; return; }
        resContainer.innerHTML = quotes.map(item => `
            <div onclick="selectAndAddAsset('${item.symbol}')" class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:border-blue-500 border border-transparent cursor-pointer transition-all flex justify-between items-center group">
                <div><p class="font-black group-hover:text-blue-600">${item.symbol}</p><p class="text-[10px] text-slate-400">${item.shortname || ''}</p></div>
                <span class="text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100">+ 추가</span>
            </div>
        `).join('');
    } catch (e) { resContainer.innerHTML = '<p class="text-xs text-red-400 text-center py-8">오류 발생</p>'; }
};

window.selectAndAddAsset = async function(ticker) {
    toggleSearchModal(false);
    await quickAdd(ticker);
    document.getElementById('assetSearchInput').value = '';
};

// --- Asset Management ---
window.addAsset = function(initialData = { ticker: '', qty: 0, price: 0 }) {
    const id = Date.now() + Math.random();
    assets.push({ id, ...initialData });
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
    } catch (e) { addAsset({ ticker, qty: 1, price: 0 }); }
};

window.updateAsset = function(id, key, val) {
    const asset = assets.find(a => a.id === id);
    if (asset) asset[key] = key === 'ticker' ? val.toUpperCase() : parseFloat(val);
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
            <div class="w-32"><label class="block text-[10px] font-bold text-slate-400 mb-1">PRICE</label><input type="number" value="${asset.price}" onchange="updateAsset(${asset.id}, 'price', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold"></div>
            <button onclick="removeAsset(${asset.id})" class="mt-4 p-3 text-red-400 hover:bg-red-50 rounded-xl transition-colors">✕</button>
        `;
        container.appendChild(div);
    });
}

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
    if (display) display.innerText = total + '%';
    if (btn) {
        if (total === 100) { btn.disabled = false; btn.classList.remove('opacity-50'); display.className = "text-2xl font-black text-emerald-500"; }
        else { btn.disabled = true; btn.classList.add('opacity-50'); display.className = "text-2xl font-black text-red-500"; }
    }
}

// --- Calculation ---
window.calculateRebalance = async function() {
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    if (btnText && btnSpinner) { btnText.classList.add('hidden'); btnSpinner.classList.remove('hidden'); }

    const manualRate = parseFloat(document.getElementById('manualExchangeRate')?.value);
    if (manualRate) exchangeRate = manualRate;

    const resultsContainer = document.getElementById('rebalanceResults');
    resultsContainer.innerHTML = '<div class="text-center py-8 animate-pulse font-bold text-slate-400">분석 중...</div>';

    let totalValueInBase = 0;
    const processedAssets = assets.map(a => {
        const isKRWAsset = a.ticker.endsWith('.KS') || a.ticker.endsWith('.KQ');
        let currentPriceInBase = a.price;
        if (baseCurrency === 'USD' && isKRWAsset) currentPriceInBase = a.price / exchangeRate;
        else if (baseCurrency === 'KRW' && !isKRWAsset && a.ticker !== 'CASH') currentPriceInBase = a.price * exchangeRate;
        const valueInBase = a.qty * currentPriceInBase;
        totalValueInBase += valueInBase;
        return { ...a, currentPriceInBase, valueInBase };
    });

    setTimeout(() => {
        resultsContainer.innerHTML = '';
        processedAssets.forEach(a => {
            const targetValue = totalValueInBase * (a.targetWeight / 100);
            const diffValue = targetValue - a.valueInBase;
            const diffQty = a.currentPriceInBase > 0 ? (diffValue / a.currentPriceInBase).toFixed(2) : 0;
            const div = document.createElement('div');
            div.className = "p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center animate-fade-in-up";
            let actionHTML = parseFloat(diffQty) > 0 ? `<div class="text-right"><span class="text-emerald-500 font-black">매수 ${diffQty}주</span><p class="text-[10px] text-slate-400">약 ${formatValue(Math.abs(diffValue))}</p></div>` : 
                             parseFloat(diffQty) < 0 ? `<div class="text-right"><span class="text-red-500 font-black">매도 ${Math.abs(diffQty)}주</span><p class="text-[10px] text-slate-400">약 ${formatValue(Math.abs(diffValue))}</p></div>` : 
                             `<span class="text-slate-400 font-black">유지</span>`;
            div.innerHTML = `<div class="flex flex-col"><span class="font-bold">${a.ticker}</span><span class="text-[10px] text-slate-400">${((a.valueInBase/totalValueInBase)*100).toFixed(1)}% → ${a.targetWeight}%</span></div>${actionHTML}`;
            resultsContainer.appendChild(div);
        });
        renderChart(processedAssets);
        updateHealthScore(processedAssets, totalValueInBase);
        goToStep(4);
        saveDataToFirebase();
        if (btnText && btnSpinner) { btnText.classList.remove('hidden'); btnSpinner.classList.add('hidden'); }
    }, 800);
};

function formatValue(val) {
    if (baseCurrency === 'KRW') return val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만';
    return '$' + Math.round(val).toLocaleString();
}

window.downloadRebalanceImage = function() {
    const area = document.querySelector('.capture-area');
    if (!area) return;
    
    if (window.showToast) window.showToast("진단 리포트 이미지를 생성하고 있습니다... 🖼️");

    html2canvas(area, { useCORS: true, backgroundColor: null, scale: 2, logging: false }).then(canvas => {
        const link = document.createElement('a');
        link.download = `HedgeDochi_Portfolio_Report.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (window.showToast) window.showToast("이미지 저장이 완료되었습니다! ✨");
    }).catch(() => {
        if (window.showToast) window.showToast("이미지 생성 중 오류가 발생했습니다.");
    });
};

function renderChart(processedAssets) {
    const ctx = document.getElementById('currentChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: processedAssets.map(a => a.ticker),
            datasets: [{ data: processedAssets.map(a => a.valueInBase), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderWidth: 0 }]
        },
        options: { cutout: '75%', plugins: { legend: { display: false } } }
    });
}

function updateHealthScore(processedAssets, totalValueInBase) {
    let totalDeviance = 0;
    processedAssets.forEach(a => {
        const currentWeight = totalValueInBase > 0 ? (a.valueInBase / totalValueInBase) * 100 : 0;
        totalDeviance += Math.abs(currentWeight - a.targetWeight);
    });
    const score = Math.max(0, 100 - Math.round(totalDeviance));
    const scoreEl = document.getElementById('healthScore');
    if (scoreEl) {
        scoreEl.innerText = score;
        scoreEl.className = `text-4xl font-black ${score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'}`;
    }
}

// --- Auth & Firebase ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn'), userProfile = document.getElementById('userProfile'), authContainerMobile = document.getElementById('authContainerMobile');
    if (user) {
        loginBtn?.classList.add('hidden'); userProfile?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        if (authContainerMobile) authContainerMobile.innerHTML = `<div class="flex items-center justify-between px-2"><div class="flex items-center gap-3"><img src="${user.photoURL}" class="w-8 h-8 rounded-full"><span class="font-bold text-sm text-slate-800 dark:text-white">${user.displayName}</span></div><button id="logoutBtnMobile" class="text-xs text-red-500 font-bold">로그아웃</button></div>`;
        document.getElementById('logoutBtnMobile')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
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

window.showToast = function(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
};

// --- Init ---
(async () => {
    try {
        const res = await fetch('/api/price?ticker=USDKRW=X');
        const data = await res.json();
        const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1350;
        liveExchangeRate = rate;
        exchangeRate = rate;
        const display = document.getElementById('exchangeRateDisplay');
        if (display) display.innerText = `현재 환율: ₩${rate.toLocaleString()}`;
        const input = document.getElementById('manualExchangeRate');
        if (input && !input.value) input.value = Math.round(rate);
        const now = new Date();
        const updateEl = document.getElementById('lastUpdateRebalance');
        if (updateEl) updateEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    } catch (e) {}
    if (assets.length === 0) addAsset();
})();
