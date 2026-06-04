const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 꼬임 부분 찾기
// 'function 코인탭렌더링() {' 이 부분부터 'window.AI자동매매버튼상태동기화();\n};' 까지
// 단, 이 중복 꼬임 패턴은 localStorage.setItem("선물시뮬레이터_현재코인", symbol);\n    } catch (e) { 등을 가지고 있음

const targetStr = `function 코인탭렌더링() {
    const tabsEl = document.getElementById("coin-tabs");
    if (!tabsEl) return;

    let html = "";
    
    // 가로형 탭의 가로 공간 부족 현상을 근본적으로 차단하기 위해,
    // 탭 영역에는 BTC, ETH 및 '현재 포커스되어 있는 활성 코인'만 최대 3개 콤팩트하게 렌더링합니다.
    const 콤팩트코인들 = ["BTCUSDT", "ETHUSDT"];
    if (!콤팩트코인들.includes(상태.기본코인)) {
        콤팩트코인들.push(상태.기본코인);
    }

    콤팩트코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;
        
        const isActive = symbol === 상태.기본코인 ? "active" : "";
        const 즐겨찾기여부 = 상태.즐겨찾기목록.includes(symbol);
        const starClass = 즐겨찾기여부 ? "fa-solid fa-star text-yellow" : "fa-regular fa-star";
        
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    
    // UI 정보 변경
    const coin = 상태.코인목록[symbol];
    document.getElementById("current-coin-title").innerText = coin.이름;
    document.getElementById("qty-symbol-addon").innerText = symbol.replace("USDT", "");
    
    코인탭렌더링();
    호가창렌더링실제(coin);
    화면업데이트();
    
    // 4분할 차트 비동기 데이터 병렬 로드 및 렌더링 가동
    await 탭전환시분할차트데이터로드(symbol);

    // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
    window.AI자동매매버튼상태동기화();
};

async function 코인추가액션() {
    const inputEl = document.getElementById("new-coin-symbol");
    const rawSymbol = inputEl.value.trim().toUpperCase();
    if (!rawSymbol) return;

    // 바이낸스 규격 USDT 페어로 강제 매핑
    const symbol = rawSymbol.endsWith("USDT") ? rawSymbol : rawSymbol + "USDT";

    if (상태.코인목록[symbol]) {
        alert("이미 목록에 등록되어 있는 코인입니다.");
        return;
    }


    // 탭 UI 리프레시 갱신
    코인탭렌더링();
};

window.코인탭전환 = async function(symbol) {
    if (상태.기본코인 === symbol) return;
    상태.기본코인 = symbol;
    
    // 현재 활성화된 코인을 로컬스토리지(Local Storage)에 영구 저장
    try {
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    
    // UI 정보 변경
    const coin = 상태.코인목록[symbol];
    document.getElementById("current-coin-title").innerText = coin.이름;
    document.getElementById("qty-symbol-addon").innerText = symbol.replace("USDT", "");
    
    코인탭렌더링();
    호가창렌더링실제(coin);
    화면업데이트();
    
    // 4분할 차트 비동기 데이터 병렬 로드 및 렌더링 가동
    await 탭전환시분할차트데이터로드(symbol);

    // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
    window.AI자동매매버튼상태동기화();
};`;

// CRLF vs LF 호환성을 위해 정규식으로 안전하게 다룹니다.
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    const nextContent = normalizedContent.replace(normalizedTarget, '// [Antigravity AI 브리핑] 중복되고 손상되었던 코인탭렌더링 및 코인탭전환 가비지 블록을 완벽하게 소탕하였습니다.');
    fs.writeFileSync(filePath, nextContent, 'utf8');
    console.log("[SUCCESS] Successfully stripped duplicate tab rendering blocks!");
} else {
    console.log("[FAIL] Could not match target string, trying index range strip...");
    
    // 줄 번호 기반 직접 인덱스 스트립
    const lines = normalizedContent.split('\n');
    const startIdx = 851; // 1-indexed 라인 852
    const endIdx = 937;   // 1-indexed 라인 938
    
    const keptLines = [];
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (lineNum >= startIdx && lineNum <= endIdx) {
            if (lineNum === startIdx) {
                keptLines.push('// [Antigravity AI 브리핑] 중복되고 손상되었던 코인탭렌더링 및 코인탭전환 가비지 블록을 완벽하게 소탕하였습니다.');
            }
        } else {
            keptLines.push(line);
        }
    });
    
    fs.writeFileSync(filePath, keptLines.join('\n'), 'utf8');
    console.log("[SUCCESS] Index range slice recovery completed!");
}
