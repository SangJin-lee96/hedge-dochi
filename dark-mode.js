// 다크 모드 토글 로직
(function() {
    const html = document.documentElement;
    // 초기 로드 시 로컬 스토리지 확인 (가장 빠르게 실행하기 위해 즉시실행함수 사용)
    if (localStorage.getItem('darkMode') === 'enabled') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const html = document.documentElement;

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const isDark = html.classList.toggle('dark');
            
            // 로컬 스토리지에 다크 모드 설정 저장
            if (isDark) {
                localStorage.setItem('darkMode', 'enabled');
            } else {
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }
});