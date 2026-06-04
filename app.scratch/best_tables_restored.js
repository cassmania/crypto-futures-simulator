Created At: 2026-05-29T15:03:22Z
Completed At: 2026-05-29T15:03:22Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 3901
Total Bytes: 177791
Showing lines 2119 to 2180
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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
        const badgeClass = pos.방향 === "LONG" ? "long" : "short";

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
                    <button class="btn-table-close" onclick="수동포지션종료(${idx})">시장가 정산</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

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

The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
