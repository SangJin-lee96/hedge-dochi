export async function onRequest(context) {
    const { searchParams } = new URL(context.request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
        return new Response(JSON.stringify({ error: "Query parameter 'ticker' is missing" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    // 안정적인 Chart API v8 사용
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

    try {
        const response = await fetch(yahooUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance responded with ${response.status}`);
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=60" // 실시간 시세이므로 짧은 캐시 (60초)
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}