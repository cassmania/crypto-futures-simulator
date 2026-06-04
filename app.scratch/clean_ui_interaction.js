const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (UI 인터랙션 시작)
const startKeywords = [
    '// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩 (UI Event Handlers & Bindings)',
    '// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩',
    'function 코인탭렌더링'
];

let startIdx = -1;
for (const kw of startKeywords) {
    startIdx = content.indexOf(kw);
    if (startIdx !== -1) {
        console.log(`Found start keyword: "${kw}" at index ${startIdx}`);
        break;
    }
}

if (startIdx === -1) {
    console.error("[FAIL] Could not find any start keyword in app.js");
    process.exit(1);
}

// 2. 교환할 영역의 끝 인덱스 계산 (테이블 렌더러 시작 전)
const endKeywords = [
    '// 12. 테이블 데이터 렌더러 정의 (Grid Tables Renderers)',
    '// 12. 테이블 데이터 렌더러 정의',
    'function 대기주문테이블렌더링'
];

let endIdx = -1;
for (const kw of endKeywords) {
    endIdx = content.indexOf(kw, startIdx); // startIdx 이후부터 매칭
    if (endIdx !== -1) {
        console.log(`Found end keyword: "${kw}" at index ${endIdx}`);
        break;
    }
}

if (endIdx === -1) {
    console.error("[FAIL] Could not find any end keyword in app.js");
    process.exit(1);
}

const beforePart = content.substring(0, startIdx);
const afterPart = content.substring(endIdx);

const pristineUIInteraction = `// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩 (UI Event Handlers & Bindings)
function 코인탭렌더링() {
    const tabsEl = document.getElementById("coin-tabs");
    if (!tabsEl) return;

    let html = "";
    
    // 가로형 탭의 공간 부족 현상을 방지하기 위해 BTC, ETH 및 현재 조회 중인 코인만 콤팩트하게 렌더링
    const 콤팩트코인들 = ["BTCUSDT", "ETHUSDT"];
    if (!콤팩트코인들.includes(상태.기본코인)) {
        콤팩트코인들.push(상태.기본코인);
    }

    콤팩트코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;

        const isActive = 상태.기본코인 === symbol ? "active" : "";
        const isFav = 상태.즐겨찾기목록.includes(symbol) ? "fa-star text-yellow" : "fa-star text-muted";
        
        // 실시간 가격 변동에 따른 탭 내부 텍스트 갱신
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

    // 즐겨찾기 로컬스토리지 동기화
    try {
        localStorage.setItem("선물시뮬레이터_즐겨찾기", JSON.stringify(상태.즐겨찾기목록));
    } catch (e) {
        console.error("즐겨찾기 저장 중 에러:", e);
    }

    코인탭렌더링();
    window.코인목록렌더링(); // 우측 목록 갱신
};

function isActiveFav(symbol) {
    return 상태.즐겨찾기목록.includes(symbol);
}

window.코인탭전환 = async function(symbol) {
    if (상태.기본코인 === symbol) return;
    상태.기본코인 = symbol;
    
    // 현재 활성화된 코인을 로컬스토리지에 영구 저장
    try {
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    
    // UI 정보 변경
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
    
    // 8분할 차트 비동기 데이터 병렬 로드 및 렌더링 가동
    await 탭전환시분할차트데이터로드(symbol);

    // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
    window.AI자동매매버튼상태동기화();

    // 폼 잔상 제거
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
    
    // AI추천캐시 초기화
    if (typeof AI추천캐시 !== 'undefined') {
        AI추천캐시.방향 = "LONG";
        AI추천캐시.진입가 = 0;
        AI추천캐시.익절가 = 0;
        AI추천캐시.손절가 = 0;
        AI추천캐시.지지선 = 0;
        AI추천캐시.저항선 = 0;
    }
    
    주문비용재연산();
};

async function 코인추가액션() {
    const inputEl = document.getElementById("new-coin-symbol");
    if (!inputEl) return;
    const rawSymbol = inputEl.value.trim().toUpperCase();
    if (!rawSymbol) return;

    // 바이낸스 규격 USDT 페어로 강제 매핑
    const symbol = rawSymbol.endsWith("USDT") ? rawSymbol : rawSymbol + "USDT";

    if (상태.코인목록[symbol]) {
        alert("이미 목록에 등록되어 있는 코인입니다.");
        return;
    }

    // 임시 신규 코인 메모리 로드
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

    // 알트코인에 따른 소수점 규격 최적화 보정
    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
        상태.코인목록[symbol].소수점 = 5;
        상태.코인목록[symbol].수량소수점 = 0;
    } else if (symbol.startsWith("BTC") || symbol.startsWith("ETH")) {
        상태.코인목록[symbol].소수점 = 2;
        상태.코인목록[symbol].수량소수점 = 3;
    }

    // 추가 코인 로컬스토리지 영구 기록
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

const finalContent = beforePart + pristineUIInteraction + afterPart;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 UI 인터랙션 코어 영역이 복원되었습니다!');
