const assert = require("assert");
const V41 = require("./v41_analysis.js");

const rows = Array.from({length:200}, (_, index) => {
    const close = 100 + index * 0.2 + Math.sin(index / 8);
    return {open:close-0.2,high:close+1,low:close-1,close,volume:1000+index,closeTime:1700000000000+index*3600000};
});
const result = V41.calculate({"4h":rows});
const frame = result.frames["4h"];
assert.strictEqual(result.version,"4.1.0");
assert.ok(Number.isFinite(frame.sma60));
assert.ok(Number.isFinite(frame.sma120));
assert.ok(Number.isFinite(frame.rsi14));
assert.ok(Number.isFinite(frame.cci20));
assert.ok(Number.isFinite(frame.macd.histogram));
assert.ok(Number.isFinite(frame.stochastic.k));
assert.ok(Number.isFinite(frame.anchoredVwap));
assert.ok(frame.profile.poc > 0 && frame.profile.val <= frame.profile.vah);
assert.strictEqual(V41.rr(100,90,115),1.5);
console.log("V4.1 시뮬레이터 분석 모듈 테스트 통과");
