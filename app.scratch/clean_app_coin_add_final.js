const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
const content = fs.readFileSync(filePath, 'utf8');

const normalizedContent = content.replace(/\r\n/g, '\n');
const lines = normalizedContent.split('\n');

// 1-indexed 라인 지정
const startIdx = 894;  // 'async function 코인추가액션() {'
const endIdx = 1034;   // 'window.코인탭전환' 직전의 중괄호 닫는 부분

const replacement = `async function 코인추가액션() {
    const inputEl = document.getElementById("new-coin-symbol");
    if (!inputEl) return;
    const rawSymbol = inputEl.value.trim().toUpperCase();
    if (!rawSymbol) return;

    // 바이낸스 규격 USDT 페어로 강제 매핑
    const symbol = rawSymbol.endsWith("USDT") ? rawSymbol : rawSymbol + "USDT";

    if (상태.코인목록[symbol]) {
        alert("이미 목록에 등록되어 있는 코인입니다.");
        return;
    }

    const 자동매매활성화 = false;

    // 임시 신규 코인 메모리 로드 (Perpetual 이름 적용)
    상태.코인목록[symbol] = {
        심볼: symbol,
        이름: \`\${symbol.replace("USDT", "")}/USDT Perpetual\`,
        현재가: 10.00,
        어제종가: 9.80,
        최고24h: 10.20,
        최저24h: 9.70,
        캔들데이터: [],
        호가매도: [],
        호가매수: [],
        소수점: 3,
        수량소수점: 2,
        자동매매활성화: 자동매매활성화
    };

    // 알트코인에 따른 소수점 규격 최적화 보정
    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
        상태.코인목록[symbol].소수점 = 5;
        상태.코인목록[symbol].수량소수점 = 0;
    } else if (symbol.startsWith("BTC") || symbol.startsWith("ETH")) {
        상태.코인목록[symbol].소수점 = 2;
        상태.코인목록[symbol].수량소수점 = 3;
    } else {
        상태.코인목록[symbol].소수점 = 3;
        상태.코인목록[symbol].수량소수점 = 2;
    }

    // 4분할 과거 데이터 REST API 요청 비동기 병렬 가동 전, 분할 차트 객체들의 코인심볼을 먼저 셋팅
    상태.차트객체.분할차트들.forEach((c, idx) => {
        c.코인심볼 = symbol;
    });

    const 로드프로미스들 = 상태.차트객체.분할차트들.map((_, idx) => {
        return 분할차트캔들데이터로드(idx);
    });
    
    await Promise.all(로드프로미스들);

    // 만약 잘못된 코인이어서 리포지토리에서 데이터 유실 처리되었으면 중단
    if (!상태.코인목록[symbol]) {
        inputEl.value = "";
        return;
    }

    // 성공적으로 데이터 적재되었으므로 localStorage에 영구 박제!
    try {
        localStorage.setItem("선물시뮬레이터_추가코인", JSON.stringify(Object.keys(상태.코인목록)));
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("localStorage 저장 실패:", e);
    }

    // 폼 잔상 제거: 신규 코인 추가 시에도 주문 폼 가격 잔상(1.409 등)이 꽂히지 않도록 즉각 리셋
    document.getElementById("input-trigger-price").value = "";
    document.getElementById("input-quantity").value = "0.1";
    document.getElementById("input-tp-price").value = "";
    document.getElementById("input-sl-price").value = "";
    document.getElementById("chk-tpsl").checked = false;
    document.getElementById("tpsl-inputs-container").classList.add("hidden");
    
    // AI추천캐시 초기화
    AI추천캐시.방향 = "LONG";
    AI추천캐시.진입가 = 0;
    AI추천캐시.익절가 = 0;
    AI추천캐시.손절가 = 0;
    AI추천캐시.지지선 = 0;
    AI추천캐시.저항선 = 0;
    
    주문비용재연산();

    // WebSocket 갱신 가동 (핫스왑)
    웹소켓스트림갱신();

    inputEl.value = "";
    
    // UI 리프레시 및 강제 탭 포커스 이동
    코인탭렌더링();
    if (typeof window.차트선택기목록동적갱신 === 'function') {
        window.차트선택기목록동적갱신();
    }
    await 코인탭전환(symbol);
}`;

const keptLines = [];
lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (lineNum >= startIdx && lineNum <= endIdx) {
        if (lineNum === startIdx) {
            keptLines.push(replacement);
        }
    } else {
        keptLines.push(line);
    }
});

fs.writeFileSync(filePath, keptLines.join('\n'), 'utf8');
console.log("[SUCCESS] Reconstructed 코인추가액션 and stripped duplicate blocks cleanly!");
