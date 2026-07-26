/**
 * wave_analyzer.js 자체 검증. 실행: node test_wave_analyzer.js
 */
const assert = require('assert');
const ElliottWaveEngine = require('./wave_analyzer.js');

const engine = new ElliottWaveEngine();

/** 지정한 꼭짓점들을 선형 보간해 캔들 시퀀스 생성 */
function buildCandles(nodes, perLeg = 12) {
    const candles = [];
    let t = 1700000000;
    for (let i = 0; i < nodes.length - 1; i++) {
        const from = nodes[i];
        const to = nodes[i + 1];
        for (let s = 0; s < perLeg; s++) {
            const a = from + (to - from) * (s / perLeg);
            const b = from + (to - from) * ((s + 1) / perLeg);
            candles.push({
                time: t,
                open: a,
                close: b,
                high: Math.max(a, b) * 1.001,
                low: Math.min(a, b) * 0.999
            });
            t += 3600;
        }
    }
    return candles;
}

// --- 1. 데이터 부족 방어 ---
assert.ok(engine.analyze([]).error, '빈 배열은 error 반환');
assert.ok(engine.analyze(buildCandles([100, 110], 5)).error, '30캔들 미만은 error 반환');

// --- 2. 피봇 교대 강제: 같은 타입 연속 시 극단값 유지 ---
const zig = buildCandles([100, 130, 112, 165, 140, 190, 170]);
const pivots = engine.extractPivots(zig);
for (let i = 1; i < pivots.length; i++) {
    assert.notStrictEqual(pivots[i].type, pivots[i - 1].type, '피봇 타입은 반드시 교대');
}
assert.ok(pivots.length >= 5, `피봇 5개 이상 추출 (실제 ${pivots.length})`);

// 파동 0번 노드도 '완성된 전환점'이어야 피봇으로 잡히므로 선행 하락 leg를 붙인다.
// (엔진은 완료된 전환만 피봇으로 인식 -> 진행 중 마지막 leg는 피봇 없음)
const lead = 120;

// --- 3. 상승 5파 구조: 절대 법칙 전부 통과 ---
// 0=100 1=130 2=112 3=175(최장) 4=150 -> 현재가 5파 전진
const bullNodes = [lead, 100, 130, 112, 175, 150, 185];
const bull = engine.analyze(buildCandles(bullNodes), { rsi: [], vpvrPOC: 0, ma: {} });
assert.ok(!bull.error, '정상 데이터는 error 없음');
assert.strictEqual(bull.isBullish, true, '상승 구조 판정');
assert.strictEqual(bull.rules.rule1, true, '2파 저점 > 1파 시작점');
assert.strictEqual(bull.rules.rule2, true, '3파가 최단 아님');
assert.strictEqual(bull.rules.rule3, true, '4파가 1파 고점 미침범');

// --- 4. 법칙 위반 감지: 4파가 1파 고점을 침범 ---
// 4파 저점 125 < 1파 고점 130 -> rule3 위반
const bad = engine.analyze(buildCandles([lead, 100, 130, 112, 175, 125, 140]));
assert.strictEqual(bad.rules.rule3, false, '4파 중첩은 rule3 위반으로 잡혀야 함');
assert.strictEqual(bad.allPassed, false, '위반 시 allPassed=false');

// --- 5. 하락(베어) 구조도 대칭 처리 (기존 구현의 미구현 분기) ---
const bear = engine.analyze(buildCandles([180, 200, 170, 188, 125, 150, 115]));
assert.strictEqual(bear.isBullish, false, '하락 구조 판정');
assert.notStrictEqual(bear.stage, '파동 분석 중', '하락 구조도 국면이 확정돼야 함');
assert.ok(bear.signal.action !== 'NEUTRAL' || /4파/.test(bear.stage), '하락 구조도 신호 산출');
assert.ok(bear.invalidation > 0, '하락 구조도 무효화 가격 산출');

// --- 6. 3파 국면의 방향성 정합: 타겟은 전진, 손절은 후퇴 ---
const w3 = engine.analyze(buildCandles([lead, 100, 130, 112, 150, 138, 160]));
const px = 160;
if (/3파/.test(w3.stage) && w3.signal.action === 'LONG') {
    assert.ok(w3.signal.tp1 > px, 'LONG 3파 TP는 현재가보다 높아야 함');
    assert.ok(w3.signal.sl < px, 'LONG 3파 SL은 현재가보다 낮아야 함');
}

// --- 7. 신뢰도는 항상 1~10 정수 ---
for (const r of [bull, bad, bear, w3]) {
    assert.ok(Number.isInteger(r.confidence) && r.confidence >= 1 && r.confidence <= 10,
        `신뢰도 범위 위반: ${r.confidence}`);
}

// --- 8. SMA 워밍업은 null (0 채우기 금지) ---
const sma = engine.calculateSMA([1, 2, 3, 4, 5], 3);
assert.strictEqual(sma[0], null, '워밍업 구간은 null');
assert.strictEqual(sma[1], null, '워밍업 구간은 null');
assert.strictEqual(sma[2], 2, 'SMA3(1,2,3)=2');
assert.strictEqual(sma[4], 4, 'SMA3(3,4,5)=4');

// --- 9. EWO 길이는 캔들 수와 동일 ---
assert.strictEqual(bull.ewo.length, buildCandles(bullNodes).length, 'EWO 길이 일치');

// --- 10. RSI 다이버전스 감지 ---
// lookback=30 -> 최소 60캔들 필요. 전반 30 / 후반 30 비교.
const divCandles = buildCandles([100, 200], 60);
const half = divCandles.length / 2;
const fakeRsi = divCandles.map((c, i) => (i < half ? 80 : 60)); // 가격은 신고점인데 RSI는 하락
assert.strictEqual(engine.detectDivergence(divCandles, fakeRsi, 1), true, '상승 다이버전스 감지');
// 정상 추세(RSI 동반 상승)는 다이버전스 아님
const okRsi = divCandles.map((c, i) => (i < half ? 60 : 80));
assert.strictEqual(engine.detectDivergence(divCandles, okRsi, 1), false, 'RSI 동반 상승은 다이버전스 아님');

// --- 11. 저변동 타임프레임(1분봉)에서도 피봇이 살아남아야 함 ---
// 회귀 방지: 고정 1.5% 임계였을 때 전체 변동 0.25% 구간의 피봇이 전멸했음.
const tinyNodes = [100, 100.25, 100.05, 100.4, 100.2, 100.55, 100.35];
const tiny = buildCandles(tinyNodes);
const tinyRange = (Math.max(...tiny.map(c => c.high)) - Math.min(...tiny.map(c => c.low))) / tiny[tiny.length - 1].close;
assert.ok(tinyRange < 0.01, `저변동 픽스처여야 함 (실제 ${(tinyRange * 100).toFixed(2)}%)`);
const tinyPivots = engine.extractPivots(tiny);
assert.ok(tinyPivots.length >= 5, `저변동 구간에서도 피봇 5개 이상 (실제 ${tinyPivots.length})`);
assert.ok(!engine.analyze(tiny).error, '저변동 구간도 분석 가능');

// 고변동 구간에서는 임계가 커져 잔피봇이 걸러져야 함
assert.ok(engine.swingThreshold(tiny) < engine.swingThreshold(buildCandles([100, 300, 150, 400])),
    '변동폭이 큰 데이터일수록 스윙 임계가 커야 함');

// --- 12. 파동 노드 위상: 0/1번 노드는 반드시 반대 타입 ---
// 회귀 방지: 최근 5피봇을 그냥 잘라 쓰면 0·1번이 둘 다 고점이 되어 절대법칙이 거짓 위반으로 찍혔음.
for (const [name, res] of [['bull', bull], ['bear', bear], ['w3', w3]]) {
    if (!res.pivots || res.pivots.length !== 5) continue;
    assert.notStrictEqual(res.pivots[0].type, res.pivots[1].type,
        `${name}: 0번/1번 노드가 같은 타입이면 안 됨`);
    // 상승 구조면 0번이 저점, 하락 구조면 0번이 고점
    const expected = res.isBullish ? 'LOW' : 'HIGH';
    assert.strictEqual(res.pivots[0].type, expected,
        `${name}: ${res.isBullish ? '상승' : '하락'} 구조의 0번 노드는 ${expected}`);
}

// --- 13. 노이즈 제거 후에도 고/저 교대가 깨지면 안 됨 ---
// 회귀 방지: [교대 -> 노이즈 제거]를 1회만 하면 중간 피봇이 빠지며 HH/LL 인접쌍이 생겼음.
// 큰 스윙 사이에 임계 미달의 잔스윙을 끼워 실제 상황을 재현한다.
const noisy = buildCandles([100, 140, 105, 141, 140.4, 141.2, 106, 150, 118, 152, 120]);
const noisyPivots = engine.extractPivots(noisy);
for (let i = 1; i < noisyPivots.length; i++) {
    assert.notStrictEqual(noisyPivots[i].type, noisyPivots[i - 1].type,
        `노이즈 제거 후 인접 피봇 타입 중복 (idx ${i}: ${noisyPivots.map(p => p.type[0]).join('')})`);
}

// 실데이터에서도 동일 불변식 유지
const realish = buildCandles([64476, 64496, 64521, 64488, 64518, 64493, 64530, 64500], 15);
const realPivots = engine.extractPivots(realish);
for (let i = 1; i < realPivots.length; i++) {
    assert.notStrictEqual(realPivots[i].type, realPivots[i - 1].type, '실데이터 유사 케이스도 교대 유지');
}

console.log('wave_analyzer 자체 검증 통과 (13개 항목)');
