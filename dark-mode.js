// 다크 모드 토글 로직
const darkModeToggle = document.getElementById('darkModeToggle');
const html = document.documentElement;

// 초기 로드 시 로컬 스토리지 확인
if (localStorage.getItem('darkMode') === 'enabled') {
    html.classList.add('dark');
}

darkModeToggle.addEventListener('click', () => {
    html.classList.toggle('dark');
    
    // 로컬 스토리지에 다크 모드 설정 저장
    if (html.classList.contains('dark')) {
        localStorage.setItem('darkMode', 'enabled');
    } else {
        localStorage.setItem('darkMode', 'disabled');
    }
});