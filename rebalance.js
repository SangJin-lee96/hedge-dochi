// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

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
let currentDochiStyle = null;
let simulationChartInstance = null;
let isIntegerMode = false; // 정수 매매 모드

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
const recommendationSection = document.getElementById('recommendationSection');
const recommendationListBody = document.getElementById('recommendationListBody');
const recommendationTitle = document.getElementById('recommendationTitle');
const integerModeToggle = document.getElementById('integerModeToggle');

// Shared Proxy List & Helper
const getProxies = (targetUrl) => [
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, isDirect: true },
    { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, isDirect: true },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, isDirect: false }
];

async function fetchWithProxies(targetUrl, timeout = 10000) {
    const proxies = getProxies(targetUrl);
    for (const proxy of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(proxy.url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) continue;
            if (proxy.isDirect) {
                const text = await response.text();
                try { return JSON.parse(text); } catch { continue; }
            } else {
                const raw = await response.json();
                if (!raw.contents) continue;
                return JSON.parse(raw.contents);
            }
        } catch (e) { continue; }
    }
    throw new Error("All proxies failed");
}

// Batch Price Fetching
async function refreshAllPrices() {
    const validHoldings = holdings.filter(h => 
        h.ticker && h.ticker.trim() !== '' && 
        !['CASH', 'USD', 'KRW', '현금', 'NEW ASSET'].includes(h.ticker.toUpperCase())
    );

    if (validHoldings.length === 0) {
        alert("시세를 불러올 유효한 종목(Ticker)이 없습니다.");
        return;
    }

    refreshPricesBtn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('animate-spin', 'inline-block');
    refreshPricesBtn.classList.add('opacity-50');
    
    let successCount = 0;
    for (let i = 0; i < validHoldings.length; i++) {
        const item = validHoldings[i];
        try {
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.ticker)}?interval=1d&range=1d`;
            const data = await fetchWithProxies(targetUrl, 10000);
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
                }
            }
        } catch (e) { console.warn(`Failed to update ${item.ticker}:`, e); }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    refreshPricesBtn.disabled = false;
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    refreshPricesBtn.classList.remove('opacity-50');
    renderAssetList();
    if (successCount > 0) alert(`${successCount}개 종목의 시세를 업데이트했습니다.`);
}

if (refreshPricesBtn) {
    refreshPricesBtn.addEventListener('click', refreshAllPrices);
}

// Search Logic
async function performSearch(query) {
    searchResultsContainer.classList.remove('hidden');
    searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';
    try {
        const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
        const data = await fetchWithProxies(targetUrl, 8000);
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
            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex-1 min-w-0 pr-4">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-blue-600 dark:text-blue-400 group-hover:underline truncate">${quote.symbol}</span>
                            <span class="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-medium">${quote.exchDisp || "Stocks"}</span>
                        </div>
                        <div class="text-sm text-slate-600 dark:text-slate-300 truncate">${name}</div>
                    </div>
                    <button class="add-btn shrink-0 bg-blue-600 text-white dark:bg-blue-600 dark:text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all hover:bg-blue-700">+ 추가</button>
                </div>`;
            li.onclick = async () => {
                const btn = li.querySelector('.add-btn');
                if (btn.disabled) return;
                btn.disabled = true; btn.innerHTML = '⏳';
                await addAssetFromSearch(quote);
            };
            searchResults.appendChild(li);
        });
    } catch (e) {
        searchResults.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">오류: 네트워크 연결 실패</li>`;
    }
}

async function addAssetFromSearch(quote) {
    if (holdings.find(h => h.ticker.toUpperCase() === quote.symbol.toUpperCase())) {
        alert("이미 목록에 있습니다.");
        return;
    }
    let price = 0;
    try {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(quote.symbol)}?interval=1d&range=1d`;
        const data = await fetchWithProxies(targetUrl, 6000);
        const result = data?.chart?.result?.[0];
        if (result && result.meta) price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
    } catch (e) {}
    holdings.push({ ticker: quote.symbol, name: quote.shortname || quote.longname || quote.symbol, qty: 0, price: price, targetPercent: 0 });
    tickerSearchInput.value = ''; searchResultsContainer.classList.add('hidden'); renderAssetList();
}

// Portfolio Presets (Sector-based with Candidates)
const portfolioPresets = {
    aggressive: {
        name: "공격도치", icon: "🦔🔥", returnRate: 0.12,
        composition: [
            { 
                sector: "기술성장주 (Tech)", 
                targetPercent: 70,
                candidates: [
                    { ticker: "QQQ", name: "Invesco QQQ (나스닥100)" },
                    { ticker: "VGT", name: "Vanguard IT ETF" },
                    { ticker: "XLK", name: "Tech Select Sector SPDR" }
                ]
            },
            { 
                sector: "시장지수 (Equity)", 
                targetPercent: 30,
                candidates: [
                    { ticker: "SPY", name: "SPDR S&P 500" },
                    { ticker: "VOO", name: "Vanguard S&P 500" },
                    { ticker: "IVV", name: "iShares Core S&P 500" }
                ]
            }
        ]
    },
    balanced: {
        name: "중도도치", icon: "🦔⚖️", returnRate: 0.07,
        composition: [
            { 
                sector: "시장지수 (Equity)", 
                targetPercent: 50,
                candidates: [
                    { ticker: "SPY", name: "SPDR S&P 500" },
                    { ticker: "VTI", name: "Total Stock Market" }
                ]
            },
            { 
                sector: "안전자산 (Bonds)", 
                targetPercent: 40,
                candidates: [
                    { ticker: "BND", name: "Total Bond Market" },
                    { ticker: "AGG", name: "Core US Aggregate Bond" },
                    { ticker: "TLT", name: "20+ Year Treasury Bond" }
                ]
            },
            { 
                sector: "배당주 (Dividend)", 
                targetPercent: 10,
                candidates: [
                    { ticker: "SCHD", name: "US Dividend Equity" },
                    { ticker: "VYM", name: "High Dividend Yield" },
                    { ticker: "JEPI", name: "Equity Premium Income" }
                ]
            }
        ]
    },
    defensive: {
        name: "수비도치", icon: "🦔🛡️", returnRate: 0.04,
        composition: [
            { 
                sector: "안전자산 (Short Bonds)", 
                targetPercent: 60,
                candidates: [
                    { ticker: "SHY", name: "1-3 Year Treasury" },
                    { ticker: "BIL", name: "1-3 Month T-Bill" },
                    { ticker: "SGOV", name: "0-3 Month Treasury" }
                ]
            },
            { 
                sector: "원자재 (Gold)", 
                targetPercent: 20,
                candidates: [
                    { ticker: "GLD", name: "SPDR Gold Shares" },
                    { ticker: "IAU", name: "iShares Gold Trust" }
                ]
            },
            { 
                sector: "시장지수 (Equity)", 
                targetPercent: 20,
                candidates: [
                    { ticker: "SPY", name: "SPDR S&P 500" },
                    { ticker: "DIA", name: "Dow Jones Industrial" }
                ]
            }
        ]
    }
};

window.selectDochi = (type) => {
    const preset = portfolioPresets[type];
    if (!preset) return;
    currentDochiStyle = type;
    recommendationSection.classList.remove('hidden');
    recommendationTitle.innerHTML = `<span class="mr-2 text-xl">${preset.icon}</span> ${preset.name}`;
    renderRecommendationList(preset);
    updateSimulationChart();
    recommendationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// 추천 비중 적용 (선택된 종목 기반)
window.applyRecommendation = () => {
    if (!currentDochiStyle) return;
    const preset = portfolioPresets[currentDochiStyle];
    
    // 선택된 종목 수집
    const selectedTickers = [];
    preset.composition.forEach((comp, idx) => {
        const radios = document.getElementsByName(`rec_radio_${idx}`);
        let selected = null;
        for (const radio of radios) {
            if (radio.checked) {
                selected = {
                    ticker: radio.value,
                    name: radio.dataset.name,
                    targetPercent: comp.targetPercent
                };
                break;
            }
        }
        if (selected) selectedTickers.push(selected);
    });

    if (selectedTickers.length === 0) return;

    if (!confirm(`선택하신 ${selectedTickers.length}개 대표 종목으로 포트폴리오를 재구성하시겠습니까?\n\n- 기존 목표 비중은 초기화됩니다.\n- 선택한 종목이 목록에 추가됩니다.`)) return;

    // 1. Reset targets
    holdings.forEach(h => h.targetPercent = 0);

    // 2. Apply Selected Items
    selectedTickers.forEach(item => {
        let asset = holdings.find(h => h.ticker.toUpperCase() === item.ticker.toUpperCase());
        
        if (asset) {
            asset.targetPercent = item.targetPercent;
        } else {
            holdings.push({
                ticker: item.ticker,
                name: item.name,
                qty: 0,
                price: 0, // Will be fetched via refresh
                targetPercent: item.targetPercent
            });
        }
    });
    
    renderAssetList();
    // 새로 추가된 종목의 시세 자동 업데이트 (선택 사항)
    setTimeout(() => refreshAllPrices(), 500);
};

function renderRecommendationList(preset) {
    const totalValue = holdings.reduce((sum, h) => sum + (h.qty * h.price), 0);
    recommendationListBody.innerHTML = '';
    
    preset.composition.forEach((comp, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-indigo-100 dark:border-indigo-800/50 hover:bg-white/50 dark:hover:bg-slate-800/50";
        
        const estAmount = totalValue > 0 ? `$${Math.round(totalValue * comp.targetPercent / 100).toLocaleString()}` : '-';

        // 종목 선택 옵션 생성 (Radio Buttons)
        let optionsHtml = `<div class="flex flex-wrap gap-2 mt-1">`;
        comp.candidates.forEach((cand, cIdx) => {
            const isChecked = cIdx === 0 ? 'checked' : '';
            optionsHtml += `
                <label class="inline-flex items-center cursor-pointer bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg px-2 py-1 hover:border-indigo-400 transition-colors">
                    <input type="radio" name="rec_radio_${idx}" value="${cand.ticker}" data-name="${cand.name}" class="form-radio text-indigo-600 h-3 w-3" ${isChecked}>
                    <span class="ml-1 text-xs font-bold text-slate-700 dark:text-slate-300">${cand.ticker}</span>
                </label>
            `;
        });
        optionsHtml += `</div>`;

        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="font-bold text-indigo-900 dark:text-indigo-200 text-sm">${comp.sector}</div>
                ${optionsHtml}
            </td>
            <td class="py-3 px-2 align-middle text-right font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                ${comp.targetPercent}%
            </td>
            <td class="py-3 px-2 align-middle text-right text-slate-600 dark:text-slate-300 text-sm">
                ${estAmount}
            </td>`;
        recommendationListBody.appendChild(tr);
    });
}

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group`;
        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    <div class="flex items-center gap-1">
                        <input type="text" placeholder="예: AAPL" value="${item.ticker}" class="w-full min-w-[60px] bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200 uppercase" onchange="updateHolding(${index}, 'ticker', this.value)" onblur="validateTicker(${index}, this.value)">
                    </div>
                    <div class="text-[10px] text-slate-400 truncate max-w-[120px]">${item.name || ''}</div>
                </div>
            </td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.price}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 align-middle"><div class="relative"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)"><span class="absolute right-[-10px] top-1/2 -translate-y-1/2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">%</span></div></td>
            <td class="py-3 px-2 text-center align-middle"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></td>`;
        assetListBody.appendChild(tr);
    });
    
    if (currentDochiStyle && !recommendationSection.classList.contains('hidden')) {
        renderRecommendationList(portfolioPresets[currentDochiStyle]);
    }
    updateCalculation();
}

window.updateHolding = (index, field, value) => {
    if (field === 'qty' || field === 'price' || field === 'targetPercent') holdings[index][field] = parseFloat(value) || 0;
    else holdings[index][field] = value.toUpperCase();
    updateCalculation();
};

window.removeAsset = (index) => {
    if(confirm('정말 이 종목을 삭제하시겠습니까?')) { holdings.splice(index, 1); renderAssetList(); }
};

if (integerModeToggle) {
    integerModeToggle.addEventListener('change', (e) => {
        isIntegerMode = e.target.checked;
        updateCalculation();
    });
}

function updateCalculation() {
    let totalValue = 0, totalTargetPercent = 0;
    holdings.forEach(item => { totalValue += item.qty * item.price; totalTargetPercent += item.targetPercent; });
    document.getElementById('totalValueDisplay').innerText = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    // Auto-calculate Cash if < 100%
    let diffPercent = 100 - totalTargetPercent;
    // 현금 자동 계산 로직은 보여주기만 하고 실제 배열엔 추가 안함 (복잡도 방지)
    
    const totalPercentDisplay = document.getElementById('totalPercentDisplay');
    if (Math.abs(diffPercent) < 0.1) totalPercentDisplay.innerHTML = `<span class="text-emerald-500">✨ 목표 비중 합계: 100%</span>`;
    else if (diffPercent > 0) totalPercentDisplay.innerHTML = `<span class="text-blue-500 font-bold">⚠️ 합계: ${totalTargetPercent.toFixed(1)}% (나머지 ${diffPercent.toFixed(1)}%는 현금 보유 권장)</span>`;
    else totalPercentDisplay.innerHTML = `<span class="text-red-500 font-bold">🚫 합계: ${totalTargetPercent.toFixed(1)}% (${Math.abs(diffPercent).toFixed(1)}% 초과)</span>`;

    const actionPlanList = document.getElementById('actionPlanList');
    actionPlanList.innerHTML = '';
    let isBalanced = true;
    const chartLabels = [], currentWeights = [], targetWeights = [];

    // 현금 비중이 있다면 차트 및 계산에 포함
    let cashWeight = 0;
    if (diffPercent > 0) {
        cashWeight = diffPercent;
        chartLabels.push('현금 (Cash)');
        currentWeights.push('0.0'); // 현재 현금은 모른다고 가정
        targetWeights.push(cashWeight);
    }

    holdings.forEach(item => {
        const currentVal = item.qty * item.price;
        const currentWeight = totalValue > 0 ? (currentVal / totalValue) : 0;
        chartLabels.push(item.ticker || 'N/A');
        currentWeights.push((currentWeight * 100).toFixed(1));
        targetWeights.push(item.targetPercent);

        if (totalValue > 0) {
            const diffVal = (totalValue * item.targetPercent / 100) - currentVal;
            if (Math.abs(diffVal / totalValue) > 0.01) { // 1% 이상 차이나면 액션 제안
                isBalanced = false;
                const actionDiv = document.createElement('div');
                actionDiv.className = "p-4 rounded-xl border flex justify-between items-center " + (diffVal > 0 ? "bg-red-50/50 border-red-100" : "bg-blue-50/50 border-blue-100");
                
                let quantityMsg = "";
                if (item.price > 0) {
                    let qty = Math.abs(diffVal) / item.price;
                    if (isIntegerMode) qty = Math.floor(qty); // 정수 매매
                    else qty = qty.toFixed(2);
                    quantityMsg = `<span class="block text-xs opacity-70">${qty}주 ${diffVal > 0 ? '매수' : '매도'}</span>`;
                }

                actionDiv.innerHTML = `
                    <div><span class="font-bold">${item.ticker}</span></div>
                    <div class="text-right">
                        <span class="font-bold ${diffVal > 0 ? 'text-red-600' : 'text-blue-600'}">
                            ${diffVal > 0 ? '매수' : '매도'} $${Math.abs(diffVal).toLocaleString()}
                        </span>
                        ${quantityMsg}
                    </div>`;
                actionPlanList.appendChild(actionDiv);
            }
        }
    });

    if (isBalanced) actionPlanList.innerHTML = `<div class="text-center py-10 text-slate-400">🎉 리밸런싱이 필요하지 않습니다.</div>`;
    updateChart(chartLabels, currentWeights, targetWeights);
    updateSimulationChart();
}

function updateChart(labels, currentData, targetData) {
    const ctx = document.getElementById('portfolioChart');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: '현재 (%)', data: currentData, backgroundColor: 'rgba(99, 102, 241, 0.8)' }, { label: '목표 (%)', data: targetData, borderColor: '#10b981', type: 'line', fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function updateSimulationChart() {
    const ctx = document.getElementById('simulationChart');
    if (!ctx) return;
    let totalValue = holdings.reduce((sum, h) => sum + (h.qty * h.price), 0) || 10000;
    const years = Array.from({length: 11}, (_, i) => i);
    const inflationRate = 0.025; // 2.5% 인플레이션
    const currentReturn = 0.06;
    
    // 명목 가치 (Nominal)
    const currentData = years.map(y => Math.round(totalValue * Math.pow(1 + currentReturn, y)));
    // 실질 가치 (Real Value - Inflation Adjusted)
    const realData = years.map(y => Math.round(totalValue * Math.pow(1 + currentReturn - inflationRate, y)));
    
    let targetReturn = currentDochiStyle ? portfolioPresets[currentDochiStyle].returnRate : 0.07;
    const recommendedData = years.map(y => Math.round(totalValue * Math.pow(1 + targetReturn, y)));

    if (simulationChartInstance) simulationChartInstance.destroy();
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';

    simulationChartInstance = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: years.map(y => `${y}년후`), 
            datasets: [
                { label: '현재 경로', data: currentData, borderColor: '#94a3b8', borderDash: [5,5] }, 
                { label: '실질 가치(물가반영)', data: realData, borderColor: '#f59e0b', borderDash: [2,2], borderWidth: 1 },
                { label: '도치 추천', data: recommendedData, borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }
            ] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: tickColor, callback: v => v/10000 + '만' }, grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } },
                x: { ticks: { color: tickColor }, grid: { display: false } }
            },
            plugins: {
                legend: { labels: { color: tickColor, font: { family: 'Pretendard' } } }
            }
        }
    });
}

// Auth & Persistence
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtn.classList.add('hidden'); userProfile.classList.remove('hidden'); userPhoto.src = user.photoURL;
        loginAlert.classList.add('hidden'); appContent.classList.remove('hidden'); appContent.classList.add('grid');
        await loadPortfolio();
    } else {
        loginBtn.classList.remove('hidden'); userProfile.classList.add('hidden');
        loginAlert.classList.remove('hidden'); appContent.classList.add('hidden');
    }
});

async function loadPortfolio() {
    if (!currentUser) return;
    try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.holdings) holdings = data.holdings;
        }
        renderAssetList();
    } catch (e) {}
}

async function savePortfolio(silent = false) {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), { uid: currentUser.uid, holdings: holdings, lastUpdated: new Date() });
        if (!silent) alert("저장 완료! 💾");
    } catch (e) { if (!silent) alert("저장 실패"); }
}

saveBtn.addEventListener('click', () => savePortfolio());
addAssetBtn.addEventListener('click', () => { holdings.push({ ticker: "", qty: 0, price: 0, targetPercent: 0 }); renderAssetList(); });

if (tickerSearchInput) {
    let searchTimer = null;
    tickerSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchTimer) clearTimeout(searchTimer);
        if (query.length < 2) { searchResultsContainer.classList.add('hidden'); return; }
        searchTimer = setTimeout(() => performSearch(query), 500);
    });
}

renderAssetList();