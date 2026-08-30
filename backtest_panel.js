/** 현재 종목의 다중 지표 신호를 읽기 전용으로 검증하는 화면 연결 모듈입니다. */
(function () {
    const API = "https://fapi.binance.com";

    async function fetchServerTime() {
        const response = await fetch(`${API}/fapi/v1/time`, { cache: "no-store" });
        if (!response.ok) throw new Error("Binance 서버 시각을 불러오지 못했습니다.");
        return Number((await response.json()).serverTime);
    }

    async function fetchClosedCandles(symbol, interval, serverTime) {
        const rows = [];
        let endTime = serverTime;
        // 요청당 1,500봉 제한 때문에 과거 방향으로 네 번 페이지네이션합니다.
        for (let page = 0; page < 4 && rows.length < 5000; page++) {
            const response = await fetch(`${API}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1500&endTime=${endTime}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`${symbol} ${interval} 캔들을 불러오지 못했습니다.`);
            const batch = await response.json();
            if (!Array.isArray(batch) || !batch.length) break;
            rows.push(...batch);
            endTime = Number(batch[0][0]) - 1;
            if (batch.length < 1500) break;
        }
        const unique = new Map(rows
            .filter(row => Number(row[6]) < serverTime)
            .map(row => [Number(row[0]), {
                time: Number(row[0]), closeTime: Number(row[6]),
                open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5])
            }]));
        return [...unique.values()].sort((a, b) => a.time - b.time).slice(-5000);
    }

    function number(value, digits = 2) {
        return Number.isFinite(value) ? value.toFixed(digits) : "∞";
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleString("ko-KR", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        });
    }

    function render(symbol, interval, candles, result) {
        const summary = result.holdout;
        const metrics = [
            ["홀드아웃 거래", `${summary.trades}회`],
            ["승률", `${number(summary.winRate, 1)}%`],
            ["Profit Factor", number(summary.profitFactor)],
            ["평균 순손익", `${summary.expectancyR >= 0 ? "+" : ""}${number(summary.expectancyR, 3)}R`],
            ["누적 순손익", `${summary.totalR >= 0 ? "+" : ""}${number(summary.totalR)}R`],
            ["최대낙폭", `${number(summary.maxDrawdownR)}R`]
        ];
        document.getElementById("indicator-backtest-result").innerHTML = `
            <div class="indicator-backtest-metrics">${metrics.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}</div>
            <p class="indicator-backtest-verdict"><b>${StrategyBacktest.verdict(summary)}</b> · ${symbol} ${interval}</p>
            <p class="indicator-backtest-note">${formatTime(candles[result.splitIndex].time)} ~ ${formatTime(candles.at(-1).closeTime)} · 전체 ${candles.length}봉 중 마지막 ${candles.length - result.splitIndex}봉 검증 · 전체 종료 거래 ${result.all.trades}회</p>`;
    }

    window.지표백테스트실행 = async function () {
        const button = document.getElementById("indicator-backtest-button");
        const resultElement = document.getElementById("indicator-backtest-result");
        const interval = document.getElementById("indicator-backtest-timeframe").value;
        const symbol = typeof 상태 !== "undefined" && 상태.기본코인 ? 상태.기본코인 : "BTCUSDT";
        button.disabled = true;
        button.textContent = "계산 중";
        resultElement.innerHTML = `<p class="indicator-backtest-note">${symbol} ${interval} 확정봉을 불러와 비용 포함 홀드아웃을 계산하고 있습니다.</p>`;
        try {
            const serverTime = await fetchServerTime();
            const candles = await fetchClosedCandles(symbol, interval, serverTime);
            if (candles.length < 500) throw new Error(`확정봉이 ${candles.length}개뿐이라 백테스트 표본이 부족합니다.`);
            const result = StrategyBacktest.runBacktest(candles);
            render(symbol, interval, candles, result);
        } catch (error) {
            resultElement.innerHTML = `<p class="indicator-backtest-note">${error.message}</p>`;
        } finally {
            button.disabled = false;
            button.textContent = "백테스트 실행";
        }
    };
})();
