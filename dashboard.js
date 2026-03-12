import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        
        // 대시보드 UI 업데이트
        document.getElementById('dashUserName').innerText = user.displayName;
        document.getElementById('dashUserPhoto').src = user.photoURL;
        
        loadDashboardData(user.uid);
        renderMarketSentiment(); // 시장 심리 로드
    } else {
// ... (생략)

async function renderMarketSentiment() {
    const indicator = document.getElementById('sentimentIndicator');
    const valEl = document.getElementById('sentimentValue');
    const labelEl = document.getElementById('sentimentLabel');
    if (!indicator) return;

    try {
        const res = await fetch('/api/price?ticker=^GSPC');
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;

        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        
        // 간단한 센티먼트 로직 (전일 대비 등락폭 확대 해석)
        const dayChangePercent = (price - prevClose) / prevClose * 100;
        let sentiment = 50 + (dayChangePercent * 10); // 기본 50에서 등락폭에 따라 가감
        sentiment = Math.max(5, Math.min(95, sentiment)); // 5~95 사이로 제한

        indicator.style.left = `${sentiment}%`;
        valEl.innerText = Math.round(sentiment);

        if (sentiment > 70) { labelEl.innerText = "GREED"; labelEl.className = "text-[10px] font-bold text-red-500 uppercase"; }
        else if (sentiment < 30) { labelEl.innerText = "FEAR"; labelEl.className = "text-[10px] font-bold text-blue-500 uppercase"; }
        else { labelEl.innerText = "NEUTRAL"; labelEl.className = "text-[10px] font-bold text-slate-400 uppercase"; }

    } catch (e) {}
}
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userProfile) userProfile.classList.add('hidden');
        alert("로그인이 필요한 페이지입니다. 홈으로 이동합니다.");
        location.href = "index.html";
    }
});

async function loadDashboardData(uid) {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(c => c.classList.add('skeleton')); // 로딩 시작

    const activityLog = document.getElementById('dashActivityLog');
    activityLog.innerHTML = "";

    try {
        // ... (데이터 로드 로직 동일)
// ... (생략)
        renderDashChart(assets);
    } catch (e) { console.error("Load Error:", e); }
    finally {
        cards.forEach(c => c.classList.remove('skeleton')); // 로딩 종료
    }
}
        const riskSnap = await getDoc(doc(db, "risk_profiles", uid));
        if (riskSnap.exists()) {
            const data = riskSnap.data();
            document.getElementById('dashRiskType').innerText = data.type;
            document.getElementById('dashRiskDesc').innerText = `추천: ${data.portfolio}`;
            const icons = { "공격투자형": "🔥", "적극투자형": "🚀", "위험중립형": "⚖️", "안정추구형": "🛡️", "안정형": "💎" };
            document.getElementById('dashRiskIcon').innerText = icons[data.type] || "🧠";
            addLog(`투자 성향이 '${data.type}'으로 분석되었습니다.`);
        }

        // 2. 자산 시뮬레이션 데이터 분석 및 렌더링
        const simSnap = await getDoc(doc(db, "simulations", uid));
        if (simSnap.exists()) {
            const d = simSnap.data();
            const result = calculateSummary(d);
            
            document.getElementById('dashTierName').innerText = result.tier;
            document.getElementById('dashTierIcon').innerText = result.icon;
            
            // 활동 로그에 상세 수치 추가
            addLog(`10년 후 예상 자산: ${result.nominalWealth}`);
            addLog(`물가 반영 실질 가치: ${result.realWealth}`);
        }

        // 3. 리밸런싱 포트폴리오 데이터
        const portSnap = await getDoc(doc(db, "portfolios", uid));
        if (portSnap.exists()) {
            const assets = portSnap.data().assets || [];
            if (assets.length > 0) {
                // 실시간 건강 점수 계산
                const score = calculateHealthScore(assets);
                const scoreEl = document.getElementById('dashScoreValue');
                scoreEl.innerText = score;
                scoreEl.className = `text-6xl font-black mb-4 ${score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'}`;
                
                addLog(`${assets.length}개의 종목을 관리 중입니다. (건강도: ${score}점)`);
                renderDashChart(assets);
            }
        }

        // 4. 로또 행운 번호 데이터 (기존 로직 유지)
// ... (생략)

function calculateHealthScore(assets) {
    const totalValue = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    if (totalValue === 0) return 0;
    
    let totalDeviance = 0;
    assets.forEach(a => {
        const currentWeight = (a.qty * (a.price || 0) / totalValue) * 100;
        totalDeviance += Math.abs(currentWeight - (a.targetWeight || 0));
    });
    
    return Math.max(0, 100 - Math.round(totalDeviance));
}
        const lottoSnap = await getDoc(doc(db, "lotto_history", uid));
        const lottoContainer = document.getElementById('dashLottoList');
        if (lottoSnap.exists()) {
            const data = lottoSnap.data();
            lottoContainer.innerHTML = "";
            data.results.slice(0, 4).forEach((res, i) => {
                const div = document.createElement('div');
                div.className = "p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-2";
                
                let numsHTML = "";
                if (data.type === '645') {
                    numsHTML = res.map(n => `<span class="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">${n}</span>`).join('');
                } else {
                    numsHTML = `<span class="text-xs font-bold text-purple-500">${res.group}조 ${res.numbers.join('')}</span>`;
                }

                div.innerHTML = `<span class="text-[10px] font-black text-slate-400">G${i+1}</span><div class="flex gap-1">${numsHTML}</div>`;
                lottoContainer.appendChild(div);
            });
            addLog("최근 행운의 번호가 저장되었습니다.");
        }

        if (activityLog.innerHTML === "") {
            activityLog.innerHTML = "아직 기록된 활동이 없습니다. 도구를 사용하여 자산을 분석해보세요!";
        }

        renderDailyQuote();

    } catch (e) { console.error("Load Error:", e); }
}

function renderDashChart(assets) {
    const ctx = document.getElementById('dashTotalChart').getContext('2d');
    const totalValue = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    const centerText = document.getElementById('dashChartCenterText');
    const legend = document.getElementById('dashAssetLegend');
    
    centerText.innerText = assets.length + " 종목";
    legend.innerHTML = "";

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: assets.map(a => a.ticker),
            datasets: [{
                data: assets.map(a => a.qty * (a.price || 0)),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            cutout: '80%',
            plugins: { legend: { display: false } },
            animation: { animateScale: true }
        }
    });

    // 커스텀 범례 생성
    assets.forEach((a, i) => {
        const weight = totalValue > 0 ? ((a.qty * a.price) / totalValue * 100).toFixed(1) : 0;
        const item = document.createElement('div');
        item.className = "flex items-center gap-2";
        item.innerHTML = `
            <div class="w-2 h-2 rounded-full" style="background-color: ${colors[i % colors.length]}"></div>
            <span class="text-slate-600 dark:text-slate-400">${a.ticker}</span>
            <span class="ml-auto text-slate-400">${weight}%</span>
        `;
        legend.appendChild(item);
    });
}

// 시뮬레이션 데이터 요약 계산기 (main.js 로직 축약본)
function calculateSummary(d) {
    const salary = parseFloat(d.annualSalary) || 0;
    const seed = parseFloat(d.initialSeed) || 0;
    const expense = parseFloat(d.monthlyExpense) || 0;
    const growth = (parseFloat(d.salaryGrowth) || 0) / 100;
    const returns = (parseFloat(d.investmentReturn) || 0) / 100;
    const inflation = (parseFloat(d.inflationRate) || 0) / 100;

    let current = seed;
    let curSalary = salary;
    let curExpense = expense;

    for (let i = 1; i <= 10; i++) {
        const surplus = curSalary - (curExpense * 12);
        current = current + surplus + ((current + surplus / 2) * returns);
        curSalary *= (1 + growth);
        curExpense *= (1 + inflation);
    }

    const realWealth = current / Math.pow(1 + inflation, 10);
    
    // 등급 판정
    let tier = "브론즈", icon = "🥉";
    const threshold = d.baseCurrency === 'KRW' ? 1 : (1/1350 * 10000); // 환율 가정
    const val = realWealth / threshold;

    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; }

    return {
        tier, icon,
        nominalWealth: formatVal(current, d.baseCurrency),
        realWealth: formatVal(realWealth, d.baseCurrency)
    };
}

function formatVal(v, curr) {
    if (curr === 'KRW') {
        return v >= 10000 ? (v / 10000).toFixed(1) + '억' : Math.round(v).toLocaleString() + '만';
    }
    return '$' + (v / 1000000).toFixed(2) + 'M';
}

function renderDailyQuote() {
    const quotes = [
        "자산 배분은 투자자가 가질 수 있는 유일한 공짜 점심입니다.",
        "가장 좋은 투자 시기는 어제였고, 그다음으로 좋은 시기는 바로 오늘입니다.",
        "시장의 소음이 아닌, 당신만의 비중(Allocation)에 집중하세요.",
        "복리는 세상의 8번째 불가사의입니다. 시간을 내 편으로 만드세요.",
        "리밸런싱은 본능을 이기고 기계적으로 수익을 확정하는 기술입니다."
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    addLog(`💡 오늘의 팁: ${randomQuote}`);
}

window.quickPriceSearch = async function() {
    const ticker = document.getElementById('quickSearchInput').value.trim().toUpperCase();
    const resultEl = document.getElementById('quickSearchResult');
    if (!ticker) return;

    resultEl.innerHTML = '<div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>';

    try {
        const res = await fetch(`/api/price?ticker=${ticker}`);
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error();

        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const change = price - prevClose;
        const changePercent = (change / prevClose * 100).toFixed(2);
        const color = change >= 0 ? 'text-red-500' : 'text-blue-500';

        resultEl.innerHTML = `
            <div class="flex items-baseline gap-2 animate-fade-in-up">
                <span class="text-lg font-black text-slate-800 dark:text-slate-200">${ticker}</span>
                <span class="text-base font-bold">${price.toLocaleString()}</span>
                <span class="text-xs font-bold ${color}">${change >= 0 ? '+' : ''}${changePercent}%</span>
            </div>
        `;
    } catch (e) {
        resultEl.innerHTML = '<p class="text-[10px] text-red-400">종목을 찾을 수 없습니다. (예: TSLA, AAPL)</p>';
    }
};

function addLog(msg) {
    const log = document.getElementById('dashActivityLog');
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fade-in-up";
    div.innerHTML = `<span class="text-blue-500">✔</span> <span>${msg}</span>`;
    log.appendChild(div);
}

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
