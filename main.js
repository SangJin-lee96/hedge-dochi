document.addEventListener('DOMContentLoaded', () => {
    let chart;

    function updateSimulation() {
        // 1. 입력값 가져오기
        const salaryElem = document.getElementById('annualSalary');
        if (!salaryElem) return; // Guard clause for pages without the simulator

        let salary = parseFloat(salaryElem.value);
        const salaryGrowth = parseFloat(document.getElementById('salaryGrowth').value) / 100;
        const initialSeed = parseFloat(document.getElementById('initialSeed').value);
        const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value);
        const investmentReturn = parseFloat(document.getElementById('investmentReturn').value) / 100;
        const inflationRate = parseFloat(document.getElementById('inflationRate').value) / 100;

        let currentWealth = initialSeed;
        
        const labels = [];
        const nominalData = [];
        const realData = [];
        const monthlyReturn = investmentReturn / 12;

        // 2. 10년치 계산 루프
        for (let year = 0; year <= 10; year++) {
            labels.push(year === 0 ? '현재' : `${year}년후`);
            nominalData.push(Math.round(currentWealth));
            realData.push(Math.round(currentWealth / Math.pow(1 + inflationRate, year)));

            if (year < 10) {
                let monthlySalary = salary / 12;
                let monthlyNetSavings = monthlySalary - monthlyExpense;

                for (let m = 0; m < 12; m++) {
                    // 월별 투자 수익 및 저축 반영
                    currentWealth *= (1 + monthlyReturn);
                    if (monthlyNetSavings > 0) {
                        currentWealth += monthlyNetSavings;
                    }
                }
                // 연말 연봉 인상 반영
                salary *= (1 + salaryGrowth);
            }
        }

        // 3. UI 업데이트 (텍스트 및 차트)
        const finalNominal = nominalData[10];
        const finalReal = realData[10];
        const currentAvgNet = (parseFloat(document.getElementById('annualSalary').value)/12) - monthlyExpense;

        const formatWealth = (val) => {
            if (val >= 10000) {
                return (val / 10000).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "억";
            }
            return Math.round(val).toLocaleString() + "만";
        };

        document.getElementById('finalWealthText').innerText = formatWealth(finalNominal);
        document.getElementById('realValueText').innerText = formatWealth(finalReal);
        document.getElementById('netSavingsText').innerText = Math.round(currentAvgNet).toLocaleString() + "만";

        updateChart(labels, nominalData, realData);
        generateInsight(finalNominal, finalReal, currentAvgNet);
        
        // ⭐ 4. 등급 결정 함수 호출 ⭐
        determineGrade(finalNominal);
    }

    // ⭐ 등급별 투자 전략 데이터 ⭐
    const strategyData = {
        '브론즈': {
            icon: '🥉',
            content: `
                <div class="space-y-4">
                    <p class="font-bold text-lg text-orange-600 dark:text-orange-400">자산 형성의 초기 단계입니다.</p>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>지출 통제:</strong> 'Fixed Expense Management'가 최우선입니다. 가계부를 통해 불필요한 구독 서비스나 고정 지출을 줄이세요.</li>
                        <li><strong>시드머니 확보:</strong> 소액이라도 꾸준히 적립식 투자를 시작하는 습관이 수익률보다 훨씬 중요합니다.</li>
                        <li><strong>비상금 마련:</strong> 월급의 3~6개월치 비상금을 먼저 확보하여 예상치 못한 지출에 대비하세요.</li>
                    </ul>
                </div>`
        },
        '실버': {
            icon: '🥈',
            content: `
                <div class="space-y-4">
                    <p class="font-bold text-lg text-slate-600 dark:text-slate-400">기반이 마련되었습니다. 이제는 성장할 때입니다.</p>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>금융 지능(IQ) 높이기:</strong> 투자 관련 서적을 읽고 경제 흐름을 파악하기 시작하세요.</li>
                        <li><strong>인덱스 펀드/ETF:</strong> 개별 종목보다는 시장 평균을 따라가는 분산 투자로 안정적인 수익을 추구하세요.</li>
                        <li><strong>세제 혜택 활용:</strong> ISA, 연금저축 등 절세 계좌를 최대한 활용하여 실질 수익률을 높이세요.</li>
                    </ul>
                </div>`
        },
        '골드': {
            icon: '🥇',
            content: `
                <div class="space-y-4">
                    <p class="font-bold text-lg text-amber-600 dark:text-amber-400">본격적인 자산 우상향 궤도에 진입했습니다.</p>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>자산 배분(Asset Allocation):</strong> 주식, 채권, 원자재 등 상관관계가 낮은 자산군에 나누어 투자하여 리스크를 관리하세요.</li>
                        <li><strong>포트폴리오 리밸런싱:</strong> 주기적으로 자산 비중을 점검하고 원래 계획했던 비율로 조정하세요.</li>
                        <li><strong>부수입 창출:</strong> 근로 소득 외에 자산 소득이 유의미해지는 지점입니다. 재투자를 통해 복리 효과를 극대화하세요.</li>
                    </ul>
                </div>`
        },
        '플래티넘': {
            icon: '💠',
            content: `
                <div class="space-y-4">
                    <p class="font-bold text-lg text-blue-600 dark:text-blue-400">상위권 자산가 그룹입니다. 시스템을 견고히 하세요.</p>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>세금 최적화:</strong> 증여, 양도세 등 세금 계획을 사전에 수립하여 자산 누수를 막으세요.</li>
                        <li><strong>현금 흐름 강화:</strong> 배당주, 부동산 수익 등 노동 없이도 발생하는 시스템 소득 비중을 높이세요.</li>
                        <li><strong>전문가 네트워크:</strong> 세무사, 자산관리사 등 전문가의 조언을 듣고 장기적인 플랜을 점검하세요.</li>
                    </ul>
                </div>`
        },
        '다이아몬드': {
            icon: '💎',
            content: `
                <div class="space-y-4">
                    <p class="font-bold text-lg text-purple-600 dark:text-purple-400">경제적 자유를 달성했습니다. 자산 방어가 핵심입니다.</p>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                        <li><strong>자산 방어(Wealth Preservation):</strong> 무리한 수익률 추구보다는 인플레이션을 방어하며 자산 가치를 보존하는 데 집중하세요.</li>
                        <li><strong>사회적 가치 환원:</strong> 노블레스 오블리주를 실천하거나 가문의 자산 승계 플랜을 구체화하세요.</li>
                        <li><strong>웰빙(Well-being):</strong> 경제적 자유를 바탕으로 자신의 건강과 가족, 개인적인 꿈에 더 많은 시간을 투자하세요.</li>
                    </ul>
                </div>`
        }
    };

    let currentGradeTitle = "다이아몬드";

    // ⭐ 등급 결정 함수 ⭐
    function determineGrade(finalWealth) {
        const section = document.getElementById('gradeSection');
        const badgeIcon = document.getElementById('gradeBadgeIcon');
        const title = document.getElementById('gradeTitle');
        const desc = document.getElementById('gradeDesc');

        let grade = {};

        // 등급 기준 (단위: 만원)
        if (finalWealth < 10000) { // 1억 미만
            grade = {
                icon: '🥉', title: '브론즈',
                desc: '아직은 준비 단계! 지출을 조금만 줄여도 결과가 크게 바뀝니다.',
                bgClasses: ['from-orange-400', 'via-orange-500', 'to-amber-500'],
                animationClass: 'animate-pulse'
            };
        } else if (finalWealth < 30000) { // 3억 미만
            grade = {
                icon: '🥈', title: '실버',
                desc: '꾸준함이 무기! 시드머니가 모이고 있습니다. 투자 공부를 병행해보세요.',
                bgClasses: ['from-slate-400', 'via-slate-500', 'to-zinc-500'],
                animationClass: 'animate-bounce'
            };
        } else if (finalWealth < 60000) { // 6억 미만
            grade = {
                icon: '🥇', title: '골드',
                desc: '안정적인 궤도 진입! 노후 준비의 탄탄한 기반을 마련하셨습니다.',
                bgClasses: ['from-yellow-400', 'via-amber-500', 'to-orange-500'],
                animationClass: 'animate-pulse'
            };
        } else if (finalWealth < 120000) { // 12억 미만
            grade = {
                icon: '💠', title: '플래티넘',
                desc: '상위권 자산가! 경제적 자유를 향한 고속도로에 올라탔습니다.',
                bgClasses: ['from-cyan-500', 'via-blue-500', 'to-indigo-600'],
                animationClass: 'animate-pulse'
            };
        } else { // 12억 이상
            grade = {
                icon: '💎', title: '다이아몬드',
                desc: 'TOP TIER 달성! 10년 후, 당신은 경제적 자유를 누리게 됩니다.',
                bgClasses: ['from-indigo-500', 'via-purple-500', 'to-pink-500'],
                animationClass: 'animate-bounce'
            };
        }

        currentGradeTitle = grade.title;

        // 애니메이션과 함께 UI 업데이트
        section.className = `capture-area p-10 rounded-2xl shadow-2xl text-center transition-all duration-700 transform hover:scale-[1.01] bg-gradient-to-br ${grade.bgClasses.join(' ')}`;
        section.style.borderColor = `var(--color-grade-section-border)`;

        badgeIcon.innerText = grade.icon;
        badgeIcon.className = `text-7xl md:text-8xl mb-6 drop-shadow-2xl transition-all duration-700 ${grade.animationClass}`;
        
        title.innerText = grade.title;
        title.className = `text-5xl md:text-6xl font-black text-white mb-3 transition-all duration-700 tracking-tight`;
        title.style.color = ''; 

        desc.innerText = grade.desc;
        desc.className = `text-white/90 text-lg md:text-xl font-medium max-w-xl mx-auto transition-all duration-700 leading-relaxed`;
        desc.style.color = ''; 
    }

    // ⭐ 모달 제어 로직 ⭐
    const modal = document.getElementById('strategyModal');
    const modalContainer = document.getElementById('modalContainer');
    const showBtn = document.getElementById('showStrategyBtn');
    const closeBtns = [document.getElementById('closeModal'), document.getElementById('closeModalBtn')];

    function openModal() {
        const data = strategyData[currentGradeTitle];
        document.getElementById('modalIcon').innerText = data.icon;
        document.getElementById('modalContent').innerHTML = data.content;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modalContainer.classList.remove('scale-95', 'opacity-0');
            modalContainer.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeModal() {
        modalContainer.classList.remove('scale-100', 'opacity-100');
        modalContainer.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    if (showBtn) {
        showBtn.addEventListener('click', openModal);
        closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    function updateChart(labels, nominalData, realData) {
        const ctx = document.getElementById('wealthChart').getContext('2d');
        if (chart) chart.destroy();

        const isDarkMode = document.documentElement.classList.contains('dark');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        const tickColor = isDarkMode ? '#94a3b8' : '#64748b';

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '명목 자산 (통장 찍히는 돈)',
                        data: nominalData,
                        borderColor: isDarkMode ? '#60a5fa' : '#2563eb',
                        backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)', 
                        fill: true,
                        borderWidth: 4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        tension: 0.4
                    },
                    {
                        label: '실질 가치 (물가 반영된 돈)',
                        data: realData,
                        borderColor: isDarkMode ? '#94a3b8' : '#64748b',
                        borderDash: [8, 8],
                        fill: false,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
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
                        align: 'end', 
                        labels: { 
                            usePointStyle: true, 
                            boxWidth: 10, 
                            font: { family: 'Pretendard', weight: '600' },
                            color: tickColor
                        } 
                    },
                    tooltip: { 
                        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(0,0,0,0.8)', 
                        titleFont: { family: 'Pretendard' }, 
                        bodyFont: { family: 'Pretendard' }, 
                        padding: 12, 
                        cornerRadius: 12 
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: false,
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { 
                            callback: v => v/10000 + '억', 
                            font: { family: 'Pretendard', weight: '600' }, 
                            color: tickColor 
                        }
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { 
                            font: { family: 'Pretendard', weight: '600' }, 
                            color: tickColor 
                        } 
                    }
                }
            }
        });
    }

    function generateInsight(final, real, net) {
        let text = "";
        if (net < 0) {
            text = "🚨 비상! 현재 지출이 수입보다 많습니다. 저축은커녕 빚이 늘어날 수 있는 구조입니다. 고정 지출 다이어트가 시급합니다.";
        } else if (net < 50) {
            text = `⚠️ 저축 여력이 빠듯합니다. (월 ${Math.round(net)}만원). 예상치 못한 지출이 생기면 계획이 흔들릴 수 있습니다. 부수입이나 지출 통제를 고려해보세요.`;
        } else if (final > 100000) {
            text = `✨ 아주 훌륭한 흐름입니다! 이대로라면 10년 후 자산 ${Math.round(final/10000).toFixed(1)}억 원 클럽에 가입합니다. 물가 상승을 이기는 투자를 지속하는 것이 관건입니다.`;
        } else {
            text = `💡 긍정적입니다. 꾸준히 자산이 우상향하고 있습니다. 현재의 저축 습관을 유지하되, 투자 수익률을 1~2%만 높여도 결과는 극적으로 바뀔 수 있습니다.`;
        }
        document.getElementById('aiInsight').innerText = text;
    }

    // 이벤트 리스너 등록
    const ids = ['annualSalary', 'salaryGrowth', 'initialSeed', 'monthlyExpense', 'investmentReturn', 'inflationRate'];
    if (document.getElementById('annualSalary')) {
        ids.forEach(id => document.getElementById(id).addEventListener('input', updateSimulation));
        // 초기 실행
        updateSimulation();
    }

    // 테마 변경 감지 및 차트 업데이트
    window.addEventListener('themeChanged', () => {
        if (document.getElementById('annualSalary')) {
            updateSimulation();
        }
    });

    // SNS 공유 함수 추가
    window.shareToX = function() {
        const gradeTitle = document.getElementById('gradeTitle').innerText;
        const text = `나의 10년 후 자산 등급은 [${gradeTitle}]! 현실 자산 시뮬레이터에서 당신의 등급도 확인해보세요! 💎`;
        const url = window.location.href;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    window.shareToThreads = function() {
        const gradeTitle = document.getElementById('gradeTitle').innerText;
        const text = `나의 10년 후 자산 등급은 [${gradeTitle}]! 현실 자산 시뮬레이터에서 당신의 등급도 확인해보세요! 💎`;
        const url = window.location.href;
        window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}`, '_blank');
    };

    window.shareToInstagram = function() {
        const gradeTitle = document.getElementById('gradeTitle').innerText;
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert(`링크가 복사되었습니다! 나의 등급 [${gradeTitle}] 결과를 인스타그램 스토리에 공유해보세요. 📸`);
        }).catch(err => {
            console.error('링크 복사 실패:', err);
        });
    };

    window.copyLink = function() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert("링크가 복사되었습니다!");
        }).catch(err => {
            console.error('링크 복사 실패:', err);
        });
    };
});