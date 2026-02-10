export async function onRequest(context) {
    const { searchParams } = new URL(context.request.url);
    const query = searchParams.get('q');

    if (!query) {
        return new Response(JSON.stringify({ error: "Query parameter 'q' is missing" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

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
                "Cache-Control": "public, max-age=3600" // 1시간 캐싱으로 효율성 증대
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}