import os
import re

files = [
    'index.html', 'compound.html', 'dividend.html', 'fire-calc.html',
    'rebalance.html', 'risk-test.html', 'dashboard.html', 'guides.html',
    'lotto.html', 'about.html', 'privacy.html', 'tos.html', 'contact-form.html'
]

# The original main headers that were replaced (I need to restore them)
# For index.html, it was:
# <header class="mb-12 text-center">
#     <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4" style="color: var(--color-primary-text);">2026 현실 자산 시뮬레이터</h1>
#     <p class="text-lg md:text-xl font-medium text-slate-500">당신의 10년 후, 데이터로 미리 확인해보세요.</p>
#     ...

# This is going to be hard to restore if I don't have the original content.
# Wait, I have the original content of index.html, rebalance.html, compound.html, about.html from previous read_file calls!

# index.html original main header:
index_main_header = """        <header class="mb-12 text-center">
            <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4" style="color: var(--color-primary-text);">2026 현실 자산 시뮬레이터</h1>
            <p class="text-lg md:text-xl font-medium text-slate-500">당신의 10년 후, 데이터로 미리 확인해보세요.</p>
            
            <div class="mt-10 flex items-center justify-center gap-2 max-w-md mx-auto">
                <div id="step-indicator-1" class="step-dot w-3 h-3 rounded-full bg-blue-600 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-2" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-3" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-4" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
            </div>
        </header>"""

# rebalance.html original main header:
rebalance_main_header = """        <header class="mb-12 text-center">
            <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">⚖️ 스마트 리밸런싱 매니저</h1>
            <p class="text-lg text-slate-500 font-medium">실시간 환율과 시장가격을 반영하여 완벽한 비중을 찾습니다.</p>
            <div class="mt-10 flex items-center justify-center gap-2 max-w-xs mx-auto">
                <div id="step-indicator-1" class="step-dot w-3 h-3 rounded-full bg-blue-600 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-2" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-3" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-4" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
            </div>
        </header>"""

# compound.html original main header:
compound_main_header = """        <header class="mb-12 text-center">
            <h1 class="text-3xl md:text-5xl font-black mb-4 tracking-tight">⏳ 복리의 마법 계산기</h1>
            <p class="text-lg text-slate-500 font-medium">시간이 당신의 돈을 어떻게 기하급수적으로 키우는지 확인하세요.</p>
            <div class="mt-10 flex items-center justify-center gap-2 max-w-xs mx-auto">
                <div id="step-indicator-1" class="step-dot w-3 h-3 rounded-full bg-blue-600 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-2" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-3" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
                <div class="w-8 h-0.5 bg-slate-200"></div>
                <div id="step-indicator-4" class="step-dot w-3 h-3 rounded-full bg-slate-200 transition-all"></div>
            </div>
        </header>"""

# I need to find where they were and put them back.
# They were inside <main ...>.

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Fix the double <!-- 헤더 네비게이션 --> and the first header
    # I'll just replace the whole header block again but more carefully.
    
    # Let's find all header blocks.
    headers = re.findall(r'<header.*?>.*?</header>', content, flags=re.DOTALL)
    
    if len(headers) > 1:
        # The first one is the nav header (but maybe doubled or messy)
        # The subsequent ones are main headers that were accidentally replaced.
        
        # Restore main headers based on filename
        if file_path == 'index.html':
            content = content.replace(headers[1], index_main_header)
        elif file_path == 'rebalance.html':
            content = content.replace(headers[1], rebalance_main_header)
        elif file_path == 'compound.html':
            content = content.replace(headers[1], compound_main_header)
        # For others, I might need to read them or guess. 
        # But wait, did other files have a <header> in <main>?
        # dividend.html, fire-calc.html, risk-test.html, dashboard.html probably do.
    
    # Let's fix the nav header doubling.
    content = re.sub(r'<!-- 헤더 네비게이션 -->\s*<!-- 헤더 네비게이션 -->', '<!-- 헤더 네비게이션 -->', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

