/**
 * 엘리엇 파동 + 피보나치 정밀 분석 엔진
 * coin-wave-analysis 스킬의 규칙을 시뮬레이터로 이식한 것.
 *
 * 캔들 형식: { time, open, high, low, close }  (volume 없음 - VPVR 확증은 호출측 계산값 사용)
 */

class ElliottWaveEngine {
    constructor() {
        // 프랙탈 피봇 판정 폭 (좌우 캔들 수)
        this.fractalWidth = 2;
        // 노이즈 피봇 제거 임계는 데이터 변동폭에서 유도한다.
        // (고정 1.5%로 두면 1분봉처럼 전체 변동이 0.3%인 구간에서 피봇이 전멸함)
        this.minSwingCeil = 0.03;
        // 전체 고저 range 대비 스윙 인정 비율
        this.swingRangeRatio = 0.12;
    }

    /**
     * @param {Array} candles OHLC 배열
     * @param {Object} ctx 호출측이 이미 계산해 둔 확증 지표 { rsi:number[], vpvrPOC:number, ma:{ema20,sma60,sma200} }
     */
    analyze(candles, ctx = {}) {
        if (!candles || candles.length < 30) {
            return { error: '데이터 부족 (최소 30개 캔들 필요)' };
        }

        const pivots = this.extractPivots(candles);
        const ewo = this.calculateEWO(candles);
        const last = candles[candles.length - 1];

        if (pivots.length < 5) {
            return {
                stage: '파동 형성 중 (피봇 측정 중)',
                pivots,
                ewo,
                rules: { rule1: null, rule2: null, rule3: null },
                confidence: 2,
                confidenceReason: '유효 피봇 5개 미달 - 카운팅 불가',
                signal: { action: 'NEUTRAL', reason: '명확한 파동 노드 탐색 중', entry: 0, tp1: 0, tp2: 0, sl: 0 },
                invalidation: 0
            };
        }

        // 최근 5개 피봇을 0~4파 노드로 사용.
        // 단, 0번 노드는 1번 노드와 반대 타입이어야 한다(저점->고점 또는 고점->저점).
        // 교대가 보장돼도 슬라이스 시작 위치에 따라 위상이 어긋날 수 있어 한 칸 밀어 맞춘다.
        let window5 = pivots.slice(-5);
        if (window5[0].type === window5[1].type && pivots.length >= 6) {
            window5 = pivots.slice(-6, -1);
        }
        const [w0, w1, w2, w3, w4] = window5;
        const isBullish = w1.price > w0.price;
        const dir = isBullish ? 1 : -1;

        const len1 = Math.abs(w1.price - w0.price);
        const len3 = Math.abs(w3.price - w2.price);
        const len5 = Math.abs(last.close - w4.price);

        // --- 엘리엇 절대 법칙 3종 ---
        // 1) 2파는 1파 시작점을 이탈 못함
        const rule1 = dir * (w2.price - w0.price) > 0;
        // 2) 3파는 추진파 중 최단이 될 수 없음
        const rule2 = len3 >= len1 || len3 >= len5;
        // 3) 4파는 1파 고점 영역과 중첩 불가
        const rule3 = dir * (w4.price - w1.price) > 0;
        const rules = { rule1, rule2, rule3 };
        const allPassed = rule1 && rule2 && rule3;

        // --- 파동 국면 판정 + 피보나치 타겟 ---
        const stageInfo = this.resolveStage({ w0, w1, w2, w3, w4, last, dir, len1, len3 });

        // 시나리오 무효화 가격: 현재 국면의 기준 노드 이탈선
        const invalidation = stageInfo.invalidation;

        const conf = this.scoreConfidence({ rules, stageInfo, candles, ctx, dir });

        return {
            stage: stageInfo.stage,
            isBullish,
            allPassed,
            rules,
            pivots: [w0, w1, w2, w3, w4],
            fib: stageInfo.fib,
            invalidation: this.round(invalidation),
            confidence: conf.score,
            confidenceReason: conf.reason,
            signal: {
                action: stageInfo.action,
                reason: stageInfo.reason,
                entry: this.round(stageInfo.entry),
                tp1: this.round(stageInfo.tp1),
                tp2: this.round(stageInfo.tp2),
                sl: this.round(stageInfo.sl)
            },
            ewo
        };
    }

    /**
     * 현재가 위치로 파동 국면을 정하고 스킬 규칙의 피보나치 비율을 적용.
     * 상승/하락 모두 dir 부호로 대칭 처리.
     */
    resolveStage({ w0, w1, w2, w3, w4, last, dir, len1, len3 }) {
        const px = last.close;
        const ahead = (from, mult) => from + dir * mult;   // 추세 방향 전진
        const back = (from, mult) => from - dir * mult;    // 되돌림 방향

        // 2파 되돌림 진행 중: 1파 고점 미돌파 + 2파 저점 유지
        if (dir * (px - w1.price) < 0 && dir * (px - w2.price) >= 0) {
            const fib = {
                '0.5 되돌림': back(w1.price, len1 * 0.5),
                '0.618 되돌림': back(w1.price, len1 * 0.618),
                '3파 1.618 확장': ahead(w2.price, len1 * 1.618)
            };
            return {
                stage: dir > 0 ? '2파 조정 진행 중 (매수 대기)' : '2파 반등 진행 중 (매도 대기)',
                fib,
                action: dir > 0 ? 'LONG' : 'SHORT',
                reason: '2파 0.5~0.618 되돌림 지지 확인 후 3파 진입',
                entry: fib['0.618 되돌림'],
                tp1: w1.price,
                tp2: fib['3파 1.618 확장'],
                sl: back(w0.price, len1 * 0.02),
                invalidation: w0.price
            };
        }

        // 3파 진행 중: 1파 고점 돌파, 3파 고점 미갱신
        if (dir * (px - w1.price) > 0 && dir * (px - w3.price) <= 0) {
            const fib = {
                '3파 1.618 확장': ahead(w2.price, len1 * 1.618),
                '3파 2.618 연장': ahead(w2.price, len1 * 2.618)
            };
            return {
                stage: dir > 0 ? '메인 상승 3파 진행 중 (최강 임펄스)' : '메인 하락 3파 진행 중 (최강 임펄스)',
                fib,
                action: dir > 0 ? 'LONG' : 'SHORT',
                reason: '3파 임펄스 추종 - 피보나치 1.618 확장 목표',
                entry: px,
                tp1: fib['3파 1.618 확장'],
                tp2: fib['3파 2.618 연장'],
                sl: w2.price,
                invalidation: w2.price
            };
        }

        // 4파 조정 중: 3파 고점 대비 되돌림, 아직 4파 저점 부근
        if (dir * (px - w3.price) < 0 && dir * (px - w4.price) <= 0) {
            const fib = {
                '4파 0.236 되돌림': back(w3.price, len3 * 0.236),
                '4파 0.382 되돌림': back(w3.price, len3 * 0.382),
                '5파 1.0 확장': ahead(w4.price, len1 * 1.0)
            };
            return {
                stage: dir > 0 ? '4파 조정 진행 중 (교대 법칙)' : '4파 반등 진행 중 (교대 법칙)',
                fib,
                action: 'NEUTRAL',
                reason: '4파 0.236~0.382 되돌림 관망 - 1파 영역 침범 여부 확인',
                entry: fib['4파 0.382 되돌림'],
                tp1: w3.price,
                tp2: fib['5파 1.0 확장'],
                sl: w1.price,
                invalidation: w1.price
            };
        }

        // 5파 진행 중: 4파 저점 이탈 없이 재전진
        if (dir * (px - w4.price) > 0) {
            const fib = {
                '5파 1.0 확장': ahead(w4.price, len1 * 1.0),
                '5파 0.618 (1~3파 기준)': ahead(w4.price, Math.abs(w3.price - w0.price) * 0.618)
            };
            return {
                stage: dir > 0 ? '5파 상승 진행 중 (다이버전스 경계)' : '5파 하락 진행 중 (다이버전스 경계)',
                fib,
                action: dir > 0 ? 'LONG' : 'SHORT',
                reason: '5파 막바지 - 목표 도달 시 분할 청산, 다이버전스 발생 주의',
                entry: px,
                tp1: fib['5파 1.0 확장'],
                tp2: fib['5파 0.618 (1~3파 기준)'],
                sl: w4.price,
                invalidation: w4.price
            };
        }

        // 5파 완료 후 ABC 조정 진입 (추세 반대)
        const cLen = Math.abs(w3.price - w0.price);
        const fib = {
            'C파 1.0 (1:1)': back(w4.price, cLen * 0.618),
            'C파 1.618 연장': back(w4.price, cLen * 1.0)
        };
        return {
            stage: 'ABC 조정파 진입 (추진 파동 종료 추정)',
            fib,
            action: dir > 0 ? 'SHORT' : 'LONG',
            reason: '추진 파동 종료 - C파 조정 확장 구간 역방향 대응',
            entry: px,
            tp1: fib['C파 1.0 (1:1)'],
            tp2: fib['C파 1.618 연장'],
            sl: w4.price,
            invalidation: w4.price
        };
    }

    /**
     * 파동 신뢰도 1~10점. 절대 법칙 준수 + 확증 지표(RSI 다이버전스, POC, MA) 가중.
     */
    scoreConfidence({ rules, stageInfo, candles, ctx, dir }) {
        let score = 4;
        const notes = [];

        const passed = [rules.rule1, rules.rule2, rules.rule3].filter(Boolean).length;
        score += passed * 1.5;
        notes.push(`절대법칙 ${passed}/3 충족`);

        // RSI 다이버전스: 5파 국면에서 발생하면 반전 임박 -> 추종 신뢰도 하락
        const rsi = ctx.rsi;
        if (Array.isArray(rsi) && rsi.length === candles.length) {
            const div = this.detectDivergence(candles, rsi, dir);
            if (div && /5파/.test(stageInfo.stage)) {
                score -= 2;
                notes.push('5파 다이버전스 발생 - 추종 위험');
            } else if (div) {
                notes.push('다이버전스 감지');
            }
        }

        // VPVR POC 근접: 파동 매듭이 매물대와 겹치면 신뢰도 상승
        const poc = ctx.vpvrPOC;
        const px = candles[candles.length - 1].close;
        if (poc > 0 && Math.abs(px - poc) / px < 0.01) {
            score += 1;
            notes.push('POC 매물대 일치');
        }

        // 이동평균 정배열 일치
        const ma = ctx.ma || {};
        if (ma.ema20 > 0 && ma.sma60 > 0) {
            const aligned = dir > 0 ? ma.ema20 > ma.sma60 : ma.ema20 < ma.sma60;
            if (aligned) {
                score += 1;
                notes.push('이동평균 방향 일치');
            } else {
                score -= 1;
                notes.push('이동평균 방향 불일치');
            }
        }

        return {
            score: Math.max(1, Math.min(10, Math.round(score))),
            reason: notes.join(', ')
        };
    }

    /** 최근 구간 가격 신고점/신저점 대비 RSI 실패 여부 = 다이버전스 */
    detectDivergence(candles, rsi, dir, lookback = 30) {
        const n = candles.length;
        if (n < lookback * 2) return false;
        const recent = candles.slice(n - lookback);
        const prior = candles.slice(n - lookback * 2, n - lookback);
        const rRecent = rsi.slice(n - lookback);
        const rPrior = rsi.slice(n - lookback * 2, n - lookback);

        if (dir > 0) {
            const pxUp = Math.max(...recent.map(c => c.high)) > Math.max(...prior.map(c => c.high));
            const rsiDown = Math.max(...rRecent) < Math.max(...rPrior);
            return pxUp && rsiDown;
        }
        const pxDown = Math.min(...recent.map(c => c.low)) < Math.min(...prior.map(c => c.low));
        const rsiUp = Math.min(...rRecent) > Math.min(...rPrior);
        return pxDown && rsiUp;
    }

    /**
     * 프랙탈 피봇 추출 후 고/저 교대 강제 + 노이즈 스윙 제거.
     * 같은 타입이 연속되면 더 극단값으로 교체 (기존 구현은 뒤쪽 피봇을 버려서 고점을 놓쳤음).
     */
    extractPivots(candles) {
        const w = this.fractalWidth;
        const raw = [];

        for (let i = w; i < candles.length - w; i++) {
            const cur = candles[i];
            let isHigh = true;
            let isLow = true;
            // 좌측은 strict, 우측은 등호 허용 -> 동일 고점 평탄 구간(쌍고점)에서도 첫 캔들이 피봇으로 잡힘
            for (let k = 1; k <= w; k++) {
                if (cur.high <= candles[i - k].high || cur.high < candles[i + k].high) isHigh = false;
                if (cur.low >= candles[i - k].low || cur.low > candles[i + k].low) isLow = false;
            }
            if (isHigh) raw.push({ index: i, time: cur.time, price: cur.high, type: 'HIGH' });
            else if (isLow) raw.push({ index: i, time: cur.time, price: cur.low, type: 'LOW' });
        }

        // 노이즈 제거로 중간 피봇이 빠지면 남은 이웃끼리 같은 타입으로 붙는다.
        // 따라서 [교대 정리 -> 노이즈 제거]를 한 번만 하면 안 되고 변화가 없을 때까지 반복해야 한다.
        const threshold = this.swingThreshold(candles);
        let cur = this.enforceAlternation(raw);
        for (let guard = 0; guard < 20; guard++) {
            const filtered = this.dropNoiseSwings(cur, threshold);
            const next = this.enforceAlternation(filtered);
            if (next.length === cur.length) return next;
            cur = next;
        }
        return cur;
    }

    /** 고/저 교대 강제. 같은 타입이 연속되면 더 극단적인 쪽만 남긴다. */
    enforceAlternation(pivots) {
        const out = [];
        for (const p of pivots) {
            const prev = out[out.length - 1];
            if (!prev || prev.type !== p.type) {
                out.push(p);
                continue;
            }
            const replace = p.type === 'HIGH' ? p.price > prev.price : p.price < prev.price;
            if (replace) out[out.length - 1] = p;
        }
        return out;
    }

    /** 직전 피봇 대비 변동률이 임계 미달인 잔스윙 제거 */
    dropNoiseSwings(pivots, threshold) {
        const out = [];
        for (const p of pivots) {
            const prev = out[out.length - 1];
            if (prev && Math.abs(p.price - prev.price) / prev.price < threshold) continue;
            out.push(p);
        }
        return out;
    }

    /**
     * 타임프레임 무관 동작을 위해 전체 고저 range에서 스윙 임계를 유도.
     * 1분봉(range 0.2%)과 일봉(range 30%)이 같은 상수를 쓸 수 없으므로 비율로 스케일한다.
     * floor는 절대값이 아니라 range 대비 비율로 잡아야 저변동 구간에서 피봇이 전멸하지 않는다.
     */
    swingThreshold(candles) {
        const hi = Math.max(...candles.map(c => c.high));
        const lo = Math.min(...candles.map(c => c.low));
        const last = candles[candles.length - 1].close;
        if (!(last > 0) || !(hi > lo)) return 0;
        const rangePct = (hi - lo) / last;
        return Math.min(this.minSwingCeil, rangePct * this.swingRangeRatio);
    }

    /** 엘리엇 파동 오실레이터 = SMA5 - SMA35 */
    calculateEWO(candles) {
        const closes = candles.map(c => c.close);
        const sma5 = this.calculateSMA(closes, 5);
        const sma35 = this.calculateSMA(closes, 35);
        return candles.map((c, i) => ({
            time: c.time,
            value: (sma5[i] === null || sma35[i] === null) ? 0 : sma5[i] - sma35[i]
        }));
    }

    /** 워밍업 구간은 null (기존 구현은 0을 채워 EWO를 왜곡시켰음) */
    calculateSMA(data, period) {
        const out = [];
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
            if (i >= period) sum -= data[i - period];
            out.push(i >= period - 1 ? sum / period : null);
        }
        return out;
    }

    round(v) {
        if (!isFinite(v)) return 0;
        const abs = Math.abs(v);
        const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
        return parseFloat(v.toFixed(digits));
    }
}

if (typeof module !== 'undefined') module.exports = ElliottWaveEngine;
if (typeof window !== 'undefined') window.ElliottWaveEngine = ElliottWaveEngine;
