Created At: 2026-05-28T23:10:05Z
Completed At: 2026-05-28T23:10:05Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 1493
Total Bytes: 63878
Showing lines 1300 to 1493
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
function 실시간포지션PNL업데이트() {
    상태.활성포지션.forEach(pos => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin) return;

        const 현재가 = coin.현재가;
        const pnl = pos.미실현손익 || 0;
        const pnlPct = pos.수익률 || 0;
        
        const pnlClass = pnl >= 0 ? "text-green" : "text-red";
        const sign = pnl >= 0 ? "+" : "";

        const priceEl = document.getElementById(`pos-mark-price-${pos.아이디}`);
        const pnlEl = document.getElementById(`pos-pnl-${pos.아이디}`);

        if (priceEl) priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.so수점 || coin.소수점 });
        if (pnlEl) {
            pnlEl.innerText = `${sign}${pnl.toFixed(2)} USDT (${sign}${pnlPct.toFixed(2)}%)`;
            pnlEl.className = `${pnlClass}`;
        }
    });
}

window.수동포지션종료 = function(idx) {
    if (confirm("선택한 포지션을 즉시 시장가로 종료하여 실현 손익을 정산하시겠습니까?")) {
        const pos = 상태.활성포지션[idx];
        const coin = 상태.코인목록[pos.심볼];
        포지션종료실행(idx, coin.현재가, "수동 시장가 종료");
    }
};

// 대기 주문 테이블 렌더링
function 대기주문테이블렌더링() {
    const tbody = document.getElementById(
<truncated 6416 bytes>

function 화면업데이트() {
    상태바업데이트();
    주문비용재연산();
}

// 신호 알림창에 신호 카드 삽입
function 새신호알림(symbol, msg, type) {
    const listEl = document.getElementById("signal-feed-list");
    if (!listEl) return;

    const time = 얻는현재시각텍스트().split(" ")[1]; // 시:분:초 추출
    
    const item = document.createElement("div");
    item.className = `signal-item ${type}`;
    item.innerHTML = `
        <span class="signal-time"><i class="fa-solid fa-coins" style="margin-right:4px;"></i> ${symbol} perpetual | ${time}</span>
        <span class="signal-msg">${msg}</span>
    `;

    // 최상단에 배치
    listEl.insertBefore(item, listEl.firstChild);

    // 알림 카드가 너무 많으면 삭제 (최대 50개 유지)
    if (listEl.children.length > 50) {
        listEl.removeChild(listEl.lastChild);
    }
}

// 시각 텍스트 연출 헬퍼
function 얻는현재시각텍스트() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 효과음 재생 헬퍼 (Sound Trigger)
function 재생효과음(audioId) {
    const audio = document.getElementById(audioId);
    if (audio) {
        audio.currentTime = 0; // 재생 포인터 초기화
        audio.play().catch(e => {
            // 브라우저 자동 재생 제한 정책 대비 예외 무시
            console.log("오디오 자동 재생이 차단되었습니다:", e.message);
        });
    }
}

The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
