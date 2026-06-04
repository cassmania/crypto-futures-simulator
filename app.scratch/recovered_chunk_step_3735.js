"// 6. 바이낸스 WebSocket 실시간 스트리밍 시스템 (WebSocket Combined streams Engine)
function 바이낸스웹소켓연결() {
    if (상태.웹소켓인스턴스) {
        try {
            상태.웹소켓인스턴스.close();
        } catch (e) {}
    }

    // 현재 감시 중인 모든 알트코인의 kline(1m) 및 depth5(호가창) 스트림 배열 구성
    const activeSymbo// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)

// Kline 실시간 수신 핸들러 (8분할 실시간 틱 갱신 및 1m 신호 감지 병합)
function 실시간캔들메시지파싱(data) {"