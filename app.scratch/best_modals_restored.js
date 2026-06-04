Created At: 2026-05-29T17:10:20Z
Completed At: 2026-05-29T17:10:20Z
File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
Total Lines: 4691
Total Bytes: 227029
Showing lines 4400 to 4600
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
                const distClass = 괴리율 < 0.5 ? "distance-warning-blink" : "";
                const badgeClass = order.방향 === "LONG" ? "long" : "short";

                radarHtml += `
                    <tr>
                        <td style="font-weight:700;">${order.심볼}</td>
                        <td><span class="badge-position-type ${badgeClass}">${order.방향}</span></td>
                        <td style="font-weight:600; color:var(--color-yellow);">${order.레버리지}x</td>
                        <td style="font-family:var(--font-display);">${order.타점가격.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                        <td style="font-family:var(--font-display);">${현재가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                        <td><span class="${distClass}">${괴리율.toFixed(2)}%</span></td>
                        <td>
                            <button class="btn-table-close" onclick="대기주문취소(${order.아이디})" style="padding: 2px 6px; font-size:10px;">취소</button>
                        </td>
                    </tr>
                `;
            });
            radarBody.innerHTML = radarHtml;
        }
    }

    // B. 우측: 코인별 레버리지 일괄 현황 맵 렌더링
    const mapContainer = document.getElementById("leverage-map-container");
    if
<truncated 7487 bytes>
 danger"><i class="fa-solid fa-arrow-trend-down"></i> Stochastic K<D 이탈세</span>`;
    }

    // 6. VWAP 괴리
    if (coin.현재가 >= vwapVal) {
        factsHtml += `<span class="fact-badge success"><i class="fa-solid fa-up-long"></i> VWAP 거래량 가중 지지</span>`;
    } else {
        factsHtml += `<span class="fact-badge danger"><i class="fa-solid fa-down-long"></i> VWAP 저항 구간 대치</span>`;
    }

    // 7. 피보나치 골든존
    const 피보나치골든존 = coin.현재가 <= fiboLevels["50.0%"] && coin.현재가 >= fiboLevels["61.8%"];
    if (피보나치골든존) {
        factsHtml += `<span class="fact-badge success"><i class="fa-solid fa-gem"></i> 피보나치 61.8% 골든 지지</span>`;
    } else {
        factsHtml += `<span class="fact-badge info"><i class="fa-solid fa-arrows-spin"></i> 피보나치 채널 추적 중</span>`;
    }

    // 8. VPVR POC
    if (coin.현재가 >= vpvrPOC) {
        factsHtml += `<span class="fact-badge success"><i class="fa-solid fa-layer-group"></i> POC 매물 지지대 상회</span>`;
    } else {
        factsHtml += `<span class="fact-badge danger"><i class="fa-solid fa-layer-group"></i> POC 매물 저항대 직면</span>`;
    }

    factsContainer.innerHTML = factsHtml;
};

// ==========================================================================
// ⚡ 독립 위젯 팝아웃(Widget Popout) & 회수(Recall) 관리 엔진
// ==========================================================================
window.실시간신호팝업 = null;
window.타점레버리지팝업 = null;
window.퀀트분석팝업 = null;

// 위젯 분리 실행 함수
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
