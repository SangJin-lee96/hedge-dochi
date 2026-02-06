document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateLotto');
    const resultsDiv = document.getElementById('lottoResults');
    const numGamesInput = document.getElementById('numGames');
    const includeBonusCheckbox = document.getElementById('includeBonus');

    // 번호별 색상을 위한 Tailwind CSS 클래스
    const colors = [
        'bg-yellow-100 text-yellow-800', // 1-10
        'bg-blue-100 text-blue-800',    // 11-20
        'bg-red-100 text-red-800',      // 21-30
        'bg-gray-100 text-gray-800',    // 31-40
        'bg-green-100 text-green-800',  // 41-45
    ];

    const getBallColor = (num) => {
        if (num <= 10) return colors[0];
        if (num <= 20) return colors[1];
        if (num <= 30) return colors[2];
        if (num <= 40) return colors[3];
        return colors[4];
    };

    /**
     * "심리적" 가중치가 적용된 로또 번호 생성 함수
     * @param {number} count - 생성할 번호의 개수 (6 또는 7)
     * @returns {number[]} - 정렬된 로또 번호 배열
     */
    const generatePsychologicalNumbers = (count) => {
        // 사람들이 잘 선택하지 않는 번호(32-45)에 가중치를 부여
        const weightedPool = [];
        for (let i = 1; i <= 45; i++) {
            weightedPool.push(i);
            if (i >= 32) {
                // 32 이상 숫자를 한번 더 추가하여 가중치를 줌 (간단한 방식)
                weightedPool.push(i);
            }
        }
        
        // Fisher-Yates shuffle
        for (let i = weightedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [weightedPool[i], weightedPool[j]] = [weightedPool[j], weightedPool[i]];
        }

        const numbers = new Set();
        let i = 0;
        while (numbers.size < count && i < weightedPool.length) {
            numbers.add(weightedPool[i]);
            i++;
        }
        
        return Array.from(numbers).sort((a, b) => a - b);
    };


    const generatePensionButton = document.getElementById('generatePension');
    const numPensionGamesInput = document.getElementById('numPensionGames');

    /**
     * 연금복권 번호 생성 함수 (조 + 6자리)
     * @returns {object} - { group: number, numbers: number[] }
     */
    const generatePensionNumbers = () => {
        const group = Math.floor(Math.random() * 5) + 1;
        const numbers = [];
        
        // 6자리 숫자 생성
        for (let i = 0; i < 6; i++) {
            numbers.push(Math.floor(Math.random() * 10));
        }

        // 심리적 필터: 모두 같은 숫자이거나 단순 계단식인 경우 재생성 (최대 10번 시도)
        const isRepeating = numbers.every(n => n === numbers[0]);
        const isSequence = numbers.every((n, i) => i === 0 || n === numbers[i-1] + 1 || n === numbers[i-1] - 1);
        
        if (isRepeating || isSequence) {
            return generatePensionNumbers();
        }

        return { group, numbers };
    };

    generateButton.addEventListener('click', () => {
        const numGames = parseInt(numGamesInput.value, 10);
        const includeBonus = includeBonusCheckbox.checked;
        const numbersToDraw = includeBonus ? 7 : 6;

        resultsDiv.innerHTML = ''; // 이전 결과 지우기
        
        // 결과 제목 추가
        const title = document.createElement('h4');
        title.className = 'text-lg font-bold text-blue-600 dark:text-blue-400 mb-4';
        title.textContent = '📍 로또 6/45 추천 번호';
        resultsDiv.appendChild(title);

        for (let i = 0; i < numGames; i++) {
            const numbers = generatePsychologicalNumbers(numbersToDraw);
            const gameDiv = document.createElement('div');
            gameDiv.className = 'p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between transition-colors duration-300';

            const numbersContainer = document.createElement('div');
            numbersContainer.className = 'flex flex-wrap items-center gap-2';

            numbers.forEach((num, index) => {
                const ball = document.createElement('div');
                ball.className = `w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${getBallColor(num)}`;
                ball.textContent = num;

                // 보너스 번호 스타일링
                if (includeBonus && index === numbers.length - 1) {
                    ball.className += ' ml-2 border-2 border-dashed border-red-400';
                    const plusSign = document.createElement('span');
                    plusSign.className = 'mx-2 font-bold text-xl text-slate-400 dark:text-slate-600';
                    plusSign.textContent = '+';
                    numbersContainer.appendChild(plusSign);
                }
                
                numbersContainer.appendChild(ball);
            });

            const gameLabel = document.createElement('span');
            gameLabel.className = 'font-bold text-sm text-slate-400 dark:text-slate-500 tracking-wider';
            gameLabel.textContent = `GAME ${i + 1}`;
            
            gameDiv.appendChild(gameLabel);
            gameDiv.appendChild(numbersContainer);
            resultsDiv.appendChild(gameDiv);
        }
    });

    generatePensionButton.addEventListener('click', () => {
        const numGames = parseInt(numPensionGamesInput.value, 10);
        resultsDiv.innerHTML = ''; // 이전 결과 지우기

        // 결과 제목 추가
        const title = document.createElement('h4');
        title.className = 'text-lg font-bold text-purple-600 dark:text-purple-400 mb-4';
        title.textContent = '📍 연금복권 720+ 추천 번호';
        resultsDiv.appendChild(title);

        for (let i = 0; i < numGames; i++) {
            const { group, numbers } = generatePensionNumbers();
            const gameDiv = document.createElement('div');
            gameDiv.className = 'p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between transition-colors duration-300';

            const numbersContainer = document.createElement('div');
            numbersContainer.className = 'flex flex-wrap items-center gap-2';

            // 조 번호 표시
            const groupBall = document.createElement('div');
            groupBall.className = 'px-4 h-10 flex items-center justify-center rounded-full font-bold text-lg bg-purple-600 text-white mr-2';
            groupBall.textContent = `${group}조`;
            numbersContainer.appendChild(groupBall);

            // 6자리 숫자 표시
            numbers.forEach(num => {
                const ball = document.createElement('div');
                ball.className = 'w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600';
                ball.textContent = num;
                numbersContainer.appendChild(ball);
            });

            const gameLabel = document.createElement('span');
            gameLabel.className = 'font-bold text-sm text-slate-400 dark:text-slate-500 tracking-wider';
            gameLabel.textContent = `GAME ${i + 1}`;
            
            gameDiv.appendChild(gameLabel);
            gameDiv.appendChild(numbersContainer);
            resultsDiv.appendChild(gameDiv);
        }
    });
});

