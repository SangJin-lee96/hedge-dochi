import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, saveProgress, goToNextStep } from './core.js';

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        // 대시보드 사용자 정보 초기화
        document.getElementById('dashUserName').innerHTML = `${user.displayName} <span id="userTraitBadge" class="ml-2 text-[10px] px-2 py-1 rounded-lg bg-slate-500 text-white opacity-0 transition-opacity duration-1000">분석 중</span>`;
        loadDashboardData(user.uid);
        renderMarketSentiment();
    } else {
        showToast("로그인이 필요한 서비스입니다."); location.href = "index.html";
    }
});

async function loadDashboardData(uid) {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(c => c.classList.add('skeleton'));
    const activityLog = document.getElementById('dashActivityLog');
    activityLog.innerHTML = "";

    try {
        const [riskSnap, simSnap, portSnap, lottoSnap, goalSnap, fireSnap, watchSnap, divSnap, compSnap] = await Promise.all([
            getDoc(doc(db, "risk_profiles", uid)),
            getDoc(doc(db, "simulations", uid)),
            getDoc(doc(db, "portfolios", uid)),
            getDoc(doc(db, "lotto_history", uid)),
            getDoc(doc(db, "user_goals", uid)),
            getDoc(doc(db, "fire_goals", uid)),
            getDoc(doc(db, "user_watchlists", uid)),
            getDoc(doc(db, "dividend_goals", uid)),
            getDoc(doc(db, "compound_settings", uid))
        ]);

        let riskType = null;
        let recommendedPortfolio = null;
        if (riskSnap.exists()) {
            const d = riskSnap.data();
            riskType = d.type;
            recommendedPortfolio = d.portfolio;
            document.getElementById('dashRiskType').innerText = d.type;
            document.getElementById('dashRiskDesc').innerText = `추천: ${d.portfolio}`;
            const icons = { "공격투자형": "🔥", "적극투자형": "🚀", "위험중립형": "⚖️", "안정추구형": "🛡️", "안정형": "💎" };
            document.getElementById('dashRiskIcon').innerText = icons[d.type] || "🧠";
        } else {
            document.getElementById('dashRiskType').innerText = "성향 분석 전";
            document.getElementById('dashRiskDesc').innerText = "3단계를 먼저 진행해 주세요.";
        }

        let simResult = null;
        if (simSnap.exists()) {
            simResult = calculateSummary(simSnap.data());
            document.getElementById('dashTierName').innerText = simResult.tier;
            document.getElementById('dashTierIcon').innerText = simResult.icon;
            addLog(`나의 10년 후 예상 자산 등급: ${simResult.tier}`);
        }

        // 캐릭터 및 뱃지 업데이트
        updateUserAvatar(simResult, riskType);

        const assetLegend = document.getElementById('dashAssetLegend');
        if (portSnap.exists()) {
            const assets = portSnap.data().assets || [];
            if (assets.length > 0) {
                const score = calculateHealthScore(assets);
                const scoreEl = document.getElementById('dashScoreValue');
                scoreEl.innerText = score;
                scoreEl.className = `text-6xl font-black mb-4 ${score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'}`;
                renderDashChart(assets);
                document.getElementById('dashChartCenterText').innerText = formatVal(assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0), portSnap.data().baseCurrency || 'USD');
            } else {
                showEmptyAssetGuide(recommendedPortfolio);
            }
        } else {
            showEmptyAssetGuide(recommendedPortfolio);
        }

function showEmptyAssetGuide(recommended) {
    const centerText = document.getElementById('dashChartCenterText');
    if (centerText) centerText.innerText = "등록 필요";
    
    const legend = document.getElementById('dashAssetLegend');
    if (legend) {
        legend.innerHTML = `
            <div class="col-span-full p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-center">
                <p class="text-blue-600 dark:text-blue-400 font-bold mb-4">아직 등록된 자산이 없습니다.</p>
                <p class="text-xs text-slate-500 mb-6">${recommended ? `당신의 추천 비중은 <b>${recommended}</b> 입니다.` : '이전 단계의 분석 데이터를 기반으로 포트폴리오를 구성해 드릴 수 있습니다.'}</p>
                <a href="step8-rebalance.html" class="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all">실제 자산 등록하러 가기 ➔</a>
            </div>
        `;
    }
}

        if (lottoSnap.exists()) {
            const d = lottoSnap.data();
            const container = document.getElementById('dashLottoList');
            container.innerHTML = "";
            d.results.slice(0, 4).forEach((res, i) => {
                const div = document.createElement('div');
                div.className = "p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between";
                let nums = d.type === '645' ? res.map(n => `<span class="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">${n}</span>`).join('') : `<span class="text-xs font-bold text-purple-500">${res.group}조 ${res.numbers.join('')}</span>`;
                div.innerHTML = `<span class="text-[10px] font-black text-slate-400">G${i+1}</span><div class="flex gap-1">${nums}</div>`;
                container.appendChild(div);
            });
        }

        if (fireSnap.exists()) {
            const d = fireSnap.data();
            document.getElementById('dashFireRemaining').innerText = `${d.remainingYears}년 남음`;
            document.getElementById('dashFireDate').innerText = `${d.targetYear}년 은퇴 예정`;
            document.getElementById('dashFireIcon').innerText = d.remainingYears <= 5 ? "🥂" : "🏝️";
        }

        if (goalSnap.exists() && simResult) {
            updateGoalUI(simResult.rawNominal, goalSnap.data().amount);
        }

        if (watchSnap.exists()) {
            renderWatchlist(watchSnap.data().tickers || []);
        }

        if (divSnap.exists()) {
            const d = divSnap.data();
            document.getElementById('dashMonthlyDividend').innerText = `예상 월 배당금: ${formatVal(d.monthlyIncome, 'KRW')}`;
        }

        renderDailyQuote();
    } catch (e) { console.error(e); }
    finally { cards.forEach(c => c.classList.remove('skeleton')); }
}

function updateUserAvatar(sim, riskType) {
    const photoEl = document.getElementById('dashUserPhoto');
    const badgeEl = document.getElementById('userTraitBadge');
    if (!photoEl) return;

    const avatars = { "다이아몬드": "👑", "플래티넘": "💎", "골드": "💰", "실버": "🥈", "브론즈": "🦔" };
    const char = avatars[sim?.tier] || "🦔";
    
    // 캐릭터 이모지 기반 프로필 생성 (태그 교체)
    const newAvatar = document.createElement('div');
    newAvatar.id = 'dashUserPhoto';
    newAvatar.className = "w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center text-5xl transform hover:rotate-12 transition-transform duration-500 cursor-pointer";
    newAvatar.title = "나의 금융 캐릭터";
    newAvatar.innerText = char;
    photoEl.replaceWith(newAvatar);
    
    if (riskType && badgeEl) {
        badgeEl.innerText = riskType;
        badgeEl.classList.remove('opacity-0');
        const colors = { "공격투자형": "bg-red-500", "적극투자형": "bg-orange-500", "위험중립형": "bg-blue-500", "안정추구형": "bg-emerald-500", "안정형": "bg-slate-500" };
        badgeEl.className = `ml-2 text-[10px] px-2 py-1 rounded-lg text-white font-black shadow-sm ${colors[riskType] || "bg-blue-500"}`;
    }
}

function calculateSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0, seed = parseFloat(d.initialSeed) || 0, expense = parseFloat(d.monthlyExpense) || 0;
    const growth = (parseFloat(d.salaryGrowth) || 0) / 100, returns = (parseFloat(d.investmentReturn) || 0) / 100, inflation = (parseFloat(d.inflationRate) || 0) / 100;
    let current = seed, curSalary = salary, curExpense = expense;
    for (let i = 1; i <= 10; i++) {
        const surplus = curSalary - (curExpense * 12);
        current = current + surplus + ((current + surplus / 2) * returns);
        curSalary *= (1 + growth); curExpense *= (1 + inflation);
    }
    const realWealth = current / Math.pow(1 + inflation, 10);
    let tier = "브론즈", icon = "🥉";
    const val = realWealth / (d.baseCurrency === 'KRW' ? 1 : (1/1350 * 10000));
    if (val >= 200000) { tier = "다이아몬드"; icon = "👑"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💎"; }
    else if (val >= 50000) { tier = "골드"; icon = "💰"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }
    return { tier, icon, nominalWealth: formatVal(current, d.baseCurrency), realWealth: formatVal(realWealth, d.baseCurrency), rawNominal: current };
}

function updateGoalUI(currentWealth, goalEok) {
    const goalMan = goalEok * 10000;
    const percent = Math.min(100, Math.round((currentWealth / goalMan) * 100));
    document.getElementById('goalPercent').innerText = percent + '%';
    document.getElementById('goalProgressBar').style.width = percent + '%';
    document.getElementById('goalTargetText').innerText = `목표: ${goalEok}억`;
    document.getElementById('currentWealthLabel').innerText = `현재 추정 자산: ${Math.round(currentWealth / 1000 * 10) / 100}억`;
    document.getElementById('goalInput').value = goalEok;
}

window.saveFinancialGoal = async function() {
    const amount = parseFloat(document.getElementById('goalInput').value);
    if (!amount || !currentUser) return;
    await setDoc(doc(db, "user_goals", currentUser.uid), { amount, updatedAt: new Date() });
    showToast("목표가 저장되었습니다! 🎯"); location.reload();
};

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + (v / 1000000).toFixed(2) + 'M';
}

function addLog(msg) {
    const log = document.getElementById('dashActivityLog');
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fade-in-up";
    div.innerHTML = `<span class="text-blue-500">✔</span> <span>${msg}</span>`;
    log.appendChild(div);
}

function renderDailyQuote() {
    const quotes = ["자산 배분은 공짜 점심입니다.", "가장 좋은 투자 시기는 오늘입니다.", "시장의 소음이 아닌 비중에 집중하세요.", "복리는 세상의 8번째 불가사의입니다."];
    addLog(`💡 오늘의 팁: ${quotes[Math.floor(Math.random() * quotes.length)]}`);
}

async function renderMarketSentiment() {
    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;
        const sentiment = Math.max(5, Math.min(95, 50 + ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 1000)));
        const indicator = document.getElementById('sentimentIndicator');
        if (indicator) indicator.style.left = `${sentiment}%`;
        const valEl = document.getElementById('sentimentValue');
        if (valEl) valEl.innerText = Math.round(sentiment);
    } catch (e) {}
}

function renderDashChart(assets) {
    const ctx = document.getElementById('dashTotalChart').getContext('2d');
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    new Chart(ctx, {
        type: 'doughnut',
        data: { labels: assets.map(a => a.ticker), datasets: [{ data: assets.map(a => a.qty * (a.price || 0)), backgroundColor: colors, borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function calculateHealthScore(assets) {
    const total = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    if (total === 0) return 0;
    let dev = 0;
    assets.forEach(a => dev += Math.abs(((a.qty * (a.price || 0)) / total * 100) - (a.targetWeight || 0)));
    const score = Math.max(0, 100 - Math.round(dev));
    
    // 이격도 알림 처리 (기존 로직 유지)
    const alertBanner = document.getElementById('rebalanceAlert');
    if (alertBanner) {
        if (dev >= 10) alertBanner.classList.remove('hidden');
        else alertBanner.classList.add('hidden');
    }
    return score;
}

window.quickPriceSearch = async function() {
    const ticker = document.getElementById('quickSearchInput').value.trim().toUpperCase();
    const resEl = document.getElementById('quickSearchResult');
    if (!ticker) return;
    resEl.innerHTML = '<div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>';
    try {
        const res = await fetch(`/api/price?ticker=${ticker}`);
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const color = meta.regularMarketPrice >= meta.chartPreviousClose ? 'text-red-500' : 'text-blue-500';
        resEl.innerHTML = `<div class="flex items-center justify-between w-full animate-fade-in-up"><div class="flex items-baseline gap-2"><span class="text-lg font-black">${ticker}</span><span class="text-base font-bold">${meta.regularMarketPrice.toLocaleString()}</span><span class="text-xs font-bold ${color}">${((meta.regularMarketPrice - meta.chartPreviousClose)/meta.chartPreviousClose*100).toFixed(2)}%</span></div><button onclick="addToWatchlist('${ticker}')" class="text-[10px] font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">+ 관심 등록</button></div>`;
    } catch (e) { resEl.innerHTML = '<p class="text-[10px] text-red-400">찾을 수 없음</p>'; }
};

window.addToWatchlist = async function(ticker) {
    if (!currentUser) return;
    try {
        const snap = await getDoc(doc(db, "user_watchlists", currentUser.uid));
        let tickers = snap.exists() ? snap.data().tickers : [];
        if (!tickers.includes(ticker)) {
            tickers.push(ticker);
            await setDoc(doc(db, "user_watchlists", currentUser.uid), { tickers, updatedAt: new Date() });
            renderWatchlist(tickers);
        }
    } catch (e) { console.error(e); }
};

window.removeFromWatchlist = async function(ticker) {
    if (!currentUser) return;
    try {
        const snap = await getDoc(doc(db, "user_watchlists", currentUser.uid));
        if (snap.exists()) {
            let tickers = snap.data().tickers.filter(t => t !== ticker);
            await setDoc(doc(db, "user_watchlists", currentUser.uid), { tickers, updatedAt: new Date() });
            renderWatchlist(tickers);
        }
    } catch (e) { console.error(e); }
};

async function renderWatchlist(tickers) {
    const container = document.getElementById('dashWatchlist');
    if (!container) return;
    if (tickers.length === 0) { container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">관심 있는 티커를 등록하세요.</p>'; return; }
    container.innerHTML = "";
    tickers.forEach(async (ticker) => {
        const div = document.createElement('div');
        div.className = "p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between animate-fade-in-up";
        div.innerHTML = `<div class="flex items-center gap-3"><span class="font-black text-sm">${ticker}</span><span id="price-${ticker}" class="text-xs font-bold text-slate-400">Loading...</span></div><button onclick="removeFromWatchlist('${ticker}')" class="text-slate-300 hover:text-red-500">✕</button>`;
        container.appendChild(div);
        try {
            const res = await fetch(`/api/price?ticker=${ticker}`);
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
                const color = meta.regularMarketPrice >= meta.chartPreviousClose ? 'text-red-500' : 'text-blue-500';
                const el = document.getElementById(`price-${ticker}`);
                if (el) el.innerHTML = `<span class="text-slate-800 dark:text-slate-200">${meta.regularMarketPrice.toLocaleString()}</span> <span class="${color}">${meta.regularMarketPrice >= meta.chartPreviousClose ? '+' : ''}${((meta.regularMarketPrice - meta.chartPreviousClose)/meta.chartPreviousClose*100).toFixed(2)}%</span>`;
            }
        } catch (e) {}
    });
}

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
