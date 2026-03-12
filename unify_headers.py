import os
import re

files = [
    'index.html', 'compound.html', 'dividend.html', 'fire-calc.html',
    'rebalance.html', 'risk-test.html', 'dashboard.html', 'guides.html',
    'lotto.html', 'about.html', 'privacy.html', 'tos.html', 'contact-form.html'
]

new_header = """    <!-- 헤더 네비게이션 -->
    <header class="sticky top-0 z-[100] w-full backdrop-blur-md border-b transition-colors duration-300" style="background-color: rgba(var(--nav-bg-rgb), 0.7); border-color: var(--color-nav-border);">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <!-- 로고 -->
            <div class="flex items-center gap-2 cursor-pointer" onclick="location.href='index.html'">
                <span class="text-xl">💎</span>
                <span class="font-bold text-lg tracking-tight whitespace-nowrap">Hedge Dochi</span>
            </div>

            <!-- PC 네비게이션 -->
            <nav class="hidden md:flex items-center gap-1">
                <!-- 분석/설계 -->
                <div class="relative group">
                    <button class="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" style="color: var(--color-nav-link);">
                        분석/설계 <svg class="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="absolute top-full left-0 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl py-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                        <a href="index.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">자산 시뮬레이터</a>
                        <a href="fire-calc.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">은퇴 설계</a>
                        <a href="risk-test.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">성향 진단</a>
                    </div>
                </div>

                <!-- 투자 관리 -->
                <div class="relative group">
                    <button class="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" style="color: var(--color-nav-link);">
                        투자 관리 <svg class="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="absolute top-full left-0 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl py-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                        <a href="dashboard.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">대시보드</a>
                        <a href="rebalance.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">리밸런싱</a>
                    </div>
                </div>

                <!-- 계산기 -->
                <div class="relative group">
                    <button class="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" style="color: var(--color-nav-link);">
                        계산기 <svg class="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="absolute top-full left-0 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl py-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                        <a href="compound.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">복리 계산기</a>
                        <a href="dividend.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">배당 계산기</a>
                    </div>
                </div>

                <!-- 서비스 -->
                <div class="relative group">
                    <button class="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" style="color: var(--color-nav-link);">
                        서비스 <svg class="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="absolute top-full left-0 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl py-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200">
                        <a href="guides.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">금융 가이드</a>
                        <a href="lotto.html" class="block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">로또 추천</a>
                    </div>
                </div>

                <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <button id="darkModeToggle" class="p-2 rounded-lg transition-colors" style="color: var(--color-toggle-text);">🌙</button>
                <div id="authContainer" class="ml-2">
                    <button id="loginBtn" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors">구글 로그인</button>
                    <div id="userProfile" class="hidden flex items-center gap-2">
                        <img id="userPhoto" src="" alt="Profile" class="w-8 h-8 rounded-full border border-slate-200">
                        <button id="logoutBtn" class="text-xs text-slate-500 font-semibold transition-colors hover:text-blue-600">로그아웃</button>
                    </div>
                </div>
            </nav>

            <!-- 모바일 헤더 우측 -->
            <div class="flex items-center gap-2 md:hidden">
                <button id="darkModeToggleMobile" class="p-2 rounded-lg transition-colors" style="color: var(--color-toggle-text);">🌙</button>
                <button id="mobileMenuBtn" class="p-2 rounded-lg" style="color: var(--color-primary-text);">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                </button>
            </div>
        </div>

        <!-- 모바일 메뉴 -->
        <div id="mobileMenu" class="hidden md:hidden absolute top-16 left-0 w-full border-b shadow-lg z-[110]" style="background-color: var(--color-nav-bg); border-color: var(--color-nav-border);">
            <nav class="flex flex-col p-4 space-y-4 overflow-y-auto max-h-[70vh] no-scrollbar">
                <!-- 분석/설계 -->
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-4">분석/설계</p>
                    <div class="flex flex-col space-y-1">
                        <a href="index.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">자산 시뮬레이터</a>
                        <a href="fire-calc.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">은퇴 설계</a>
                        <a href="risk-test.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">성향 진단</a>
                    </div>
                </div>
                <!-- 투자 관리 -->
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-4">투자 관리</p>
                    <div class="flex flex-col space-y-1">
                        <a href="dashboard.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">대시보드</a>
                        <a href="rebalance.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">리밸런싱</a>
                    </div>
                </div>
                <!-- 계산기 -->
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-4">계산기</p>
                    <div class="flex flex-col space-y-1">
                        <a href="compound.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">복리 계산기</a>
                        <a href="dividend.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">배당 계산기</a>
                    </div>
                </div>
                <!-- 서비스 -->
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-4">서비스</p>
                    <div class="flex flex-col space-y-1">
                        <a href="guides.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">금융 가이드</a>
                        <a href="lotto.html" class="text-base font-semibold p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style="color: var(--color-nav-link);">로또 추천</a>
                    </div>
                </div>
                <div id="authContainerMobile" class="p-4 border-t border-slate-100 dark:border-slate-700 text-center"></div>
            </nav>
        </div>
    </header>"""

for file_path in files:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Replace header
    content = re.sub(r'<header.*?>.*?</header>', new_header, content, flags=re.DOTALL)
    
    # 2. Remove mobile menu script
    content = re.sub(r'<script>\s*document\.addEventListener\(\'DOMContentLoaded\', \(\) => \{\s*const btn = document\.getElementById\(\'mobileMenuBtn\'\);\s*const menu = document\.getElementById\(\'mobileMenu\'\);\s*if \(btn && menu\) btn\.addEventListener\(\'click\', \(\) => \{ menu\.classList\.toggle\(\'hidden\'\); \}\);\s*\}\);\s*</script>', '', content)
    
    # Also handle the slightly different one in index.html
    content = re.sub(r'<script>\s*document\.addEventListener\(\'DOMContentLoaded\', \(\) => \{\s*const btn = document\.getElementById\(\'mobileMenuBtn\'\);\s*const menu = document\.getElementById\(\'mobileMenu\'\);\s*if \(btn && menu\) btn\.addEventListener\(\'click\', \(\) => \{ menu\.classList\.toggle\(\'hidden\'\); \}\);\s*\}\);\s*</script>', '', content)
    
    # 3. Ensure dark-mode.js is included (it should be, but let's make sure it's before other modules)
    if 'dark-mode.js' not in content:
        content = content.replace('</body>', '<script src="dark-mode.js"></script>\n</body>')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")
