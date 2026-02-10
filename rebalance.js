// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
// (GitHub 경고는 Client-side 앱 특성상 불가피하며, Firebase Console에서 도메인 제한을 걸어두는 것이 정석입니다.)
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
const tickerSearchInput = document.getElementById('tickerSearchInput');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const searchResults = document.getElementById('searchResults');

// ==========================================
// 1. Optimized Price Fetching (Internal API)
// ==========================================
async function refreshAllPrices() {
    const validHoldings = holdings.filter(h => 
        h.ticker && h.ticker.trim() !== '' && 
        !['CASH', 'USD', 'KRW', '현금', 'NEW ASSET'].includes(h.ticker.toUpperCase())
    );

    if (validHoldings.length === 0) {
        alert("시세를 불러올 유효한 종목(Ticker)이 없습니다. (현금 제외)");
        return;
    }

    refreshPricesBtn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('animate-spin', 'inline-block');
    refreshPricesBtn.classList.add('opacity-50');
    
    let successCount = 0;
    let failCount = 0;

    // 순차 처리 (서버 부하 방지 및 안정성 확보)
    for (let i = 0; i < validHoldings.length; i++) {
        const item = validHoldings[i];
        try {
            console.log(`Fetching price for ${item.ticker} (${i + 1}/${validHoldings.length})...`);
            
            // Cloudflare Functions API 호출
            const response = await fetch(`/api/price?ticker=${encodeURIComponent(item.ticker)}`);
            
            if (response.ok) {
                const data = await response.json();
                const result = data?.chart?.result?.[0];
                
                if (result && result.meta) {
                    const price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
                    if (price > 0) {
                        const index = holdings.indexOf(item);
                        if (index !== -1) {
                            holdings[index].price = price;
                            if (!holdings[index].name || holdings[index].name.includes('❌')) {
                                holdings[index].name = result.meta.symbol || item.ticker;
                            }
                            successCount++;
                        }
                    } else { failCount++; }
                } else { failCount++; }
            } else { failCount++; }
        } catch (e) {
            console.warn(`Failed to update ${item.ticker}:`, e);
            failCount++;
        }
    }

    refreshPricesBtn.disabled = false;
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    refreshPricesBtn.classList.remove('opacity-50');
    
    renderAssetList();
    
    if (successCount > 0) {
        let msg = `${successCount}개 종목 업데이트 완료`;
        if (failCount > 0) msg += ` (${failCount}개 실패)`;
        alert(msg);
    } else {
        alert("시세를 가져오는데 실패했습니다. 네트워크 상태를 확인해주세요.");
    }
}

if (refreshPricesBtn) {
    refreshPricesBtn.addEventListener('click', refreshAllPrices);
}

// ==========================================
// 2. Optimized Search Logic (Debounced)
// ==========================================
let searchTimer = null;

if (tickerSearchInput) {
    tickerSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timer (Debouncing)
        if (searchTimer) clearTimeout(searchTimer);

        if (query.length < 2) {
            searchResultsContainer.classList.add('hidden');
            return;
        }

        // Wait 500ms after user stops typing
        searchTimer = setTimeout(() => {
            performSearch(query);
        }, 500);
    });
}

async function performSearch(query) {
    searchResultsContainer.classList.remove('hidden');
    searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';

    try {
        // Cloudflare Functions API 호출
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error("API request failed");

        const data = await response.json();
        const quotes = data.quotes || [];
        
        if (quotes.length === 0) {
            searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 결과가 없습니다.</li>';
            return;
        }

        searchResults.innerHTML = '';
        quotes.forEach(quote => {
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
                if (btn && !btn.disabled) {
                    btn.disabled = true;
                    btn.innerHTML = '<span>⏳...</span>';
                    await addAssetFromSearch(quote);
                }
            };
            searchResults.appendChild(li);
        });
    } catch (e) {
        console.error("Search error:", e);
        searchResults.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">오류: 검색에 실패했습니다.</li>`;
    }
}

async function addAssetFromSearch(quote) {
    if (!quote || !quote.symbol) return;

    const exists = holdings.find(h => h.ticker.toUpperCase() === quote.symbol.toUpperCase());
    if (exists) {
        alert(`'${quote.symbol}'은(는) 이미 목록에 있습니다.`);
        tickerSearchInput.value = '';
        searchResultsContainer.classList.add('hidden');
        return;
    }

    let price = 0;
    try {
        // Internal API call for price
        const response = await fetch(`/api/price?ticker=${encodeURIComponent(quote.symbol)}`);
        if (response.ok) {
            const data = await response.json();
            const result = data?.chart?.result?.[0];
            if (result && result.meta) {
                price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
            }
        }
    } catch (e) {
        console.warn("Initial price fetch failed:", e);
    }

    const newAsset = {
        ticker: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        qty: 0,
        price: price,
        targetPercent: 0
    };

    holdings.push(newAsset);
    
    tickerSearchInput.value = '';
    searchResultsContainer.classList.add('hidden');
    renderAssetList();
    
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

// ==========================================
// 3. Core Logic (Auth, Rendering, etc.)
// ==========================================

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
        appContent.classList.add('grid');
        
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

// Helper: Validate Ticker (Deprecated in favor of search, but kept for direct input)
window.validateTicker = async (index, symbol) => {
    if (!symbol || ['CASH', 'USD', 'KRW', '현금', 'NEW ASSET'].includes(symbol.toUpperCase())) {
        holdings[index].name = "현금성 자산";
        renderAssetList();
        return;
    }
    // Simple validation without API call to avoid spamming
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
    updateSimulationChart(); // 시뮬레이션 차트 업데이트
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

// ==========================================
// 4. Dochi Personality & Simulation Logic
// ==========================================

// Portfolio Presets Data
const portfolioPresets = {
    aggressive: {
        name: "공격도치",
        returnRate: 0.12, // 12%
        composition: [
            { ticker: "QQQ", name: "Invesco QQQ Trust", targetPercent: 70 }, // Nasdaq 100
            { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", targetPercent: 30 } // S&P 500
        ]
    },
    balanced: {
        name: "중도도치",
        returnRate: 0.07, // 7%
        composition: [
            { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", targetPercent: 60 },
            { ticker: "BND", name: "Vanguard Total Bond Market", targetPercent: 40 }
        ]
    },
    defensive: {
        name: "수비도치",
        returnRate: 0.04, // 4%
        composition: [
            { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", targetPercent: 30 },
            { ticker: "SHy", name: "iShares 1-3 Year Treasury Bond", targetPercent: 50 }, // Short-term Treasury
            { ticker: "GLD", name: "SPDR Gold Shares", targetPercent: 20 }
        ]
    }
};

let currentDochiStyle = null; // 현재 선택된 스타일
let simulationChartInstance = null;

// Character Selection Handler
window.selectDochi = (type) => {
    const preset = portfolioPresets[type];
    if (!preset) return;

    if (!confirm(`'${preset.name}' 스타일을 적용하시겠습니까?\n\n목표 비중이 재설정되고, 필요한 종목이 목록에 없는 경우 추가됩니다.`)) {
        return;
    }

    currentDochiStyle = type;

    // 1. Reset all existing targets to 0
    holdings.forEach(h => h.targetPercent = 0);

    // 2. Apply Preset Targets
    preset.composition.forEach(comp => {
        // Find existing asset by ticker
        let asset = holdings.find(h => h.ticker.toUpperCase() === comp.ticker.toUpperCase());
        
        if (asset) {
            asset.targetPercent = comp.targetPercent;
        } else {
            // Add new asset if not exists
            holdings.push({
                ticker: comp.ticker,
                name: comp.name,
                qty: 0,
                price: 0, // Will be fetched via refresh button usually, or we could fetch here
                targetPercent: comp.targetPercent
            });
        }
    });

    // 3. Trigger Price Refresh for new assets (Optional but good UX)
    // We call renderAssetList first to show the structure
    renderAssetList();
    
    // Auto-fetch prices for newly added assets (0 price)
    const needsPrice = holdings.some(h => h.price === 0 && h.targetPercent > 0);
    if (needsPrice) {
        // Debounce price refresh slightly
        setTimeout(() => refreshAllPrices(), 500);
    }

    // 4. Update Simulation
    updateSimulationChart();
};

// Simulation Chart Logic
function updateSimulationChart() {
    const ctx = document.getElementById('simulationChart');
    if (!ctx) return;

    // Calculate Current Portfolio Return (Approximate)
    // This is complex without historical data, so we use a simplified model or user input from main page.
    // For this standalone page, we'll assume a baseline return based on asset classes if possible, 
    // OR just compare against the selected Dochi style vs a standard "Cash" baseline (2%).
    
    // Let's estimate current portfolio return based on weighted average of presets if possible, 
    // or just default to Balanced (7%) if unknown, or calculate from holdings if we had return data.
    // For "Zero Redundant Calls", we won't fetch historical data. We'll use a fixed assumption or allow user input.
    // Given the prompt asks to link to "existing 10-year asset simulation engine", 
    // we mimic the logic: FV = PV * (1+r)^n
    
    let totalValue = holdings.reduce((sum, h) => sum + (h.qty * h.price), 0);
    if (totalValue === 0) totalValue = 10000; // Default seed for simulation visualization ($10k)

    const years = Array.from({length: 11}, (_, i) => i); // 0 to 10
    const inflationRate = 0.025; // 2.5% assumed inflation

    // Line 1: Current Portfolio (Simplified Estimate)
    // We'll assume a standard 6% return for the user's "Current" mix unless they align perfectly with a preset.
    // Or we could calculate it weighted if we had returns for every ticker. 
    // Let's use 6% as a generic baseline for "User's Path".
    const currentReturn = 0.06; 
    const currentData = years.map(y => Math.round(totalValue * Math.pow(1 + currentReturn - inflationRate, y)));

    // Line 2: Selected Dochi Path
    let targetReturn = 0.07; // Default to Balanced
    let label = "추천 포트폴리오";
    
    if (currentDochiStyle) {
        targetReturn = portfolioPresets[currentDochiStyle].returnRate;
        label = `${portfolioPresets[currentDochiStyle].name} (연 ${targetReturn*100}%)`;
    }

    const recommendedData = years.map(y => Math.round(totalValue * Math.pow(1 + targetReturn - inflationRate, y)));

    if (simulationChartInstance) {
        simulationChartInstance.destroy();
    }

    const isDarkMode = document.documentElement.classList.contains('dark');
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';

    simulationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => `${y}년후`),
            datasets: [
                {
                    label: '현재 예상 (연 6%)',
                    data: currentData,
                    borderColor: isDarkMode ? '#94a3b8' : '#64748b',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: label,
                    data: recommendedData,
                    borderColor: isDarkMode ? '#34d399' : '#10b981', // Emerald
                    backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    borderWidth: 3,
                    pointRadius: 3,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { color: tickColor, font: { family: 'Pretendard' } } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: tickColor },
                    grid: { display: false }
                },
                x: {
                    ticks: { color: tickColor },
                    grid: { display: false }
                }
            }
        }
    });

    const diff = recommendedData[10] - currentData[10];
    const diffText = diff > 0 
        ? `🚀 선택한 스타일이 현재보다 10년 후 약 $${Math.round(diff).toLocaleString()} 더 유리합니다.` 
        : `🛡️ 현재 포트폴리오가 더 공격적일 수 있습니다. 선택한 스타일은 안정성을 중시합니다.`;
    
    const insightElem = document.getElementById('simulationInsight');
    if (insightElem) insightElem.innerText = diffText;
}

// Initial render
renderAssetList();