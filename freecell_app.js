/* -------------------------------------------------------------
 * Premium FreeCell Game Logic Engine
 * 작성 규칙에 따른 한글 주석 적용
 * ------------------------------------------------------------- */

// 1. 게임 상태 데이터 정의
const 상태 = {
    덱: [],
    임시보관소: Array(4).fill(null), // Freecells
    홈셀: Array(4).fill(null).map(() => []), // Foundations
    열: Array(8).fill(null).map(() => []), // Tableau columns
    이동횟수: 0,
    시작시간: null,
    타이머인터벌: null,
    실행취소스택: [],
    선택된카드정보: null, // 클릭-클릭 이동용
    게임활성화: true,
    현재테마: "emerald"
};

// 카드 문양 아이콘 매핑
const 문양아이콘 = {
    spades: '<i class="fa-solid fa-spade"></i>',
    hearts: '<i class="fa-solid fa-heart"></i>',
    diamonds: '<i class="fa-solid fa-diamond"></i>',
    clubs: '<i class="fa-solid fa-club"></i>'
};

// 2. 초기 기동 리스너
document.addEventListener("DOMContentLoaded", () => {
    게임초기화();
    이벤트바인딩();
});

// 3. 게임 엔진 초기화
function 게임초기화() {
    clearInterval(상태.타이머인터벌);
    상태.임시보관소 = Array(4).fill(null);
    상태.홈셀 = Array(4).fill(null).map(() => []);
    상태.열 = Array(8).fill(null).map(() => []);
    상태.이동횟수 = 0;
    상태.시작시간 = null;
    상태.실행취소스택 = [];
    상태.선택된카드정보 = null;
    상태.게임활성화 = true;
    
    document.getElementById("stat-time").innerText = "00:00";
    document.getElementById("stat-moves").innerText = "0";
    document.getElementById("btn-undo").disabled = true;

    // 캔버스 초기화
    const canvas = document.getElementById("victory-canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    덱생성();
    덱셔플();
    카드배치();
    UI렌더링();
}

// 4. 카드 덱 생성 및 셔플
function 덱생성() {
    const 문양들 = ["spades", "hearts", "diamonds", "clubs"];
    const 랭크들 = [
        { name: "A", val: 1 }, { name: "2", val: 2 }, { name: "3", val: 3 },
        { name: "4", val: 4 }, { name: "5", val: 5 }, { name: "6", val: 6 },
        { name: "7", val: 7 }, { name: "8", val: 8 }, { name: "9", val: 9 },
        { name: "10", val: 10 }, { name: "J", val: 11 }, { name: "Q", val: 12 },
        { name: "K", val: 13 }
    ];

    상태.덱 = [];
    문양들.forEach(suit => {
        const color = (suit === "hearts" || suit === "diamonds") ? "red" : "black";
        랭크들.forEach(rank => {
            상태.덱.push({
                id: `${suit}-${rank.val}`,
                suit: suit,
                value: rank.val,
                rank: rank.name,
                color: color
            });
        });
    });
}

function 덱셔플() {
    for (let i = 상태.덱.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [상태.덱[i], 상태.덱[j]] = [상태.덱[j], 상태.덱[i]];
    }
}

// 8개 Tableau 열에 카드 분배
function 카드배치() {
    for (let i = 0; i < 상태.덱.length; i++) {
        const colIdx = i % 8;
        상태.열[colIdx].push(상태.덱[i]);
    }
}

// 5. 타이머 시작 제어
function 타이머시작() {
    if (상태.시작시간 !== null) return;
    상태.시작시간 = Date.now();
    상태.타이머인터벌 = setInterval(() => {
        const diff = Date.now() - 상태.시작시간;
        const min = Math.floor(diff / 60000).toString().padStart(2, "0");
        const sec = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        document.getElementById("stat-time").innerText = `${min}:${sec}`;
    }, 1000);
}

// 6. UI 렌더링 엔진 (DOM 구성)
function UI렌더링() {
    // A. 임시 보관소 렌더링
    const freecellCells = document.querySelectorAll(".freecell");
    freecellCells.forEach((cell, idx) => {
        cell.innerHTML = "";
        const card = 상태.임시보관소[idx];
        if (card) {
            cell.appendChild(카드엘리먼트생성(card, "freecell", idx, 0));
        }
    });

    // B. 홈셀 렌더링
    const foundationCells = document.querySelectorAll(".foundation");
    foundationCells.forEach((cell, idx) => {
        // 기존 카드를 제외한 워터마크 아이콘만 남기기
        const watermark = cell.querySelector(".cell-watermark");
        cell.innerHTML = "";
        if (watermark) cell.appendChild(watermark);

        const stack = 상태.홈셀[idx];
        if (stack.length > 0) {
            const topCard = stack[stack.length - 1];
            cell.appendChild(카드엘리먼트생성(topCard, "foundation", idx, 0));
        }
    });

    // C. 8개 열(Tableau) 렌더링
    const columns = document.querySelectorAll(".tableau-column");
    columns.forEach((col, colIdx) => {
        // 기저 슬롯을 제외한 모든 카드 엘리먼트 제거
        const base = col.querySelector(".column-base-slot");
        col.innerHTML = "";
        if (base) col.appendChild(base);

        const stack = 상태.열[colIdx];
        stack.forEach((card, cardIdx) => {
            const cardEl = 카드엘리먼트생성(card, "tableau", colIdx, cardIdx);
            col.appendChild(cardEl);
        });
    });

    // 실행취소 상태 동기화
    document.getElementById("btn-undo").disabled = (상태.실행취소스택.length === 0);
    document.getElementById("stat-moves").innerText = 상태.이동횟수;
}

// 개별 카드 DOM 엘리먼트 생성
function 카드엘리먼트생성(card, zone, zoneIdx, cardIdx) {
    const el = document.createElement("div");
    el.className = `card ${card.color}`;
    el.id = card.id;
    el.dataset.zone = zone;
    el.dataset.zoneIdx = zoneIdx;
    el.dataset.cardIdx = cardIdx;
    
    // 드래그가 허용되는 카드 판정 (해당 존의 가장 바깥 또는 정렬된 더미)
    if (이동가능여부판정(zone, zoneIdx, cardIdx)) {
        el.setAttribute("draggable", "true");
    }

    // 위치 오프셋 CSS
    if (zone === "tableau") {
        el.classList.add(`card-stack-offset-${cardIdx}`);
        // 쌓임 순서 Z-index 처리
        el.style.zIndex = 10 + cardIdx;
    }

    const suitHtml = 문양아이콘[card.suit];
    el.innerHTML = `
        <div class="card-header">
            <span class="card-value">${card.rank}</span>
            <span class="card-suit-mini">${suitHtml}</span>
        </div>
        <div class="card-center">
            ${suitHtml}
        </div>
        <div class="card-footer">
            <span class="card-value">${card.rank}</span>
            <span class="card-suit-mini">${suitHtml}</span>
        </div>
    `;

    // 선택 강조 상태
    if (상태.선택된카드정보 && 상태.선택된카드정보.id === card.id) {
        el.classList.add("drag-target");
    }

    return el;
}

// 7. 카드 이동 규칙 검증 및 판정
function 이동가능여부판정(zone, zoneIdx, cardIdx) {
    if (zone === "freecell") return true;
    if (zone === "foundation") return false; // 홈셀에 들어간 카드는 락
    if (zone === "tableau") {
        const stack = 상태.열[zoneIdx];
        // 마지막 카드면 무조건 이동 가능
        if (cardIdx === stack.length - 1) return true;
        
        // 중간 카드인 경우, 그 아래 카드들이 올바른 내림차순 및 색상교대로 정렬되어 있는지 확인
        for (let i = cardIdx; i < stack.length - 1; i++) {
            const curr = stack[i];
            const next = stack[i + 1];
            if (curr.color === next.color || curr.value !== next.value + 1) {
                return false;
            }
        }
        return true;
    }
    return false;
}

// 여러 장의 카드가 이동할 때 최대 이동 가능 장수 연산
function 최대이동장수계산(toColIsEmpty = false) {
    const 빈프리셀수 = 상태.임시보관소.filter(c => c === null).length;
    let 빈열수 = 상태.열.filter(col => col.length === 0).length;
    
    // 만약 이동하려는 대상 열 자체가 빈 열이라면, 그 빈 열 하나는 연산에서 차감
    if (toColIsEmpty) {
        빈열수 = Math.max(0, 빈열수 - 1);
    }
    
    return (1 + 빈프리셀수) * Math.pow(2, 빈열수);
}

// 이동 조건 규칙 유효성 체크
function 이동적합성검증(srcCard, destZone, destZoneIdx) {
    // 1. 임시 보관소로 이동
    if (destZone === "freecell") {
        return 상태.임시보관소[destZoneIdx] === null;
    }

    // 2. 홈셀로 이동 (A부터 K까지 동일 문양 오름차순)
    if (destZone === "foundation") {
        const targetStack = 상태.홈셀[destZoneIdx];
        if (targetStack.length === 0) {
            return srcCard.value === 1; // A만 진입 가능
        } else {
            const topCard = targetStack[targetStack.length - 1];
            return srcCard.suit === topCard.suit && srcCard.value === topCard.value + 1;
        }
    }

    // 3. 탭블로 열로 이동 (교대 색상 및 1 작은 숫자)
    if (destZone === "tableau") {
        const targetStack = 상태.열[destZoneIdx];
        if (targetStack.length === 0) {
            return true; // 빈 열에는 아무 카드나 진입 가능
        } else {
            const topCard = targetStack[targetStack.length - 1];
            return srcCard.color !== topCard.color && srcCard.value === topCard.value - 1;
        }
    }

    return false;
}

// 8. 상태 백업 및 카드 이동 실행
function 상태스냅샷백업() {
    const snapshot = {
        임시보관소: JSON.parse(JSON.stringify(상태.임시보관소)),
        홈셀: JSON.parse(JSON.stringify(상태.홈셀)),
        열: JSON.parse(JSON.stringify(상태.열)),
        이동횟수: 상태.이동횟수
    };
    상태.실행취소스택.push(snapshot);
}

// 카드 실제 배치 스왑
function 카드이동실행(srcZone, srcZoneIdx, srcCardIdx, destZone, destZoneIdx) {
    타이머시작();
    상태스냅샷백업();

    let cardsToMove = [];

    // 소스 카드 그룹 획득
    if (srcZone === "freecell") {
        cardsToMove = [상태.임시보관소[srcZoneIdx]];
        상태.임시보관소[srcZoneIdx] = null;
    } else if (srcZone === "tableau") {
        const col = 상태.열[srcZoneIdx];
        cardsToMove = col.splice(srcCardIdx);
    }

    // 타깃 영역 적재
    if (destZone === "freecell") {
        상태.임시보관소[destZoneIdx] = cardsToMove[0];
    } else if (destZone === "foundation") {
        상태.홈셀[destZoneIdx].push(...cardsToMove);
    } else if (destZone === "tableau") {
        상태.열[destZoneIdx].push(...cardsToMove);
    }

    상태.이동횟수++;
    상태.선택된카드정보 = null;
    UI렌더링();

    // 자동 완성 탐색 및 승리 체크
    setTimeout(() => {
        자동홈셀수집기();
        승리여부체크();
    }, 150);
}

// 9. 실행취소 (Undo) 기능
function 실행취소() {
    if (상태.실행취소스택.length === 0) return;
    const backup = 상태.실행취소스택.pop();
    상태.임시보관소 = backup.임시보관소;
    상태.홈셀 = backup.홈셀;
    상태.열 = backup.열;
    상태.이동횟수 = backup.이동횟수;
    상태.선택된카드정보 = null;
    UI렌더링();
}

// 10. 자동 수집 장치 (Auto-Collect to Foundations)
function 자동홈셀수집기() {
    let 수집발생 = false;

    // 1. 임시보관소의 카드 검사
    for (let i = 0; i < 4; i++) {
        const card = 상태.임시보관소[i];
        if (card && 자동수집적합성판정(card)) {
            const destIdx = 홈셀매핑인덱스(card.suit);
            상태스냅샷백업();
            상태.임시보관소[i] = null;
            상태.홈셀[destIdx].push(card);
            상태.이동횟수++;
            수집발생 = true;
            break;
        }
    }

    // 2. 8개 열의 마지막 카드 검사
    if (!수집발생) {
        for (let i = 0; i < 8; i++) {
            const col = 상태.열[i];
            if (col.length > 0) {
                const card = col[col.length - 1];
                if (자동수집적합성판정(card)) {
                    const destIdx = 홈셀매핑인덱스(card.suit);
                    상태스냅샷백업();
                    col.pop();
                    상태.홈셀[destIdx].push(card);
                    상태.이동횟수++;
                    수집발생 = true;
                    break;
                }
            }
        }
    }

    if (수집발생) {
        UI렌더링();
        // 연쇄 수집을 위해 재귀적 호출
        setTimeout(자동홈셀수집기, 100);
    }
}

// 카드를 자동으로 홈셀에 올려도 안전한지 검사하는 스마트 알고리즘
// (반대 색상의 카드가 이미 홈셀에 일정 수준 이상 채워져 있어야 탭블로에서 지지대로 쓰이지 않아 안전함)
function 자동수집적합성판정(card) {
    const destIdx = 홈셀매핑인덱스(card.suit);
    const targetStack = 상태.홈셀[destIdx];

    // 홈셀 적재 규칙 기본 부합 여부
    let fit = false;
    if (targetStack.length === 0) {
        fit = (card.value === 1);
    } else {
        const top = targetStack[targetStack.length - 1];
        fit = (card.suit === top.suit && card.value === top.value + 1);
    }

    if (!fit) return false;
    if (card.value <= 2) return true; // A와 2는 탭블로 아래에 놓일 일이 없어 무조건 자동 수집 가능

    // 반대 색상의 문양 수집 상태 확인
    const 반대색상문양들 = (card.color === "red") ? ["spades", "clubs"] : ["hearts", "diamonds"];
    const stack1 = 상태.홈셀[홈셀매핑인덱스(반대색상문양들[0])];
    const stack2 = 상태.홈셀[홈셀매핑인덱스(반대색상문양들[1])];

    const val1 = stack1.length > 0 ? stack1[stack1.length - 1].value : 0;
    const val2 = stack2.length > 0 ? stack2[stack2.length - 1].value : 0;

    // 반대 색상 카드가 (현재 카드 Value - 1) 이상이어야 그 아래에 카드를 덧댈 걱정이 없으므로 안전함
    return Math.min(val1, val2) >= card.value - 1;
}

function 홈셀매핑인덱스(suit) {
    const suits = ["spades", "hearts", "diamonds", "clubs"];
    return suits.indexOf(suit);
}

// 11. 승리 판정 및 카드 폭포 애니메이션
function 승리여부체크() {
    const totalFoundations = 상태.홈셀.reduce((sum, stack) => sum + stack.length, 0);
    if (totalFoundations === 52 && 상태.게임활성화) {
        상태.게임활성화 = false;
        clearInterval(상태.타이머인터벌);
        setTimeout(카드폭포시작, 500);
    }
}

// 윈도우 클래식 폭포 효과 물리 시뮬레이션
function 카드폭포시작() {
    const canvas = document.getElementById("victory-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    const cascades = [];

    // 홈셀 우측 끝 순서(K부터 아래로) 역순으로 폭포 노드 생성
    let currentSuitIdx = 3;
    let currentValue = 13; // K

    // 카드를 Canvas 상에 렌더링하기 위한 스타일 맵
    const cardWidth = 100;
    const cardHeight = 140;

    // 홈셀 슬롯의 좌표 추정치 획득
    const foundationSlots = document.querySelectorAll(".foundation");

    function 생성다음노드() {
        if (currentSuitIdx < 0) return;

        const slot = foundationSlots[currentSuitIdx];
        const rect = slot.getBoundingClientRect();
        
        const card = 상태.홈셀[currentSuitIdx][currentValue - 1];
        if (card) {
            cascades.push({
                card: card,
                x: rect.left,
                y: rect.top,
                vx: (Math.random() - 0.5) * 6 - 2, // 좌상향 위주
                vy: -Math.random() * 4 - 2,
                bounce: 0.85
            });
        }

        currentValue--;
        if (currentValue < 1) {
            currentValue = 13;
            currentSuitIdx--;
        }

        // 0.25초 간격으로 연쇄 낙하 유도
        if (currentSuitIdx >= 0) {
            setTimeout(생성다음노드, 250);
        }
    }

    생성다음노드();

    // 물리 루프
    function 프레임업데이트() {
        if (상태.게임활성화) return; // 다시 시작하면 중단

        cascades.forEach(node => {
            // 이전 좌표에 꼬리 렌더링
            그리기카드(ctx, node.card, node.x, node.y, cardWidth, cardHeight);

            // 물리 가속도
            node.vy += 0.25; // 중력 가속도
            node.x += node.vx;
            node.y += node.vy;

            // 바닥 충돌 튕김
            if (node.y + cardHeight >= canvas.height) {
                node.y = canvas.height - cardHeight;
                node.vy = -node.vy * node.bounce;
                // 마찰력으로 수평 감쇠
                node.vx *= 0.98;
            }
        });

        // 화면 밖으로 완전히 벗어난 노드 필터링
        const activeNodes = cascades.filter(node => node.x + cardWidth > 0 && node.x < canvas.width);
        
        if (activeNodes.length > 0 || currentSuitIdx >= 0) {
            requestAnimationFrame(프레임업데이트);
        }
    }

    requestAnimationFrame(프레임업데이트);
}

// 캔버스 위에 카드 그래픽 드로잉
function 그리기카드(ctx, card, x, y, w, h) {
    ctx.save();
    
    // 카드 외곽선 및 배경
    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ffffff";
    
    // 둥근 사각형 경로
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 텍스트 & 문양 드로잉
    ctx.shadowColor = "transparent"; // 그림자 제거
    ctx.fillStyle = (card.color === "red") ? "#e11d48" : "#1e293b";
    ctx.font = "bold 16px Outfit, sans-serif";
    ctx.fillText(card.rank, x + 10, y + 22);

    // 수트 텍스트 드로잉
    let suitChar = "";
    if (card.suit === "spades") suitChar = "♠";
    else if (card.suit === "hearts") suitChar = "♥";
    else if (card.suit === "diamonds") suitChar = "♦";
    else if (card.suit === "clubs") suitChar = "♣";

    ctx.font = "20px Outfit, sans-serif";
    ctx.fillText(suitChar, x + w - 24, y + 24);

    // 센터 대형 수트
    ctx.font = "48px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(suitChar, x + w / 2, y + h / 2 + 5);

    ctx.restore();
}

// 12. 브라우저 이벤트 바인딩
function 이벤트바인딩() {
    // A. 드래그 앤 드롭 이벤트 바인딩
    const container = document.querySelector(".game-container");

    container.addEventListener("dragstart", e => {
        if (!상태.게임활성화) return;
        const cardEl = e.target.closest(".card");
        if (!cardEl) return;

        cardEl.classList.add("is-dragging");

        const zone = cardEl.dataset.zone;
        const zoneIdx = parseInt(cardEl.dataset.zoneIdx);
        const cardIdx = parseInt(cardEl.dataset.cardIdx);

        // 드래그 데이터 설정
        e.dataTransfer.setData("text/plain", JSON.stringify({ zone, zoneIdx, cardIdx }));
        e.dataTransfer.effectAllowed = "move";
    });

    container.addEventListener("dragend", e => {
        const cardEl = e.target.closest(".card");
        if (cardEl) cardEl.classList.remove("is-dragging");
        
        // 드래그 타깃 오버레이 해제
        document.querySelectorAll(".cell, .card").forEach(el => {
            el.classList.remove("drag-over");
            el.classList.remove("drag-target");
        });
    });

    // 드래그 오버
    container.addEventListener("dragover", e => {
        e.preventDefault();
        
        // 슬롯 셀 검출
        const cell = e.target.closest(".cell");
        if (cell) {
            cell.classList.add("drag-over");
            return;
        }

        // 탭블로 열 검출
        const col = e.target.closest(".tableau-column");
        if (col) {
            // 열의 마지막 카드 또는 빈 열 슬롯 강조
            const cards = col.querySelectorAll(".card");
            if (cards.length > 0) {
                cards[cards.length - 1].classList.add("drag-target");
            } else {
                col.classList.add("drag-over");
            }
        }
    });

    container.addEventListener("dragleave", e => {
        const cell = e.target.closest(".cell");
        if (cell) cell.classList.remove("drag-over");

        const col = e.target.closest(".tableau-column");
        if (col) {
            col.classList.remove("drag-over");
            const cards = col.querySelectorAll(".card");
            if (cards.length > 0) {
                cards[cards.length - 1].classList.remove("drag-target");
            }
        }
    });

    // 드롭 처리
    container.addEventListener("drop", e => {
        e.preventDefault();
        
        // 드래그 데이터 파싱
        let dragData;
        try {
            dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
        } catch (err) {
            return;
        }

        const { zone: srcZone, zoneIdx: srcZoneIdx, cardIdx: srcCardIdx } = dragData;
        
        // 드래그 카드 획득
        let srcCard;
        if (srcZone === "freecell") {
            srcCard = 상태.임시보관소[srcZoneIdx];
        } else if (srcZone === "tableau") {
            srcCard = 상태.열[srcZoneIdx][srcCardIdx];
        }

        if (!srcCard) return;

        // 드롭 대상 영역 판정
        const cell = e.target.closest(".cell");
        const col = e.target.closest(".tableau-column");

        if (cell) {
            const destZone = cell.dataset.cellType;
            const destZoneIdx = parseInt(cell.dataset.idx);

            if (이동적합성검증(srcCard, destZone, destZoneIdx)) {
                카드이동실행(srcZone, srcZoneIdx, srcCardIdx, destZone, destZoneIdx);
            }
        } else if (col) {
            const destZoneIdx = parseInt(col.dataset.colIdx);
            const targetStack = 상태.열[destZoneIdx];

            // 여러 장 이동 조건 제어
            let canMovePile = true;
            if (srcZone === "tableau" && srcCardIdx < 상태.열[srcZoneIdx].length - 1) {
                const moveCount = 상태.열[srcZoneIdx].length - srcCardIdx;
                const limit = 최대이동장수계산(targetStack.length === 0);
                if (moveCount > limit) {
                    canMovePile = false;
                }
            }

            if (canMovePile && 이동적합성검증(srcCard, "tableau", destZoneIdx)) {
                카드이동실행(srcZone, srcZoneIdx, srcCardIdx, "tableau", destZoneIdx);
            }
        }
    });

    // B. 클릭-클릭 하이브리드 조작 및 더블 클릭 자동 안착 바인딩
    container.addEventListener("click", e => {
        if (!상태.게임활성화) return;

        const cardEl = e.target.closest(".card");
        const cell = e.target.closest(".cell");
        const col = e.target.closest(".tableau-column");

        // A. 이미 선택된 카드가 있는 경우 이동 처리 프로세스
        if (상태.선택된카드정보) {
            const src = 상태.선택된카드정보;
            let srcCard;
            if (src.zone === "freecell") srcCard = 상태.임시보관소[src.zoneIdx];
            else if (src.zone === "tableau") srcCard = 상태.열[src.zoneIdx][src.cardIdx];

            if (!srcCard) {
                상태.선택된카드정보 = null;
                UI렌더링();
                return;
            }

            // 본인 선택 카드 클릭 시 해제
            if (cardEl && cardEl.id === src.id) {
                상태.선택된카드정보 = null;
                UI렌더링();
                return;
            }

            // A-1. 카드 엘리먼트 위로 클릭 드롭한 경우
            if (cardEl) {
                const destZone = cardEl.dataset.zone;
                const destZoneIdx = parseInt(cardEl.dataset.zoneIdx);
                const destCardIdx = parseInt(cardEl.dataset.cardIdx);

                if (destZone === "tableau") {
                    const targetStack = 상태.열[destZoneIdx];
                    // 열의 최상단 카드인 경우에만 그 위로 스택 이동 가능
                    if (destCardIdx === targetStack.length - 1) {
                        let canMovePile = true;
                        if (src.zone === "tableau" && src.cardIdx < 상태.열[src.zoneIdx].length - 1) {
                            const moveCount = 상태.열[src.zoneIdx].length - src.cardIdx;
                            const limit = 최대이동장수계산(false);
                            if (moveCount > limit) canMovePile = false;
                        }

                        if (canMovePile && 이동적합성검증(srcCard, "tableau", destZoneIdx)) {
                            카드이동실행(src.zone, src.zoneIdx, src.cardIdx, "tableau", destZoneIdx);
                            return;
                        }
                    }
                } else if (destZone === "foundation") {
                    // 홈셀 내의 카드 위 클릭 시 적재 적합 여부 확인 후 적재
                    if (이동적합성검증(srcCard, "foundation", destZoneIdx)) {
                        카드이동실행(src.zone, src.zoneIdx, src.cardIdx, "foundation", destZoneIdx);
                        return;
                    }
                }

                // 이동이 불가능한 경우, 대상 카드가 직접 이동 가능한 대상이라면 재선택(포커스 스왑)
                if (이동가능여부판정(destZone, destZoneIdx, destCardIdx)) {
                    상태.선택된카드정보 = { id: cardEl.id, zone: destZone, zoneIdx: destZoneIdx, cardIdx: destCardIdx };
                } else {
                    상태.선택된카드정보 = null;
                }
                UI렌더링();
                return;
            }

            // A-2. 빈 슬롯(프리셀 또는 홈셀)을 클릭한 경우
            if (cell) {
                const destZone = cell.dataset.cellType;
                const destZoneIdx = parseInt(cell.dataset.idx);

                if (이동적합성검증(srcCard, destZone, destZoneIdx)) {
                    카드이동실행(src.zone, src.zoneIdx, src.cardIdx, destZone, destZoneIdx);
                    return;
                }
            }

            // A-3. 빈 탭블로 열(column)을 클릭한 경우
            if (col) {
                const destZoneIdx = parseInt(col.dataset.colIdx);
                const targetStack = 상태.열[destZoneIdx];
                if (targetStack.length === 0) {
                    let canMovePile = true;
                    if (src.zone === "tableau" && src.cardIdx < 상태.열[src.zoneIdx].length - 1) {
                        const moveCount = 상태.열[src.zoneIdx].length - src.cardIdx;
                        const limit = 최대이동장수계산(true);
                        if (moveCount > limit) canMovePile = false;
                    }

                    if (canMovePile && 이동적합성검증(srcCard, "tableau", destZoneIdx)) {
                        카드이동실행(src.zone, src.zoneIdx, src.cardIdx, "tableau", destZoneIdx);
                        return;
                    }
                }
            }

            // 매칭되는 이동 경로가 없는 경우 선택 해제
            상태.선택된카드정보 = null;
            UI렌더링();
        }
        // B. 선택된 카드가 없었던 상태에서의 최초 선택 프로세스
        else {
            if (cardEl) {
                const zone = cardEl.dataset.zone;
                const zoneIdx = parseInt(cardEl.dataset.zoneIdx);
                const cardIdx = parseInt(cardEl.dataset.cardIdx);

                if (이동가능여부판정(zone, zoneIdx, cardIdx)) {
                    상태.선택된카드정보 = { id: cardEl.id, zone, zoneIdx, cardIdx };
                    UI렌더링();
                }
            }
        }
    });

    // 더블 클릭 시 자동 안착
    container.addEventListener("dblclick", e => {
        if (!상태.게임활성화) return;
        const cardEl = e.target.closest(".card");
        if (!cardEl) return;

        const zone = cardEl.dataset.zone;
        const zoneIdx = parseInt(cardEl.dataset.zoneIdx);
        const cardIdx = parseInt(cardEl.dataset.cardIdx);

        if (!이동가능여부판정(zone, zoneIdx, cardIdx)) return;

        let srcCard;
        if (zone === "freecell") srcCard = 상태.임시보관소[zoneIdx];
        else if (zone === "tableau") srcCard = 상태.열[zoneIdx][cardIdx];

        if (!srcCard) return;

        // A. 홈셀 적재 시도
        for (let i = 0; i < 4; i++) {
            if (이동적합성검증(srcCard, "foundation", i)) {
                카드이동실행(zone, zoneIdx, cardIdx, "foundation", i);
                return;
            }
        }

        // B. 빈 임시보관소 적재 시도 (탭블로에 있을 때만 작동)
        if (zone === "tableau") {
            for (let i = 0; i < 4; i++) {
                if (이동적합성검증(srcCard, "freecell", i)) {
                    카드이동실행(zone, zoneIdx, cardIdx, "freecell", i);
                    return;
                }
            }
        }
    });

    // C. 제어 버튼 리스너 바인딩
    document.getElementById("btn-undo").addEventListener("click", 실행취소);
    document.getElementById("btn-restart").addEventListener("click", () => {
        if (상태.실행취소스택.length === 0) return;
        // 첫 번째 기록의 스냅샷을 강제 주입
        const first = 상태.실행취소스택[0];
        상태.임시보관소 = first.임시보관소;
        상태.홈셀 = first.홈셀;
        상태.열 = first.열;
        상태.이동횟수 = 0;
        상태.실행취소스택 = [];
        상태.선택된카드정보 = null;
        UI렌더링();
    });
    document.getElementById("btn-new-game").addEventListener("click", 게임초기화);

    // 테마 토글
    document.getElementById("btn-theme").addEventListener("click", () => {
        const body = document.body;
        const icon = document.querySelector("#btn-theme i");
        if (body.classList.contains("theme-emerald")) {
            body.className = "theme-dark";
            icon.className = "fa-solid fa-sun";
            상태.현재테마 = "dark";
        } else {
            body.className = "theme-emerald";
            icon.className = "fa-solid fa-moon";
            상태.현재테마 = "emerald";
        }
    });

    // 규칙 모달 열기/닫기
    const modal = document.getElementById("rules-modal");
    document.getElementById("btn-rules").addEventListener("click", () => modal.classList.remove("hidden"));
    document.getElementById("btn-close-modal").addEventListener("click", () => modal.classList.add("hidden"));
    document.getElementById("btn-confirm-rules").addEventListener("click", () => modal.classList.add("hidden"));

    // 치트 코드 작동 (폭포 테스트 목적)
    document.getElementById("btn-cheat").addEventListener("click", () => {
        상태스냅샷백업();
        // A부터 Q까지 홈셀에 자동 정렬 상태 구축
        const suits = ["spades", "hearts", "diamonds", "clubs"];
        suits.forEach((suit, idx) => {
            const color = (suit === "hearts" || suit === "diamonds") ? "red" : "black";
            상태.홈셀[idx] = [];
            // A부터 Q(12)까지 채우기
            for (let v = 1; v <= 12; v++) {
                let rankName = v.toString();
                if (v === 1) rankName = "A";
                else if (v === 11) rankName = "J";
                else if (v === 12) rankName = "Q";
                상태.홈셀[idx].push({
                    id: `${suit}-${v}`,
                    suit: suit,
                    value: v,
                    rank: rankName,
                    color: color
                });
            }
        });

        // 탭블로 열에는 K들만 얹어두기
        상태.열 = Array(8).fill(null).map(() => []);
        suits.forEach((suit, idx) => {
            const color = (suit === "hearts" || suit === "diamonds") ? "red" : "black";
            상태.열[idx].push({
                id: `${suit}-13`,
                suit: suit,
                value: 13,
                rank: "K",
                color: color
            });
        });
        상태.임시보관소 = Array(4).fill(null);
        UI렌더링();
    });
}
