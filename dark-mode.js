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
    // 다크 모드 토글
    const darkModeToggles = document.querySelectorAll('#darkModeToggle, #darkModeToggleMobile');
    const html = document.documentElement;

    darkModeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const isDark = html.classList.toggle('dark');
            
            // 로컬 스토리지에 다크 모드 설정 저장
            if (isDark) {
                localStorage.setItem('darkMode', 'enabled');
            } else {
                localStorage.setItem('darkMode', 'disabled');
            }

            // 테마 변경 이벤트 발생 (다른 스크립트에서 감지 가능하도록)
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isDark } }));
        });
    });

    // 모바일 메뉴 토글
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // 현재 페이지 강조 표시
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            if (link.closest('nav').classList.contains('flex-col')) {
                // 모바일 메뉴
                link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
            } else {
                // 데스크탑 메뉴 (드롭다운 포함)
                if (link.classList.contains('block')) {
                    // 드롭다운 아이템
                    link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
                } else {
                    // 메인 네비게이션 (만약 드롭다운이 아니라면)
                    link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
                }
            }
        }
    });
});