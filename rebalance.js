// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

// Initialize Firebase
let app, auth, db, analytics;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
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
const refreshPricesBtn = document.getElementById('refreshPricesBtn');
const refreshIcon = document.getElementById('refreshIcon');

// Batch Price Fetching (Senior Optimizer Approach)
async function refreshAllPrices() {
    const validTickers = holdings
        .map(h => h.ticker.trim().toUpperCase())
        .filter(t => t && !['CASH', 'USD', 'KRW', '현금', 'NEW ASSET'].includes(t));

    if (validTickers.length === 0) {
        alert("시세를 불러올 유효한 종목(Ticker)이 없습니다. (현금 제외)");
        return;
    }

    // UI Feedback
    refreshPricesBtn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('animate-spin', 'inline-block');
    refreshPricesBtn.classList.add('opacity-50');

    try {
        const symbols = validTickers.join(',');
        const timestamp = Date.now();
        
        // 야후 파이낸스 미러 서버 목록
        const mirrors = [
            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&_=${timestamp}`,
            `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&_=${timestamp}`
        ];
        
        // 가용한 프록시 서버 목록 (순차 시도)
        const proxies = [
            { name: 'Primary-Proxy', getUrl: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, isDirect: false },
        // 가용한 프록시 서버 목록 (안정성 최우선)
        const proxies = [
            // AllOrigins: 느리지만 가장 안정적 (타임아웃 25초)
            { name: 'AllOrigins', getUrl: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, isDirect: false, timeout: 25000 },
            // ThingProxy: 안정적임 (타임아웃 15초)
            { name: 'ThingProxy', getUrl: (target) => `https://thingproxy.freeboard.io/fetch/${target}`, isDirect: true, timeout: 15000 }
        ];

        let quotes = null;
        let lastError = null;
        let successInfo = '';

        // 미러 서버와 프록시 서버 조합으로 시도
        outerLoop: for (const mirror of mirrors) {
            for (const proxy of proxies) {
                try {
                    const requestUrl = proxy.getUrl(mirror);
                    console.log(`Trying ${proxy.name}...`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), proxy.timeout || 15000);

                    const response = await fetch(requestUrl, { 
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        console.warn(`${proxy.name} HTTP ${response.status}`);
                        continue;
                    }

                    let data;
                    if (proxy.isDirect) {
                        // 텍스트로 먼저 받아서 JSON 파싱 시도
                        const text = await response.text();
                        try {
                            data = JSON.parse(text);
                        } catch (e) {
                            if (text.includes("Edge: Too many requests") || text.includes("Too Many Requests")) {
                                throw new Error("요청 한도 초과 (Too Many Requests)");
                            }
                            throw new Error("Invalid JSON response");
                        }
                    } else {
                        const raw = await response.json();
                        if (!raw || !raw.contents) throw new Error("Empty contents");
                        
                        try {
                            data = JSON.parse(raw.contents);
                        } catch (e) {
                             if (raw.status?.http_code === 429) throw new Error("Too Many Requests");
                             throw new Error("Invalid JSON in contents");
                        }
                    }

                    quotes = data?.quoteResponse?.result || data?.finance?.result || (Array.isArray(data) ? data : null);
                    
                    if (quotes && Array.isArray(quotes) && quotes.length > 0) {
                        successInfo = `${proxy.name}`;
                        break outerLoop; 
                    }
                } catch (e) {
                    console.warn(`${proxy.name} failed:`, e.message);
                    lastError = e;
                    continue; 
                }
            }
        }

        if (!quotes) {
            let errorMsg = lastError?.message || "연결 실패";
            if (errorMsg.includes("Too Many Requests")) {
                errorMsg = "서버 사용량이 많아 일시적으로 차단되었습니다. 1분 뒤 다시 시도해주세요.";
            } else if (errorMsg.includes("Failed to fetch")) {
                errorMsg = "네트워크 연결이 불안정하거나 차단되었습니다.";
            }
            throw new Error(errorMsg);
        }

        // Update holdings
        let updatedCount = 0;
        quotes.forEach(quote => {
            if (!quote || !quote.symbol) return;
            const index = holdings.findIndex(h => h.ticker.toUpperCase() === quote.symbol.toUpperCase());
            if (index !== -1) {
                const newPrice = quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice || quote.bid || quote.ask;
                if (newPrice) {
                    holdings[index].price = newPrice;
                    if (!holdings[index].name || holdings[index].name.includes('❌')) {
                        holdings[index].name = quote.shortName || quote.longName || quote.symbol;
                    }
                    updatedCount++;
                }
            }
        });

        console.log(`Updated ${updatedCount} prices via ${successInfo}.`);
        renderAssetList();
        alert(`${updatedCount}개 종목의 시세가 업데이트되었습니다. (${successInfo})`);

    } catch (error) {
        console.error("Price update completely failed:", error);
        alert("시세를 가져오는데 실패했습니다.\n\n원인: " + error.message);
    } finally {
        refreshPricesBtn.disabled = false;
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        refreshPricesBtn.classList.remove('opacity-50');
    }
}

if (refreshPricesBtn) {
    refreshPricesBtn.addEventListener('click', refreshAllPrices);
}

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
    holdings.push({ ticker: "", qty: 0, price: 0, targetPercent: 0 });
    renderAssetList();
});

// Helper: Validate Ticker & Get Name
window.validateTicker = async (index, symbol) => {
    if (!symbol || ['CASH', 'USD', 'KRW', '현금', 'NEW ASSET'].includes(symbol.toUpperCase())) {
        holdings[index].name = "현금성 자산";
        renderAssetList(); // Refresh to show name
        return;
    }

    try {
        const targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) return; // Silent fail

        const rawData = await response.json();
        const data = JSON.parse(rawData.contents);
        const quote = data.quoteResponse?.result?.[0];

        if (quote) {
            holdings[index].name = quote.shortName || quote.longName || symbol;
            // Optional: Auto-fill price if 0
            if (holdings[index].price === 0 && quote.regularMarketPrice) {
                holdings[index].price = quote.regularMarketPrice;
            }
        } else {
            holdings[index].name = "❌ 종목 확인 불가";
        }
    } catch (e) {
        console.warn("Validation failed for", symbol);
        holdings[index].name = "";
    }
    renderAssetList();
};

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group";
        
        const assetName = item.name ? `<div class="text-[10px] text-slate-400 truncate max-w-[100px]">${item.name}</div>` : '';

        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    <div class="flex items-center gap-1">
                        <input type="text" placeholder="예: AAPL" value="${item.ticker}" class="w-full min-w-[60px] bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200 uppercase" 
                            onchange="updateHolding(${index}, 'ticker', this.value)"
                            onblur="validateTicker(${index}, this.value)">
                    </div>
                    ${assetName}
                </div>
            </td>
            <td class="py-3 px-2 align-middle">
                <input type="number" placeholder="0" value="${item.qty}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'qty', this.value)">
            </td>
            <td class="py-3 px-2 align-middle">
                <input type="number" placeholder="0" value="${item.price}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'price', this.value)">
            </td>
            <td class="py-3 px-2 align-middle">
                <div class="relative">
                    <input type="number" placeholder="0" value="${item.targetPercent}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)">
                    <span class="absolute right-[-10px] top-1/2 -translate-y-1/2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">%</span>
                </div>
            </td>
            <td class="py-3 px-2 text-center align-middle">
                <button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
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
        holdings[index][field] = value.toUpperCase(); // Ticker uppercase
    }
    updateCalculation();
};

window.removeAsset = (index) => {
    if(confirm('정말 이 종목을 삭제하시겠습니까?')) {
        holdings.splice(index, 1);
        renderAssetList();
    }
};

function updateCalculation() {
    let totalValue = 0;
    let totalTargetPercent = 0;

    // 1. Calculate Total Value
    holdings.forEach(item => {
        totalValue += item.qty * item.price;
        totalTargetPercent += item.targetPercent;
    });

    // 2. Update Summary UI & Target Percent Feedback
    document.getElementById('totalValueDisplay').innerText = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const totalPercentDisplay = document.getElementById('totalPercentDisplay');
    const diffPercent = 100 - totalTargetPercent;
    
    if (Math.abs(diffPercent) < 0.1) {
        totalPercentDisplay.innerHTML = `<span class="text-emerald-500">✨ 목표 비중 합계: 100% (완벽함)</span>`;
    } else if (diffPercent > 0) {
        totalPercentDisplay.innerHTML = `<span class="text-amber-500 font-bold">⚠️ 목표 비중 합계: ${totalTargetPercent.toFixed(1)}% (${diffPercent.toFixed(1)}% 부족)</span>`;
    } else {
        totalPercentDisplay.innerHTML = `<span class="text-red-500 font-bold">🚫 목표 비중 합계: ${totalTargetPercent.toFixed(1)}% (${Math.abs(diffPercent).toFixed(1)}% 초과)</span>`;
    }

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
        chartLabels.push(item.ticker || 'No Name');
        currentWeights.push((currentWeight * 100).toFixed(1));
        targetWeights.push(item.targetPercent);

        // Action Logic
        if (totalValue > 0) {
            const deviation = Math.abs(diffVal / totalValue); // Deviation relative to total portfolio
            
            if (deviation > THRESHOLD) {
                isBalanced = false;
                const actionDiv = document.createElement('div');
                actionDiv.className = "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md " + 
                    (diffVal > 0 ? "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" : "bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30");
                
                let actionBadge = "";
                let actionDetail = "";
                
                if (diffVal > 0) {
                    // Buy
                    const buyQty = item.price > 0 ? (diffVal / item.price).toFixed(2) : 0;
                    actionBadge = `<span class="inline-block px-3 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-black text-sm">매수 (BUY)</span>`;
                    actionDetail = `<span class="text-red-600 dark:text-red-400 font-bold text-lg">+${buyQty}주</span> <span class="text-xs text-slate-500">($${diffVal.toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                } else {
                    // Sell
                    const sellQty = item.price > 0 ? (Math.abs(diffVal) / item.price).toFixed(2) : 0;
                    actionBadge = `<span class="inline-block px-3 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-black text-sm">매도 (SELL)</span>`;
                    actionDetail = `<span class="text-blue-600 dark:text-blue-400 font-bold text-lg">-${sellQty}주</span> <span class="text-xs text-slate-500">($${Math.abs(diffVal).toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                }

                actionDiv.innerHTML = `
                    <div class="flex items-center gap-3 mb-2 sm:mb-0">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-600 bg-white shadow-sm border border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                            ${item.ticker.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <span class="block font-bold text-slate-800 dark:text-slate-100">${item.ticker}</span>
                            <span class="text-xs text-slate-500">목표: ${item.targetPercent}% (현재: ${(currentWeight*100).toFixed(1)}%)</span>
                        </div>
                    </div>
                    <div class="text-right flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto">
                        ${actionBadge}
                        <div class="text-right">
                            ${actionDetail}
                        </div>
                    </div>
                `;
                actionPlanList.appendChild(actionDiv);
            }
        }
    });

    if (isBalanced) {
        actionPlanList.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <span class="text-4xl mb-2">🎉</span>
                <p class="font-bold text-lg text-slate-600 dark:text-slate-300">포트폴리오가 완벽합니다!</p>
                <p class="text-sm">현재 리밸런싱이 필요하지 않습니다.</p>
            </div>
        `;
        document.getElementById('statusIcon').innerText = "✅";
        document.getElementById('statusTitle').innerText = "상태 양호";
        document.getElementById('statusDesc').innerText = "현재 포트폴리오 비율이 목표와 일치합니다.";
    } else {
        document.getElementById('statusIcon').innerText = "⚡️";
        document.getElementById('statusTitle').innerText = "리밸런싱 필요";
        document.getElementById('statusDesc').innerText = "목표 비중과 차이가 발생했습니다.";
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

// Ticker Search Logic
const tickerSearchInput = document.getElementById('tickerSearchInput');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const searchResults = document.getElementById('searchResults');

let searchTimeout = null;

if (tickerSearchInput) {
    tickerSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            searchResultsContainer.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(() => performSearch(query), 500);
    });
}

async function performSearch(query) {
    searchResultsContainer.classList.remove('hidden');
    searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';

    try {
        const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`;

        console.log("Searching for:", query);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("네트워크 응답 에러");
        
        const rawData = await response.json();
        if (!rawData || !rawData.contents) throw new Error("데이터를 가져올 수 없습니다.");

        const data = JSON.parse(rawData.contents);
        console.log("Search results data:", data);

        const quotes = data.quotes || [];
        
        if (quotes.length === 0) {
            searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 결과가 없습니다.</li>';
            return;
        }

        searchResults.innerHTML = '';
        quotes.forEach(quote => {
            // symbol이 없거나 유효하지 않은 결과는 제외
            if (!quote.symbol) return;
            
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900 group";
            
            const name = quote.shortname || quote.longname || quote.symbol;
            const exchange = quote.exchDisp || quote.exchange || "Unknown";
            const type = quote.quoteType || "Stock";

            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1 min-w-0 pr-4">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-blue-600 dark:text-blue-400 group-hover:underline truncate">${quote.symbol}</span>
                            <span class="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-medium">${exchange}</span>
                        </div>
                        <div class="text-sm text-slate-600 dark:text-slate-300 truncate">${name}</div>
                        <div class="text-[10px] text-slate-400">${type}</div>
                    </div>
                    <button class="add-btn shrink-0 bg-blue-600 text-white dark:bg-blue-600 dark:text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all hover:bg-blue-700">
                        + 추가
                    </button>
                </div>
            `;
            li.onclick = async (e) => {
                const btn = li.querySelector('.add-btn');
                if (btn.disabled) return;
                
                // 즉각적인 피드백 제공
                btn.disabled = true;
                btn.innerHTML = '<span>⏳ 처리 중...</span>';
                btn.classList.add('opacity-70', 'cursor-not-allowed');
                
                await addAssetFromSearch(quote);
            };
            searchResults.appendChild(li);
        });
    } catch (e) {
        console.error("Search error detail:", e);
        searchResults.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">오류: ${e.message}</li>`;
    }
}

async function addAssetFromSearch(quote) {
    if (!quote || !quote.symbol) return;

    // Check if already exists
    const exists = holdings.find(h => h.ticker.toUpperCase() === quote.symbol.toUpperCase());
    if (exists) {
        alert(`'${quote.symbol}'은(는) 이미 목록에 있습니다.`);
        return;
    }

    // Try to get initial price with stability (Multi-Proxy)
    let price = 0;
    try {
        const targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(quote.symbol)}`;
        const proxies = [
            { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, isDirect: false },
            { url: `https://thingproxy.freeboard.io/fetch/${targetUrl}`, isDirect: true }
        ];

        for (const proxy of proxies) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                const response = await fetch(proxy.url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                let data;
                if (proxy.isDirect) {
                    const text = await response.text();
                    try { data = JSON.parse(text); } catch { continue; }
                } else {
                    const raw = await response.json();
                    if (raw.contents) data = JSON.parse(raw.contents);
                }

                const result = data?.quoteResponse?.result?.[0] || data?.finance?.result?.[0];
                if (result) {
                    price = result.regularMarketPrice || result.postMarketPrice || result.preMarketPrice || result.bid || 0;
                    if (price > 0) break;
                }
            } catch (e) {
                // Ignore and try next
            }
        }
    } catch (e) {
        console.warn("Initial price fetch failed for", quote.symbol, e.message);
    }

    const newAsset = {
        ticker: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        qty: 0,
        price: price,
        targetPercent: 0
    };

    holdings.push(newAsset);
    
    // UI Update
    tickerSearchInput.value = '';
    searchResultsContainer.classList.add('hidden');
    renderAssetList();
    
    // Highlight the new row
    setTimeout(() => {
        const rows = assetListBody.querySelectorAll('tr');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lastRow.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            setTimeout(() => {
                lastRow.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
            }, 2000);
        }
    }, 100);
}

// Initial render
renderAssetList();
