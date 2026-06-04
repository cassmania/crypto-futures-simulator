const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (보조 지표 시작)
const startKeywords = [
    '// 8. 보조 지표 계산 로직 (Indicators Algorithms)',
    '// 8. 보조 지표 계산 로직',
    'function 계산SMA'
];

let startIdx = -1;
for (const kw of startKeywords) {
    startIdx = content.indexOf(kw);
    if (startIdx !== -1) {
        console.log(`Found start keyword: "${kw}" at index ${startIdx}`);
        break;
    }
}

if (startIdx === -1) {
    console.error("[FAIL] Could not find any start keyword in app.js");
    process.exit(1);
}

// 2. 교환할 영역의 끝 인덱스 계산 (AI자동매매실행 시작 전)
const endKeywords = [
    '// AI 자동 매매 실제 포지션 진입 및 안전 마진/수량 연산 처리 엔진',
    'function AI자동매매실행'
];

let endIdx = -1;
for (const kw of endKeywords) {
    endIdx = content.indexOf(kw, startIdx); // startIdx 이후부터 매칭
    if (endIdx !== -1) {
        console.log(`Found end keyword: "${kw}" at index ${endIdx}`);
        break;
    }
}

if (endIdx === -1) {
    console.error("[FAIL] Could not find any end keyword in app.js");
    process.exit(1);
}

const beforePart = content.substring(0, startIdx);
const afterPart = content.substring(endIdx);

const pristineIndicators = `// 8. 보조 지표 계산 로직 (Indicators Algorithms)
function 계산SMA(data, period) {
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j];
        }
        result.push(sum / period);
    }
    return result;
}

function 계산EMA(data, period) {
    let result = [];
    if (data.length === 0) return result;
    
    let k = 2 / (period + 1);
    let ema = data[0];
    result.push(ema);
    
    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
        result.push(ema);
    }
    return result;
}

function 계산RSI(data, period) {
    let rsi = [];
    if (data.length < period + 1) {
        return new Array(data.length).fill(50); // 데이터 부족 시 기본값
    }

    let gains = [];
    let losses = [];

    for (let i = 1; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    rsi.push(NaN); // 첫 캔들
    for (let i = 1; i < period; i++) rsi.push(NaN);

    if (avgLoss === 0) rsi.push(100);
    else rsi.push(100 - (100 / (1 + avgGain / avgLoss)));

    for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
        
        if (avgLoss === 0) rsi.push(100);
        else rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
    }

    return rsi;
}

function 계산MACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const emaShort = 계산EMA(data, shortPeriod);
    const emaLong = 계산EMA(data, longPeriod);
    
    let macdLine = [];
    for (let i = 0; i < data.length; i++) {
        macdLine.push(emaShort[i] - emaLong[i]);
    }
    
    const signalLine = 계산EMA(macdLine, signalPeriod);
    
    let histogram = [];
    for (let i = 0; i < data.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram
    };
}

// 9. 매매 타이밍 신호 발생 분석기 (Technical Indicator Signal Analyzer)
function 분석및신호생성(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const times = coin.캔들데이터.map(c => c.time);
    
    const rsi = 계산RSI(closes, 14);
    const macdData = 계산MACD(closes, 12, 26, 9);
    const ma7 = 계산SMA(closes, 7);
    const ma25 = 계산SMA(closes, 25);

    const idx = closes.length - 1;
    
    const 현재RSI = rsi[idx];
    const 현재MACD = macdData.macd[idx];
    const 현재MACD시그널 = macdData.signal[idx];
    const 이전MACD = macdData.macd[idx - 1];
    const 이전MACD시그널 = macdData.signal[idx - 1];

    const 현재MA7 = ma7[idx];
    const 현재MA25 = ma25[idx];
    const 이전MA7 = ma7[idx - 1];
    const 이전MA25 = ma25[idx - 1];

    const MACD골든크로스 = 이전MACD < 이전MACD시그널 && 현재MACD >= 현재MACD시그널;
    const MACD데드크로스 = 이전MACD > 이전MACD시그널 && 현재MACD <= 현재MACD시그널;

    const MA골든크로스 = 이전MA7 < 이전MA25 && 현재MA7 >= 현재MA25;
    const MA데드크로스 = 이전MA7 > 이전MA25 && 현재MA7 <= 이전MA25;

    let 신호방향 = null;
    let 근거 = [];

    // 매수 진입 시그널 조건 판정
    if (현재RSI <= 32) {
        신호방향 = "LONG";
        근거.push("RSI 과매도 영역");
    }
    if (MACD골든크로스) {
        if (!신호방향) 신호방향 = "LONG";
        근거.push("MACD 골든크로스");
    }
    if (MA골든크로스) {
        if (!신호방향) 신호방향 = "LONG";
        근거.push("이평선(MA 7/25) 골든크로스");
    }

    // 매도 진입 시그널 조건 판정
    if (현재RSI >= 68) {
        신호방향 = "SHORT";
        근거.push("RSI 과매수 영역");
    }
    if (MACD데드크로스) {
        if (!신호방향) 신호방향 = "SHORT";
        근거.push("MACD 데드크로스");
    }
    if (MA데드크로스) {
        if (!신호방향) 신호방향 = "SHORT";
        근거.push("이평선(MA 7/25) 데드크로스");
    }

    // 조건 부합 시 화면 알림 및 차트 마킹 출력
    if (신호방향 && 근거.length >= 1) {
        const 근거텍스트 = 근거.join(" + ");
        const 색상 = 신호방향 === "LONG" ? "long" : "short";
        const 방향한글 = 신호방향 === "LONG" ? "롱(LONG) 매수" : "숏(SHORT) 매도";
        
        새신호알림(symbol, \`[매매 신호 감지] **\${방향한글}** 타점 발생! (\${근거텍스트} | RSI: \${현재RSI.toFixed(1)})\`, 색상);
        재생효과음("sound-signal");

        if (symbol === 상태.기본코인 && 상태.차트객체.분할차트들[0] && 상태.차트객체.분할차트들[0].캔들시리즈) {
            const series = 상태.차트객체.분할차트들[0].캔들시리즈;
            let markers = [];
            try {
                if (typeof series.getMarkers === 'function') {
                    markers = series.getMarkers() || [];
                } else {
                    markers = series._markers || [];
                }
            } catch (e) {
                markers = series._markers || [];
            }

            markers.push({
                time: times[idx],
                position: 신호방향 === "LONG" ? 'belowBar' : 'aboveBar',
                color: 신호방향 === "LONG" ? '#f6465d' : '#0066ff', // 상승 = 빨간색, 하락 = 파란색
                shape: 신호방향 === "LONG" ? 'arrowUp' : 'arrowDown',
                text: 신호방향 === "LONG" ? 'LONG BUY' : 'SHORT SELL'
            });

            try {
                series.setMarkers(markers);
                series._markers = markers;
            } catch (e) {
                console.error("마커 설정 실패:", e);
            }
        }

        // AI 자동 매매 활성화 상태일 경우 자동 거래 수행 (Auto Trading Execution)
        if (coin.자동매매활성화) {
            AI자동매매실행(symbol, 신호방향);
        }
    }
}

`;

const finalContent = beforePart + pristineIndicators + afterPart;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 보조 지표 계산 및 시그널 분석기 영역이 정화되었습니다!');
