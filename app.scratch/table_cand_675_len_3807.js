Created At: 2026-05-29T21:24:20Z
Completed At: 2026-05-29T21:24:20Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 3603
Total Bytes: 145284
Showing lines 1020 to 1150
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.

    대기주문테이블렌더링();
    상태바업데이트();
    화면업데이트();

    // 입력폼 리셋
    document.getElementById("input-trigger-price").value = "";
    document.getElementById("input-quantity").value = "0.1";
    document.getElementById("input-tp-price").value = "";
    document.getElementById("input-sl-price").value = "";
    document.getElementById("chk-tpsl").checked = false;
    document.getElementById("tpsl-inputs-container").classList.add("hidden");
    주문비용재연산();
}

// 12. 테이블 렌더링 인터페이스 (Table Renders)

function 활성포지션테이블렌더링() {
    const tbody = document.getElementById("positions-table-body");
    if (!tbody) return;

    if (상태.활성포지션.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 활성화된 포지션이 없습니다.</td>
            </tr>
        `;
        return;
    }

    let html = "";
    상태.활성포지션.forEach((pos, idx) => {
        const coin = 상태.코인목록[pos.심볼];
        const 현재가 = coin ? coin.현재가 : pos.진입가;
        
        const pnl = pos.미실현손익 || 0;
        const pnlPct = pos.수익률 || 0;
        
        const pnlClass = pnl >= 0 ? "text-gr
<truncated 3108 bytes>
.수동포지션종료 = function(idx) {
    if (confirm("선택한 포지션을 현재 바이낸스 시장가로 즉시 정산 종료하시겠습니까?")) {
        const pos = 상태.활성포지션[idx];
        const coin = 상태.코인목록[pos.심볼];
        포지션종료실행(idx, coin.현재가, "사용자 시장가 정산");
    }
};

function 대기주문테이블렌더링() {
    const tbody = document.getElementById("pending-orders-table-body");
    if (!tbody) return;

    if (상태.대기주문.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 대기 중인 자동 체결 주문이 없습니다.</td>
            </tr>
        `;
        return;
    }

    let html = "";
    상태.대기주문.forEach((ord, idx) => {
        const coin = 상태.코인목록[ord.심볼];
        const badgeClass = ord.방향 === "LONG" ? "long" : "short";
        
        let tpslText = "설정 안 함";
        if (ord.익절가 > 0 || ord.손절가 > 0) {
            tpslText = `TP: ${ord.익절가 > 0 ? ord.익절가.toLocaleString() : '-'} | SL: ${ord.손절가 > 0 ? ord.손절가.toLocaleString() : '-'}`;
        }

        html += `
            <tr>
                <td style="font-weight:700;">${ord.심볼}</td>
    else if (rsiVal >= 65) 점수 -= 10; // 과매수

    // B. MACD 분석 (가중치 15점)
    if (현재MACD > 현재MACD시그널) {
        점수 += 8;
        if (현재MACD히스토그램 > 0) 점수 += 7; // 골든크로스 + 히스토그램 확장
    } else {
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
