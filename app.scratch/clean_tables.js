const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (테이블 렌더러 시작)
// 띄어쓰기나 주석 형식에 구애받지 않도록 단어 자체로 매칭
const startKeywords = [
    '활성포지션테이블렌더링',
    '대기주문테이블렌더링'
];

let startIdx = -1;
for (const kw of startKeywords) {
    const idx = content.indexOf(kw);
    if (idx !== -1) {
        // 단어가 시작된 위치 근처의 'function ' 혹은 주석 시작 부분으로 startIdx 보정
        // 단어 시작점 앞의 100자 정도를 뒤로 탐색해 'function'이나 '// 12.' 위치를 잡음
        const searchRange = content.substring(Math.max(0, idx - 150), idx);
        const funcIdx = searchRange.lastIndexOf('function');
        if (funcIdx !== -1) {
            startIdx = Math.max(0, idx - 150) + funcIdx;
        } else {
            const commentIdx = searchRange.lastIndexOf('//');
            if (commentIdx !== -1) {
                startIdx = Math.max(0, idx - 150) + commentIdx;
            } else {
                startIdx = idx;
            }
        }
        console.log(`Found start keyword: "${kw}" at index ${idx}, startIdx resolved to ${startIdx}`);
        break;
    }
}

if (startIdx === -1) {
    console.error("[FAIL] Could not find any start keyword in app.js");
    process.exit(1);
}

const beforePart = content.substring(0, startIdx);

const pristineTablesAndWidgets = `// 12. 테이블 데이터 렌더러 정의 (Grid Tables Renderers)
function 활성포지션테이블렌더링() {
    const tbody = document.getElementById("positions-table-body");
    if (!tbody) return;

    if (상태.활성포지션.length === 0) {
        tbody.innerHTML = \`
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 활성화된 포지션이 없습니다.</td>
            </tr>
        \`;
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

        html += \`
            <tr>
                <td style="font-weight:700;">\${pos.심볼}</td>
                <td><span class="badge-position-type \${badgeClass}">\${pos.방향}</span></td>
                <td class="text-yellow" style="font-weight:600;">\${pos.레버리지}x</td>
                <td style="font-family:var(--font-display);">\${pos.수량.toFixed(coin ? coin.수량소수점 : 2)}</td>
                <td style="font-family:var(--font-display);">\${pos.진입가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                <td id="pos-mark-price-\${pos.아이디}" style="font-family:var(--font-display);">\${현재가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                <td class="text-red" style="font-family:var(--font-display); font-weight:600;">\${pos.청산가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                <td style="font-family:var(--font-display);">\${pos.투입마진.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="pos-pnl-\${pos.아이디}" class="\${pnlClass} font-display" style="font-weight:700; font-family:var(--font-display);">
                    \${sign}\${pnl.toFixed(2)} USDT (\${sign}\${pnlPct.toFixed(2)}%)
                </td>
                <td>
                    <button class="btn-table-close" onclick="수동포지션종료(\${idx})">시장가 정산</button>
                </td>
            </tr>
        \`;
    });
    tbody.innerHTML = html;
}

function 실시간포지션PNL업데이트() {
    상태.활성포지션.forEach(pos => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin) return;

        const 현재가 = coin.현재가;
        let pnl = 0;
        if (pos.방향 === "LONG") {
            pnl = (현재가 - pos.진입가) * pos.수량;
        } else {
            pnl = (pos.진입가 - 현재가) * pos.수량;
        }
        
        pos.미실현손익 = pnl;
        pos.수익률 = (pnl / pos.투입마진) * 100;
        
        const pnlClass = pnl >= 0 ? "text-green" : "text-red";
        const sign = pnl >= 0 ? "+" : "";

        const priceEl = document.getElementById(\`pos-mark-price-\${pos.아이디}\`);
        const pnlEl = document.getElementById(\`pos-pnl-\${pos.아이디}\`);

        if (priceEl) {
            priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        }
        if (pnlEl) {
            pnlEl.innerText = \`\${sign}\${pnl.toFixed(2)} USDT (\${sign}\${pos.수익률.toFixed(2)}%)\`;
            pnlEl.className = \`\${pnlClass} font-display\`;
        }
    });
}

window.수동포지션종료 = function(idx) {
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
        tbody.innerHTML = \`
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 대기 중인 자동 체결 주문이 없습니다.</td>
            </tr>
        \`;
        return;
    }

    let html = "";
    상태.대기주문.forEach((ord, idx) => {
        const coin = 상태.코인목록[ord.심볼];
        const badgeClass = ord.방향 === "LONG" ? "long" : "short";
        
        let tpslText = "설정 안 함";
        if (ord.익절가 > 0 || ord.손절가 > 0) {
            tpslText = \`TP: \${ord.익절가 > 0 ? ord.익절가.toLocaleString() : '-'} | SL: \${ord.손절가 > 0 ? ord.손절가.toLocaleString() : '-'}\`;
        }

        html += \`
            <tr>
                <td style="font-weight:700;">\${ord.심볼}</td>
                <td><span class="badge-position-type \${badgeClass}">\${ord.방향}</span></td>
                <td class="text-yellow" style="font-weight:600;">\${ord.레버리지}x</td>
                <td style="font-family:var(--font-display);">\${ord.수량.toFixed(coin ? coin.수량소수점 : 2)}</td>
                <td style="font-family:var(--font-display);">\${ord.타점가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                <td style="font-size:11px; color:var(--text-muted);">\${tpslText}</td>
                <td>
                    <button class="btn-table-cancel" onclick="대기주문취소(\${idx})">취소</button>
                </td>
            </tr>
        \`;
    });
    tbody.innerHTML = html;
}

window.대기주문취소 = function(idx) {
    const ord = 상태.대기주문[idx];
    새신호알림(ord.심볼, \`[주문 예약 취소] 타점 \${ord.타점가.toLocaleString()} USDT 지정 주문이 정상 취소되었습니다.\`, "neutral");
    상태.대기주문.splice(idx, 1);
    
    모의매매상태저장();
    
    대기주문테이블렌더링();
    상태바업데이트();
    화면업데이트();
};

function 거래이력테이블렌더링() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    if (상태.거래이력.length === 0) {
        tbody.innerHTML = \`
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 거래 이력이 존재하지 않습니다.</td>
            </tr>
        \`;
        return;
    }

    let html = "";
    상태.거래이력.forEach(h => {
        const coin = 상태.코인목록[h.심볼];
        const decimal = coin ? coin.소수점 : 2;
        const pnlClass = h.실현손익 >= 0 ? "text-green" : "text-red";
        const sign = h.실현손익 >= 0 ? "+" : "";

        html += \`
            <tr>
                <td style="font-size:11px; color:var(--text-muted);">\text-muted \${h.시간}</td>
                <td style="font-weight:700;">\${h.심볼}</td>
                <td><span class="badge-position-type \${h.방향 === "LONG" ? "long" : "short"}">\${h.방향}</span></td>
                <td class="text-yellow" style="font-weight:600;">\${h.레버리지}x</td>
                <td style="font-family:var(--font-display);">\${h.진입가.toLocaleString(undefined, { minimumFractionDigits: decimal })}</td>
                <td style="font-family:var(--font-display);">\${h.종료가.toLocaleString(undefined, { minimumFractionDigits: decimal })}</td>
                <td style="font-family:var(--font-display);">\${h.수량.toFixed(coin ? coin.수량소수점 : 2)}</td>
                <td class="\${pnlClass} font-display" style="font-weight:700;">\${sign}\${h.실현손익.toFixed(2)} USDT</td>
                <td style="font-size:11px; color:var(--text-muted);">\${h.종료원인}</td>
            </tr>
        \`;
    });
    tbody.innerHTML = html;
}

// 20. 코인별 레버리지 일괄 현황 맵 렌더링 헬퍼
window.타점체결레버리지패널렌더링 = function() {
    const container = document.getElementById("leverage-map-container");
    const radarBody = document.getElementById("trigger-radar-body");
    if (!container || !radarBody) return;

    // A. 좌측: 대기 타점 레이더 렌더링
    if (상태.대기주문.length === 0) {
        radarBody.innerHTML = \`
            <tr class="empty-row">
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 15px 0;">
                    <i class="fa-solid fa-satellite-dish" style="margin-right: 6px;"></i> 대기 중인 레이더 타점이 없습니다.
                </td>
            </tr>
        \`;
    } else {
        radarBody.innerHTML = 상태.대기주문.map(ord => {
            const coin = 상태.코인목록[ord.심볼];
            const currPrice = coin ? coin.현재가 : ord.타점가;
            const diffPct = ((currPrice - ord.타점가) / ord.타점가 * 100);
            const absDiff = Math.abs(diffPct);
            const isNear = absDiff <= 0.5; // 괴리율 0.5% 미만 시 경보
            const alertClass = isNear ? "near-alert animate-pulse text-red" : "text-neutral";
            
            return \`
                <tr class="\${isNear ? 'bg-danger-subtle' : ''}">
                    <td style="font-weight: 700;">\${ord.심볼}</td>
                    <td><span class="badge-position-type \${ord.방향 === 'LONG' ? 'long' : 'short'}">\${ord.방향}</span></td>
                    <td class="font-display">\${ord.타점가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                    <td class="font-display">\${currPrice.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</td>
                    <td class="\${alertClass} font-display" style="font-weight: 700;">
                        \${diffPct >= 0 ? '+' : ''}\${diffPct.toFixed(2)}%
                    </td>
                </tr>
            \`;
        }).join('');
    }

    // B. 우측: 레버리지 맵 그리드 렌더링
    const coins = Object.keys(상태.코인목록);
    container.innerHTML = coins.map(sym => {
        const coin = 상태.코인목록[sym];
        const hasPos = 상태.활성포지션.some(p => p.심볼 === sym);
        
        let lev = 20;
        if (hasPos) {
            lev = 상태.활성포지션.find(p => p.심볼 === sym).레버리지;
        } else if (상태.코인별레버리지 && 상태.코인별레버리지[sym]) {
            lev = 상태.코인별레버리지[sym];
        }

        return \`
            <div class="leverage-card \${hasPos ? 'active-pos' : ''}">
                <div class="card-top">
                    <span class="card-symbol">\${sym.replace("USDT", "")}</span>
                    <span class="card-lev-val">\${lev}x</span>
                </div>
                <div class="card-actions">
                    <button class="btn-lev-dec" onclick="event.stopPropagation(); window.개별코인레버리지미세조정('\${sym}', -1)">-</button>
                    <button class="btn-lev-inc" onclick="event.stopPropagation(); window.개별코인레버리지미세조정('\${sym}', 1)">+</button>
                </div>
            </div>
        \`;
    }).join('');
};

window.개별코인레버리지미세조정 = function(symbol, delta) {
    if (!상태.코인별레버리지) 상태.코인별레버리지 = {};
    
    const hasPos = 상태.활성포지션.some(p => p.심볼 === symbol);
    if (hasPos) {
        const pos = 상태.활성포지션.find(p => p.심볼 === symbol);
        let newLev = pos.레버리지 + delta;
        newLev = Math.max(1, Math.min(125, newLev));
        pos.레버리지 = newLev;
        상태.코인별레버리지[symbol] = newLev;
        새신호알림(symbol, \`⚡ [레버리지 변경] 보유 포지션 레버리지가 \${newLev}x 로 미세조정 되었습니다.\`, "neutral");
    } else {
        let currentLev = 상태.코인별레버리지[symbol] || 20;
        let newLev = currentLev + delta;
        newLev = Math.max(1, Math.min(125, newLev));
        상태.코인별레버리지[symbol] = newLev;
        
        // 만약 메인 화면에서 선택 중인 기본 코인이라면 폼 슬라이더와 싱크
        if (symbol === 상태.기본코인) {
            const mainLev = document.getElementById("input-leverage");
            const levBadge = document.getElementById("leverage-badge");
            if (mainLev) {
                mainLev.value = newLev;
            }
            if (levBadge) {
                levBadge.innerText = newLev + "x";
            }
        }
        새신호알림(symbol, \`⚡ [주문 레버리지 변경] \${symbol}의 기본 레버리지가 \${newLev}x 로 설정되었습니다.\`, "neutral");
    }
    
    주문비용재연산();
    화면업데이트();
    모의매매상태저장();
};

window.AI자동매매버튼상태동기화 = function() {
    const activeCoin = 상태.코인목록[상태.기본코인];
    const aiBtn = document.getElementById("btn-toggle-ai");
    if (!aiBtn || !activeCoin) return;

    if (activeCoin.자동매매활성화) {
        aiBtn.innerHTML = '<i class="fa-solid fa-robot"></i> AI 자동매매 활성화됨';
        aiBtn.className = "btn-submit btn-ai-active";
    } else {
        aiBtn.innerHTML = '<i class="fa-solid fa-robot"></i> AI 자동매매 가동';
        aiBtn.className = "btn-submit btn-ai-inactive";
    }
};

// ====================================================
// 21. AI 자동매매 가동 승인 모달 제어 모듈 (AI Activation Modal Control Modules)
// ====================================================
window.AI자동매매가동승인모달열기 = function(symbol) {
    const activeCoin = 상태.코인목록[symbol];
    if (!activeCoin) return;

    const modal = document.getElementById("ai-settings-modal");
    if (!modal) return;

    // 모달 타겟 코인 심볼 주입
    const symbolEl = document.getElementById("ai-settings-symbol");
    if (symbolEl) symbolEl.innerText = symbol;

    // 슬라이더 초기값 세팅 (상태.자동매매설정 값 활용)
    const ratioSlider = document.getElementById("ai-slider-ratio");
    const leverageSlider = document.getElementById("ai-slider-leverage");
    const ratioVal = document.getElementById("ai-val-ratio");
    const leverageVal = document.getElementById("ai-val-leverage");

    const activeSettings = 상태.자동매매설정 || { 진입비율: 10, 익절옵션: "auto", 손절옵션: "auto" };

    const inputLeverage = document.getElementById("input-leverage");
    const currentLeverage = inputLeverage ? parseInt(inputLeverage.value) : 20;

    if (ratioSlider) {
        ratioSlider.value = activeSettings.진입비율 || 10;
        if (ratioVal) ratioVal.innerText = ratioSlider.value + "%";
    }
    if (leverageSlider) {
        leverageSlider.value = currentLeverage;
        if (leverageVal) leverageVal.innerText = leverageSlider.value + "x";
    }

    // 수치 실시간 갱신 계산 호출
    window.AI자동매매설정시뮬레이션갱신();

    // 모달 숨김 해제
    modal.classList.remove("hidden");
};

window.AI자동매매가동승인모달닫기 = function() {
    const modal = document.getElementById("ai-settings-modal");
    if (modal) modal.classList.add("hidden");
};

window.AI자동매매설정시뮬레이션갱신 = function() {
    const ratioSlider = document.getElementById("ai-slider-ratio");
    const leverageSlider = document.getElementById("ai-slider-leverage");
    const estMarginEl = document.getElementById("ai-est-margin");
    const estSizeEl = document.getElementById("ai-est-size");

    if (!ratioSlider || !leverageSlider) return;

    const ratio = parseInt(ratioSlider.value);
    const leverage = parseInt(leverageSlider.value);

    const targetMargin = 상태.지갑잔고 * (ratio / 100);
    const symbolEl = document.getElementById("ai-settings-symbol");
    const symbol = symbolEl ? symbolEl.innerText : 상태.기본코인;
    const coin = 상태.코인목록[symbol];
    const currPrice = coin ? coin.현재가 : 100;

    const qty = (targetMargin * leverage) / currPrice;

    if (estMarginEl) estMarginEl.innerText = targetMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    if (estSizeEl) estSizeEl.innerText = qty.toFixed(coin ? coin.수량소수점 : 2) + " " + symbol.replace("USDT", "");
};

// 슬라이더 및 아코디언 컨트롤러 등록
document.addEventListener("DOMContentLoaded", () => {
    const ratioSlider = document.getElementById("ai-slider-ratio");
    const leverageSlider = document.getElementById("ai-slider-leverage");
    const ratioVal = document.getElementById("ai-val-ratio");
    const leverageVal = document.getElementById("ai-val-leverage");

    if (ratioSlider && ratioVal) {
        ratioSlider.addEventListener("input", (e) => {
            ratioVal.innerText = e.target.value + "%";
            window.AI자동매매설정시뮬레이션갱신();
        });
    }

    if (leverageSlider && leverageVal) {
        leverageSlider.addEventListener("input", (e) => {
            leverageVal.innerText = e.target.value + "x";
            window.AI자동매매설정시뮬레이션갱신();
        });
    }
});

window.AI자동매매가동승인완료 = function() {
    const symbolEl = document.getElementById("ai-settings-symbol");
    if (!symbolEl) return;
    const symbol = symbolEl.innerText;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    const ratioSlider = document.getElementById("ai-slider-ratio");
    const leverageSlider = document.getElementById("ai-slider-leverage");
    
    const ratio = ratioSlider ? parseInt(ratioSlider.value) : 10;
    const leverage = leverageSlider ? parseInt(leverageSlider.value) : 20;

    // A. 전역 상태 갱신
    if (!상태.자동매매설정) 상태.자동매매설정 = {};
    상태.자동매매설정.진입비율 = ratio;
    상태.자동매매설정.익절옵션 = "auto";
    상태.자동매매설정.손절옵션 = "auto";

    if (!상태.코인별레버리지) 상태.코인별레버리지 = {};
    상태.코인별레버리지[symbol] = leverage;

    // B. 우측 주문 패널 레버리지 슬라이더 및 텍스트 갱신
    const inputLeverage = document.getElementById("input-leverage");
    const levBadge = document.getElementById("leverage-badge");
    if (inputLeverage) inputLeverage.value = leverage;
    if (levBadge) levBadge.innerText = leverage + "x";

    // C. AI 설정 아코디언 패널 내부 슬라이더 수치 동기화
    const accordionLevVal = document.getElementById("accordion-leverage-val");
    if (accordionLevVal) accordionLevVal.innerText = leverage + "x";

    // D. 자동매매 온처리 및 UI 리드로잉
    coin.자동매매활성화 = true;
    window.AI자동매매버튼상태동기화();
    window.AI자동매매가동승인모달닫기();

    // 효과음 및 알림 출력
    재생효과음("sound-trigger");
    새신호알림(symbol, \`⚡ [AI 자동매매 기동] \${symbol}의 퀀트 스코어링 분석 엔진이 시작되었습니다. (투입비율: \${ratio}%, 타점 배후 고정 레버리지: \${leverage}x)\`, "long");

    모의매매상태저장();
};

window.AI자동매매즉시정지 = function() {
    const symbolEl = document.getElementById("ai-settings-symbol");
    const symbol = symbolEl ? symbolEl.innerText : 상태.기본코인;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.자동매매활성화 = false;
    window.AI자동매매버튼상태동기화();
    window.AI자동매매가동승인모달닫기();

    새신호알림(symbol, \`🛑 [AI 자동매매 가동 중단] \${symbol}의 자동 매매 운용이 즉시 중단 및 가드 정지되었습니다.\`, "short");
    
    모의매매상태저장();
};

// ==========================================================================
// ⚡ 독립 위젯 팝아웃(Widget Popout) & 회수(Recall) 관리 엔진
// ==========================================================================
window.실시간신호팝업 = null;
window.타점레버리지팝업 = null;
window.퀀트분석팝업 = null;

window.위젯분리실행 = function(widgetType) {
    let url = "";
    let popVar = "";
    let title = "";

    if (widgetType === "quant") {
        url = "widget_quant.html";
        popVar = "퀀트분석팝업";
        title = "초정밀 퀀트 분석 센터";
    } else if (widgetType === "signal") {
        url = "widget_signal.html";
        popVar = "실시간신호팝업";
        title = "글로벌 매매 신호 감지 피드";
    } else if (widgetType === "trigger") {
        url = "widget_trigger.html";
        popVar = "타점레버리지팝업";
        title = "대기 타점 레이더 & 레버리지 현황";
    }

    if (!url) return;

    // 메인 컨테이너 요소를 숨겨 레이아웃 동적 핫스왑 가동
    const containerMap = {
        "quant": "quant-analysis-container",
        "signal": "signal-feed-container",
        "trigger": "trigger-radar-container"
    };

    const targetEl = document.getElementById(containerMap[widgetType]);
    if (targetEl) {
        targetEl.classList.add("hidden");
        // 오버레이 표시
        const overlay = document.getElementById(\`widget-detached-overlay-\${widgetType}\`);
        if (overlay) overlay.classList.remove("hidden");
    }

    // 기존 팝업이 띄워져 있다면 포커스
    if (window[popVar] && !window[popVar].closed) {
        window[popVar].focus();
        return;
    }

    // 새 팝업 띄우기
    const w = 450;
    const h = 600;
    const left = (screen.width/2) - (w/2);
    const top = (screen.height/2) - (h/2);

    window[popVar] = window.open(url, popVar, \`width=\${w},height=\${h},top=\${top},left=\${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,status=no\`);
    
    새신호알림(상태.기본코인, \`🖥️ [위젯 팝아웃] \${title} 독립 위젯이 성공적으로 외부 분할 기동되었습니다.\`, "neutral");
};

window.위젯회수 = function(widgetType) {
    let popVar = "";
    if (widgetType === "quant") popVar = "퀀트분석팝업";
    else if (widgetType === "signal") popVar = "실시간신호팝업";
    else if (widgetType === "trigger") popVar = "타점레버리지팝업";

    if (window[popVar]) {
        try {
            window[popVar].close();
        } catch (e) {}
        window[popVar] = null;
    }

    const containerMap = {
        "quant": "quant-analysis-container",
        "signal": "signal-feed-container",
        "trigger": "trigger-radar-container"
    };

    const targetEl = document.getElementById(containerMap[widgetType]);
    if (targetEl) {
        targetEl.classList.remove("hidden");
        const overlay = document.getElementById(\`widget-detached-overlay-\${widgetType}\`);
        if (overlay) overlay.classList.add("hidden");
    }

    새신호알림(상태.기본코인, \`🖥️ [위젯 메인 복구] 분할 팝아웃 되었던 위젯이 메인 패널로 성공적으로 복귀 및 정렬되었습니다.\`, "neutral");
    
    // 복구 직후 렌더링 강제 업데이트
    화면업데이트();
};
`;

const finalContent = beforePart + pristineTablesAndWidgets;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 테이블 및 보조 패널 데이터 렌더러와 위젯/모달 영역이 완벽하게 전면 갱신되었습니다!');
