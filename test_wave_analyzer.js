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

// --- 14. 임계가 올라도 피봇이 절벽처럼 붕괴하면 안 됨 ---
// 회귀 방지: 순차 필터가 "직전 생존 피봇" 기준이라 연쇄 삭제를 일으켰음.
// 실측 재현 - threshold 0.001에서 13개였다가 0.0016에서 2개로 무너짐.
const many = buildCandles([100, 103, 100.5, 104, 101, 105, 102, 106, 103, 107, 104, 108], 8);
const engineRaw = new ElliottWaveEngine();
const altOnly = engineRaw.enforceAlternation(
    (function () {
        const w = engineRaw.fractalWidth, r = [];
        for (let i = w; i < many.length - w; i++) {
            const cu = many[i]; let h = true, l = true;
            for (let k = 1; k <= w; k++) {
                if (cu.high <= many[i - k].high || cu.high < many[i + k].high) h = false;
                if (cu.low >= many[i - k].low || cu.low > many[i + k].low) l = false;
            }
            if (h) r.push({ index: i, time: cu.time, price: cu.high, type: 'HIGH' });
            else if (l) r.push({ index: i, time: cu.time, price: cu.low, type: 'LOW' });
        }
        return r;
    })()
);
let prevCount = engineRaw.dropNoiseSwings(altOnly, 0).length;
for (const th of [0.002, 0.005, 0.01, 0.02]) {
    const n = engineRaw.dropNoiseSwings(altOnly, th).length;
    assert.ok(n <= prevCount, `임계 증가 시 피봇 수는 단조 감소해야 함 (th=${th}: ${prevCount} -> ${n})`);
    // 교대 불변식은 어떤 임계에서도 유지
    const kept = engineRaw.dropNoiseSwings(altOnly, th);
    for (let i = 1; i < kept.length; i++) {
        assert.notStrictEqual(kept[i].type, kept[i - 1].type, `th=${th}에서 교대 붕괴`);
    }
    prevCount = n;
}

// --- 15. 저변동 구간(1분봉류)에서도 파동 카운팅 가능해야 함 ---
// 회귀 방지: swingRangeRatio 0.12는 range 1.3% 데이터에서 임계를 0.16%로 올려
// 피봇을 2개로 붕괴시켰음 (카운팅 최소 5개 미달).
const lowVol = [];
{
    // 전체 range 약 1.3%인 잔파동 시퀀스 (1분봉 실측과 유사)
    const base = 65000;
    const nodes = [];
    for (let i = 0; i < 12; i++) {
        nodes.push(base * (1 + (i % 2 === 0 ? 0 : 0.004) + i * 0.0008));
    }
    lowVol.push(...buildCandles(nodes, 10));
}
const lowVolRange = (Math.max(...lowVol.map(c => c.high)) - Math.min(...lowVol.map(c => c.low)))
    / lowVol[lowVol.length - 1].close;
assert.ok(lowVolRange < 0.03, `저변동 픽스처여야 함 (range ${(lowVolRange * 100).toFixed(2)}%)`);

const lowVolPivots = engine.extractPivots(lowVol);
assert.ok(lowVolPivots.length >= 5,
    `저변동 구간에서도 피봇 5개 이상 필요 (실제 ${lowVolPivots.length}) — swingRangeRatio 과대 의심`);
for (let i = 1; i < lowVolPivots.length; i++) {
    assert.notStrictEqual(lowVolPivots[i].type, lowVolPivots[i - 1].type, '저변동 구간도 교대 유지');
}
assert.notStrictEqual(engine.analyze(lowVol, {}).stage, '파동 형성 중 (피봇 측정 중)',
    '저변동 구간에서 파동 국면이 확정돼야 함');

// ── v4 신뢰등급 (백테스트 실측 기대값) ──────────────────────
const pv = prices => prices.map((p, i) => ({ price: p, type: i % 2 ? 'HIGH' : 'LOW' }));
const ALL_PASS = { rule1: true, rule2: true, rule3: true };
// 기본 지표: 손절폭 ATR 2.5배 / MA 정렬 일치 / RSI 60(r高)
const IND = { atr: 2, ema20: 105, sma60: 100, rsi: 60, price: 100 };
const mk = (stage, extra = {}) => ({
    stage, rules: ALL_PASS, allPassed: true, confidence: 8,
    pivots: pv([0, 100, 50, 160, 120]), isBullish: true, invalidation: 95, ...extra
});

// 국면 -> 패턴 분류
assert.strictEqual(engine.classifyPattern('메인 상승 3파 진행 중 (최강 임펄스)'), 'IMPULSE_3');
assert.strictEqual(engine.classifyPattern('5파 상승 진행 중 (다이버전스 경계)'), 'IMPULSE_5');
assert.strictEqual(engine.classifyPattern('2파 조정 진행 중 (매수 대기)'), 'WAVE_2');
assert.strictEqual(engine.classifyPattern('ABC 조정파 진입 (추진 파동 종료 추정)'), 'ZIGZAG_C');

// 실측 최상위 조합은 매매 가능 (WAVE_2 c8+ a2+ m+ r高 = +1.1427R)
const gTop = engine.gradeWave(mk('2파 조정 진행 중'), '1d', IND);
assert.strictEqual(gTop.cell, 'WAVE_2 c8+ a2+ m+ r高', `조합 불일치: ${gTop.cell}`);
assert.strictEqual(gTop.grade, 'A', `A등급이어야 함 (실제 ${gTop.grade})`);
assert.ok(gTop.tradable);

// 실측 최악 조합은 반드시 관망 (WAVE_2 c<6 a<1 m- r低 = -0.6578R)
const gBad = engine.gradeWave(mk('2파 조정 진행 중', { confidence: 4, invalidation: 99 }),
                              '1d', { atr: 20, ema20: 95, sma60: 100, rsi: 45, price: 100 });
assert.strictEqual(gBad.cell, 'WAVE_2 c<6 a<1 m- r低', `조합 불일치: ${gBad.cell}`);
assert.strictEqual(gBad.tradable, false, '손실 조합이 매매가능으로 새어나옴');

// RSI만 낮아져도 판정이 뒤집힌다 (v4에서 추가된 축이 실제로 작동하는가)
const gLoRsi = engine.gradeWave(mk('2파 조정 진행 중'), '1d', { ...IND, rsi: 45 });
assert.ok(gTop.tradable && !gLoRsi.tradable, `RSI 축 미작동: ${gTop.cell} vs ${gLoRsi.cell}`);

// 하락 파동은 RSI를 100에서 뺀다 - 같은 RSI라도 방향에 따라 구간이 갈린다
const gShort = engine.gradeWave(mk('2파 반등 진행 중', { isBullish: false, invalidation: 105 }),
                                '1d', { ...IND, ema20: 95, rsi: 60 });
assert.strictEqual(gShort.rsiAdj, 40, `SHORT RSI 보정 실패: ${gShort.rsiAdj}`);

// 지표가 하나라도 없으면 등급을 내지 않는다 (임의 기본값 금지)
assert.strictEqual(engine.gradeWave(mk('2파 조정 진행 중'), '1d', null).ev, null);
for (const miss of ['atr', 'ema20', 'sma60', 'rsi', 'price']) {
    // 0이 아니라 undefined로 지운다. ema20=0은 "미산출"이 아니라 "MA 역행"으로
    // 해석돼 유효한 조합이 나와버리므로 결측 검증이 되지 않는다.
    const bad = { ...IND }; delete bad[miss];
    const g = engine.gradeWave(mk('2파 조정 진행 중'), '1d', bad);
    assert.strictEqual(g.ev, null, `${miss} 없는데 등급이 나옴`);
    assert.strictEqual(g.tradable, false);
}

// 손절이 현재가의 반대쪽이면 판정 불가 (R 부호 뒤집힘 방지)
const gWrong = engine.gradeWave(mk('2파 조정 진행 중', { invalidation: 105 }), '1d', IND);
assert.strictEqual(gWrong.ev, null, '방향 모순 신호가 통과함');

// 표본 부족 조합은 매매 불가 + 미검증 표시
const gUnk = engine.gradeWave(mk('4파 조정 진행 중'), '1d', IND);
assert.strictEqual(gUnk.tradable, false, '미검증 조합이 매매가능');
assert.ok(gUnk.warnings.some(w => /검증되지 않았다/.test(w)), JSON.stringify(gUnk.warnings));

// 매도 표(ladder): 손절은 최초보다 불리해지지 않고, 확정손익은 단조 증가
assert.strictEqual(gTop.ladder.length, 4);
for (const st of gTop.ladder) assert.ok(st.stop >= gTop.sl, `손절이 최초보다 내려감: ${st.stop}`);
for (let i = 1; i < gTop.ladder.length; i++) {
    assert.ok(gTop.ladder[i].lockedR >= gTop.ladder[i - 1].lockedR, '확정손익 역전');
}

// 컷 경계가 반올림으로 뚫리면 안 된다 (실측 0.4961 -> 0.50 사고 회귀 방지)
for (const [cell, ev] of Object.entries(ElliottWaveEngine.CELL_EV)) {
    if (ev < ElliottWaveEngine.TRADE_CUT && Math.round(ev * 100) / 100 >= ElliottWaveEngine.TRADE_CUT) {
        throw new Error(`${cell}: ${ev}가 반올림되면 컷 통과 - 정밀도 유지 필요`);
    }
}

// analyze() 결과에 grade가 실린다 (ctx로 지표를 넘기면 등급이 산출된다)
const gRes = engine.analyze(lowVol, {
    interval: '1d',
    ma: { ema20: lowVol.at(-1).close * 1.01, sma60: lowVol.at(-1).close },
    rsi: lowVol.map(() => 60)
});
assert.ok(gRes.grade, 'analyze 결과에 grade 없음');
assert.ok(['A', 'B', 'C', 'D'].includes(gRes.grade.grade));

console.log('wave_analyzer 자체 검증 통과 (15개 항목 + v4 등급 12개)');
