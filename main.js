document.addEventListener('DOMContentLoaded', () => {
    let chart;

    // --- Mobile Menu Toggle Logic ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        const toggleMenu = () => {
            mobileMenu.classList.toggle('hidden');
            if (!mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('animate-slide-down');
            }
        };

        mobileMenuBtn.addEventListener('click', toggleMenu);
        mobileMenuBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleMenu();
        }, { passive: false });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    function updateSimulation() {
        const salaryElem = document.getElementById('annualSalary');
        if (!salaryElem) return;

        let salary = parseFloat(salaryElem.value) || 0;
        const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
        const initialSeed = parseFloat(document.getElementById('initialSeed').value) || 0;
        const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
        const investmentReturn = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
        const inflationRate = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

        let currentWealth = initialSeed;
        
        const labels = [];
        const nominalData = [];
        const realData = [];
        const monthlyReturn = investmentReturn / 12;

        for (let year = 0; year <= 10; year++) {
            labels.push(year === 0 ? '현재' : `${year}년후`);
            nominalData.push(Math.round(currentWealth));
            realData.push(Math.round(currentWealth / Math.pow(1 + inflationRate, year)));

            if (year < 10) {
                let monthlySalary = salary / 12;
                let monthlyNetSavings = monthlySalary - monthlyExpense;

                for (let m = 0; m < 12; m++) {
                    currentWealth *= (1 + monthlyReturn);
                    currentWealth += monthlyNetSavings;
                }
                salary *= (1 + salaryGrowth);
            }
        }

        const finalNominal = nominalData[10];
        const finalReal = realData[10];
        const currentAvgNet = (parseFloat(document.getElementById('annualSalary').value || 0)/12) - monthlyExpense;

        const formatWealth = (val) => {
            if (Math.abs(val) >= 10000) {
                return (val / 10000).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "억";
            }
            return Math.round(val).toLocaleString() + "만";
        };

        document.getElementById('finalWealthText').innerText = formatWealth(finalNominal);
        document.getElementById('realValueText').innerText = formatWealth(finalReal);
        document.getElementById('netSavingsText').innerText = Math.round(currentAvgNet).toLocaleString() + "만";

        updateChart(labels, nominalData, realData);
        generateInsight(finalNominal, finalReal, currentAvgNet);
        determineGrade(finalNominal);
    }

    const strategyData = {
        '자산 위험': {
            icon: '⚠️',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-red-600 dark:text-red-400">자산이 줄어들고 있습니다!</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>지출 구조조정:</strong> 불필요한 모든 비용을 제거해야 합니다.</li><li><strong>부채 관리:</strong> 고금리 부채 상환이 최우선입니다.</li><li><strong>소득 다각화:</strong> 추가 수입원을 반드시 확보하세요.</li></ul></div>`
        },
        '브론즈': {
            icon: '🥉',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-orange-600 dark:text-orange-400">자산 형성의 기초 단계입니다.</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>지출 통제:</strong> 고정 지출을 줄여 저축액을 늘리세요.</li><li><strong>종잣돈 마련:</strong> 소액이라도 꾸준한 적립식 투자가 중요합니다.</li><li><strong>비상금 확보:</strong> 3~6개월치 생활비를 먼저 모으세요.</li></ul></div>`
        },
        '실버': {
            icon: '🥈',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-slate-600 dark:text-slate-400">기반이 마련되었습니다.</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>투자 공부:</strong> 지수 추종 ETF 등으로 안정적 성장을 꾀하세요.</li><li><strong>세제 혜택:</strong> ISA, 연금저축 계좌를 적극 활용하세요.</li><li><strong>금융 지능 향상:</strong> 경제 흐름을 읽는 습관을 들이세요.</li></ul></div>`
        },
        '골드': {
            icon: '🥇',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-amber-600 dark:text-amber-400">자산 우상향 궤도에 진입했습니다.</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>자산 배분:</strong> 다양한 자산군에 분산하여 리스크를 관리하세요.</li><li><strong>리밸런싱:</strong> 주기적으로 비중을 점검하고 조정하세요.</li><li><strong>재투자:</strong> 발생한 수익을 재투자하여 복리를 극대화하세요.</li></ul></div>`
        },
        '플래티넘': {
            icon: '💠',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-blue-600 dark:text-blue-400">상위권 자산가 그룹입니다.</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>절세 전략:</strong> 증여, 양도세 등 세금 최적화를 시작하세요.</li><li><strong>현금 흐름:</strong> 배당 및 임대 소득 등 시스템 소득을 늘리세요.</li><li><strong>자산 방어:</strong> 리스크가 큰 투자보다는 원금 보존에 신경 쓰세요.</li></ul></div>`
        },
        '다이아몬드': {
            icon: '💎',
            content: `<div class="space-y-4"><p class="font-bold text-lg text-purple-600 dark:text-purple-400">경제적 자유를 달성했습니다.</p><ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300"><li><strong>부의 대물림:</strong> 가문의 자산 승계 플랜을 구체화하세요.</li><li><strong>사회적 기여:</strong> 가치 있는 곳에 자산을 환원하는 것을 고려하세요.</li><li><strong>삶의 질:</strong> 자산 관리보다 건강과 행복에 집중할 때입니다.</li></ul></div>`
        }
    };

    let currentGradeTitle = "다이아몬드";

    function determineGrade(finalWealth) {
        const section = document.getElementById('gradeSection');
        const badgeIcon = document.getElementById('gradeBadgeIcon');
        const title = document.getElementById('gradeTitle');
        const desc = document.getElementById('gradeDesc');

        let grade = {};

        if (finalWealth < 0) {
            grade = { icon: '⚠️', title: '자산 위험', desc: '현재 구조로는 10년 후 빚만 남게 됩니다. 지출을 줄여야 합니다.', bgClasses: ['from-red-500', 'via-red-600', 'to-red-700'], ani: 'animate-pulse' };
        } else if (finalWealth < 10000) {
            grade = { icon: '🥉', title: '브론즈', desc: '아직은 준비 단계! 지출을 조금만 줄여도 결과가 바뀝니다.', bgClasses: ['from-orange-400', 'via-orange-500', 'to-amber-500'], ani: 'animate-pulse' };
        } else if (finalWealth < 30000) {
            grade = { icon: '🥈', title: '실버', desc: '꾸준함이 무기! 시드머니가 모이고 있습니다. 공부를 병행하세요.', bgClasses: ['from-slate-400', 'via-slate-500', 'to-zinc-500'], ani: 'animate-bounce' };
        } else if (finalWealth < 60000) {
            grade = { icon: '🥇', title: '골드', desc: '안정적인 궤도 진입! 탄탄한 노후 기반을 마련하셨습니다.', bgClasses: ['from-yellow-400', 'via-amber-500', 'to-orange-500'], ani: 'animate-pulse' };
        } else if (finalWealth < 120000) {
            grade = { icon: '💠', title: '플래티넘', desc: '상위권 자산가! 경제적 자유를 향한 고속도로에 올랐습니다.', bgClasses: ['from-cyan-500', 'via-blue-500', 'to-indigo-600'], ani: 'animate-pulse' };
        } else {
            grade = { icon: '💎', title: '다이아몬드', desc: 'TOP TIER 달성! 10년 후, 당신은 경제적 자유를 누리게 됩니다.', bgClasses: ['from-indigo-500', 'via-purple-500', 'to-pink-500'], ani: 'animate-bounce' };
        }

        currentGradeTitle = grade.title;
        section.className = `capture-area p-10 rounded-2xl md:rounded-3xl shadow-2xl text-center transition-all duration-700 transform hover:scale-[1.01] bg-gradient-to-br ${grade.bgClasses.join(' ')}`;
        badgeIcon.innerText = grade.icon;
        badgeIcon.className = `text-7xl md:text-8xl mb-6 drop-shadow-2xl transition-all duration-700 ${grade.ani}`;
        title.innerText = grade.title;
        desc.innerText = grade.desc;
    }

    const modal = document.getElementById('strategyModal');
    const modalContainer = document.getElementById('modalContainer');
    const showBtn = document.getElementById('showStrategyBtn');
    const closeBtns = [document.getElementById('closeModal'), document.getElementById('closeModalBtn')];

    if (showBtn) {
        showBtn.addEventListener('click', () => {
            const data = strategyData[currentGradeTitle];
            document.getElementById('modalIcon').innerText = data.icon;
            document.getElementById('modalContent').innerHTML = data.content;
            modal.classList.remove('hidden');
            setTimeout(() => modalContainer.classList.add('scale-100', 'opacity-100'), 10);
        });
        closeBtns.forEach(btn => btn.addEventListener('click', () => {
            modalContainer.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeBtns[0].click(); });
    }

    function updateChart(labels, nominalData, realData) {
        const ctx = document.getElementById('wealthChart').getContext('2d');
        if (chart) chart.destroy();

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        const tickColor = isDark ? '#94a3b8' : '#64748b';

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '명목 자산', data: nominalData, borderColor: isDark ? '#60a5fa' : '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, borderWidth: 4, pointRadius: 0, tension: 0.4 },
                    { label: '실질 가치', data: realData, borderColor: isDark ? '#94a3b8' : '#64748b', borderDash: [5, 5], fill: false, borderWidth: 2, pointRadius: 0, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { color: tickColor, font: { family: 'Pretendard', weight: '600' } } },
                    tooltip: { padding: 12, cornerRadius: 12, titleFont: { family: 'Pretendard' } }
                },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => (v >= 10000 ? (v/10000).toFixed(1) + '억' : v + '만') } },
                    x: { grid: { display: false }, ticks: { color: tickColor } }
                }
            }
        });
    }

    function generateInsight(final, real, net) {
        let text = "";
        if (net < 0) text = "🚨 비상! 현재 지출이 수입보다 많아 빚이 늘어날 위험이 큽니다. 고정 지출 절감이 시급합니다.";
        else if (net < 50) text = `⚠️ 저축 여력이 다소 부족합니다. 부수입을 창출하거나 지출을 통제하여 시드머니를 더 빠르게 확보하세요.`;
        else if (final > 100000) text = `✨ 훌륭한 흐름입니다! 10년 후 자산 ${ (final/10000).toFixed(1) }억 원 클럽 가입이 유력합니다. 변동성을 이기는 투자를 지속하세요.`;
        else text = `💡 자산이 꾸준히 우상향하고 있습니다. 수익률을 1%만 더 높여도 10년 후 결과는 수천만 원이 달라집니다.`;
        document.getElementById('aiInsight').innerText = text;
    }

    const inputIds = ['annualSalary', 'salaryGrowth', 'initialSeed', 'monthlyExpense', 'investmentReturn', 'inflationRate'];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateSimulation);
    });

    if (document.getElementById('annualSalary')) updateSimulation();
    window.addEventListener('themeChanged', () => { if (document.getElementById('annualSalary')) updateSimulation(); });

    window.shareToX = () => {
        const t = document.getElementById('gradeTitle').innerText;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`나의 10년 후 자산 등급은 [${t}]! Hedge Dochi에서 확인해보세요! 💎`)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
    };
    window.copyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => alert("링크가 복사되었습니다!"));
    };
});