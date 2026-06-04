const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 'function 계산RSI(data, period) {'의 내부 루프가 끊겨서 가비지가 되었던 구간부터
// 'function 분석및신호생성(symbol) {' 직전까지의 영역을 안전하게 복구합니다.

const searchStart = `    for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;`;

const searchEnd = `function 분석및신호생성(symbol) {`;

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd, startIdx + searchStart.length);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    
    const replacement = `    for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
        if (avgLoss === 0) rsi[i] = 100;
        else rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    return rsi;
}

function 계산MACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const emaShort = 계산EMA(data, shortPeriod);
    const emaLong = 계산EMA(data, longPeriod);
    
    const macd = [];
    for (let i = 0; i < data.length; i++) {
        macd.push(emaShort[i] - emaLong[i]);
    }
    
    const signal = 계산EMA(macd, signalPeriod);
    
    const histogram = [];
    for (let i = 0; i < data.length; i++) {
        histogram.push(macd[i] - signal[i]);
    }
    
    return { macd, signal, histogram };
}

function 포지션체결실행(주문, 체결가) {
    const 증거금 = (주문.수량 * 체결가) / 주문.레버리지;

    if (상태.지갑잔고 < 증거금) {
        새신호알림(주문.심볼, \`[체결 취소] 증거금 부족으로 예약 주문이 자동 취소되었습니다. (필요 마진: \${증거금.toFixed(2)} USDT)\`, "short");
        return;
    }

    상태.지갑잔고 -= 증거금;

    // 청산가격 연산 (유지마진비율 0.5% 가정)
    let 청산가격 = 0;
    if (주문.방향 === "LONG") {
        청산가격 = 체결가 * (1 - (1 / 주문.레버리지) + 0.005);
    } else {
        청산가격 = 체결가 * (1 + (1 / 주문.레버리지) - 0.005);
    }

    const 신규포지션 = {
        아이디: 상태.포지션아이디카운터++,
        심볼: 주문.심볼,
        방향: 주문.방향,
        레버리지: 주문.레버리지,
        진입가: 체결가,
        수량: 주문.수량,
        증거금: 증거금,
        청산가: 청산가격,
        미실현손익: 0,
        수익률: 0
    };

    상태.활성포지션.push(신규포지션);
    
    새신호알림(주문.심볼, \`[포지션 체결] **\${주문.방향 === "LONG" ? "롱(LONG)" : "숏(SHORT)"}** 진입 완료! (수량: \${주문.수량} | 체결가: \${체결가.toLocaleString(undefined, { minimumFractionDigits: 상태.코인목록[주문.심볼].소수점 })} USDT)\`, "long");
    재생효과음("sound-trigger");
}

`;

    fs.writeFileSync(filePath, before + replacement + after, 'utf8');
    console.log('[SUCCESS] RSI end, MACD and position trigger block successfully patched!');
} else {
    console.log('[FAIL] Could not locate indicators or position block.');
}
