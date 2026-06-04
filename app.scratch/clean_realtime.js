const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (실시간 파트 시작)
const startKeywords = [
    '// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)',
    '// 7. 실시간 수신 웹소켓 데이터 파싱',
    'function 실시간캔들메시지파싱',
    '// Kline 실시간 수신 핸들러'
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

// 2. 교환할 영역의 끝 인덱스 계산 (보조 지표 계산 로직 시작 전)
const endKeywords = [
    '// 8. 보조 지표 계산 로직 (Indicators Algorithms)',
    '// 8. 보조 지표 계산 로직',
    'function 계산SMA'
];

let endIdx = -1;
for (const kw of endKeywords) {
    endIdx = content.indexOf(kw, startIdx); // startIdx 이후부터 매칭 시작
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

const pristineRealtime = `// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)

// Kline 실시간 수신 핸들러 (8분할 실시간 틱 갱신 및 1m 신호 감지 병합)
function 실시간캔들메시지파싱(data) {
    const symbol = data.s; // 심볼 (예: BTCUSDT)
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    // 바이낸스 K라인 페이로드 규격: t: 시작시각(ms), o: 시가, h: 고가, l: 저가, c: 종가, v: 거래량
    const k = data.k;
    const candleTime = Math.floor(k.t / 1000);
    const 현재가 = parseFloat(k.c);

    const 실시간캔들 = {
        time: candleTime,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: 현재가,
        volume: parseFloat(k.v)
    };

    coin.현재가 = 현재가;

    // 1. 실시간 1분봉 버퍼 누적 및 신호 가동 (분할 시간대와 별개로 1분봉으로 타점 분석 유지)
    const candles = coin.캔들데이터;
    if (candles.length === 0) {
        candles.push(실시간캔들);
    } else {
        const lastCandle = candles[candles.length - 1];
        
        // 동일 시간대 분봉 캔들 실시간 데이터 갱신
        if (candleTime === lastCandle.time) {
            candles[candles.length - 1] = 실시간캔들;
        } else if (candleTime > lastCandle.time) {
            // 1분 지나서 새로운 캔들 영역 진입 시 추가 삽입
            candles.push(실시간캔들);
            if (candles.length > 500) candles.shift(); // 메모리 보호용
        }
    }

    // 24시간 최고/최저가 실시간 갱신
    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

    // 현재 보고 있는 코인 화면 실시간 연동
    if (symbol === 상태.기본코인) {
        const priceEl = document.getElementById("current-price");
        const midPriceEl = document.getElementById("orderbook-mid-price");
        
        if (priceEl && midPriceEl) {
            const 이전가격 = parseFloat(priceEl.innerText.replace(/,/g, '')) || 현재가;
            
            // 실시간 텍스트 가격 및 깜빡임 연출
            priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            midPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

            priceEl.className = "ticker-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
            midPriceEl.className = "mid-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
        }

        // 24시간 변동률 렌더링
        const 변동률 = ((현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeEl = document.getElementById("price-change-percent");
        if (changeEl) {
            changeEl.innerText = (변동률 >= 0 ? "+" : "") + 변동률 + "%";
            changeEl.className = "stat-val " + (변동률 >= 0 ? "text-green" : "text-red");
        }
        
        const highEl = document.getElementById("price-high-24h");
        const lowEl = document.getElementById("price-low-24h");
        if (highEl) highEl.innerText = coin.최고24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (lowEl) lowEl.innerText = coin.최저24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

        // AI 추천 타점 갱신 (메인 코인 활성 시 실시간 추천 적용)
        AI추천분석및업데이트(symbol);
    }

    // 2. 8개 분할 차트 실시간 틱 갱신 및 신규 봉 자동 생성 (글로벌 틱 라우팅 적용 - 기본코인 여부 무관)
    상태.차트객체.분할차트들.forEach(c => {
        if (!c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length === 0) return;
        
        // 차트의 코인 심볼과 유입된 틱 데이터의 코인 심볼이 다를 경우 무시 (8개 차트 개별 코인 갱신 지원)
        if (c.코인심볼 !== symbol) return;

        // 각 분할 차트의 시간 단위(interval)에 맞는 초 단위 주기 연산
        let 봉단위초 = 60;
        if (c.시간단위 === "1m") 봉단위초 = 60;
        else if (c.시간단위 === "1h") 봉단위초 = 3600;
        else if (c.시간단위 === "4h") 봉단위초 = 14400;
        else if (c.시간단위 === "8h") 봉단위초 = 28800;
        else if (c.시간단위 === "12h") 봉단위초 = 43200;
        else if (c.시간단위 === "1d") 봉단위초 = 86400;
        else if (c.시간단위 === "1w") 봉단위초 = 604800;

        const targetT = Math.floor(candleTime / 봉단위초) * 봉단위초;
        const lastCandle = c.캔들데이터[c.캔들데이터.length - 1];

        if (targetT === lastCandle.time) {
            // 동일 시간 범위 내 실시간 틱 갱신
            lastCandle.close = 현재가;
            if (현재가 > lastCandle.high) lastCandle.high = 현재가;
            if (현재가 < lastCandle.low) lastCandle.low = 현재가;
            c.캔들시리즈.update(lastCandle);
        } else if (targetT > lastCandle.time) {
            // 새 봉 생성 시 SMA 지표 새로 연산 및 누적
            const newCandle = {
                time: targetT,
                open: 현재가,
                high: 현재가,
                low: 현재가,
                close: 현재가,
                volume: parseFloat(k.v)
            };
            c.캔들데이터.push(newCandle);
            c.캔들시리즈.update(newCandle);
            if (c.캔들데이터.length > 500) c.캔들데이터.shift();
        }

        // 실시간 SMA 이동평균선(MA) 갱신
        const currentCandles = c.캔들데이터;
        const closes = currentCandles.map(cand => cand.close);
        const targetCandleTime = currentCandles[currentCandles.length - 1].time;

        const ma7 = 계산SMA(closes, 7);
        const ma25 = 계산SMA(closes, 25);
        const ma99 = 계산SMA(closes, 99);

        if (ma7.length > 0) c.MA7시리즈.update({ time: targetCandleTime, value: ma7[ma7.length - 1] });
        if (ma25.length > 0) c.MA25시리즈.update({ time: targetCandleTime, value: ma25[ma25.length - 1] });
        if (ma99.length > 0) c.MA99시리즈.update({ time: targetCandleTime, value: ma99[ma99.length - 1] });
    });
}

// 실시간 호가창(Depth) 수신 핸들러
function 실시간호가메시지파싱(data, symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    // 바이낸스 depth5 페이로드 규격: bids: [[가격, 잔량], ...], asks: [[가격, 잔량], ...]
    coin.호가매도 = data.asks || [];
    coin.호가매수 = data.bids || [];

    // 현재 보고 있는 코인일 경우 호가창 실시간 렌더링
    if (symbol === 상태.기본코인) {
        호가창렌더링실제(coin);
    }
}

function 호가창렌더링실제(coin) {
    const asksEl = document.getElementById("orderbook-asks");
    const bidsEl = document.getElementById("orderbook-bids");
    if (!asksEl || !bidsEl) return;

    // 매도 호가 5개 렌더링 (Asks - 하향 역순 배열)
    const asks = [...coin.호가매도].slice(0, 5).reverse();
    업데이트호가목록(asksEl, asks, coin, "text-red", true);

    // 매수 호가 5개 렌더링 (Bids)
    const bids = [...coin.호가매수].slice(0, 5);
    업데이트호가목록(bidsEl, bids, coin, "text-green", false);

    // 스프레드 실시간 연산
    if (coin.호가매도.length > 0 && coin.호가매수.length > 0) {
        const 최고매수 = parseFloat(coin.호가매수[0][0]);
        const 최저매도 = parseFloat(coin.호가매도[0][0]);
        const 스프레드 = 최저매도 - 최고매수;
        const 스프레드율 = (스프레드 / coin.현재가 * 100).toFixed(4);
        
        const spreadEl = document.getElementById("orderbook-spread-value");
        if (spreadEl) {
            spreadEl.innerText = \`스프레드: \${스프레드.toFixed(coin.소수점)} (\${스프레드율}%)\`;
        }
    }
}

function 업데이트호가목록(containerEl, data, coin, 가격클래스, isAsk) {
    const rows = containerEl.querySelectorAll(".orderbook-row");
    if (rows.length === 0 || data.length === 0) return;

    let 누적 = 0;
    const 총누적 = data.slice(0, 5).reduce((acc, curr) => acc + parseFloat(curr[1]), 0);

    data.slice(0, 5).forEach((item, idx) => {
        if (idx >= rows.length) return;

        const 가격 = parseFloat(item[0]);
        const 잔량 = parseFloat(item[1]);
        누적 += 잔량;
        const 뎁스백분율 = 총누적 > 0 ? (누적 / 총누적 * 100).toFixed(1) : 0;

        const row = rows[idx];
        row.setAttribute("onclick", \`호가클릭(\${가격.toFixed(coin.소수점)})\`);

        const depthBar = row.querySelector(".depth-bar");
        if (depthBar) {
            depthBar.style.width = \`\${뎁스백분율}%\`;
        }

        const priceSpan = row.querySelector(".price-val");
        if (priceSpan) {
            priceSpan.className = \`price-val \${가격클래스}\`;
            const formattedPrice = 가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            if (priceSpan.textContent !== formattedPrice) {
                priceSpan.textContent = formattedPrice;
            }
        }

        const sizeSpan = row.querySelector(".size-val");
        if (sizeSpan) {
            const formattedSize = 잔량.toFixed(coin.수량소수점);
            if (sizeSpan.textContent !== formattedSize) {
                sizeSpan.textContent = formattedSize;
            }
        }

        const totalSpan = row.querySelector(".total-val");
        if (totalSpan) {
            const formattedTotal = 누적.toFixed(1);
            if (totalSpan.textContent !== formattedTotal) {
                totalSpan.textContent = formattedTotal;
            }
        }
    });
}

// 호가 클릭 시 가격 자동 입력
window.호가클릭 = function(price) {
    const triggerInput = document.getElementById("input-trigger-price");
    if (triggerInput) {
        triggerInput.value = price;
        주문비용재연산();
    }
};

`;

const finalContent = beforePart + pristineRealtime + afterPart;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 실시간 메시지 파싱 및 호가창 렌더러 영역이 정화되었습니다!');
