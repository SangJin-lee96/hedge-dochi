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
let isIntegerMode = false;

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

// Sector Mapping Database (Local Cache)
const sectorMap = {
    "QQQ": "기술성장주 (Tech)", "AAPL": "기술성장주 (Tech)", "MSFT": "기술성장주 (Tech)", "NVDA": "기술성장주 (Tech)", "TSLA": "기술성장주 (Tech)", 
    "GOOGL": "기술성장주 (Tech)", "AMZN": "기술성장주 (Tech)", "META": "기술성장주 (Tech)", "AMD": "기술성장주 (Tech)", "VGT": "기술성장주 (Tech)", "XLK": "기술성장주 (Tech)",
    "SPY": "시장지수 (Equity)", "VOO": "시장지수 (Equity)", "IVV": "시장지수 (Equity)", "VTI": "시장지수 (Equity)", "DIA": "시장지수 (Equity)",
    "TLT": "안전자산 (Bonds)", "IEF": "안전자산 (Bonds)", "SHY": "안전자산 (Bonds)", "BND": "안전자산 (Bonds)", "AGG": "안전자산 (Bonds)", "BIL": "안전자산 (Bonds/Cash)",
    "SCHD": "배당주 (Dividend)", "JEPI": "배당주 (Dividend)", "VYM": "배당주 (Dividend)", "O": "배당주 (Dividend)",
    "GLD": "원자재 (Gold/Alt)", "IAU": "원자재 (Gold/Alt)", "SLV": "원자재 (Gold/Alt)", "DBC": "원자재 (Gold/Alt)"
};

function getSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (sectorMap[t]) return sectorMap[t];
    if (quoteType === 'CRYPTOCURRENCY') return "원자재 (Gold/Alt)";
    if (yahooSector.includes("Technology") || yahooSector.includes("Communication")) return "기술성장주 (Tech)";
    if (yahooSector.includes("Financial") || yahooSector.includes("Consumer")) return "시장지수 (Equity)";
    if (quoteType === 'ETF') return "시장지수 (Equity)";
    if (quoteType === 'EQUITY') return "시장지수 (Equity)";
    return "기타";
}

// ==========================================
// 1. Optimized API Logic (Cloudflare Functions First)
// ==========================================

async function fetchInternalAPI(endpoint, params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`/api/${endpoint}?${queryString}`);
        if (!response.ok) throw new Error("Internal API Error");
        return await response.json();
    } catch (e) {
        throw e;
    }
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
    
    // Cloudflare Functions로 직접 호출 (속도 빠름, CORS 없음)
    for (let i = 0; i < validHoldings.length; i++) {
        const item = validHoldings[i];
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker });
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
                        // 섹터 정보가 없으면 자동 업데이트
                        if (!holdings[index].sector) {
                            holdings[index].sector = getSector(item.ticker);
                        }
                        successCount++;
                    }
                }
            }
        } catch (e) { 
            console.warn(`Failed to update ${item.ticker}:`, e); 
        }
        // 내부 API라 딜레이 없이 빠르게 호출 가능 (필요시 100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    refreshPricesBtn.disabled = false;
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    refreshPricesBtn.classList.remove('opacity-50');
    renderAssetList();
    
    if (successCount > 0) alert(`${successCount}개 종목의 시세를 업데이트했습니다.`);
    else alert("시세 업데이트 실패. 잠시 후 다시 시도해주세요.");
}

if (refreshPricesBtn) {
    refreshPricesBtn.addEventListener('click', refreshAllPrices);
}

// Search Logic
async function performSearch(query) {
    searchResultsContainer.classList.remove('hidden');
    searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';
    
    try {
        const data = await fetchInternalAPI('search', { q: query });
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
        console.error(e);
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
        const data = await fetchInternalAPI('price', { ticker: quote.symbol });
        const result = data?.chart?.result?.[0];
        if (result && result.meta) {
            price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
        }
    } catch (e) {}

    const detectedSector = getSector(quote.symbol, quote.quoteType, quote.sector);
    holdings.push({ 
        ticker: quote.symbol, 
        name: quote.shortname || quote.longname || quote.symbol, 
        qty: 0, price: price, targetPercent: 0, 
        sector: detectedSector, 
        isPreset: false 
    });
    
    tickerSearchInput.value = ''; 
    searchResultsContainer.classList.add('hidden'); 
    renderAssetList();
    
    setTimeout(() => {
        const rows = assetListBody.querySelectorAll('tr');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lastRow.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            setTimeout(() => lastRow.classList.remove('bg-blue-50', 'dark:bg-blue-900/20'), 2000);
        }
    }, 100);
}

// Portfolio Presets (Sector-based with Candidates)
const portfolioPresets = {
    aggressive: {
        name: "공격도치", icon: "🦔🔥", returnRate: 0.12,
        composition: [
            { sector: "기술성장주 (Tech)", targetPercent: 70, candidates: [{ ticker: "QQQ", name: "Invesco QQQ (나스닥100)" }, { ticker: "VGT", name: "Vanguard IT ETF" }, { ticker: "XLK", name: "Tech Select Sector SPDR" }] },
            { sector: "시장지수 (Equity)", targetPercent: 30, candidates: [{ ticker: "SPY", name: "SPDR S&P 500" }, { ticker: "VOO", name: "Vanguard S&P 500" }, { ticker: "IVV", name: "iShares Core S&P 500" }] }
        ]
    },
    balanced: {
        name: "중도도치", icon: "🦔⚖️", returnRate: 0.07,
        composition: [
            { sector: "시장지수 (Equity)", targetPercent: 50, candidates: [{ ticker: "SPY", name: "SPDR S&P 500" }, { ticker: "VTI", name: "Total Stock Market" }] },
            { sector: "안전자산 (Bonds)", targetPercent: 40, candidates: [{ ticker: "BND", name: "Total Bond Market" }, { ticker: "AGG", name: "Core US Aggregate Bond" }, { ticker: "TLT", name: "20+ Year Treasury Bond" }] },
            { sector: "배당주 (Dividend)", targetPercent: 10, candidates: [{ ticker: "SCHD", name: "US Dividend Equity" }, { ticker: "VYM", name: "High Dividend Yield" }, { ticker: "JEPI", name: "Equity Premium Income" }] }
        ]
    },
    defensive: {
        name: "수비도치", icon: "🦔🛡️", returnRate: 0.04,
        composition: [
            { sector: "안전자산 (Short Bonds)", targetPercent: 60, candidates: [{ ticker: "SHY", name: "1-3 Year Treasury" }, { ticker: "BIL", name: "1-3 Month T-Bill" }, { ticker: "SGOV", name: "0-3 Month Treasury" }] },
            { sector: "원자재 (Gold)", targetPercent: 20, candidates: [{ ticker: "GLD", name: "SPDR Gold Shares" }, { ticker: "IAU", name: "iShares Gold Trust" }] },
            { sector: "시장지수 (Equity)", targetPercent: 20, candidates: [{ ticker: "SPY", name: "SPDR S&P 500" }, { ticker: "DIA", name: "Dow Jones Industrial" }] }
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

// Apply Recommendation (With Reset Logic)
window.applyRecommendation = () => {
    if (!currentDochiStyle) return;
    const preset = portfolioPresets[currentDochiStyle];
    
    const selectedTickers = [];
    preset.composition.forEach((comp, idx) => {
        const radios = document.getElementsByName(`rec_radio_${idx}`);
        let selected = null;
        for (const radio of radios) {
            if (radio.checked) {
                selected = { ticker: radio.value, name: radio.dataset.name, targetPercent: comp.targetPercent };
                break;
            }
        }
        if (selected) selectedTickers.push(selected);
    });

    if (selectedTickers.length === 0) return;
    if (!confirm(`'${preset.name}'의 추천 종목으로 교체하시겠습니까?\n\n- 기존 추천 종목은 삭제됩니다.\n- 직접 추가하신 종목은 유지됩니다.`)) return;

    // 1. Remove previous recommendations (isPreset: true)
    holdings = holdings.filter(h => !h.isPreset);

    // 2. Reset targets for remaining user items
    holdings.forEach(h => h.targetPercent = 0);

    // 3. Add new recommendations
    selectedTickers.forEach(item => {
        let asset = holdings.find(h => h.ticker.toUpperCase() === item.ticker.toUpperCase());
        // 섹터 자동 매핑
        const sec = getSector(item.ticker);
        
        if (asset) {
            asset.targetPercent = item.targetPercent;
            asset.isPreset = true;
            asset.sector = sec;
        } else {
            holdings.push({ 
                ticker: item.ticker, 
                name: item.name, 
                qty: 0, price: 0, targetPercent: item.targetPercent, 
                isPreset: true,
                sector: sec
            });
        }
    });
    
    renderAssetList();
    setTimeout(() => refreshAllPrices(), 500);
};

function renderRecommendationList(preset) {
    const totalValue = holdings.reduce((sum, h) => sum + (h.qty * h.price), 0);
    recommendationListBody.innerHTML = '';
    preset.composition.forEach((comp, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-indigo-100 dark:border-indigo-800/50 hover:bg-white/50 dark:hover:bg-slate-800/50";
        const estAmount = totalValue > 0 ? `$${Math.round(totalValue * comp.targetPercent / 100).toLocaleString()}` : '-';
        
        let optionsHtml = `<div class="flex flex-wrap gap-2 mt-1">`;
        comp.candidates.forEach((cand, cIdx) => {
            const isChecked = cIdx === 0 ? 'checked' : '';
            optionsHtml += `<label class="inline-flex items-center cursor-pointer bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg px-2 py-1 hover:border-indigo-400 transition-colors"><input type="radio" name="rec_radio_${idx}" value="${cand.ticker}" data-name="${cand.name}" class="form-radio text-indigo-600 h-3 w-3" ${isChecked}><span class="ml-1 text-xs font-bold text-slate-700 dark:text-slate-300">${cand.ticker}</span></label>`;
        });
        optionsHtml += `</div>`;

        tr.innerHTML = `
            <td class="py-3 px-2 align-middle"><div class="font-bold text-indigo-900 dark:text-indigo-200 text-sm">${comp.sector}</div>${optionsHtml}</td>
            <td class="py-3 px-2 align-middle text-right font-bold text-indigo-600 dark:text-indigo-400 text-lg">${comp.targetPercent}%</td>
            <td class="py-3 px-2 align-middle text-right text-slate-600 dark:text-slate-300 text-sm">${estAmount}</td>`;
        recommendationListBody.appendChild(tr);
    });
}

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        const isPreset = item.isPreset;
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isPreset ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`;
        const badge = isPreset ? `<span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 mb-1 tracking-wider uppercase">Recommended</span>` : `<span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 mb-1 tracking-wider uppercase">My Asset</span>`;
        const sectorDisplay = item.sector ? `<span class="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold mr-1">[${item.sector.split(' ')[0]}]</span>` : '';

        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    ${badge}
                    <div class="flex items-center gap-1">
                        <input type="text" placeholder="예: AAPL" value="${item.ticker}" class="w-full min-w-[60px] bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200 uppercase" onchange="updateHolding(${index}, 'ticker', this.value)" ${isPreset ? 'readonly' : ''}>
                    </div>
                    <div class="text-[10px] text-slate-400 truncate max-w-[120px]">${sectorDisplay}${item.name || ''}</div>
                </div>
            </td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.price}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 align-middle"><div class="relative"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)"><span class="absolute right-[-10px] top-1/2 -translate-y-1/2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">%</span></div></td>
            <td class="py-3 px-2 text-center align-middle"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></td>`;
        assetListBody.appendChild(tr);
    });
    if (currentDochiStyle && !recommendationSection.classList.contains('hidden')) { renderRecommendationList(portfolioPresets[currentDochiStyle]); }
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
    
    // 섹터별 합계 계산 (Group by Sector)
    const sectorStats = {};

    holdings.forEach(item => { 
        totalValue += item.qty * item.price; 
        totalTargetPercent += item.targetPercent;
        
        const sec = item.sector || getSector(item.ticker);
        if (!sectorStats[sec]) sectorStats[sec] = { currentVal: 0, targetPct: 0 };
        sectorStats[sec].currentVal += item.qty * item.price;
        sectorStats[sec].targetPct += item.targetPercent;
    });

    document.getElementById('totalValueDisplay').innerText = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    let diffPercent = 100 - totalTargetPercent;
    const totalPercentDisplay = document.getElementById('totalPercentDisplay');
    if (Math.abs(diffPercent) < 0.1) totalPercentDisplay.innerHTML = `<span class="text-emerald-500">✨ 목표 비중 합계: 100%</span>`;
    else if (diffPercent > 0) totalPercentDisplay.innerHTML = `<span class="text-blue-500 font-bold">⚠️ 합계: ${totalTargetPercent.toFixed(1)}% (현금 권장: ${diffPercent.toFixed(1)}%)</span>`;
    else totalPercentDisplay.innerHTML = `<span class="text-red-500 font-bold">🚫 합계: ${totalTargetPercent.toFixed(1)}% (${Math.abs(diffPercent).toFixed(1)}% 초과)</span>`;

    const actionPlanList = document.getElementById('actionPlanList');
    actionPlanList.innerHTML = '';
    let isBalanced = true;
    
    // 차트 데이터 (섹터별로 통합해서 보여줌)
    const chartLabels = [], currentWeights = [], targetWeights = [];

    // 섹터별 차트 데이터 생성
    Object.keys(sectorStats).forEach(sec => {
        const stat = sectorStats[sec];
        const currentWeight = totalValue > 0 ? (stat.currentVal / totalValue) : 0;
        
        chartLabels.push(sec.split(' ')[0]); // 섹터명만 짧게
        currentWeights.push((currentWeight * 100).toFixed(1));
        targetWeights.push(stat.targetPct);
    });

    if (diffPercent > 0) {
        chartLabels.push('현금');
        currentWeights.push('0.0');
        targetWeights.push(diffPercent);
    }

    // 리밸런싱 액션 (여전히 개별 종목 단위로 상세하게)
    holdings.forEach(item => {
        const currentVal = item.qty * item.price;
        if (totalValue > 0) {
            const diffVal = (totalValue * item.targetPercent / 100) - currentVal;
            if (Math.abs(diffVal / totalValue) > 0.01) {
                isBalanced = false;
                const actionDiv = document.createElement('div');
                actionDiv.className = "p-4 rounded-xl border flex justify-between items-center " + (diffVal > 0 ? "bg-red-50/50 border-red-100" : "bg-blue-50/50 border-blue-100");
                
                let quantityMsg = "";
                if (item.price > 0) {
                    let qty = Math.abs(diffVal) / item.price;
                    if (isIntegerMode) qty = Math.floor(qty);
                    else qty = qty.toFixed(2);
                    quantityMsg = `<span class="block text-xs opacity-70">${qty}주 ${diffVal > 0 ? '매수' : '매도'}</span>`;
                }

                actionDiv.innerHTML = `<div><span class="font-bold">${item.ticker}</span></div><div class="text-right"><span class="font-bold ${diffVal > 0 ? 'text-red-600' : 'text-blue-600'}">${diffVal > 0 ? '매수' : '매도'} $${Math.abs(diffVal).toLocaleString()}</span>${quantityMsg}</div>`;
                actionPlanList.appendChild(actionDiv);
            }
        }
    });

    if (isBalanced) actionPlanList.innerHTML = `<div class="text-center py-10 text-slate-400">🎉 리밸런싱 완료! (목표 비중과 일치합니다)</div>`;
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
    const inflationRate = 0.025;
    const currentReturn = 0.06;
    const currentData = years.map(y => Math.round(totalValue * Math.pow(1 + currentReturn, y)));
    const realData = years.map(y => Math.round(totalValue * Math.pow(1 + currentReturn - inflationRate, y)));
    let targetReturn = currentDochiStyle ? portfolioPresets[currentDochiStyle].returnRate : 0.07;
    const recommendedData = years.map(y => Math.round(totalValue * Math.pow(1 + targetReturn, y)));

    if (simulationChartInstance) simulationChartInstance.destroy();
    const isDarkMode = document.documentElement.classList.contains('dark');
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
    simulationChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: years.map(y => `${y}년후`), datasets: [{ label: '현재 경로', data: currentData, borderColor: '#94a3b8', borderDash: [5,5] }, { label: '실질 가치(물가반영)', data: realData, borderColor: '#f59e0b', borderDash: [2,2], borderWidth: 1 }, { label: '도치 추천', data: recommendedData, borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: tickColor, callback: v => v/10000 + '만' }, grid: { color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } }, x: { ticks: { color: tickColor }, grid: { display: false } } }, plugins: { legend: { labels: { color: tickColor, font: { family: 'Pretendard' } } } } }
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
            if (data.holdings) {
                holdings = data.holdings;
                holdings.forEach(h => { if (!h.sector) h.sector = getSector(h.ticker); });
            }
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