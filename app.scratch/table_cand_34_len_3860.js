Created At: 2026-05-28T23:10:02Z
Completed At: 2026-05-28T23:10:02Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 1493
Total Bytes: 63878
Showing lines 1010 to 1300
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.

    // I. 초기화 리셋 버튼
    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("모든 모의 자산과 포지션을 처음 상태로 리셋하시겠습니까?")) {
            상태.지갑잔고 = 10000.00;
            상태.마진잔고 = 10000.00;
            상태.미실현손익 = 0.00;
            상태.대기주문 = [];
            상태.활성포지션 = [];
            상태.거래이력 = [];
            
            새신호알림(상태.기본코인, "[시스템 초기화] 시뮬레이션 자산 및 거래 내역이 성공적으로 초기화되었습니다.", "execution");
            
            화면업데이트();
            대기주문테이블렌더링();
            활성포지션테이블렌더링();
            거래이력테이블렌더링();
        }
    });

    // J. 주문 패널 탭 (자동 체결 vs 시장가 거래) 전환
    document.querySelectorAll(".order-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".order-tab").forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            
            const orderType = e.target.dataset.type;
            const triggerPriceGroup = document.getElementById("trigger-price-group");
            const submitBtn = document.getElementById("btn-submit-order");

<truncated 11086 bytes>
 ? "long" : "short";

        html += `
            <tr>
                <td style="font-weight:700;">${pos.심볼}</td>
                <td><span class="badge-position-type ${badgeClass}">${pos.방향}</span></td>
                <td class="text-yellow" style="font-weight:600;">${pos.레버리지}x</td>
                <td style="font-family:var(--font-display);">${pos.수량.toFixed(coin.수량소수점)}</td>
                <td style="font-family:var(--font-display);">${pos.진입가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</td>
                <td id="pos-mark-price-${pos.아이디}" style="font-family:var(--font-display);">${현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</td>
                <td class="text-red" style="font-family:var(--font-display); font-weight:600;">${pos.청산가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</td>
                <td style="font-family:var(--font-display);">${pos.투입마진.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="pos-pnl-${pos.아이디}" class="${pnlClass} font-display" style="font-weight:700; font-family:var(--font-display);">
                    ${sign}${pnl.toFixed(2)} USDT (${sign}${pnlPct.toFixed(2)}%)
                </td>
                <td>
                    <button class="btn-table-close" onclick="수동포지션종료(${idx})">시장가 종료</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 실시간 활성 포지션 PNL 텍스트 리프레시 (매 초 갱신 최적화)
function 실시간포지션PNL업데이트() {
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
