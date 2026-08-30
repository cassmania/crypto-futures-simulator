/** 실행: node test_strategy_backtest.js */
const assert = require("assert");
const fs = require("fs");
const Strategy = require("./strategy_backtest.js");

// Wilder RSI 기준값과 완전 횡보 구간의 중립값을 함께 확인합니다.
const classic = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
const classicRsi = Strategy.rsi(classic, 14);
assert.ok(Math.abs(classicRsi[14] - 70.4641) < 0.001, `RSI 기준값 불일치: ${classicRsi[14]}`);
assert.strictEqual(Strategy.rsi(Array(20).fill(100), 14)[19], 50, "횡보 RSI는 50이어야 함");

// 현재 EMA20을 하향 교차했지만 이전 EMA20보다는 위에 있는 데드크로스 회귀 사례입니다.
const deathCross = Strategy.evaluateConfluence({
    price: 110, fib: { f38: 100, f50: 95 }, poc: 100, bbUpper: 120, bbLower: 80,
    ma20: 90, ma60: 100, ema20: 102, rsi: 50, cci: 0, stochK: 50, stochD: 50,
    macd: 0, macdSignal: 1, previousMacd: 0, previousMacdSignal: 1,
    ema5: 101, previousEma5: 105, previousEma20: 100
});
assert.strictEqual(deathCross.flags.maShort, true, "현재 EMA20 기준 데드크로스를 잡아야 함");
assert.strictEqual(deathCross.direction, "SHORT", "데드크로스 숏 신호가 생성돼야 함");

// 같은 봉에서 목표와 손절이 모두 닿으면 과대평가를 막기 위해 손절이 우선입니다.
const exit = Strategy.resolveExit([{ high: 110, low: 90 }], 0, "LONG", 105, 95);
assert.deepStrictEqual(exit, { exitIndex: 0, exitPrice: 95, reason: "STOP" });

// 진입·청산 양쪽 수수료와 슬리피지가 모두 R 손익에서 차감되는지 확인합니다.
const netR = Strategy.calculateNetR(100, 105, 95, "LONG");
assert.ok(Math.abs(netR - 0.9754) < 1e-9, `비용 포함 R 불일치: ${netR}`);

const appSource = fs.readFileSync("app.js", "utf8");
assert.ok(appSource.includes("상태.지갑잔고 -= 필요잔고"), "진입 수수료 포함 잔고 차감이 필요함");
assert.ok(appSource.includes("실현손익: 순손익"), "거래 이력은 비용 차감 순손익이어야 함");

const html = fs.readFileSync("index.html", "utf8");
assert.ok(html.includes("strategy_backtest.js?v=1.0.0"), "공용 전략 모듈 연결 필요");
assert.ok(html.includes("indicator-backtest-button"), "백테스트 실행 UI 필요");

console.log("다중 지표 백테스트·비용 정산 검증 통과 (6개 항목)");

