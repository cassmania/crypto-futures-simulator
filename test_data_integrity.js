const assert = require("assert");
const { closedCandles, upsertCandle } = require("./data_integrity.js");

const now = 10_000;
const candles = [
    { time: 1, closeTime: 5_000, close: 100 },
    { time: 2, closeTime: 15_000, close: 101 },
    { time: 3, closeTime: 6_000, close: 102, synthetic: true },
    { time: 4, closeTime: 7_000, close: 103, isClosed: true },
    { time: 5, closeTime: 7_000, close: 104, isClosed: false }
];

assert.deepStrictEqual(
    closedCandles(candles, now).map(c => c.time),
    [1, 4],
    "확정된 실제 봉만 분석 대상으로 남아야 합니다."
);

const oneMinuteBuffer = [];
upsertCandle(oneMinuteBuffer, { time: 60, close: 100, interval: "1m" });
upsertCandle(oneMinuteBuffer, { time: 60, close: 101, interval: "1m" });
upsertCandle(oneMinuteBuffer, { time: 120, close: 102, interval: "1m" });

assert.strictEqual(oneMinuteBuffer.length, 2, "동일 시각 봉은 중복 추가되면 안 됩니다.");
assert.strictEqual(oneMinuteBuffer[0].close, 101, "동일 시각의 최신 틱으로 봉을 교체해야 합니다.");
assert.ok(oneMinuteBuffer.every(c => c.interval === "1m"), "신호 버퍼에는 1분봉만 있어야 합니다.");

console.log("data_integrity 검증 통과 (확정 봉·합성 데이터 제외·1분봉 버퍼 분리)");
