/* Binance REST 차단(418)·제한(429) 응답을 받으면 해제 시각까지 fapi 요청을 보내지 않는다.
   차단 중에 계속 요청하면 바이낸스가 차단 시간을 늘리기 때문이다. */
(function () {
    if (typeof window === "undefined" || !window.fetch) return;
    const 원본fetch = window.fetch.bind(window);
    const 대상 = /^https:\/\/fapi\.binance\.com\//;
    let 해제시각 = 0;
    try { 해제시각 = Number(localStorage.getItem("binanceBanUntil")) || 0; } catch {}

    window.바이낸스차단해제시각 = () => 해제시각;

    window.fetch = async function (입력, 옵션) {
        const url = typeof 입력 === "string" ? 입력 : (입력 && 입력.url) || String(입력);
        if (!대상.test(url)) return 원본fetch(입력, 옵션);
        if (Date.now() < 해제시각) {
            // ponytail: 차단 중엔 현물 미러로 대체 — 선물과 가격이 미세하게 다르다. 현물 미상장 코인은 실패한다.
            const 미러 = /\/fapi\/v1\/(klines|ticker\/24hr|ticker\/price|depth)(\?|$)/.exec(url);
            if (미러) return 원본fetch(url.replace(/^https:\/\/fapi\.binance\.com\/fapi\/v1\//, "https://data-api.binance.vision/api/v3/"), 옵션);
            return new Response(JSON.stringify({ code: -1003, msg: "로컬 대기: 바이낸스 요청 제한" }),
                { status: 429, headers: { "Content-Type": "application/json" } });
        }
        const 응답 = await 원본fetch(입력, 옵션);
        if (응답.status === 418 || 응답.status === 429) {
            let 대기 = 응답.status === 418 ? 5 * 60_000 : 60_000;
            try {
                const 본문 = await 응답.clone().json();
                const m = /banned until (\d+)/.exec(본문.msg || "");
                if (m) 대기 = Math.max(0, Number(m[1]) - Date.now()) + 1000;
            } catch {}
            해제시각 = Math.max(해제시각, Date.now() + 대기);
            try { localStorage.setItem("binanceBanUntil", String(해제시각)); } catch {}
            console.warn("[Binance] 요청 제한 — " + Math.ceil(대기 / 1000) + "초 동안 REST 요청 중단");
        }
        return 응답;
    };
})();
