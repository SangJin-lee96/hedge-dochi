import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, saveProgress, goToNextStep, getStepData } from './core.js';

document.addEventListener('coreDataReady', async (e) => {
    const user = e.detail.user;
    if (user) {
        const nameEl = document.getElementById('dashUserName');
        if (nameEl) {
            nameEl.innerHTML = `${user.displayName || '투자자'} <span id="userTraitBadge" class="ml-2 text-[10px] px-2 py-1 rounded-lg bg-slate-500 text-white opacity-0 transition-opacity duration-1000">분석 중</span>`;
        }
        await loadDashboardData(user.uid);
        renderMarketSentiment();
    } else {
        showToast("로그인이 필요한 서비스입니다."); location.href = "index.html";
    }
});

async function loadDashboardData(uid) {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(c => c.classList.add('skeleton'));
    
    try {
        // 1. 모든 데이터 로드 (Step 3 데이터 포함)
        const [portSnap, lottoSnap, goalSnap, watchSnap, divSnap] = await Promise.all([
            getDoc(doc(db, "portfolios", uid)),
            getDoc(doc(db, "lotto_history", uid)),
            getDoc(doc(db, "user_goals", uid)),
            getDoc(doc(db, "user_watchlists", uid)),
            getDoc(doc(db, "dividend_goals", uid))
        ]);

        const step1Data = await getStepData(1);
        const step2Data = await getStepData(2);
        const step3Data = await getStepData(3);

        // 2. 투자 성향 (Step 3) UI 업데이트 - 이 부분이 핵심
        let riskType = null;
        let recommendedPortfolio = null;
        
        const riskCard = document.getElementById('dashRiskCard'); // 리스크 카드 컨테이너
        if (step3Data && step3Data.riskType) {
            riskType = step3Data.riskType;
            recommendedPortfolio = step3Data.recommendedPortfolio;
            
            // 기존 내용을 결과로 교체
            const riskTypeEl = document.getElementById('dashRiskType');
            const riskDescEl = document.getElementById('dashRiskDesc');
            const riskIconEl = document.getElementById('dashRiskIcon');
            
            if (riskTypeEl) riskTypeEl.innerText = riskType;
            if (riskDescEl) riskDescEl.innerText = `추천: ${recommendedPortfolio}`;
            
            const icons = { "공격투자형": "🔥", "적극투자형": "🚀", "위험중립형": "⚖️", "안정추구형": "🛡️", "안정형": "💎" };
            if (riskIconEl) riskIconEl.innerText = icons[riskType] || "🧠";
            
            // "진단 시작" 버튼이 있다면 숨기거나 제거
            const startBtn = document.querySelector('#dashRiskCard a');
            if (startBtn && startBtn.innerText.includes('시작')) {
                startBtn.classList.add('hidden');
            }
        }

        // 3. 자산 티어 (Step 1) 업데이트
        let simResult = null;
        if (step1Data) {
            simResult = calculateSummary(step1Data);
            const tierNameEl = document.getElementById('dashTierName');
            const tierIconEl = document.getElementById('dashTierIcon');
            if (tierNameEl) tierNameEl.innerText = simResult.tier;
            if (tierIconEl) tierIconEl.innerText = simResult.icon;
        }

        // 4. 캐릭터 아바타 업데이트
        updateUserAvatar(simResult, riskType);

        // 5. 포트폴리오 차트 및 건강 점수
        if (portSnap.exists()) {
            const portData = portSnap.data();
            const assets = portData.assets || [];
            if (assets.length > 0) {
                const score = calculateHealthScore(assets);
                const scoreEl = document.getElementById('dashScoreValue');
                if (scoreEl) {
                    scoreEl.innerText = score;
                    scoreEl.className = `text-6xl font-black mb-4 ${score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'}`;
                }
                renderDashChart(assets);
                const totalWealth = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
                const centerTextEl = document.getElementById('dashChartCenterText');
                if (centerTextEl) centerTextEl.innerText = formatVal(totalWealth, portData.baseCurrency || 'USD');
            } else {
                showEmptyAssetGuide(recommendedPortfolio);
            }
        } else {
            showEmptyAssetGuide(recommendedPortfolio);
        }

        // 6. FIRE 정보 (Step 2)
        if (step2Data) {
            const fireIncomeEl = document.getElementById('dashFireRemaining');
            const fireReturnEl = document.getElementById('dashFireDate');
            if (fireIncomeEl) fireIncomeEl.innerText = `목표: ${formatVal(step2Data.monthlyExpense || 200, 'KRW')}/월`;
            if (fireReturnEl) fireReturnEl.innerText = `목표 수익률: ${step2Data.investmentReturn || 0}%`;
        }

        // 7. 기타 UI 복구 (로또, 배당 등)
        if (lottoSnap.exists()) {
            const d = lottoSnap.data();
            const container = document.getElementById('dashLottoList');
            if (container) {
                container.innerHTML = "";
                (d.results || []).slice(0, 4).forEach((res, i) => {
                    const div = document.createElement('div');
                    div.className = "p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between";
                    let nums = d.type === '645' ? res.map(n => `<span class="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">${n}</span>`).join('') : `<span class="text-xs font-bold text-purple-500">${res.group}조 ${res.numbers.join('')}</span>`;
                    div.innerHTML = `<span class="text-[10px] font-black text-slate-400">G${i+1}</span><div class="flex gap-1">${nums}</div>`;
                    container.appendChild(div);
                });
            }
        }

        if (divSnap.exists()) {
            const divEl = document.getElementById('dashMonthlyDividend');
            if (divEl) divEl.innerText = `예상 월 배당금: ${formatVal(divSnap.data().monthlyIncome, 'KRW')}`;
        }

        if (goalSnap.exists() && simResult) {
            updateGoalUI(simResult.rawNominal, goalSnap.data().amount);
        }

        renderDailyQuote();
    } catch (e) { console.error("Dashboard Load Error:", e); }
    finally { cards.forEach(c => c.classList.remove('skeleton')); }
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

function updateUserAvatar(sim, riskType) {
    const photoEl = document.getElementById('dashUserPhoto');
    const badgeEl = document.getElementById('userTraitBadge');
    if (!photoEl) return;
    const avatars = { "다이아몬드": "👑", "플래티넘": "💎", "골드": "💰", "실버": "🥈", "브론즈": "🦔" };
    const char = avatars[sim?.tier] || "🦔";
    const newAvatar = document.createElement('div');
    newAvatar.id = 'dashUserPhoto';
    newAvatar.className = "w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center text-5xl transform hover:rotate-12 transition-transform duration-500 cursor-pointer";
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
    const realWealth = current / Math.pow(1 + (d.baseCurrency === 'KRW' ? inflation : 0.03), 10);
    let tier = "브론즈", icon = "🥉";
    const val = realWealth / (d.baseCurrency === 'KRW' ? 1 : (1/1350 * 10000));
    if (val >= 200000) { tier = "다이아몬드"; icon = "👑"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💎"; }
    else if (val >= 50000) { tier = "골드"; icon = "💰"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }
    return { tier, icon, rawNominal: current };
}

function updateGoalUI(currentWealth, goalEok) {
    const goalMan = goalEok * 10000;
    const percent = Math.min(100, Math.round((currentWealth / goalMan) * 100));
    const pctEl = document.getElementById('goalPercent');
    const barEl = document.getElementById('goalProgressBar');
    if (pctEl) pctEl.innerText = percent + '%';
    if (barEl) barEl.style.width = percent + '%';
}

function formatVal(v, curr) {
    if (curr === 'KRW') return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    return '$' + (v / 1000000).toFixed(2) + 'M';
}

function addLog(msg) {
    const log = document.getElementById('dashActivityLog');
    if (!log) return;
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fade-in-up";
    div.innerHTML = `<span class="text-blue-500">✔</span> <span>${msg}</span>`;
    log.appendChild(div);
}

function renderDailyQuote() {
    const quotes = ["자산 배분은 공짜 점심입니다.", "가장 좋은 투자 시기는 오늘입니다.", "시장의 소음이 아닌 비중에 집중하세요."];
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
    } catch (e) {}
}

function renderDashChart(assets) {
    const ctxEl = document.getElementById('dashTotalChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: { labels: assets.map(a => a.ticker), datasets: [{ data: assets.map(a => a.qty * (a.price || 0)), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function calculateHealthScore(assets) {
    const total = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    if (total === 0) return 0;
    let dev = 0;
    assets.forEach(a => dev += Math.abs(((a.qty * (a.price || 0)) / total * 100) - (a.targetWeight || 0)));
    return Math.max(0, 100 - Math.round(dev));
}

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
