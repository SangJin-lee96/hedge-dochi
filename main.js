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

        document.getElementById('finalWealthText').innerText = finalNominal.toLocaleString() + " 만원";
        document.getElementById('realValueText').innerText = finalReal.toLocaleString() + " 만원";
        document.getElementById('netSavingsText').innerText = Math.round(currentAvgNet).toLocaleString() + " 만원";

        updateChart(labels, nominalData, realData);
        generateInsight(finalNominal, finalReal, currentAvgNet);
        
        // ⭐ 4. 등급 결정 함수 호출 ⭐
        determineGrade(finalNominal);
    }

    // ⭐ 등급 결정 함수 ⭐
    function determineGrade(finalWealth) {
        const section = document.getElementById('gradeSection');
        const badgeIcon = document.getElementById('gradeBadgeIcon');
        const title = document.getElementById('gradeTitle');
        const desc = document.getElementById('gradeDesc');

        let grade = {};

        // 등급 기준 (단위: 만원) - 현실적인 직장인 기준 설정
        if (finalWealth < 10000) { // 1억 미만
            grade = {
                icon: '🥉', title: '브론즈 (Bronze)',
                desc: '아직은 준비 단계! 지출을 조금만 줄여도 결과가 크게 바뀝니다.',
                bgClasses: ['from-orange-100', 'via-orange-200', 'to-amber-200', 'dark:from-orange-900', 'dark:via-orange-800', 'dark:to-amber-800'],
                textColorClass: 'text-amber-900 dark:text-amber-100',
                animationClass: 'animate-pulse'
            };
        } else if (finalWealth < 30000) { // 3억 미만
            grade = {
                icon: '🥈', title: '실버 (Silver)',
                desc: '꾸준함이 무기! 시드머니가 모이고 있습니다. 투자 공부를 병행해보세요.',
                bgClasses: ['from-slate-200', 'via-slate-300', 'to-zinc-300', 'dark:from-slate-700', 'dark:via-slate-600', 'dark:to-zinc-600'],
                textColorClass: 'text-slate-900 dark:text-slate-100',
                animationClass: 'animate-bounce'
            };
        } else if (finalWealth < 60000) { // 6억 미만
            grade = {
                icon: '🥇', title: '골드 (Gold)',
                desc: '안정적인 궤도 진입! 노후 준비의 탄탄한 기반을 마련하셨습니다.',
                bgClasses: ['from-yellow-300', 'via-yellow-400', 'to-yellow-500', 'dark:from-yellow-600', 'dark:via-yellow-500', 'dark:to-yellow-400'],
                textColorClass: 'text-yellow-950 dark:text-black',
                animationClass: 'animate-pulse'
            };
        } else if (finalWealth < 120000) { // 12억 미만
            grade = {
                icon: '💠', title: '플래티넘 (Platinum)',
                desc: '상위권 자산가! 경제적 자유를 향한 고속도로에 올라탔습니다.',
                bgClasses: ['from-cyan-100', 'via-blue-200', 'to-indigo-200', 'dark:from-cyan-800', 'dark:via-blue-800', 'dark:to-indigo-800'],
                textColorClass: 'text-blue-950 dark:text-cyan-50',
                animationClass: 'animate-pulse'
            };
        } else { // 12억 이상
            grade = {
                icon: '💎', title: '다이아몬드 (Diamond)',
                desc: 'TOP TIER 달성! 10년 후, 당신은 경제적 자유를 누리게 됩니다.',
                bgClasses: ['from-fuchsia-100', 'via-purple-200', 'to-indigo-300', 'dark:from-fuchsia-800', 'dark:via-purple-800', 'dark:to-indigo-800'],
                textColorClass: 'text-purple-950 dark:text-fuchsia-50',
                animationClass: 'animate-bounce'
            };
        }

        // 애니메이션과 함께 UI 업데이트
        section.className = `capture-area p-8 rounded-[2.5rem] shadow-xl text-center transition-all duration-700 transform hover:scale-[1.01] bg-gradient-to-r ${grade.bgClasses.join(' ')}`;
        section.style.borderColor = `var(--color-grade-section-border)`;

        badgeIcon.innerText = grade.icon;
        badgeIcon.className = `text-6xl md:text-7xl mb-4 drop-shadow-md filter grayscale-0 transition-all duration-700 ${grade.animationClass}`;
        
        title.innerText = grade.title;
        title.className = `text-4xl md:text-5xl font-extrabold mb-2 transition-all duration-700 ${grade.textColorClass}`;
        title.style.color = ''; 

        desc.innerText = grade.desc;
        desc.className = `text-lg font-medium opacity-90 max-w-lg mx-auto transition-all duration-700 ${grade.textColorClass}`;
        desc.style.color = ''; 
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
        const text = "나의 10년 후 자산 등급은? 현실 자산 시뮬레이터에서 확인해보세요! 💎";
        const url = window.location.href;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    window.shareToFacebook = function() {
        const url = window.location.href;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
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