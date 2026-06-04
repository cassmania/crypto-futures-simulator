const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (QUANT CORE가 시작되는 부분)
// 띄어쓰기나 주석 형태에 영향 받지 않기 위해 함수명이나 '이미존' 찌꺼기 검색
const startKeywords = [
    'AI자동매매실행',
    '이미존'
];

let startIdx = -1;
for (const kw of startKeywords) {
    const idx = content.indexOf(kw);
    if (idx !== -1) {
        // 단어 시작점 앞의 150자 정도를 뒤로 탐색해 'function'이나 주석 '//' 위치를 잡음
        const searchRange = content.substring(Math.max(0, idx - 150), idx);
        const commentIdx = searchRange.lastIndexOf('//');
        if (commentIdx !== -1) {
            startIdx = Math.max(0, idx - 150) + commentIdx;
        } else {
            const funcIdx = searchRange.lastIndexOf('function');
            if (funcIdx !== -1) {
                startIdx = Math.max(0, idx - 150) + funcIdx;
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

// 2. 교환할 영역의 끝 인덱스 계산 (테이블 렌더러 시작 직전)
// '활성포지션테이블렌더링' 단어 자체로 매칭
const endIdx = content.indexOf('활성포지션테이블렌더링');

if (endIdx === -1) {
    console.error("[FAIL] Could not find '활성포지션테이블렌더링' in app.js");
    process.exit(1);
}

// 끝 인덱스를 'function 활성포지션테이블렌더링' 혹은 주석 '// 12.' 시작부로 보정
const searchRangeEnd = content.substring(Math.max(0, endIdx - 150), endIdx);
let endIdxResolved = endIdx;
const commentIdxEnd = searchRangeEnd.lastIndexOf('//');
if (commentIdxEnd !== -1) {
    endIdxResolved = Math.max(0, endIdx - 150) + commentIdxEnd;
} else {
    const funcIdxEnd = searchRangeEnd.lastIndexOf('function');
    if (funcIdxEnd !== -1) {
        endIdxResolved = Math.max(0, endIdx - 150) + funcIdxEnd;
    }
}

console.log(`Found end keyword '활성포지션테이블렌더링' at index ${endIdx}, endIdxResolved to ${endIdxResolved}`);

const beforePart = content.substring(0, startIdx);
const afterPart = content.substring(endIdxResolved);

const pristineQuantCore = `// AI 자동 매매 실제 포지션 진입 및 안전 마진/수량 연산 처리 엔진
function AI자동매매실행(symbol, 방향) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    // 1. 중복 포지션(Duplicate Position) 진입 방지 설정에 따른 조건부 가드(Guard) 적용
    if (상태.자동매매설정 && 상태.자동매매설정.중복방지) {
        const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === symbol);
        if (이미존재하는포지션) {
            return; // 이미 포지션이 열려 있으면 추가 진입 불가
        }
    }

    // 2. 사용자가 설정한 슬라이더의 레버리지(Leverage) 배수 동적 크롤링 (20배 강제 고정 보존 지원)
    let leverage = 20;
    if (상태.코인별레버리지 && 상태.코인별레버리지[symbol]) {
        leverage = 상태.코인별레버리지[symbol];
    } else {
        const mainLev = document.getElementById("input-leverage");
        leverage = mainLev ? parseInt(mainLev.value) : 20;
    }

    // 3. 사용자가 설정한 진입 비율(Entry Ratio)에 따른 가용 지갑 잔고 비례 투자
    const 진입비율 = 상태.자동매매설정 ? 상태.자동매매설정.진입비율 || 10 : 10;
    const targetMargin = 상태.지갑잔고 * (진입비율 / 100);
    const 진입가 = coin.현재가;

    let qty = (targetMargin * leverage) / 진입가;
    
    // 코인 고유 규격 소수점에 맞게 포맷 처리
    qty = parseFloat(qty.toFixed(coin.수량소수점));

    if (qty <= 0) {
        새신호알림(symbol, \`[🤖 AI 자동매매 실패] 계산된 수량(\${qty})이 거래 규격보다 작아 진입할 수 없습니다.\`, "short");
        return;
    }

    // 4. 안전 익절/손절(TP/SL) 자동 연동 가격 산출
    let 익절가 = 0;
    let 손절가 = 0;

    const 수동익절율 = 상태.자동매매설정 ? 상태.자동매매설정.수동익절율 || 10 : 10;
    const 수동손절율 = 상태.자동매매설정 ? 상태.자동매매설정.수동손절율 || 5 : 5;

    if (상태.자동매매설정 && 상태.자동매매설정.익절옵션 === "manual") {
        if (방향 === "LONG") {
            익절가 = coin.현재가 * (1 + 수동익절율 / 100);
        } else {
            익절가 = coin.현재가 * (1 - 수동익절율 / 100);
        }
    } else {
        // AI 정밀 자동 연산 (피보나치 되돌림 및 볼린저 밴드 연립 공식)
        const closes = coin.캔들데이터.map(c => c.close);
        const highs = coin.캔들데이터.map(c => c.high);
        const lows = coin.캔들데이터.map(c => c.low);
        const idx = closes.length - 1;
        const 최고가 = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
        const 최저가 = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
        const 변폭 = 최고가 - 최저가;

        if (방향 === "LONG") {
            익절가 = coin.현재가 + (변폭 * 0.382);
        } else {
            익절가 = coin.현재가 - (변폭 * 0.382);
        }
        익절가 = parseFloat(익절가.toFixed(coin.소수점));
    }

    if (상태.자동매매설정 && 상태.자동매매설정.손절옵션 === "manual") {
        if (방향 === "LONG") {
            손절가 = coin.현재가 * (1 - 수동손절율 / 100);
        } else {
            손절가 = coin.현재가 * (1 + 수동손절율 / 100);
        }
    } else {
        const closes = coin.캔들데이터.map(c => c.close);
        const lows = coin.캔들데이터.map(c => c.low);
        const highs = coin.캔들데이터.map(c => c.high);
        const idx = closes.length - 1;
        const 최고가 = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
        const 최저가 = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
        const 변폭 = 최고가 - 최저가;

        if (방향 === "LONG") {
            손절가 = coin.현재가 - (변폭 * 0.236);
        } else {
            손절가 = coin.현재가 + (변폭 * 0.236);
        }
        손절가 = parseFloat(손절가.toFixed(coin.소수점));
    }

    const 자동주문 = {
        심볼: symbol,
        방향: 방향,
        레버리지: leverage,
        수량: qty,
        타점가: 진입가,
        익절가: 익절가,
        손절가: 손절가
    };

    const 손절안내타입 = 상태.자동매매설정 && 상태.자동매매설정.손절옵션 === "manual" ? \`수동 \${수동손절율}%\` : "AI 가드";
    const 익절안내타입 = 상태.자동매매설정 && 상태.자동매매설정.익절옵션 === "manual" ? \`수동 \${수동익절율}%\` : "AI 타겟";

    새신호알림(symbol, \`[🤖 AI 자동매매 작동] \${방향} 매매 신호가 감지되어 가용자산의 \${진입비율}% (레버리지 \${leverage}x, 수량 \${qty})로 시장가 자동 포지션 진입합니다. (익절 TP: \${익절가} (\${익절안내타입}) | 손절 SL: \${손절가} (\${손절안내타입}))\`, 방향 === "LONG" ? "long" : "short");
    
    // 모의 포지션 실체결 등록 실행
    포지션체결실행(자동주문, 진입가);
}

// 10. 예약 주문 자동 체결 및 포지션 마진 연산 (Auto Order Exec & PNL Engine)
function 감시대기주문체결() {
    if (상태.대기주문.length === 0) return;

    let 체결된주문인덱스들 = [];

    상태.대기주문.forEach((주문, index) => {
        const coin = 상태.코인목록[주문.심볼];
        if (!coin) return;

        let 체결성공 = false;
        if (주문.방향 === "LONG") {
            if (coin.현재가 <= 주문.타점가) 체결성공 = true;
        } else {
            if (coin.현재가 >= 주문.타점가) 체결성공 = true;
        }

        if (체결성공) {
            체결된주문인덱스들.push(index);
            포지션체결실행(주문, coin.현재가);
        }
    });

    if (체결된주문인덱스들.length > 0) {
        상태.대기주문 = 상태.대기주문.filter((_, idx) => !체결된주문인덱스들.includes(idx));
        대기주문테이블렌더링();
        상태바업데이트();
    }
}

function 포지션체결실행(주문, 체결가) {
    const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === 주문.심볼);
    if (이미존재하는포지션) {
        새신호알림(주문.심볼, \`[체결 거부] \${주문.심볼}에 이미 활성화된 포지션이 존재합니다. 중복 진입이 제한됩니다.\`, "short");
        return;
    }

    const 증거금 = (주문.수량 * 체결가) / 주문.레버리지;

    if (상태.지갑잔고 < 증거금) {
        새신호알림(주문.심볼, \`[체결 취소] 잔고 부족으로 예약 주문이 자동 취소되었습니다. (필요 마진: \${증거금.toFixed(2)} USDT)\`, "short");
        return;
    }

    상태.지갑잔고 -= 증거금;

    // 청산가 연산 (유지마진비율 0.5% 가정)
    let 청산가 = 0;
    if (주문.방향 === "LONG") {
        청산가 = 체결가 * (1 - (1 / 주문.레버리지) + 0.005);
    } else {
        청산가 = 체결가 * (1 + (1 / 주문.레버리지) - 0.005);
    }

    const 신규포지션 = {
        아이디: 상태.포지션아이디카운터++,
        심볼: 주문.심볼,
        방향: 주문.방향,
        레버리지: 주문.레버리지,
        수량: 주문.수량,
        진입가: 체결가,
        투입마진: 증거금,
        청산가: parseFloat(청산가.toFixed(상태.코인목록[주문.심볼].소수점)),
        익절가: 주문.익절가,
        손절가: 주문.손절가,
        체결시간: 얻는현재시각텍스트()
    };

    상태.활성포지션.push(신규포지션);

    재생효과음("sound-trigger");
    새신호알림(주문.심볼, \`[체결 성공] 실시간가 \${체결가.toLocaleString()} USDT에 \${주문.방향} \${주문.레버리지}x 포지션이 체결되었습니다.\`, "execution");

    모의매매상태저장();

    활성포지션테이블렌더링();
    상태바업데이트();
    화면업데이트();
}

function 실시간포지션마진정산() {
    if (상태.활성포지션.length === 0) {
        상태.미실현손익 = 0.00;
        상태.마진잔고 = 상태.지갑잔고;
        const headerPnl = document.getElementById("header-unrealized-pnl");
        if (headerPnl) {
            headerPnl.innerText = "0.00 USDT (0.00%)";
            headerPnl.className = "info-value text-neutral";
        }
        return;
    }

    let 총미실현손익 = 0;
    let 청산또는손익종료된인덱스들 = [];

    상태.활성포지션.forEach((pos, index) => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin) return;

        let pnl = 0;
        if (pos.방향 === "LONG") {
            pnl = (coin.현재가 - pos.진입가) * pos.수량;
        } else {
            pnl = (pos.진입가 - coin.현재가) * pos.수량;
        }

        pos.미실현손익 = pnl;
        pos.수익률 = (pnl / pos.투입마진) * 100;
        총미실현손익 += pnl;

        // 1. 실제 가격 기반 청산 발생 감시
        let 청산발생 = false;
        if (pos.방향 === "LONG" && coin.현재가 <= pos.청산가) {
            청산발생 = true;
        } else if (pos.방향 === "SHORT" && coin.현재가 >= pos.청산가) {
            청산발생 = true;
        }

        if (청산발생) {
            청산또는손익종료된인덱스들.push({ index: index, 사유: "LIQUIDATED" });
            return;
        }

        // 2. 예약 익절/손절(TP/SL) 자동 감시 및 예약 종료
        let 예약종료발생 = false;
        let 예약종료정산가 = 0;

        if (pos.익절가 > 0) {
            if (pos.방향 === "LONG" && coin.현재가 >= pos.익절가) {
                예약종료발생 = true;
                예약종료정산가 = pos.익절가;
            } else if (pos.방향 === "SHORT" && coin.현재가 <= pos.익절가) {
                예약종료발생 = true;
                예약종료정산가 = pos.익절가;
            }
        }

        if (!예약종료발생 && pos.손절가 > 0) {
            if (pos.방향 === "LONG" && coin.현재가 <= pos.손절가) {
                예약종료발생 = true;
                예약종료정산가 = pos.손절가;
            } else if (pos.방향 === "SHORT" && coin.현재가 >= pos.손절가) {
                예약종료발생 = true;
                예약종료정산가 = pos.손절가;
            }
        }

        if (예약종료발생) {
            청산또는손익종료된인덱스들.push({ index: index, 사유: "AUTO_TPSL", 정산가: 예약종료정산가 });
        }
    });

    if (청산또는손익종료된인덱스들.length > 0) {
        청산또는손익종료된인덱스들.sort((a, b) => b.index - a.index).forEach(target => {
            const 포지션 = 상태.활성포지션[target.index];
            if (target.사유 === "LIQUIDATED") {
                포지션종료실행(target.index, 포지션.청산가, "강제 마진 청산(Liquidation)");
                재생효과음("sound-liquid");
            } else {
                포지션종료실행(target.index, target.정산가, "예약 TP/SL 타점 도달");
            }
        });
    }

    상태.미실현손익 = 총미실현손익;
    상태.마진잔고 = 상태.지갑잔고 + 상태.미실현손익 + 상태.활성포지션.reduce((sum, p) => sum + p.투입마진, 0);

    모의매매상태저장();

    활성포지션테이블렌더링();
    상태바업데이트();
}

function 포지션종료실행(인덱스, 종료가, 사유) {
    const pos = 상태.활성포지션[인덱스];
    if (!pos) return;

    const 수수료 = pos.수량 * 종료가 * 0.0004; // 0.04% 청산/거래 수수료
    
    let pnl = 0;
    if (pos.방향 === "LONG") {
        pnl = (종료가 - pos.진입가) * pos.수량;
    } else {
        pnl = (pos.진입가 - 종료가) * pos.수량;
    }

    let 최종정산금 = pos.투입마진 + pnl - 수수료;
    if (사유.includes("청산")) {
        최종정산금 = 0;
        pnl = -pos.투입마진;
    }

    상태.지갑잔고 += Math.max(0, 최종정산금);

    상태.거래이력.unshift({
        시간: 얻는현재시각텍스트(),
        심볼: pos.심볼,
        방향: pos.방향,
        레버리지: pos.레버리지,
        진입가: pos.진입가,
        종료가: 종료가,
        수량: pos.수량,
        실현손익: pnl,
        종료원인: 사유
    });

    const 알림색 = pnl >= 0 ? "long" : "short";
    const 이익표시 = pnl >= 0 ? "수익 정산" : "손실 정산";
    새신호알림(pos.심볼, \`[포지션 정산] \${pos.심볼} \${pos.방향} 거래가 종료가 \${종료가.toLocaleString()} USDT에 정리되었습니다. (\${사유} | PNL: \${pnl.toFixed(2)} USDT \${이익표시})\`, 알림색);

    상태.활성포지션.splice(인덱스, 1);

    모의매매상태저장();

    활성포지션테이블렌더링();
    거래이력테이블렌더링();
    상태바업데이트();
    화면업데이트();
}

// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩 (UI Event Handlers & Bindings)
function 코인탭렌더링() {
    const tabsEl = document.getElementById("coin-tabs");
    if (!tabsEl) return;

    let html = "";
    
    const 콤팩트코인들 = ["BTCUSDT", "ETHUSDT"];
    if (!콤팩트코인들.includes(상태.기본코인)) {
        콤팩트코인들.push(상태.기본코인);
    }

    콤팩트코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;

        const isActive = 상태.기본코인 === symbol ? "active" : "";
        const isFav = 상태.즐겨찾기목록.includes(symbol) ? "fa-star text-yellow" : "fa-star text-muted";
        
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeClass = 변동률 >= 0 ? "text-green" : "text-red";
        const prefix = 변동률 >= 0 ? "+" : "";

        html += \`
            <div class="coin-tab \${isActive}" onclick="코인탭전환('\${symbol}')">
                <div class="tab-meta">
                    <span class="tab-symbol">\${symbol.replace("USDT", "")}</span>
                    <span class="tab-change \${changeClass}">\${prefix}\${변동률}%</span>
                </div>
                <div class="tab-price-row">
                    <span class="tab-price">\${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
                    <i class="fa-solid \${isFav} btn-fav-star" onclick="event.stopPropagation(); 즐겨찾기토글('\${symbol}')"></i>
                </div>
            </div>
        \`;
    });

    tabsEl.innerHTML = html;
}

window.즐겨찾기토글 = function(symbol) {
    const idx = 상태.즐겨찾기목록.indexOf(symbol);
    if (isActiveFav(symbol)) {
        if (idx > -1) 상태.즐겨찾기목록.splice(idx, 1);
        새신호알림(symbol, \`[즐겨찾기] \${symbol}이 즐겨찾기 목록에서 삭제되었습니다.\`, "execution");
    } else {
        if (idx === -1) 상태.즐겨찾기목록.push(symbol);
        새신호알림(symbol, \`[즐겨찾기] \${symbol}이 즐겨찾기 목록에 추가되었습니다.\`, "execution");
    }

    try {
        localStorage.setItem("선물시뮬레이터_즐겨찾기", JSON.stringify(상태.즐겨찾기목록));
    } catch (e) {
        console.error("즐겨찾기 저장 중 에러:", e);
    }

    코인탭렌더링();
    window.코인목록렌더링();
};

function isActiveFav(symbol) {
    return 상태.즐겨찾기목록.includes(symbol);
}

window.코인탭전환 = async function(symbol) {
    if (상태.기본코인 === symbol) return;
    상태.기본코인 = symbol;
    
    try {
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    
    const coin = 상태.코인목록[symbol];
    if (coin) {
        const titleEl = document.getElementById("current-coin-title");
        const addonEl = document.getElementById("qty-symbol-addon");
        if (titleEl) titleEl.innerText = coin.이름;
        if (addonEl) addonEl.innerText = symbol.replace("USDT", "");
    }
    
    코인탭렌더링();
    if (coin) 호가창렌더링실제(coin);
    화면업데이트();
    
    await 탭전환시분할차트데이터로드(symbol);

    window.AI자동매매버튼상태동기화();

    const triggerInput = document.getElementById("input-trigger-price");
    const quantityInput = document.getElementById("input-quantity");
    const tpInput = document.getElementById("input-tp-price");
    const slInput = document.getElementById("input-sl-price");
    const tpslCheck = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");

    if (triggerInput) triggerInput.value = "";
    if (quantityInput) quantityInput.value = "0.1";
    if (tpInput) tpInput.value = "";
    if (slInput) slInput.value = "";
    if (tpslCheck) tpslCheck.checked = false;
    if (tpslContainer) tpslContainer.classList.add("hidden");
    
    주문비용재연산();
};

async function 코인추가액션() {
    const inputEl = document.getElementById("new-coin-symbol");
    if (!inputEl) return;
    const rawSymbol = inputEl.value.trim().toUpperCase();
    if (!rawSymbol) return;

    const symbol = rawSymbol.endsWith("USDT") ? rawSymbol : rawSymbol + "USDT";

    if (상태.코인목록[symbol]) {
        alert("이미 목록에 등록되어 있는 코인입니다.");
        return;
    }

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
        자동매매활성화: false
    };

    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
        상태.코인목록[symbol].소수점 = 5;
        상태.코인목록[symbol].수량소수점 = 0;
    } else if (symbol.startsWith("BTC") || symbol.startsWith("ETH")) {
        상태.코인목록[symbol].소수점 = 2;
        상태.코인목록[symbol].수량소수점 = 3;
    }

    const 추가코인목록 = [];
    Object.keys(상태.코인목록).forEach(k => {
        if (!코인스펙[k]) 추가코인목록.push(k);
    });
    try {
        localStorage.setItem("선물시뮬레이터_추가코인", JSON.stringify(추가코인목록));
    } catch (e) {
        console.error("추가 코인 저장 에러:", e);
    }

    inputEl.value = "";
    window.차트선택기목록동적갱신();
    window.코인목록렌더링();
    새신호알림(symbol, \`[시장 확장] 신규 종목 \${symbol}이 거래 대상 목록에 추가 및 등록되었습니다.\`, "execution");
}
`;

const finalContent = beforePart + pristineQuantCore + afterPart;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 중간 공백 영역(QUANT CORE 및 UI INTERACTION)이 완전히 복원 및 정화되었습니다!');
