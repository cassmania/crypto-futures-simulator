const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 'function 포지션체결실행' 의 정의 아랫부분에 존재하던
// 첫번째 꼬인 지표 잔여물 'if (MACD데드크로스) {' 부근부터
// '분석및신호생성' 함수의 하단(markers.push ~ setMarkers 부분)까지를 감지합니다.

const searchStart = `        if (!신호방향) 신호방향 = "SHORT";
        근거.push("MACD 데드크로스");
    }
    if (MA데드크로스) {`;

const searchEnd = `            try {
                series.setMarkers(markers);
            } catch (err) {
                series._markers = markers;
            }
        }
    }
}`;

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd, startIdx + searchStart.length);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + searchEnd.length);

    const replacement = `// 9. 매매 타이밍 신호 발생 분석기 (Technical Indicator Signal Analyzer)
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
                color: 신호방향 === "LONG" ? '#f6465d' : '#0066ff',
                shape: 신호방향 === "LONG" ? 'arrowUp' : 'arrowDown',
                text: 신호방향 === "LONG" ? \`LONG (\${현재RSI.toFixed(0)})\` : \`SHORT (\${현재RSI.toFixed(0)})\`
            });
            
            try {
                series.setMarkers(markers);
            } catch (err) {
                series._markers = markers;
            }
        }
    }
}
`;

    fs.writeFileSync(filePath, before + replacement + after, 'utf8');
    console.log('[SUCCESS] Technical analyzer block successfully patched!');
} else {
    console.log('[FAIL] Could not locate patch markers.');
}
