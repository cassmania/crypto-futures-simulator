Created At: 2026-05-29T21:25:08Z
Completed At: 2026-05-29T21:25:08Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 3600
Total Bytes: 144596
Showing lines 1030 to 1180
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.


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
        
        const pnlClass = pnl >= 0 ? "text-green" : "text-red";
        const sign = pnl >= 0 ? "+" : "";
        const
                <td class="text-yellow" style="font-weight:600;">${pos.레버리지}x</td>
                <td style="font-family:var(--font-display);">${pos.수량.toFixed(coin.수량소수점)}</td>
                <td style="font-family:var(--font-display);">${pos.진입가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</td>
                <td id="pos-mark-price-${pos.아이디}" style="font-family:var(--font-display);">${현재가.toLocaleString(undefined, { 
<truncated 3923 bytes>
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
        점수 -= 8;
        if (현재MACD히스토그램 < 0) 점수 -= 7; // 데드크로스 + 히스토그램 하락
    }

    // C. SMA 추세 분석 (가중치 10점)
    const 이평정배열 = ma7 > ma25 && ma25 > ma99;
    const 이평역배열 = ma7 < ma25 && ma25 < ma99;
    tbody.innerHTML = html;
}

window.대기주문취소 = function(idx) {
    const ord = 상태.대기주문[idx];
    새신호알림(ord.심볼, `[주문 예약 취소] 타점 ${ord.타점가격.toLocaleString()} USDT 지정 주문이 정상 취소되었습니다.`, "neutral");
    상태.대기주문.splice(idx, 1);
    
    // 로컬 스토리지에 대기 주문 취소 상태 반영 및 저장
    모의매매상태저장();
    
    대기주문테이블렌더링();
    상태바업데이트();
    화면업데이트();
};

function 거래이력테이블렌더링() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    if (상태.거래이력.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 거래 이력이 존재하지 않습니다.</td>
            </tr>
        `;
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
