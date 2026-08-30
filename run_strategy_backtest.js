/** 실행: node run_strategy_backtest.js */
const fs = require("fs");
const Strategy = require("./strategy_backtest.js");

const API = "https://fapi.binance.com";
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const timeframes = ["1h", "4h"];

async function serverTime() {
    const response = await fetch(`${API}/fapi/v1/time`);
    if (!response.ok) throw new Error(`서버 시각 HTTP ${response.status}`);
    return Number((await response.json()).serverTime);
}

async function candles(symbol, interval, now) {
    const rows = [];
    let endTime = now;
    for (let page = 0; page < 4 && rows.length < 5000; page++) {
        const response = await fetch(`${API}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1500&endTime=${endTime}`);
        if (!response.ok) throw new Error(`${symbol} ${interval} HTTP ${response.status}`);
        const batch = await response.json();
        if (!batch.length) break;
        rows.push(...batch);
        endTime = Number(batch[0][0]) - 1;
    }
    const unique = new Map(rows.filter(row => Number(row[6]) < now).map(row => [Number(row[0]), {
        time: Number(row[0]), closeTime: Number(row[6]),
        open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5])
    }]));
    return [...unique.values()].sort((a, b) => a.time - b.time).slice(-5000);
}

async function main() {
    const now = await serverTime();
    const results = [];
    for (const interval of timeframes) {
        for (const symbol of symbols) {
            const data = await candles(symbol, interval, now);
            const result = Strategy.runBacktest(data);
            results.push({
                symbol, interval, candles: data.length,
                dataStartTime: data[0]?.time || null,
                holdoutStartTime: data[result.splitIndex]?.time || null,
                endTime: data.at(-1)?.closeTime || null,
                verdict: Strategy.verdict(result.holdout),
                all: result.all,
                holdout: result.holdout
            });
        }
    }
    const output = {
        generatedAt: new Date().toISOString(),
        source: "Binance USDT-M Futures",
        rules: {
            closedCandlesOnly: true, maximumCandles: 5000, holdoutRatio: 0.4,
            entry: "next-bar-open", exit: "current simulator automatic TP/SL approximation",
            feeEachSide: 0.0004, slippageEachSide: 0.0002, sameBarPriority: "STOP",
            fundingAdjustment: "not included because historical funding snapshots are not fetched"
        },
        results
    };
    fs.writeFileSync("strategy-backtest-results.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
