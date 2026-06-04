const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 꼬임 부분 찾기
// '// 6. 바이낸스 WebSocket 실시간 스트리밍 시스템 (WebSocket Combined streams Engine)' 부터 
// 'function 실시간캔들메시지파싱(data) {' 까지의 블록을 찾습니다.

const searchStart = '// 6. 바이낸스 WebSocket 실시간 스트리밍 시스템 (WebSocket Combined streams Engine)';
const searchEnd = 'function 실시간캔들메시지파싱(data) {';

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd, startIdx + searchStart.length);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + searchEnd.length);

    const replacement = `// 6. 바이낸스 WebSocket 실시간 스트리밍 시스템 (WebSocket Combined streams Engine)
function 바이낸스웹소켓연결() {
    if (상태.웹소켓인스턴스) {
        try {
            상태.웹소켓인스턴스.close();
        } catch (e) {}
    }

    // 현재 감시 중인 모든 알트코인의 kline(1m) 및 depth5(호가창) 스트림 배열 구성
    const activeSymbols = Object.keys(상태.코인목록);
    let streams = [];
    activeSymbols.forEach(symbol => {
        const lower = symbol.toLowerCase();
        streams.push(\`\${lower}@kline_1m\`);
        streams.push(\`\${lower}@depth5@100ms\`);
    });

    if (streams.length === 0) return;

    const streamUrl = \`wss://fstream.binance.com/stream?streams=\${streams.join("/")}\`;
    console.log(\`[Binance WS] Combined streams 연결 시도: \${streamUrl}\`);

    try {
        상태.웹소켓인스턴스 = new WebSocket(streamUrl);
        상태.웹소켓연결상태 = false;
    } catch (err) {
        console.error("[Binance WS] 웹소켓 생성 실패:", err);
        // 5초 후 재시도
        if (상태.재연결타이머) clearTimeout(상태.재연결타이머);
        상태.재연결타이머 = setTimeout(바이낸스웹소켓연결, 5000);
        return;
    }

    상태.웹소켓인스턴스.onopen = () => {
        console.log("[Binance WS] 실시간 웹소켓 엔진 연결 성공!");
        상태.웹소켓연결상태 = true;
        
        // 연결 지표 상태 표시 업데이트
        const wsStatusIndicator = document.getElementById("ws-status");
        if (wsStatusIndicator) {
            wsStatusIndicator.className = "indicator-dot active";
            wsStatusIndicator.title = "바이낸스 실시간 엔진 온라인";
        }
    };

    상태.웹소켓인스턴스.onmessage = (event) => {
        const 패킷 = JSON.parse(event.data);
        
        // Combined streams 규격 파싱: { stream: "btcusdt@kline_1m", data: { ... } }
        if (!패킷.stream || !패킷.data) return;

        const streamName = 패킷.stream;
        
        // A. 실시간 K라인 캔들 데이터 수신 채널 파싱
        if (streamName.includes("kline")) {
            실시간캔들메시지파싱(패킷.data);
        }

        // B. 실시간 Depth 호가창 데이터 수신 채널 파싱
        if (streamName.includes("depth")) {
            실시간호가메시지파싱(패킷.data, streamName.split("@")[0].toUpperCase());
        }
    };

    상태.웹소켓인스턴스.onclose = () => {
        console.warn("[Binance WS] 실시간 웹소켓 연결 해제됨. 5초 후 자동으로 재연결을 기동합니다.");
        상태.웹소켓연결상태 = false;
        
        const wsStatusIndicator = document.getElementById("ws-status");
        if (wsStatusIndicator) {
            wsStatusIndicator.className = "indicator-dot inactive";
            wsStatusIndicator.title = "바이낸스 실시간 엔진 오프라인";
        }

        if (상태.재연결타이머) clearTimeout(상태.재연결타이머);
        상태.재연결타이머 = setTimeout(() => {
            바이낸스웹소켓연결();
        }, 5000);
    };

    상태.웹소켓인스턴스.onerror = (err) => {
        console.error("[Binance WS] 웹소켓 에러 발생:", err);
    };
}

// 동적 알트코인 추가 시, 새로운 스트림 목록을 구성하여 웹소켓 재접속 (Hot-Swap)
function 웹소켓스트림갱신() {
    console.log("[Binance WS] 스트림 변경 발생. 소켓 재접속 처리 시작...");
    바이낸스웹소켓연결();
}

// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)

// Kline 실시간 수신 핸들러 (8분할 실시간 틱 갱신 및 1m 신호 감지 병합)
function 실시간캔들메시지파싱(data) {`;

    fs.writeFileSync(filePath, before + replacement + after, 'utf8');
    console.log('[SUCCESS] Websocket and stream block successfully patched!');
} else {
    console.log('[FAIL] Could not locate websocket block or parsing block.');
}
