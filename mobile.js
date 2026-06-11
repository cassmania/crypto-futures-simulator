/* ----------------------------------------------------
   BINANCE REAL-TIME SIMULATOR FOR MOBILE (mobile.js)
   스마트폰 최적화 모바일 가상 선물 거래 시뮬레이터 비즈니스 로직입니다.
   모든 변수(Variable)와 설명은 한국어로 상세히 서술하고 기술 용어는 영어를 병기하였습니다.
   ---------------------------------------------------- */

// 1. 전역 상태 관리 객체 (Global State)
const 상태 = {
    // 자산 정보 (Assets)
    지갑잔고: 10000.00,        // Wallet Balance (USDT)
    마진잔고: 10000.00,        // Margin Balance (USDT)
    미실현손익: 0.00,          // Unrealized PNL (USDT)

    // 코인 및 시장 데이터 (Market Data)
    기본코인: "BTCUSDT",       // 현재 활성화된 코인 심볼 (Active Symbol)
    코인목록: {},              // 각 코인의 실시간 데이터 및 히스토리 관리용 객체
    CME갭캐시: {},             // 각 코인별 CME 갭 분석 결과 캐싱 (CME Gap Cache)

    // 즐겨찾기 목록 (Favorites List)
    즐겨찾기목록: ["BTCUSDT", "ETHUSDT"],

    // 주문 및 포지션 관리 (Orders & Positions)
    대기주문: [],              // Trigger Pending Orders
    활성포지션: [],            // Active Positions
    거래이력: [],              // Trade History
    주문아이디카운터: 1,       // Order ID Counter
    포지션아이디카운터: 1,     // Position ID Counter

    // AI 자동매매 세부 설정 (AI Auto-Trading Parameters)
    자동매매설정: {
        자동매매활성화: false, // AI 자동매매 활성화 여부
        진입비율: 10,          // 가용 잔고 대비 마진 진입 비율 (%)
        익절옵션: "ai",        // "ai" (알고리즘 자동 청산) 또는 "manual" (수동 %)
        수동익절율: 10,        // 수동 지정 시 익절율 (%)
        손절옵션: "ai",        // "ai" (알고리즘 자동 손절) 또는 "manual" (수동 %)
        수동손절율: 5,         // 수동 지정 시 손절율 (%)
        중복방지: true         // 동일 코인 다중 진입 방지 여부
    },

    // 바이낸스 네트워크 연결 제어 (Binance WS Connection)
    웹소켓인스턴스: null,
    웹소켓연결상태: false,
    재연결타이머: null,        // Auto Reconnect Timer

    // 단일 차트 제어 객체 (Single Chart)
    차트: {
        메인차트: null,
        캔들시리즈: null,
        EMA5시리즈: null,
        EMA20시리즈: null,
        SMA60시리즈: null,
        시간단위: "1m",         // Timeframe
        코인심볼: "BTCUSDT",
        캔들데이터: []
    }
};

// 코인 기초 규격 정보 (Coin Specifications)
const 코인정의 = {
    "BTCUSDT": { 이름: "BTC/USDT Perpetual", 시작가: 73000.00, 소수점: 2, 수량소수점: 3 },
    "ETHUSDT": { 이름: "ETH/USDT Perpetual", 시작가: 2000.00, 소수점: 2, 수량소수점: 2 },
    "SOLUSDT": { 이름: "SOL/USDT Perpetual", 시작가: 150.00, 소수점: 2, 수량소수점: 2 },
    "HYPEUSDT": { 이름: "HYPE/USDT Perpetual", 시작가: 0.338, 소수점: 3, 수량소수점: 2 },
    "XRPUSDT": { 이름: "XRP/USDT Perpetual", 시작가: 0.5500, 소수점: 4, 수량소수점: 1 },
    "ADAUSDT": { 이름: "ADA/USDT Perpetual", 시작가: 0.4500, 소수점: 4, 수량소수점: 1 },
    "DOGEUSDT": { 이름: "DOGE/USDT Perpetual", 시작가: 0.14500, 소수점: 5, 수량소수점: 0 },
    "LINKUSDT": { 이름: "LINK/USDT Perpetual", 시작가: 15.50, 소수점: 2, 수량소수점: 2 }
};

// 카카오 연동 세부 상태 (Kakao Alert State)
window.KakaoAutoSendInfo = {
    key: localStorage.getItem('kakaoJsKey') || '',
    uuid: localStorage.getItem('kakaoUuid') || '',
    enabled: !!localStorage.getItem('kakaoJsKey')
};

// 2. 초기화 프로세스 (Initialization Process)
document.addEventListener("DOMContentLoaded", async () => {
    // 오디오 요소 볼륨 조절
    ["sound-trigger", "sound-signal", "sound-liquid"].forEach(id => {
        const audio = document.getElementById(id);
        if (audio) audio.volume = 0.3;
    });

    // 1단계: 코인 데이터 구조 초기화
    초기코인데이터정의();

    // 2단계: TradingView Lightweight Charts 초기화
    차트시스템초기화();

    // 3단계: 화면 이벤트 리스너 바인딩
    이벤트리스너바인딩();

    // 4단계: 로컬 스토리지 데이터 복원
    모의매매상태복원();
    AI설정스토리지복원();
    카카오스토리지복원();

    // 5단계: 최초 실시간 시세 로딩 (CORS 차단 대비 현물 API fallback 포함)
    await 최초시세로딩();

    // 6단계: 최초 과거 캔들 데이터 로드
    await 최초과거데이터로드();

    // 7단계: 바이낸스 웹소켓 실시간 데이터 연결
    바이낸스웹소켓연결();

    // 8단계: 백그라운드 정기 감시 루프 가동
    setInterval(실시간포지션마진정산, 1000); // 1초마다 포지션 및 청산 감시
    setInterval(감시대기주문체결, 500);     // 0.5초마다 지정가 예약 주문 체결 감시
    setInterval(실시간시세REST폴러, 12000);  // 12초마다 웹소켓 백업 REST 폴링

    // 초기 화면 렌더링
    화면업데이트();
    호가창렌더링실제();
    주문비용재연산();
});

// 코인 가격대에 맞춘 소수점 자동결정 헬퍼 함수
function 자동소수점결정(가격) {
    let 소수점 = 3;
    let 수량소수점 = 2;
    if (가격 < 0.001) {
        소수점 = 7;
        수량소수점 = 0;
    } else if (가격 < 0.01) {
        소수점 = 6;
        수량소수점 = 0;
    } else if (가격 < 0.1) {
        소수점 = 5;
        수량소수점 = 0;
    } else if (가격 < 1) {
        소수점 = 4;
        수량소수점 = 1;
    } else if (가격 < 10) {
        소수점 = 3;
        수량소수점 = 2;
    } else if (가격 < 100) {
        소수점 = 2;
        수량소수점 = 2;
    } else {
        소수점 = 2;
        수량소수점 = 3;
    }
    return { 소수점, 수량소수점 };
}

// 3. 코인 데이터 구조 정의 (Coin Memory Init)
function 초기코인데이터정의() {
    Object.keys(코인정의).forEach(symbol => {
        const def = 코인정의[symbol];
        상태.코인목록[symbol] = {
            심볼: symbol,
            이름: def.이름,
            현재가: def.시작가,
            어제종가: def.시작가 * 0.98,
            최고24h: def.시작가 * 1.02,
            최저24h: def.시작가 * 0.97,
            소수점: def.소수점,
            수량소수점: def.수량소수점,
            레버리지: 3,             // 기본 레버리지
            호가매도: [],
            호가매수: [],
            캔들데이터: [],
            가상시세여부: false
        };
    });
}

// 4. 단일 차트 시스템 초기화 (Lightweight Charts Setup)
function 차트시스템초기화() {
    const container = document.getElementById("mobile-chart-canvas");
    if (!container) return;

    // 모바일 차트 기본 스타일 디자인 정의
    const chartOptions = {
        layout: {
            background: { type: 'solid', color: '#0B0E11' },
            textColor: '#848E9C',
            fontSize: 10,
            fontFamily: 'Inter'
        },
        grid: {
            vertLines: { color: '#1F2226' },
            horzLines: { color: '#1F2226' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: '#848E9C', labelBackgroundColor: '#1E2329' },
            horzLine: { color: '#848E9C', labelBackgroundColor: '#1E2329' }
        },
        rightPriceScale: {
            borderColor: '#2B3139',
            visible: true
        },
        timeScale: {
            borderColor: '#2B3139',
            timeVisible: true,
            secondsVisible: false
        }
    };

    상태.차트.메인차트 = LightweightCharts.createChart(container, chartOptions);

    // 캔들 시리즈 추가
    상태.차트.캔들시리즈 = 상태.차트.메인차트.addCandlestickSeries({
        upColor: '#f6465d',     // 상승 = 빨간색 (한국 기준)
        downColor: '#0066ff',   // 하락 = 파란색
        borderUpColor: '#f6465d',
        borderDownColor: '#0066ff',
        wickUpColor: '#f6465d',
        wickDownColor: '#0066ff'
    });

    // 이동평균선(MA) 라인 추가
    상태.차트.EMA5시리즈 = 상태.차트.메인차트.addLineSeries({ color: '#F0B90B', lineWidth: 1, title: 'MA(7)' });
    상태.차트.EMA20시리즈 = 상태.차트.메인차트.addLineSeries({ color: '#03A9F4', lineWidth: 1, title: 'MA(25)' });
    상태.차트.SMA60시리즈 = 상태.차트.메인차트.addLineSeries({ color: '#E040FB', lineWidth: 1, title: 'MA(99)' });

    // 반응형 리사이즈 이벤트 바인딩
    window.addEventListener("resize", () => {
        if (상태.차트.메인차트 && container) {
            상태.차트.메인차트.resize(container.clientWidth, container.clientHeight);
        }
    });
}

// 5. 모바일 이벤트 리스너 바인딩 (UI Event Bindings)
function 이벤트리스너바인딩() {
    // A. 하단 탭바 전환
    const navItems = document.querySelectorAll(".mobile-bottom-nav .nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const tabName = item.dataset.tab;
            const tabPanes = document.querySelectorAll(".tab-pane");
            tabPanes.forEach(pane => pane.classList.remove("active"));

            const activePane = document.getElementById(`tab-pane-${tabName}`);
            if (activePane) {
                activePane.classList.add("active");
                // 차트 탭 재지정 시 레이아웃 리사이징 강제 갱신
                if (tabName === "chart" && 상태.차트.메인차트) {
                    setTimeout(() => {
                        const container = document.getElementById("mobile-chart-canvas");
                        if (container) 상태.차트.메인차트.resize(container.clientWidth, container.clientHeight);
                        상태.차트.메인차트.timeScale().fitContent();
                    }, 50);
                }
            }
        });
    });

    // B. 코인 선택 및 전환
    const coinSelect = document.getElementById("mobile-coin-select");
    if (coinSelect) {
        coinSelect.addEventListener("change", async (e) => {
            const selectedSymbol = e.target.value;
            상태.기본코인 = selectedSymbol;
            상태.차트.코인심볼 = selectedSymbol;

            // UI 뱃지 및 타이틀 업데이트
            const obTag = document.getElementById("ob-symbol-tag");
            const tradeTag = document.getElementById("trade-symbol-tag");
            const coinTitle = document.getElementById("current-coin-title");
            const qtyAddon = document.getElementById("qty-symbol-addon");

            if (obTag) obTag.innerText = selectedSymbol.replace("USDT", "/USDT");
            if (tradeTag) tradeTag.innerText = selectedSymbol;
            if (coinTitle) coinTitle.innerText = selectedSymbol.replace("USDT", "/USDT");
            if (qtyAddon) qtyAddon.innerText = selectedSymbol.replace("USDT", "");

            // 레버리지 슬라이더 수치 동기화
            const coin = 상태.코인목록[selectedSymbol];
            if (coin) {
                const levInput = document.getElementById("input-leverage");
                const levNum = document.getElementById("input-leverage-num");
                const levDisplay = document.getElementById("leverage-display");
                if (levInput) levInput.value = coin.레버리지;
                if (levNum) levNum.value = coin.레버리지;
                if (levDisplay) levDisplay.innerText = coin.레버리지 + "x";
            }

            // 과거 차트 캔들 로드 및 소켓 데이터 갱신
            await 특정코인캔들데이터로드();
            호가창렌더링실제();
            주문비용재연산();
            화면업데이트();

            // 마지막 선택 코인 localStorage 저장
            localStorage.setItem("선물시뮬레이터_현재코인", selectedSymbol);
        });
    }

    // C. 초기화 버튼
    const btnReset = document.getElementById("btn-reset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (confirm("모든 지갑 자산 및 거래 내역을 초기화하시겠습니까?")) {
                localStorage.removeItem("선물시뮬레이터_모의매매상태");
                상태.지갑잔고 = 10000.00;
                상태.마진잔고 = 10000.00;
                상태.미실현손익 = 0.00;
                상태.대기주문 = [];
                상태.활성포지션 = [];
                상태.거래이력 = [];
                상태.주문아이디카운터 = 1;
                상태.포지션아이디카운터 = 1;

                모의매매상태저장();
                화면업데이트();
                재생효과음("sound-signal");
                alert("시뮬레이터가 성공적으로 초기화되었습니다.");
            }
        });
    }

    // D. 주문 탭 변경 (자동체결 / 시장가)
    const orderTabs = document.querySelectorAll(".order-type-tabs .order-tab");
    orderTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            orderTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const type = tab.dataset.type;
            const triggerGroup = document.getElementById("trigger-price-group");
            const btnSubmit = document.getElementById("btn-submit-order");

            if (type === "market") {
                if (triggerGroup) triggerGroup.classList.add("hidden");
                if (btnSubmit) btnSubmit.innerHTML = `<i class="fa-solid fa-bolt"></i> 즉시 시장가 진입`;
            } else {
                if (triggerGroup) triggerGroup.classList.remove("hidden");
                if (btnSubmit) btnSubmit.innerHTML = `<i class="fa-solid fa-bolt"></i> 자동 체결 예약 활성화`;
            }
            주문비용재연산();
        });
    });

    // E. 포지션 방향 선택 (LONG / SHORT)
    const btnLong = document.getElementById("btn-direction-long");
    const btnShort = document.getElementById("btn-direction-short");
    const btnSubmit = document.getElementById("btn-submit-order");

    if (btnLong && btnShort) {
        btnLong.addEventListener("click", () => {
            btnLong.classList.add("active");
            btnShort.classList.remove("active");
            if (btnSubmit) {
                btnSubmit.classList.remove("btn-sell-short");
                btnSubmit.classList.add("btn-buy-long");
            }
            주문비용재연산();
        });
        btnShort.addEventListener("click", () => {
            btnShort.classList.add("active");
            btnLong.classList.remove("active");
            if (btnSubmit) {
                btnSubmit.classList.remove("btn-buy-long");
                btnSubmit.classList.add("btn-sell-short");
            }
            주문비용재연산();
        });
    }

    // F. 레버리지 연동
    const inputLeverage = document.getElementById("input-leverage");
    const inputLeverageNum = document.getElementById("input-leverage-num");
    const leverageDisplay = document.getElementById("leverage-display");

    if (inputLeverage && inputLeverageNum && leverageDisplay) {
        const updateLeverage = (val) => {
            const valNum = Math.max(1, Math.min(125, parseInt(val) || 1));
            inputLeverage.value = valNum;
            inputLeverageNum.value = valNum;
            leverageDisplay.innerText = valNum + "x";

            const coin = 상태.코인목록[상태.기본코인];
            if (coin) {
                coin.레버리지 = valNum;
            }
            주문비용재연산();
        };

        inputLeverage.addEventListener("input", (e) => updateLeverage(e.target.value));
        inputLeverageNum.addEventListener("change", (e) => updateLeverage(e.target.value));
    }

    // G. 타점 현재가 설정 단축 버튼
    const btnSetCurrentPrice = document.getElementById("btn-set-current-price");
    if (btnSetCurrentPrice) {
        btnSetCurrentPrice.addEventListener("click", (e) => {
            e.preventDefault();
            const coin = 상태.코인목록[상태.기본코인];
            const triggerInput = document.getElementById("input-trigger-price");
            if (coin && triggerInput) {
                triggerInput.value = coin.현재가;
                주문비용재연산();
            }
        });
    }

    // H. 수량 조절 버튼
    const inputQty = document.getElementById("input-quantity");
    const btnQtyMinus = document.getElementById("btn-qty-minus");
    const btnQtyPlus = document.getElementById("btn-qty-plus");

    if (inputQty && btnQtyMinus && btnQtyPlus) {
        btnQtyMinus.addEventListener("click", () => {
            const coin = 상태.코인목록[상태.기본코인];
            const step = coin ? (coin.수량소수점 === 0 ? 1 : 1 / Math.pow(10, coin.수량소수점)) : 0.01;
            const curVal = parseFloat(inputQty.value) || 0;
            inputQty.value = Math.max(step, curVal - step).toFixed(coin ? coin.수량소수점 : 4);
            주문비용재연산();
        });
        btnQtyPlus.addEventListener("click", () => {
            const coin = 상태.코인목록[상태.기본코인];
            const step = coin ? (coin.수량소수점 === 0 ? 1 : 1 / Math.pow(10, coin.수량소수점)) : 0.01;
            const curVal = parseFloat(inputQty.value) || 0;
            inputQty.value = (curVal + step).toFixed(coin ? coin.수량소수점 : 4);
            주문비용재연산();
        });
        inputQty.addEventListener("input", () => {
            주문비용재연산();
        });
    }

    // I. 수량 비율 슬라이더 및 비율 단축 버튼 연동
    const qtySlider = document.getElementById("input-qty-slider");
    const qtySliderDisplay = document.getElementById("qty-slider-display");
    if (qtySlider && qtySliderDisplay) {
        qtySlider.addEventListener("input", (e) => {
            const ratio = parseInt(e.target.value);
            qtySliderDisplay.innerText = ratio + "%";
            비율기반주문수량연산(ratio);
        });
    }

    const pctBtns = document.querySelectorAll(".percent-selectors .btn-pct");
    pctBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const ratio = parseInt(btn.dataset.pct);
            if (qtySlider) qtySlider.value = ratio;
            if (qtySliderDisplay) qtySliderDisplay.innerText = ratio + "%";
            비율기반주문수량연산(ratio);
        });
    });

    // J. 익절/손절 체크박스 토글
    const chkTPSL = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");
    if (chkTPSL && tpslContainer) {
        chkTPSL.addEventListener("change", () => {
            if (chkTPSL.checked) {
                tpslContainer.classList.remove("hidden");
                // 현재 가격을 기반으로 적절한 TP/SL 가이드 설정
                const coin = 상태.코인목록[상태.기본코인];
                const btnLongActive = document.getElementById("btn-direction-long").classList.contains("active");
                const tpInput = document.getElementById("input-tp-price");
                const slInput = document.getElementById("input-sl-price");

                if (coin && tpInput && slInput) {
                    if (btnLongActive) {
                        tpInput.value = (coin.현재가 * 1.05).toFixed(coin.소수점);
                        slInput.value = (coin.현재가 * 0.97).toFixed(coin.소수점);
                    } else {
                        tpInput.value = (coin.현재가 * 0.95).toFixed(coin.소수점);
                        slInput.value = (coin.현재가 * 1.03).toFixed(coin.소수점);
                    }
                }
            } else {
                tpslContainer.classList.add("hidden");
            }
        });
    }

    // K. 주문 제출 버튼 클릭
    const btnSubmitOrder = document.getElementById("btn-submit-order");
    if (btnSubmitOrder) {
        btnSubmitOrder.addEventListener("click", () => {
            주문실행처리();
        });
    }

    // L. AI 설정 모달 핸들러
    const btnOpenAI = document.getElementById("btn-open-ai-modal");
    const btnCloseAI = document.getElementById("btn-close-ai-modal");
    const btnSaveAI = document.getElementById("btn-save-ai-settings");
    const aiModal = document.getElementById("ai-advisor-modal");

    if (btnOpenAI && btnCloseAI && aiModal) {
        btnOpenAI.addEventListener("click", () => {
            aiModal.classList.remove("hidden");
        });
        btnCloseAI.addEventListener("click", () => {
            aiModal.classList.add("hidden");
        });
    }
    if (btnSaveAI) {
        btnSaveAI.addEventListener("click", () => {
            AI자동매매설정저장();
        });
    }

    // M. AI ON/OFF 토글
    const btnAIToggle = document.getElementById("btn-mobile-ai-autotrade");
    if (btnAIToggle) {
        btnAIToggle.addEventListener("click", () => {
            상태.자동매매설정.자동매매활성화 = !상태.자동매매설정.자동매매활성화;
            if (상태.자동매매설정.자동매매활성화) {
                btnAIToggle.innerText = "ON";
                btnAIToggle.classList.add("active");
                alert("[AI 자동매매 가동] 선물 분석 엔진의 지시 타점에 맞춰 매수를 실행합니다.");
            } else {
                btnAIToggle.innerText = "OFF";
                btnAIToggle.classList.remove("active");
                alert("[AI 자동매매 정지] 수동 거래만 가능합니다.");
            }
            localStorage.setItem("선물시뮬레이터_자동매매활성화", 상태.자동매매설정.자동매매활성화);
        });
    }

    // N. 카카오 설정 모달 핸들러
    const btnOpenKakao = document.getElementById("btn-kakao-open");
    const btnCloseKakao = document.getElementById("btn-close-kakao-modal");
    const btnSaveKakao = document.getElementById("btn-save-kakao-settings");
    const kakaoModal = document.getElementById("kakao-config-modal");

    if (btnOpenKakao && btnCloseKakao && kakaoModal) {
        btnOpenKakao.addEventListener("click", () => {
            kakaoModal.classList.remove("hidden");
            const keyInput = document.getElementById("kakao-api-key");
            const uuidInput = document.getElementById("kakao-uuid");
            if (keyInput) keyInput.value = window.KakaoAutoSendInfo.key;
            if (uuidInput) uuidInput.value = window.KakaoAutoSendInfo.uuid;
        });
        btnCloseKakao.addEventListener("click", () => {
            kakaoModal.classList.add("hidden");
        });
    }
    if (btnSaveKakao) {
        btnSaveKakao.addEventListener("click", () => {
            카카오연동설정저장();
        });
    }

    // O. 포지션 세부 서브 탭 제어
    const posSubTabs = document.querySelectorAll(".position-tab-headers .pos-sub-tab");
    posSubTabs.forEach(subTab => {
        subTab.addEventListener("click", () => {
            posSubTabs.forEach(st => st.classList.remove("active"));
            subTab.classList.add("active");

            const subName = subTab.dataset.sub;
            const subPanes = document.querySelectorAll(".pos-sub-pane");
            subPanes.forEach(pane => pane.classList.remove("active"));

            const activePane = document.getElementById(`sub-pane-${subName}`);
            if (activePane) {
                activePane.classList.add("active");
            }
        });
    });

    // P. 호가 클릭 위임
    window.호가클릭 = function(price) {
        const triggerInput = document.getElementById("input-trigger-price");
        const orderTabs = document.querySelectorAll(".order-type-tabs .order-tab");
        
        // 자동으로 감시 타점 탭을 켜주고 가격 입력
        const autoTab = Array.from(orderTabs).find(t => t.dataset.type === "auto");
        if (autoTab && !autoTab.classList.contains("active")) {
            autoTab.click();
        }
        if (triggerInput) {
            triggerInput.value = price;
            주문비용재연산();
        }
    };
}

// 6. 실시간 자산 대비 수량 백분율 연산
function 비율기반주문수량연산(비율) {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const leverage = coin.레버리지;
    const inputQty = document.getElementById("input-quantity");
    if (!inputQty) return;

    // 실 진입 가능한 최대 마진
    const 가용마진 = 상태.지갑잔고 * (비율 / 100);
    // 레버리지 가중 실 매수 규모
    const 실질규모 = 가용마진 * leverage;
    // 수량 환산
    const 수량 = 실질규모 / coin.현재가;

    inputQty.value = 수량.toFixed(coin.수량소수점);
    주문비용재연산();
}

// 7. 실시간 시세 로드 및 백업 폴러 (REST API Fallbacks)
async function 최초시세로딩() {
    try {
        console.log("[Binance REST] 초기 전체 선물 가격 동기화...");
        let res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
        if (!res.ok) res = await fetch("https://api.binance.com/api/v3/ticker/price"); // 현물 백업
        
        if (res.ok) {
            const tickers = await res.json();
            const priceMap = {};
            tickers.forEach(t => {
                priceMap[t.symbol] = parseFloat(t.price);
            });

            Object.keys(상태.코인목록).forEach(symbol => {
                if (priceMap[symbol]) {
                    const price = priceMap[symbol];
                    const coin = 상태.코인목록[symbol];
                    coin.현재가 = price;
                    coin.어제종가 = price * 0.985;
                    coin.최고24h = price * 1.025;
                    coin.최저24h = price * 0.975;
                    const { 소수점, 수량소수점 } = 자동소수점결정(price);
                    coin.소수점 = 소수점;
                    coin.수량소수점 = 수량소수점;
                }
            });
        }
    } catch (err) {
        console.warn("[REST] 최초 전체 시세 동기화 실패:", err.message);
    }
}

async function 최초과거데이터로드() {
    await 특정코인캔들데이터로드();
}

// 특정 활성화된 코인의 과거 데이터를 바이낸스 REST API에서 가져와 Lightweight Chart에 바인딩합니다.
async function 특정코인캔들데이터로드() {
    const symbol = 상태.기본코인;
    const interval = 상태.차트.시간단위;
    const coin = 상태.코인목록[symbol];
    if (!coin || !상태.차트.메인차트) return;

    try {
        let res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=150`);
        if (!res.ok) res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=150`);

        const rawData = await res.json();
        const formattedCandles = rawData.map(c => ({
            time: Math.floor(c[0] / 1000),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        }));

        상태.차트.캔들데이터 = formattedCandles;
        coin.현재가 = formattedCandles[formattedCandles.length - 1].close;
        coin.어제종가 = formattedCandles[0].close;
        coin.최고24h = Math.max(...formattedCandles.map(c => c.high));
        coin.최저24h = Math.min(...formattedCandles.map(c => c.low));
        coin.캔들데이터 = [...formattedCandles];
        coin.가상시세여부 = false;

        const { 소수점, 수량소수점 } = 자동소수점결정(coin.현재가);
        coin.소수점 = 소수점;
        coin.수량소수점 = 수량소수점;

        // 차트 캔들 데이터 반영
        상태.차트.캔들시리즈.setData(formattedCandles);

        // 보조 이평지표 렌더링
        const closes = formattedCandles.map(c => c.close);
        const times = formattedCandles.map(c => c.time);
        
        상태.차트.EMA5시리즈.setData(매핑지표데이터(times, 계산EMA(closes, 5)));
        상태.차트.EMA20시리즈.setData(매핑지표데이터(times, 계산EMA(closes, 20)));
        상태.차트.SMA60시리즈.setData(매핑지표데이터(times, 계산SMA(closes, 60)));

        상태.차트.메인차트.timeScale().fitContent();

        console.log(`[Chart Sync] ${symbol} ${interval} 캔들 동기화 완료.`);
    } catch (err) {
        console.warn(`[REST/CORS Alert] ${symbol} ${interval} 과거 데이터 로드 실패. 가상 데이터 캔들 빌딩 시작.`);
        CORS가상캔들빌딩(symbol);
    }
}

function 매핑지표데이터(times, values) {
    return times.map((t, idx) => ({
        time: t,
        value: values[idx]
    })).filter(d => d.value !== undefined && !isNaN(d.value));
}

// 브라우저 CORS 차단 대비용 가상 캔들 빌더 (데스크톱 app.js V2 구조 이식)
function CORS가상캔들빌딩(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    const interval = 상태.차트.시간단위;
    let 최종가격 = coin.현재가 || 코인정의[symbol].시작가;
    let 봉단위초 = 60;
    if (interval === "1h") 봉단위초 = 3600;
    else if (interval === "4h") 봉단위초 = 14400;
    else if (interval === "1d") 봉단위초 = 86400;

    let 시간 = Math.floor(Date.now() / 1000);
    const 캔들들 = [];
    const 변동성 = symbol.startsWith("BTC") ? 0.001 : 0.0035;
    let 현재루프가격 = 최종가격;

    for (let i = 0; i < 150; i++) {
        let close = 현재루프가격;
        let change = 현재루프가격 * 변동성 * (Math.random() - 0.49) * 2;
        let open = close - change;
        let high = Math.max(open, close) + (현재루프가격 * 변동성 * Math.random() * 0.4);
        let low = Math.min(open, close) - (현재루프가격 * 변동성 * Math.random() * 0.4);

        캔들들.unshift({
            time: 시간,
            open: parseFloat(open.toFixed(coin.소수점)),
            high: parseFloat(high.toFixed(coin.소수점)),
            low: parseFloat(low.toFixed(coin.소수점)),
            close: parseFloat(close.toFixed(coin.소수점)),
            volume: parseFloat((Math.random() * 200 + 20).toFixed(2))
        });
        현재루프가격 = open;
        시간 -= 봉단위초;
    }

    상태.차트.캔들데이터 = 캔들들;
    coin.현재가 = 최종가격;
    coin.어제종가 = 캔들들[0].close;
    coin.최고24h = Math.max(...캔들들.map(c => c.high));
    coin.최저24h = Math.min(...캔들들.map(c => c.low));
    coin.캔들데이터 = [...캔들들];
    coin.가상시세여부 = true;

    // 차트 드로잉
    상태.차트.캔들시리즈.setData(캔들들);

    const closes = 캔들들.map(c => c.close);
    const times = 캔들들.map(c => c.time);
    상태.차트.EMA5시리즈.setData(매핑지표데이터(times, 계산EMA(closes, 5)));
    상태.차트.EMA20시리즈.setData(매핑지표데이터(times, 계산EMA(closes, 20)));
    상태.차트.SMA60시리즈.setData(매핑지표데이터(times, 계산SMA(closes, 60)));

    상태.차트.메인차트.timeScale().fitContent();

    // 경보 표시등 업데이트
    const statusDot = document.getElementById("binance-status-dot");
    const statusText = document.getElementById("binance-status-text");
    if (statusDot && statusText) {
        statusDot.style.backgroundColor = "#ff9800";
        statusDot.className = "status-dot animate-pulse";
        statusText.innerText = "CORS 차단 - 가상 시뮬레이션 시세 가동";
        statusText.className = "status-text text-yellow";
    }
}

// 8. 바이낸스 WebSocket 실시간 스트리밍
function 바이낸스웹소켓연결() {
    if (상태.웹소켓인스턴스) {
        상태.웹소켓인스턴스.close();
    }

    const streamsList = [];
    Object.keys(상태.코인목록).forEach(symbol => {
        const sym = symbol.toLowerCase();
        streamsList.push(`${sym}@kline_1m`);
        streamsList.push(`${sym}@depth5`);
    });

    const wsUrl = `wss://fstream.binance.com/stream?streams=${streamsList.join("/")}`;
    console.log("[Binance WS] 모바일 웹소켓 다중 채널 연결 시도...");
    상태.웹소켓인스턴스 = new WebSocket(wsUrl);

    상태.웹소켓인스턴스.onopen = () => {
        상태.웹소켓연결상태 = true;
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = "";
            statusDot.className = "status-dot green";
            statusText.innerText = "Binance 실시간 연결됨";
            statusText.className = "status-text text-green";
        }
    };

    상태.웹소켓인스턴스.onmessage = (event) => {
        const packet = JSON.parse(event.data);
        if (!packet.stream || !packet.data) return;

        const streamName = packet.stream;
        if (streamName.includes("kline")) {
            실시간캔들메시지파싱(packet.data);
        }
        if (streamName.includes("depth")) {
            실시간호가메시지파싱(packet.data, streamName.split("@")[0].toUpperCase());
        }
    };

    상태.웹소켓인스턴스.onclose = () => {
        상태.웹소켓연결상태 = false;
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.className = "status-dot pulse-red";
            statusText.innerText = "연결 끊김 (재연결 중)";
            statusText.className = "status-text text-red";
        }
        clearTimeout(상태.재연결타이머);
        상태.재연결타이머 = setTimeout(바이낸스웹소켓연결, 5000);
    };

    상태.웹소켓인스턴스.onerror = (err) => {
        console.error("웹소켓 에러:", err);
    };
}

// 9. 실시간 웹소켓 메시지 파싱 및 지표 연동
function 실시간캔들메시지파싱(data) {
    const symbol = data.s;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.가상시세여부 = false;

    const k = data.k;
    const candleTime = Math.floor(k.t / 1000);
    const 현재가 = parseFloat(k.c);
    const 실시간캔들 = {
        time: candleTime,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: 현재가,
        volume: parseFloat(k.v)
    };

    coin.현재가 = 현재가;

    const candles = coin.캔들데이터;
    if (candles.length === 0) {
        candles.push(실시간캔들);
    } else {
        const lastCandle = candles[candles.length - 1];
        if (candleTime === lastCandle.time) {
            candles[candles.length - 1] = 실시간캔들;
        } else if (candleTime > lastCandle.time) {
            candles.push(실시간캔들);
            if (candles.length > 300) candles.shift();

            // 신규 봉 확정 시 분석 실행
            분석및신호생성(symbol);
        }
    }

    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

    // 현재 포커스된 활성 코인일 경우 실시간 UI 업데이트
    if (symbol === 상태.기본코인) {
        const priceEl = document.getElementById("current-price");
        const obMidPriceEl = document.getElementById("ob-current-price");
        if (priceEl) {
            const 이전가 = parseFloat(priceEl.innerText.replace(/,/g, '')) || 현재가;
            priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            priceEl.className = "ticker-price " + (현재가 >= 이전가 ? "text-green" : "text-red");
        }
        if (obMidPriceEl) {
            obMidPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        }

        const 변동률 = ((현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeEl = document.getElementById("price-change-percent");
        if (changeEl) {
            changeEl.innerText = (변동률 >= 0 ? "+" : "") + 변동률 + "%";
            changeEl.className = "ticker-change " + (변동률 >= 0 ? "text-green" : "text-red");
        }

        // 단일 차트 실시간 드로잉 틱 갱신
        if (상태.차트.메인차트 && 상태.차트.캔들시리즈 && 상태.차트.캔들데이터.length > 0) {
            const interval = 상태.차트.시간단위;
            let 봉단위초 = 60;
            if (interval === "1h") 봉단위초 = 3600;
            else if (interval === "4h") 봉단위초 = 14400;
            else if (interval === "1d") 봉단위초 = 86400;

            const targetT = Math.floor(candleTime / 봉단위초) * 봉단위초;
            const lastChartCandle = 상태.차트.캔들데이터[상태.차트.캔들데이터.length - 1];

            if (targetT === lastChartCandle.time) {
                lastChartCandle.close = 현재가;
                if (현재가 > lastChartCandle.high) lastChartCandle.high = 현재가;
                if (현재가 < lastChartCandle.low) lastChartCandle.low = 현재가;
                상태.차트.캔들시리즈.update(lastChartCandle);
            } else if (targetT > lastChartCandle.time) {
                const newCandle = {
                    time: targetT,
                    open: 현재가,
                    high: 현재가,
                    low: 현재가,
                    close: 현재가,
                    volume: 실시간캔들.volume
                };
                상태.차트.캔들데이터.push(newCandle);
                if (상태.차트.캔들데이터.length > 300) 상태.차트.캔들데이터.shift();
                상태.차트.캔들시리즈.update(newCandle);
            }

            // 실시간 EMA/SMA 지표 라인 갱신
            const closesList = 상태.차트.캔들데이터.map(x => x.close);
            const ema5 = 계산EMA(closesList, 5);
            const ema20 = 계산EMA(closesList, 20);
            const sma60 = 계산SMA(closesList, 60);

            const activeCandle = 상태.차트.캔들데이터[상태.차트.캔들데이터.length - 1];
            상태.차트.EMA5시리즈.update({ time: activeCandle.time, value: ema5[ema5.length - 1] });
            상태.차트.EMA20시리즈.update({ time: activeCandle.time, value: ema20[ema20.length - 1] });
            상태.차트.SMA60시리즈.update({ time: activeCandle.time, value: sma60[sma60.length - 1] });
        }

        // 실시간 비용 및 위험 분석 연산
        주문비용재연산();
        AI추천분석및업데이트(symbol);
    }
}

function 실시간호가메시지파싱(data, symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.호가매도 = data.asks || data.a || [];
    coin.호가매수 = data.bids || data.b || [];

    if (symbol === 상태.기본코인) {
        호가창렌더링실제();
    }
}

// 10. 모바일 맞춤 호가창 렌더링 (Order Book Drawing)
function 호가창렌더링실제() {
    const asksList = document.getElementById("asks-list");
    const bidsList = document.getElementById("bids-list");
    const coin = 상태.코인목록[상태.기본코인];
    if (!asksList || !bidsList || !coin) return;

    // 매도 호가 5개 (Asks - 하향 역순 배열)
    const asks = coin.호가매도.slice(0, 5).reverse();
    업데이트호가UI(asksList, asks, coin, "asks-section", true);

    // 매수 호가 5개 (Bids)
    const bids = coin.호가매수.slice(0, 5);
    업데이트호가UI(bidsList, bids, coin, "bids-section", false);

    // 스프레드 연산
    if (coin.호가매도.length > 0 && coin.호가매수.length > 0) {
        const topBid = parseFloat(coin.호가매수[0][0]);
        const bottomAsk = parseFloat(coin.호가매도[0][0]);
        const spread = bottomAsk - topBid;
        const spreadPct = (spread / coin.현재가 * 100).toFixed(4);
        
        const spreadEl = document.getElementById("ob-spread-val");
        if (spreadEl) {
            spreadEl.innerText = `${spread.toFixed(coin.소수점)} (${spreadPct}%)`;
        }
    }
}

function 업데이트호가UI(container, data, coin, secClass, isReverse) {
    const rows = container.getElementsByClassName("ob-row");

    if (data.length === 0) return; // Flickering 방어

    while (rows.length < data.length) {
        const row = document.createElement("div");
        row.className = "ob-row";
        row.innerHTML = `
            <div class="ob-bar"></div>
            <span class="ob-price"></span>
            <span class="ob-size"></span>
            <span class="ob-total"></span>
        `;
        container.appendChild(row);
    }
    while (rows.length > data.length) {
        container.removeChild(rows[rows.length - 1]);
    }

    data.forEach((dataRow, idx) => {
        const price = parseFloat(dataRow[0]);
        const size = parseFloat(dataRow[1]);
        const cumulative = isReverse ? size * (data.length - idx) : size * (idx + 1);
        const depthPercent = Math.min(100, Math.max(5, (size / 3 * 100)));

        const row = rows[idx];
        row.setAttribute("onclick", `호가클릭(${price.toFixed(coin.소수점)})`);

        const bar = row.querySelector(".ob-bar");
        if (bar) bar.style.width = `${depthPercent}%`;

        const priceSpan = row.querySelector(".ob-price");
        if (priceSpan) {
            priceSpan.innerText = price.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            priceSpan.className = `ob-price ${secClass === 'asks-section' ? 'text-red' : 'text-green'}`;
        }

        const sizeSpan = row.querySelector(".ob-size");
        if (sizeSpan) sizeSpan.innerText = size.toFixed(coin.수량소수점);

        const totalSpan = row.querySelector(".ob-total");
        if (totalSpan) totalSpan.innerText = cumulative.toFixed(1);
    });
}

// 11. 실시간 주문 비용 및 리스크가드 연산 (Risk Guard Engine)
function 주문비용재연산() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const inputQty = document.getElementById("input-quantity");
    const inputLeverage = document.getElementById("input-leverage");
    const isLongActive = document.getElementById("btn-direction-long").classList.contains("active");
    const orderTabActive = document.querySelector(".order-type-tabs .order-tab.active");
    const isMarket = orderTabActive ? orderTabActive.dataset.type === "market" : false;

    if (!inputQty || !inputLeverage) return;

    const 수량 = parseFloat(inputQty.value) || 0;
    const 레버리지 = parseInt(inputLeverage.value) || 3;

    // 가격 결정 (자동체결 가격 또는 현재 가격)
    let 기준가 = coin.현재가;
    if (!isMarket) {
        const triggerInput = document.getElementById("input-trigger-price");
        if (triggerInput && triggerInput.value) {
            기준가 = parseFloat(triggerInput.value) || coin.현재가;
        }
    }

    const 실질규모 = 수량 * 기준가;
    const 증거금 = 실질규모 / 레버리지;

    // 주문 설정 영역 증거금 표기
    const estMarginEl = document.getElementById("estimated-margin");
    if (estMarginEl) estMarginEl.innerText = 증거금.toFixed(2);

    // Risk Guard 카드 갱신
    const riskEstimatedMargin = document.getElementById("risk-estimated-margin");
    const riskNotionalSize = document.getElementById("risk-notional-size");
    const riskLiqPrice = document.getElementById("risk-liquidation-price");
    const riskDistance = document.getElementById("risk-distance");
    const riskLevelTitle = document.getElementById("risk-level-title");
    const riskLevelBadge = document.getElementById("risk-level-badge");
    const riskMessage = document.getElementById("risk-message");
    const riskCard = document.getElementById("risk-check-card");

    if (riskEstimatedMargin) riskEstimatedMargin.innerText = 증거금.toFixed(2) + " USDT";
    if (riskNotionalSize) riskNotionalSize.innerText = 실질규모.toFixed(2) + " USDT";

    if (수량 <= 0) {
        if (riskLiqPrice) riskLiqPrice.innerText = "--";
        if (riskDistance) riskDistance.innerText = "--";
        return;
    }

    // 청산가 추정 연산 (유지마진 0.5% 적용)
    let 청산가 = 0;
    if (isLongActive) {
        청산가 = 기준가 * (1 - (1 / 레버리지) + 0.005);
    } else {
        청산가 = 기준가 * (1 + (1 / 레버리지) - 0.005);
    }
    const 청산가클램프 = Math.max(0, 청산가);
    if (riskLiqPrice) riskLiqPrice.innerText = 청산가클램프.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";

    // 청산까지의 가격 괴리 거리 계산
    const 거리 = Math.abs(coin.현재가 - 청산가클램프) / coin.현재가 * 100;
    if (riskDistance) riskDistance.innerText = 거리.toFixed(2) + "%";

    // 리스크 등급 진단
    let 위험도 = "보통 위험";
    let 뱃지클래스 = "risk-medium";
    let 메시지 = "주문 조건이 퀀트 리스크 기준에 부합합니다.";

    if (레버리지 >= 50 || 거리 < 2.0) {
        위험도 = "극도 위험";
        뱃지클래스 = "risk-high";
        메시지 = "⚠️ 레버리지가 과도하게 높거나 청산가가 너무 가깝습니다. 강제 청산 위험성이 매우 큽니다!";
    } else if (레버리지 <= 5 && 거리 > 15.0) {
        위험도 = "낮은 위험";
        뱃지클래스 = "risk-low";
        메시지 = "안정적인 증거금 비율입니다. 안전한 스윙 트레이딩 구간입니다.";
    }

    if (riskLevelTitle) riskLevelTitle.innerText = 위험도;
    if (riskLevelBadge) {
        riskLevelBadge.innerText = 위험도.split(" ")[0];
        riskLevelBadge.className = `risk-level-badge ${뱃지클래스}`;
    }
    if (riskMessage) riskMessage.innerText = 메시지;
}

// 12. 선물 매매 주문 실행 프로세스
function 주문실행처리() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const inputQty = document.getElementById("input-quantity");
    const inputLeverage = document.getElementById("input-leverage");
    const isLongActive = document.getElementById("btn-direction-long").classList.contains("active");
    const orderTabActive = document.querySelector(".order-type-tabs .order-tab.active");
    const isMarket = orderTabActive ? orderTabActive.dataset.type === "market" : false;

    if (!inputQty || !inputLeverage) return;

    const 수량 = parseFloat(inputQty.value) || 0;
    const 레버리지 = parseInt(inputLeverage.value) || 3;

    if (수량 <= 0) {
        alert("주문 수량을 입력해주세요.");
        return;
    }

    // TP/SL 설정 로드
    const chkTPSL = document.getElementById("chk-tpsl").checked;
    let 익절가 = 0;
    let 손절가 = 0;
    if (chkTPSL) {
        익절가 = parseFloat(document.getElementById("input-tp-price").value) || 0;
        손절가 = parseFloat(document.getElementById("input-sl-price").value) || 0;
    }

    if (isMarket) {
        // 즉시 시장가 체결 실행
        const 가상주문 = {
            심볼: 상태.기본코인,
            방향: isLongActive ? "LONG" : "SHORT",
            레버리지: 레버리지,
            수량: 수량,
            익절가: 익절가,
            손절가: 손절가
        };
        포지션체결실행(가상주문, coin.현재가);
    } else {
        // 자동 체결 예약 등록
        const triggerInput = document.getElementById("input-trigger-price");
        const 타점가격 = parseFloat(triggerInput.value) || 0;
        if (타점가격 <= 0) {
            alert("자동 체결을 위한 감시 가격을 입력해주세요.");
            return;
        }

        const 신규대기주문 = {
            아이디: 상태.주문아이디카운터++,
            심볼: 상태.기본코인,
            방향: isLongActive ? "LONG" : "SHORT",
            레버리지: 레버리지,
            수량: 수량,
            타점가격: 타점가격,
            익절가: 익절가,
            손절가: 손절가,
            등록시간: 얻는현재시각텍스트()
        };

        상태.대기주문.push(신규대기주문);
        모의매매상태저장();
        대기주문리스트렌더링();
        화면업데이트();
        재생효과음("sound-signal");
        alert(`[예약 완료] ${상태.기본코인} ${타점가격.toLocaleString()} USDT 도달 시 포지션이 자동 진입합니다.`);
    }
}

function 포지션체결실행(주문, 체결가) {
    // 중복 진입 방지 가드
    const 이미존재포지션 = 상태.활성포지션.find(pos => pos.심볼 === 주문.심볼);
    if (이미존재포지션) {
        새신호알림(주문.심볼, `[진입 거부] ${주문.심볼}에 이미 가동 중인 선물 포지션이 존재합니다.`, "short");
        return;
    }

    const 증거금 = (주문.수량 * 체결가) / 주문.레버리지;

    if (상태.지갑잔고 < 증거금) {
        새신호알림(주문.심볼, `[체결 거부] 증거금 부족으로 진입이 취소되었습니다. (필요: ${증거금.toFixed(2)} USDT)`, "short");
        alert("가용 지갑 잔고가 부족하여 주문 체결에 실패했습니다.");
        return;
    }

    상태.지갑잔고 -= 증거금;

    // 청산 추정가 계산
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
        자동마진: true, // 청산 방어 자동 마진 기본 가동
        체결시간: 얻는현재시각텍스트()
    };

    상태.활성포지션.push(신규포지션);
    재생효과음("sound-trigger");
    새신호알림(주문.심볼, `[포지션 체결] ${체결가.toLocaleString()} USDT에 ${주문.방향} ${주문.레버리지}x 진입 완료.`, "execution");

    // 카카오 알림톡 전송
    if (window.KakaoAutoSendInfo.enabled && window.KakaoAutoSendInfo.key) {
        카카오알림발송({
            코인명: 주문.심볼,
            방향: 주문.방향 + " 진입 (LONG)",
            현재가: 체결가.toLocaleString() + " USDT",
            RSI: "--",
            근거: `레버리지: ${주문.레버리지}x | 수량: ${주문.수량} (가상 모바일 체결)`
        });
    }

    모의매매상태저장();
    활성포지션리스트렌더링();
    화면업데이트();
}

// 13. 실시간 포지션 마진 정산 및 강제청산 감시 (Liquidation Loop)
function 실시간포지션마진정산() {
    if (상태.활성포지션.length === 0) {
        상태.미실현손익 = 0.00;
        상태.마진잔고 = 상태.지갑잔고;
        const pnlHeader = document.getElementById("header-unrealized-pnl");
        if (pnlHeader) {
            pnlHeader.innerText = "0.00 USDT (0.00%)";
            pnlHeader.className = "brief-val text-neutral";
        }
        return;
    }

    let 총미실현손익 = 0;
    let 청산대상인덱스들 = [];

    상태.활성포지션.forEach((pos, index) => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin || !coin.현재가 || coin.현재가 <= 0) return;

        let pnl = 0;
        if (pos.방향 === "LONG") {
            pnl = (coin.현재가 - pos.진입가) * pos.수량;
        } else {
            pnl = (pos.진입가 - coin.현재가) * pos.수량;
        }

        pos.미실현손익 = pnl;
        pos.수익률 = (pnl / pos.투입마진) * 100;
        총미실현손익 += pnl;

        // 🛡️ [자동 증거금 수혈 - 청산 예방 가드]
        if (pos.자동마진) {
            let 마진추가필요 = false;
            const 현재가 = coin.현재가;
            if (pos.방향 === "LONG" && 현재가 <= pos.청산가 * 1.02) {
                마진추가필요 = true;
            } else if (pos.방향 === "SHORT" && 현재가 >= pos.청산가 * 0.98) {
                마진추가필요 = true;
            }

            if (마진추가필요) {
                const 추가마진액 = pos.투입마진 * 0.5;
                if (상태.지갑잔고 >= 추가마진액) {
                    상태.지갑잔고 -= 추가마진액;
                    pos.투입마진 += 추가마진액;

                    // 청산가 재설정 공식
                    let 새청산가 = 0;
                    if (pos.방향 === "LONG") {
                        새청산가 = pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005);
                    } else {
                        새청산가 = pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
                    }
                    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
                    pos.수익률 = (pnl / pos.투입마진) * 100;

                    새신호알림(pos.심볼, `[🛡️ 마진 자동 수혈] 청산 가드 작동! **${추가마진액.toFixed(2)} USDT**가 지갑에서 긴급 추가되었습니다. (청산가: **${pos.청산가.toLocaleString()} USDT**)`, "long");
                    재생효과음("sound-trigger");
                }
            }
        }

        // 강제 청산 조건 검사
        let 청산발생 = false;
        const 현재가 = coin.현재가;
        if (pos.방향 === "LONG" && 현재가 <= pos.청산가) {
            청산발생 = true;
        } else if (pos.방향 === "SHORT" && 현재가 >= pos.청산가) {
            청산발생 = true;
        }

        if (청산발생) {
            청산대상인덱스들.push({ index: index, 사유: "LIQUIDATED" });
            return;
        }

        // TP/SL 타점 도달 검사
        let tpsl발생 = false;
        let tpsl종료가 = 현재가;

        if (pos.익절가 > 0) {
            if (pos.방향 === "LONG" && 현재가 >= pos.익절가) {
                tpsl발생 = true;
                tpsl종료가 = pos.익절가;
            } else if (pos.방향 === "SHORT" && 현재가 <= pos.익절가) {
                tpsl발생 = true;
                tpsl종료가 = pos.익절가;
            }
        }
        if (!tpsl발생 && pos.손절가 > 0) {
            if (pos.방향 === "LONG" && 현재가 <= pos.손절가) {
                tpsl발생 = true;
                tpsl종료가 = pos.손절가;
            } else if (pos.방향 === "SHORT" && 현재가 >= pos.손절가) {
                tpsl발생 = true;
                tpsl종료가 = pos.손절가;
            }
        }

        if (tpsl발생) {
            청산대상인덱스들.push({ index: index, 사유: "AUTO_TPSL", 정산가: tpsl종료가 });
        }
    });

    // 종료 대상이 있는 경우 역순 처리 (인덱스 꼬임 방지)
    if (청산대상인덱스들.length > 0) {
        청산대상인덱스들.sort((a, b) => b.index - a.index).forEach(t => {
            const 포지션 = 상태.활성포지션[t.index];
            if (t.사유 === "LIQUIDATED") {
                포지션종료실행(t.index, 포지션.청산가, "강제 마진 청산 (Liquidation)");
                재생효과음("sound-liquid");
            } else {
                포지션종료실행(t.index, t.정산가, "예약 목표가(TP/SL) 도달");
            }
        });
    }

    상태.미실현손익 = 총미실현손익;
    상태.마진잔고 = 상태.지갑잔고 + 상태.미실현손익 + 상태.활성포지션.reduce((sum, p) => sum + p.투입마진, 0);

    모의매매상태저장();
    화면업데이트();
    실시간포지션PNL업데이트();
}

function 포지션종료실행(인덱스, 종료가, 사유) {
    const pos = 상태.활성포지션[인덱스];
    if (!pos) return;

    const 수수료 = pos.수량 * 종료가 * 0.0004; // 0.04% 수수료율
    let pnl = 0;
    if (pos.방향 === "LONG") {
        pnl = (종료가 - pos.진입가) * pos.수량;
    } else {
        pnl = (pos.진입가 - 종료가) * pos.수량;
    }

    let 정산금 = pos.투입마진 + pnl - 수수료;
    if (사유.includes("청산")) {
        정산금 = 0;
        pnl = -pos.투입마진;
    }

    상태.지갑잔고 += Math.max(0, 정산금);

    // 거래 내역에 추가
    상태.거래이력.unshift({
        시간: 얻는현재시각텍스트(),
        심볼: pos.심볼,
        방향: pos.방향,
        레버리지: pos.레버리지,
        진입가: pos.진입가,
        종료가: 종료가,
        수량: pos.수량,
        수수료: 수수료,
        실현손익: pnl,
        사유: 사유
    });

    상태.활성포지션.splice(인덱스, 1);

    새신호알림(pos.심볼, `[포지션 종료] **${pos.심볼}** 포지션이 정산가 **${종료가.toLocaleString()} USDT**에 종료되었습니다. (사유: ${사유} | 손익: ${pnl.toFixed(2)} USDT)`, pnl >= 0 ? "long" : "short");

    // 카카오 알림 발송
    if (window.KakaoAutoSendInfo.enabled && window.KakaoAutoSendInfo.key) {
        카카오알림발송({
            코인명: pos.심볼,
            방향: "포지션 종료 (" + pos.방향 + ")",
            현재가: 종료가.toLocaleString() + " USDT",
            RSI: "--",
            근거: `정산손익: ${pnl.toFixed(2)} USDT (수수료: ${수수료.toFixed(3)} USDT) | 사유: ${사유}`
        });
    }

    모의매매상태저장();
    활성포지션리스트렌더링();
    거래이력리스트렌더링();
    화면업데이트();
}

function 수동포지션종료(아이디) {
    const idx = 상태.활성포지션.findIndex(p => p.아이디 === 아이디);
    if (idx !== -1) {
        const pos = 상태.활성포지션[idx];
        const coin = 상태.코인목록[pos.심볼];
        if (coin) {
            포지션종료실행(idx, coin.현재가, "수동 시장가 청산 (Market Close)");
        }
    }
}

// 14. 지정가 예약 주문 감시 루프
function 감시대기주문체결() {
    if (상태.대기주문.length === 0) return;

    let 체결인덱스들 = [];
    상태.대기주문.forEach((주문, idx) => {
        const coin = 상태.코인목록[주문.심볼];
        if (!coin || coin.가상시세여부 || !coin.현재가 || coin.현재가 <= 0) return;

        let 체결가능 = false;
        if (주문.방향 === "LONG") {
            if (coin.현재가 <= 주문.타점가격) 체결가능 = true;
        } else {
            if (coin.현재가 >= 주문.타점가격) 체결가능 = true;
        }

        if (체결가능) {
            체결인덱스들.push(idx);
            포지션체결실행(주문, coin.현재가);
        }
    });

    if (체결인덱스들.length > 0) {
        상태.대기주문 = 상태.대기주문.filter((_, idx) => !체결인덱스들.includes(idx));
        대기주문리스트렌더링();
        화면업데이트();
    }
}

function 대기주문취소(아이디) {
    const idx = 상태.대기주문.findIndex(o => o.아이디 === 아이디);
    if (idx !== -1) {
        상태.대기주문.splice(idx, 1);
        모의매매상태저장();
        대기주문리스트렌더링();
        화면업데이트();
        재생효과음("sound-signal");
    }
}

// 15. UI 동적 갱신 렌더러 (UI Dynamic Renderers)
function 화면업데이트() {
    // A. 지갑 상태 갱신
    const walletEl = document.getElementById("wallet-balance");
    const marginEl = document.getElementById("margin-balance");
    const pnlEl = document.getElementById("header-unrealized-pnl");

    if (walletEl) walletEl.innerText = 상태.지갑잔고.toLocaleString(undefined, { minimumFractionDigits: 2 }) + " USDT";
    if (marginEl) marginEl.innerText = 상태.마진잔고.toLocaleString(undefined, { minimumFractionDigits: 2 }) + " USDT";

    if (pnlEl) {
        const pnlPct = 상태.지갑잔고 > 0 ? (상태.미실현손익 / 상태.지갑잔고 * 100) : 0;
        pnlEl.innerText = `${상태.미실현손익 >= 0 ? "+" : ""}${상태.미실현손익.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT (${pnlPct.toFixed(2)}%)`;
        pnlEl.className = "brief-val " + (상태.미실현손익 > 0 ? "text-green" : (상태.미실현손익 < 0 ? "text-red" : "text-neutral"));
    }

    // B. 카운트 뱃지 갱신
    const activePosCnt = document.getElementById("active-pos-cnt");
    const pendingOrderCnt = document.getElementById("pending-order-cnt");
    const navPosBadge = document.getElementById("nav-pos-badge");

    const posCount = 상태.활성포지션.length;
    const pendingCount = 상태.대기주문.length;

    if (activePosCnt) activePosCnt.innerText = posCount;
    if (pendingOrderCnt) pendingOrderCnt.innerText = pendingCount;
    if (navPosBadge) {
        if (posCount > 0) {
            navPosBadge.innerText = posCount;
            navPosBadge.style.display = "inline-flex";
        } else {
            navPosBadge.style.display = "none";
        }
    }

    // C. 선택된 코인의 실시간 가격 UI 즉각 반영 (지연 로딩 방어)
    const coin = 상태.코인목록[상태.기본코인];
    if (coin) {
        const priceEl = document.getElementById("current-price");
        const obMidPriceEl = document.getElementById("ob-current-price");
        if (priceEl) {
            priceEl.innerText = coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        }
        if (obMidPriceEl) {
            obMidPriceEl.innerText = coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        }

        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeEl = document.getElementById("price-change-percent");
        if (changeEl) {
            changeEl.innerText = (변동률 >= 0 ? "+" : "") + 변동률 + "%";
            changeEl.className = "ticker-change " + (변동률 >= 0 ? "text-green" : "text-red");
        }
    }
}

function 활성포지션리스트렌더링() {
    const listWrapper = document.getElementById("active-positions-list");
    if (!listWrapper) return;

    if (상태.활성포지션.length === 0) {
        listWrapper.innerHTML = `<div class="empty-list-msg">활성화된 선물 포지션이 없습니다.</div>`;
        return;
    }

    let html = "";
    상태.활성포지션.forEach(pos => {
        const coin = 상태.코인목록[pos.심볼];
        const pnl = pos.미실현손익 || 0.0;
        const roi = pos.수익률 || 0.0;
        const curPrice = coin ? coin.현재가 : pos.진입가;

        html += `
            <div class="position-card ${pos.방향 === 'LONG' ? 'pos-long' : 'pos-short'}">
                <div class="pos-card-row header">
                    <div>
                        <span class="pos-sym">${pos.심볼}</span>
                        <span class="pos-direction-badge ${pos.방향 === 'LONG' ? 'long' : 'short'}">${pos.방향} ${pos.레버리지}x</span>
                    </div>
                    <span class="pos-pnl ${pnl >= 0 ? 'text-green' : 'text-red'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${roi.toFixed(2)}%)</span>
                </div>
                <div class="pos-detail-grid">
                    <div>
                        <span class="pos-lbl">진입가</span>
                        <span class="pos-val">${pos.진입가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</span>
                    </div>
                    <div>
                        <span class="pos-lbl">현재가</span>
                        <span class="pos-val">${curPrice.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</span>
                    </div>
                    <div>
                        <span class="pos-lbl">청산가</span>
                        <span class="pos-val text-yellow" style="font-weight:700;">${pos.청산가.toLocaleString(undefined, { minimumFractionDigits: coin ? coin.소수점 : 2 })}</span>
                    </div>
                    <div>
                        <span class="pos-lbl">마진</span>
                        <span class="pos-val">${pos.투입마진.toFixed(2)} USDT</span>
                    </div>
                </div>
                <div style="font-size: 9px; color: var(--color-text-muted); margin-bottom: 8px;">
                    익절: <span class="text-green">${pos.익절가 > 0 ? pos.익절가.toLocaleString() : '미지정'}</span> | 
                    손절: <span class="text-red">${pos.손절가 > 0 ? pos.손절가.toLocaleString() : '미지정'}</span>
                </div>
                <button class="btn-card-close" onclick="수동포지션종료(${pos.아이디})">시장가 청산 종료</button>
            </div>
        `;
    });

    listWrapper.innerHTML = html;
}

function 실시간포지션PNL업데이트() {
    상태.활성포지션.forEach(pos => {
        const cards = document.querySelectorAll("#active-positions-list .position-card");
        cards.forEach(card => {
            const sym = card.querySelector(".pos-sym").innerText;
            const dirBadge = card.querySelector(".pos-direction-badge").innerText;
            if (sym === pos.심볼 && dirBadge.includes(pos.방향)) {
                const pnlEl = card.querySelector(".pos-pnl");
                const curPriceEl = card.querySelector(".pos-detail-grid div:nth-child(2) .pos-val");

                const pnl = pos.미실현손익 || 0.0;
                const roi = pos.수익률 || 0.0;
                const coin = 상태.코인목록[pos.심볼];

                if (pnlEl) {
                    pnlEl.innerText = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${roi.toFixed(2)}%)`;
                    pnlEl.className = `pos-pnl ${pnl >= 0 ? 'text-green' : 'text-red'}`;
                }
                if (curPriceEl && coin) {
                    curPriceEl.innerText = coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
                }
            }
        });
    });
}

function 대기주문리스트렌더링() {
    const listWrapper = document.getElementById("pending-orders-list");
    if (!listWrapper) return;

    if (상태.대기주문.length === 0) {
        listWrapper.innerHTML = `<div class="empty-list-msg">대기 중인 자동 예약 타점이 없습니다.</div>`;
        return;
    }

    let html = "";
    상태.대기주문.forEach(ord => {
        html += `
            <div class="pending-card">
                <div class="pos-card-row header" style="border-bottom:none; margin-bottom:4px; padding-bottom:0;">
                    <div>
                        <span class="pos-sym">${ord.심볼}</span>
                        <span class="pos-direction-badge ${ord.방향 === 'LONG' ? 'long' : 'short'}" style="margin-left:6px;">${ord.방향} ${ord.레버리지}x</span>
                    </div>
                    <button class="btn-card-cancel" onclick="대기주문취소(${ord.아이디})">예약 취소</button>
                </div>
                <div class="pos-detail-grid" style="grid-template-columns: 1fr 1fr; margin-bottom:0;">
                    <div>
                        <span class="pos-lbl">타점 진입가</span>
                        <span class="pos-val text-yellow">${ord.타점가격.toLocaleString()} USDT</span>
                    </div>
                    <div>
                        <span class="pos-lbl">주문 수량</span>
                        <span class="pos-val">${ord.수량}</span>
                    </div>
                </div>
            </div>
        `;
    });

    listWrapper.innerHTML = html;
}

function 거래이력리스트렌더링() {
    const listWrapper = document.getElementById("trade-history-list");
    if (!listWrapper) return;

    if (상태.거래이력.length === 0) {
        listWrapper.innerHTML = `<div class="empty-list-msg">체결 이력이 존재하지 않습니다.</div>`;
        return;
    }

    let html = "";
    상태.거래이력.forEach(h => {
        html += `
            <div class="history-card">
                <div class="pos-card-row" style="margin-bottom:4px;">
                    <div>
                        <span class="pos-sym">${h.심볼}</span>
                        <span class="pos-direction-badge ${h.방향 === 'LONG' ? 'long' : 'short'}" style="margin-left:6px;">${h.방향} ${h.레버리지}x</span>
                    </div>
                    <span style="font-size:9px; color:var(--color-text-muted);">${h.시간}</span>
                </div>
                <div class="pos-detail-grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:4px;">
                    <div>
                        <span class="pos-lbl">진입가</span>
                        <span class="pos-val">${h.진입가.toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="pos-lbl">종료가</span>
                        <span class="pos-val">${h.종료가.toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="pos-lbl">실현손익</span>
                        <strong class="pos-val ${h.실현손익 >= 0 ? 'text-green' : 'text-red'}">${h.실현손익 >= 0 ? '+' : ''}${h.실현손익.toFixed(2)}</strong>
                    </div>
                </div>
                <div style="font-size:9px; color:var(--color-text-muted); text-align:right;">
                    사유: ${h.사유}
                </div>
            </div>
        `;
    });

    listWrapper.innerHTML = html;
}

// 16. 알림 메시지 발송기 (Notification Broker)
function 새신호알림(symbol, message, type) {
    console.log(`[Alert - ${type}] ${symbol} : ${message}`);
    
    // 매매 신호 브리핑룸 연동 (Tab 2)
    const feed = document.getElementById("live-signal-feed");
    if (feed) {
        // 기존 안내 메시지 삭제
        const neutralMsg = feed.querySelector(".neutral-msg");
        if (neutralMsg) feed.innerHTML = "";

        const item = document.createElement("div");
        item.className = `signal-item ${type === 'long' ? 'text-green' : (type === 'short' ? 'text-red' : 'text-yellow')}`;
        item.innerHTML = `<strong>[${얻는현재시각텍스트()}] ${symbol}</strong> : ${message}`;
        feed.insertBefore(item, feed.firstChild);

        // 최대 15개 유지
        const items = feed.getElementsByClassName("signal-item");
        if (items.length > 15) {
            feed.removeChild(items[items.length - 1]);
        }
    }
}

// 17. AI 자동매매 추천 타점 산출 및 백그라운드 자동매매
function AI추천분석및업데이트(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 15) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    // 보조지표 연산
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;

    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const sma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const vwapVal = 계산VWAP(coin.캔들데이터)[idx] || coin.현재가;

    // 롱/숏 비율 정보 바인딩
    const asksVolSum = coin.호가매도.slice(0, 5).reduce((a, b) => a + parseFloat(b[1]), 0);
    const bidsVolSum = coin.호가매수.slice(0, 5).reduce((a, b) => a + parseFloat(b[1]), 0);
    const totalVolSum = asksVolSum + bidsVolSum;
    const longRatio = totalVolSum > 0 ? Math.round(bidsVolSum / totalVolSum * 100) : 50;
    const shortRatio = 100 - longRatio;

    const adLongShort = document.getElementById("ad-long-short-flow");
    if (adLongShort) {
        adLongShort.innerHTML = `롱 풀 <span class="text-green">${longRatio}%</span> vs 숏 풀 <span class="text-red">${shortRatio}%</span>`;
    }

    // 뉴스 내용 바인딩
    const adNews = document.getElementById("ad-live-news-content");
    if (adNews) {
        const fundamentalMsg = (rsiVal > 65) ? "비이성적 과열 진입에 따른 공매도 수급 집중" : 
                               ((rsiVal < 35) ? "낙폭과대 매수 지지선 도달에 따른 분할매집 수급세 포착" : "박스권 횡보 수렴에 따른 방향성 관망 상태");
        adNews.innerText = fundamentalMsg;
    }

    // CME 갭 연산 업데이트
    CME갭연산및업데이트(symbol).then(() => {
        const adCme = document.getElementById("ad-cme-gap-status");
        if (adCme) {
            const cache = 상태.CME갭캐시[symbol];
            if (cache) {
                adCme.innerText = cache.간단결과 || cache.결과;
                adCme.className = cache.클래스;
            }
        }
    });
}

function 분석및신호생성(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 이전MACD = macdData.macd[idx - 1] || 0;
    const 이전MACD시그널 = macdData.signal[idx - 1] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const sma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const bbUpper = 계산볼린저밴드(closes, 20, 2).upper[idx] || coin.현재가 * 1.02;
    const bbLower = 계산볼린저밴드(closes, 20, 2).lower[idx] || coin.현재가 * 0.98;

    const 최고24h = Math.max(...highs.slice(idx - 100, idx + 1));
    const 최저24h = Math.min(...lows.slice(idx - 100, idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);

    let 신호방향 = null;
    let 근거 = [];

    //  Confluence 매매 신호 분석 판정
    const 롱지지 = coin.현재가 <= fiboLevels["50.0%"] || coin.현재가 <= bbLower;
    const 숏저항 = coin.현재가 >= fiboLevels["38.2%"] || coin.현재가 >= bbUpper;

    const 이평정배열 = ema20 >= sma60;
    const 이평역배열 = ema20 < sma60;

    const MACD골든크로스 = 이전MACD < 이전MACD시그널 && 현재MACD >= 현재MACD시그널;
    const MACD데드크로스 = 이전MACD > 이전MACD시그널 && 현재MACD <= 현재MACD시그널;

    if (롱지지 && 이평정배열 && (rsiVal <= 38 || MACD골든크로스)) {
        신호방향 = "LONG";
        if (rsiVal <= 38) 근거.push("RSI 침체");
        if (MACD골든크로스) 근거.push("MACD 크로스");
    } else if (숏저항 && 이평역배열 && (rsiVal >= 62 || MACD데드크로스)) {
        신호방향 = "SHORT";
        if (rsiVal >= 62) 근거.push("RSI 과열");
        if (MACD데드크로스) 근거.push("MACD 데드크로스");
    }

    if (신호방향) {
        const 근거텍스트 = 근거.join(" + ");
        새신호알림(symbol, `[AI 신호] **${신호방향 === 'LONG' ? '롱(LONG)' : '숏(SHORT)'}** 진입 신호 발생! (${근거텍스트})`, 신호방향 === "LONG" ? "long" : "short");
        재생효과음("sound-signal");

        // AI 자동매매 연동 처리
        if (상태.자동매매설정.자동매매활성화) {
            AI자동진입트리거(symbol, 신호방향, coin.현재가);
        }
    }
}

// AI 자동매매 포지션 진입 처리
function AI자동진입트리거(symbol, 방향, 현재가) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    if (상태.자동매매설정.중복방지) {
        const 이미존재 = 상태.활성포지션.some(p => p.심볼 === symbol);
        if (이미존재) return;
    }

    // 진입 가용 자금 산출
    const 투자비율 = 상태.자동매매설정.진입비율 / 100;
    const 투입자금 = 상태.지갑잔고 * 투자비율;
    const leverage = coin.레버리지 || 3;
    const 수량 = (투입자금 * leverage) / 현재가;

    if (수량 <= 0) return;

    // 익절/손절가 설정
    let 익절가 = 0;
    let 손절가 = 0;
    if (상태.자동매매설정.익절옵션 === "manual") {
        const 익절율 = 상태.자동매매설정.수동익절율 / 100;
        익절가 = 방향 === "LONG" ? 현재가 * (1 + 익절율 / leverage) : 현재가 * (1 - 익절율 / leverage);
    } else {
        // AI 자동 익절 (5% 변동 타점)
        익절가 = 방향 === "LONG" ? 현재가 * 1.05 : 현재가 * 0.95;
    }

    if (상태.자동매매설정.손절옵션 === "manual") {
        const 손절율 = 상태.자동매매설정.수동손절율 / 100;
        손절가 = 방향 === "LONG" ? 현재가 * (1 - 손절율 / leverage) : 현재가 * (1 + 손절율 / leverage);
    } else {
        // AI 자동 손절 (3% 변동 타점)
        손절가 = 방향 === "LONG" ? 현재가 * 0.97 : 현재가 * 1.03;
    }

    const 가상주문 = {
        심볼: symbol,
        방향: 방향,
        레버리지: leverage,
        수량: parseFloat(수량.toFixed(coin.수량소수점)),
        익절가: parseFloat(익절가.toFixed(coin.소수점)),
        손절가: parseFloat(손절가.toFixed(coin.소수점))
    };

    포지션체결실행(가상주문, 현재가);
}

// 18. 카카오톡 알림 전송 기능 (Kakao Alert Broker)
function 카카오알림발송(data) {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized() || !window.KakaoAutoSendInfo.uuid) return;

    const textContent = `[Antigravity 모바일 알림]\n\n코인: ${data.코인명}\n이벤트: ${data.방향}\n현재가: ${data.현재가}\n\n[상세 내용]\n${data.근거}`;

    Kakao.API.request({
        url: '/v2/api/talk/memo/default/send',
        data: {
            template_object: {
                object_type: 'text',
                text: textContent,
                link: { web_url: window.location.href, mobile_web_url: window.location.href },
                button_title: '모바일 시뮬레이터 확인'
            }
        },
        success: function(res) {
            console.log("카카오 알림 발송 성공:", res);
        },
        fail: function(error) {
            console.warn("카카오 알림 발송 실패:", error);
        }
    });
}

function 카카오연동설정저장() {
    const key = document.getElementById("kakao-api-key").value.trim();
    const uuid = document.getElementById("kakao-uuid").value.trim();

    if (!key) {
        alert("카카오 JavaScript 키를 입력해주세요.");
        return;
    }

    localStorage.setItem("kakaoJsKey", key);
    localStorage.setItem("kakaoUuid", uuid);

    window.KakaoAutoSendInfo.key = key;
    window.KakaoAutoSendInfo.uuid = uuid;
    window.KakaoAutoSendInfo.enabled = true;

    // Kakao SDK 초기화
    if (typeof Kakao !== 'undefined') {
        try {
            if (!Kakao.isInitialized()) Kakao.init(key);
            alert("카카오톡 알림 연동이 성공적으로 활성화되었습니다.");
            document.getElementById("kakao-config-modal").classList.add("hidden");
        } catch(e) {
            alert("SDK 초기화 실패: " + e.message);
        }
    }
}

// 19. AI 자동매매 설정 제어
function AI자동매매설정저장() {
    const marginPctInput = document.getElementById("mobile-ai-margin-pct");
    const tpOptInput = document.querySelector('input[name="mobile-ai-tp-opt"]:checked');
    const tpPctInput = document.getElementById("mobile-ai-tp-pct");
    const slOptInput = document.querySelector('input[name="mobile-ai-sl-opt"]:checked');
    const slPctInput = document.getElementById("mobile-ai-sl-pct");
    const overlapInput = document.getElementById("mobile-ai-overlap");

    if (marginPctInput) 상태.자동매매설정.진입비율 = parseInt(marginPctInput.value) || 10;
    if (tpOptInput) 상태.자동매매설정.익절옵션 = tpOptInput.value;
    if (tpPctInput) 상태.자동매매설정.수동익절율 = parseFloat(tpPctInput.value) || 10;
    if (slOptInput) 상태.자동매매설정.손절옵션 = slOptInput.value;
    if (slPctInput) 상태.자동매매설정.수동손절율 = parseFloat(slPctInput.value) || 5;
    if (overlapInput) 상태.자동매매설정.중복방지 = overlapInput.checked;

    localStorage.setItem("선물시뮬레이터_자동매매설정", JSON.stringify(상태.자동매매설정));
    alert("AI 퀀트 자동매매 설정이 저장 및 적용되었습니다.");
    document.getElementById("ai-advisor-modal").classList.add("hidden");
}

// 20. 로컬 스토리지 데이터 복원 및 연동 (Persistence & Recovery)
function 모의매매상태저장() {
    try {
        const data = {
            지갑잔고: 상태.지갑잔고,
            마진잔고: 상태.마진잔고,
            미실현손익: 상태.미실현손익,
            대기주문: 상태.대기주문,
            활성포지션: 상태.활성포지션,
            거래이력: 상태.거래이력,
            주문아이디카운터: 상태.주문아이디카운터,
            포지션아이디카운터: 상태.포지션아이디카운터
        };
        localStorage.setItem("선물시뮬레이터_모의매매상태", JSON.stringify(data));
    } catch(e) {
        console.error("데이터 저장 실패:", e);
    }
}

function 모의매매상태복원() {
    try {
        const raw = localStorage.getItem("선물시뮬레이터_모의매매상태");
        if (raw) {
            const data = JSON.parse(raw);
            if (data.지갑잔고 !== undefined) 상태.지갑잔고 = parseFloat(data.지갑잔고);
            if (data.마진잔고 !== undefined) 상태.마진잔고 = parseFloat(data.마진잔고);
            if (data.미실현손익 !== undefined) 상태.미실현손익 = parseFloat(data.미실현손익);
            if (data.대기주문 !== undefined) 상태.대기주문 = data.대기주문;
            if (data.활성포지션 !== undefined) 상태.활성포지션 = data.활성포지션;
            if (data.거래이력 !== undefined) 상태.거래이력 = data.거래이력;
            if (data.주문아이디카운터 !== undefined) 상태.주문아이디카운터 = parseInt(data.주문아이디카운터);
            if (data.포지션아이디카운터 !== undefined) 상태.포지션아이디카운터 = parseInt(data.포지션아이디카운터);
        }

        // 마지막 보고 있던 코인 복원
        const curCoin = localStorage.getItem("선물시뮬레이터_현재코인");
        if (curCoin && 코인정의[curCoin]) {
            상태.기본코인 = curCoin;
            상태.차트.코인심볼 = curCoin;
            const coinSelect = document.getElementById("mobile-coin-select");
            if (coinSelect) coinSelect.value = curCoin;
        }

        활성포지션리스트렌더링();
        대기주문리스트렌더링();
        거래이력리스트렌더링();
    } catch(e) {
        console.error("데이터 복원 실패:", e);
    }
}

function AI설정스토리지복원() {
    try {
        const raw = localStorage.getItem("선물시뮬레이터_자동매매설정");
        if (raw) {
            const data = JSON.parse(raw);
            if (data.진입비율 !== undefined) 상태.자동매매설정.진입비율 = parseInt(data.진입비율);
            if (data.익절옵션 !== undefined) 상태.자동매매설정.익절옵션 = data.익절옵션;
            if (data.수동익절율 !== undefined) 상태.자동매매설정.수동익절율 = parseFloat(data.수동익절율);
            if (data.손절옵션 !== undefined) 상태.자동매매설정.손절옵션 = data.손절옵션;
            if (data.수동손절율 !== undefined) 상태.자동매매설정.수동손절율 = parseFloat(data.수동손절율);
            if (data.중복방지 !== undefined) 상태.자동매매설정.중복방지 = !!data.중복방지;
        }

        const isEnabled = localStorage.getItem("선물시뮬레이터_자동매매활성화") === "true";
        상태.자동매매설정.자동매매활성화 = isEnabled;

        const btnAIToggle = document.getElementById("btn-mobile-ai-autotrade");
        if (btnAIToggle) {
            btnAIToggle.innerText = isEnabled ? "ON" : "OFF";
            if (isEnabled) btnAIToggle.classList.add("active");
        }

        const marginPctInput = document.getElementById("mobile-ai-margin-pct");
        if (marginPctInput) marginPctInput.value = 상태.자동매매설정.진입비율;

        const tpOptInput = document.querySelector(`input[name="mobile-ai-tp-opt"][value="${상태.자동매매설정.익절옵션}"]`);
        if (tpOptInput) tpOptInput.checked = true;

        const tpPctInput = document.getElementById("mobile-ai-tp-pct");
        if (tpPctInput) tpPctInput.value = 상태.자동매매설정.수동익절율;

        const slOptInput = document.querySelector(`input[name="mobile-ai-sl-opt"][value="${상태.자동매매설정.손절옵션}"]`);
        if (slOptInput) slOptInput.checked = true;

        const slPctInput = document.getElementById("mobile-ai-sl-pct");
        if (slPctInput) slPctInput.value = 상태.자동매매설정.수동손절율;

        const overlapInput = document.getElementById("mobile-ai-overlap");
        if (overlapInput) overlapInput.checked = 상태.자동매매설정.중복방지;

    } catch(e) {
        console.error("AI 설정 복원 실패:", e);
    }
}

function 카카오스토리지복원() {
    const key = localStorage.getItem("kakaoJsKey") || "";
    const uuid = localStorage.getItem("kakaoUuid") || "";
    window.KakaoAutoSendInfo = { key, uuid, enabled: !!key };

    if (key && typeof Kakao !== 'undefined') {
        try {
            if (!Kakao.isInitialized()) Kakao.init(key);
        } catch(e) {
            console.error("카카오 초기화 실패:", e);
        }
    }
}

// 21. 백업 REST 폴러
async function 실시간시세REST폴러() {
    if (상태.웹소켓연결상태) return; // 웹소켓이 정상이면 폴링 중단

    try {
        const symbol = 상태.기본코인;
        let res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
        if (!res.ok) res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);

        if (res.ok) {
            const data = await res.json();
            const price = parseFloat(data.price);
            const coin = 상태.코인목록[symbol];
            if (coin) {
                coin.현재가 = price;
                coin.가상시세여부 = false;

                // 캔들 및 가격 UI 갱신
                const fakeEvent = {
                    s: symbol,
                    k: {
                        t: Date.now(),
                        o: coin.현재가,
                        h: coin.현재가,
                        l: coin.현재가,
                        c: coin.현재가,
                        v: "10.0"
                    }
                };
                실시간캔들메시지파싱(fakeEvent);
            }
        }
    } catch(e) {
        console.warn("REST 폴링 시세 연동 실패:", e.message);
    }
}

// 22. 유틸리티 함수 (Utility Helpers)
function 얻는현재시각텍스트() {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function 재생효과음(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("효과음 재생 실패 (사용자 인터랙션 필요):", e));
    }
}

// 23. 수학적 퀀트 공식 모음 (Mathematical Quant Indicators)
function 계산SMA(data, period) {
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j];
        }
        result.push(sum / period);
    }
    return result;
}

function 계산EMA(data, period) {
    let result = [];
    let k = 2 / (period + 1);
    let ema = data[0];
    result.push(ema);
    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
        result.push(ema);
    }
    return result;
}

function 계산RSI(data, period) {
    let rsi = Array(data.length).fill(NaN);
    if (data.length <= period) return rsi;
    let gains = [];
    let losses = [];
    for (let i = 1; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    if (avgLoss === 0) rsi[period] = 100;
    else rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));
    for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
        if (avgLoss === 0) rsi[i] = 100;
        else rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    return rsi;
}

function 계산MACD(data, shortPeriod, longPeriod, signalPeriod) {
    const emaShort = 계산EMA(data, shortPeriod);
    const emaLong = 계산EMA(data, longPeriod);
    const macdLine = emaShort.map((val, idx) => val - emaLong[idx]);
    const signalLine = 계산EMA(macdLine, signalPeriod);
    const histogram = macdLine.map((val, idx) => val - signalLine[idx]);
    return { macd: macdLine, signal: signalLine, histogram: histogram };
}

function 계산CCI(highs, lows, closes, period = 20) {
    let cci = Array(closes.length).fill(NaN);
    if (closes.length < period) return cci;
    for (let i = period - 1; i < closes.length; i++) {
        let tpSum = 0;
        let tps = [];
        for (let j = 0; j < period; j++) {
            let idx = i - j;
            let tp = (highs[idx] + lows[idx] + closes[idx]) / 3;
            tps.push(tp);
            tpSum += tp;
        }
        let smaTp = tpSum / period;
        let meanDevSum = 0;
        for (let j = 0; j < period; j++) {
            meanDevSum += Math.abs(tps[j] - smaTp);
        }
        let meanDev = meanDevSum / period;
        let currentTp = (highs[i] + lows[i] + closes[i]) / 3;
        if (meanDev === 0) cci[i] = 0;
        else cci[i] = (currentTp - smaTp) / (0.015 * meanDev);
    }
    return cci;
}

function 계산스토캐스틱(highs, lows, closes, periodK = 14, periodD = 3, smoothingK = 3) {
    let fastK = Array(closes.length).fill(NaN);
    if (closes.length < periodK) return { k: fastK, d: fastK };
    for (let i = periodK - 1; i < closes.length; i++) {
        let currentClose = closes[i];
        let subHighs = highs.slice(i - periodK + 1, i + 1);
        let subLows = lows.slice(i - periodK + 1, i + 1);
        let highestHigh = Math.max(...subHighs);
        let lowestLow = Math.min(...subLows);
        if (highestHigh === lowestLow) fastK[i] = 50;
        else fastK[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
    let slowK = 계산SMA(fastK.map(v => isNaN(v) ? 0 : v), smoothingK);
    let slowD = 계산SMA(slowK.map(v => isNaN(v) ? 0 : v), periodD);
    return { k: slowK, d: slowD };
}

function 계산VWAP(candles) {
    let vwap = [];
    let cumulativeTPV = 0;
    let cumulativeVol = 0;
    candles.forEach(c => {
        let tp = (c.high + c.low + c.close) / 3;
        cumulativeTPV += tp * c.volume;
        cumulativeVol += c.volume;
        if (cumulativeVol === 0) vwap.push(c.close);
        else vwap.push(cumulativeTPV / cumulativeVol);
    });
    return vwap;
}

function 계산볼린저밴드(closes, period = 20, stdDevMultiplier = 2) {
    let basis = 계산SMA(closes, period);
    let upper = Array(closes.length).fill(NaN);
    let lower = Array(closes.length).fill(NaN);
    for (let i = period - 1; i < closes.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += Math.pow(closes[i - j] - basis[i], 2);
        }
        let stdDev = Math.sqrt(sum / period);
        upper[i] = basis[i] + stdDevMultiplier * stdDev;
        lower[i] = basis[i] - stdDevMultiplier * stdDev;
    }
    return { basis, upper, lower };
}

function 계산피보나치되돌림(high, low) {
    let diff = high - low;
    return {
        "0.0%": high,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.5,
        "61.8%": high - diff * 0.618,
        "78.6%": high - diff * 0.786,
        "100.0%": low
    };
}

// VPVR POC 계산
function 계산VPVR매물대(candles, priceDecimal = 2) {
    if (candles.length === 0) return { poc: 0, maxVol: 0 };
    let volProfile = {};
    let highest = Math.max(...candles.map(c => c.high));
    let lowest = Math.min(...candles.map(c => c.low));
    let range = highest - lowest;
    let step = range / 20;
    if (step <= 0) step = 0.01;
    candles.forEach(c => {
        let tp = (c.high + c.low + c.close) / 3;
        let bucketIdx = Math.floor((tp - lowest) / step);
        let bucketPrice = lowest + bucketIdx * step + step / 2;
        let key = bucketPrice.toFixed(priceDecimal);
        volProfile[key] = (volProfile[key] || 0) + c.volume;
    });
    let maxVol = 0;
    let poc = 0;
    Object.keys(volProfile).forEach(priceKey => {
        if (volProfile[priceKey] > maxVol) {
            maxVol = volProfile[priceKey];
            poc = parseFloat(priceKey);
        }
    });
    return { poc, volProfile };
}

// [CME 갭 분석]
async function CME갭연산및업데이트(symbol) {
    if (symbol !== "BTCUSDT" && symbol !== "ETHUSDT") {
        상태.CME갭캐시[symbol] = {
            결과: "N/A (CME 미상장 자산)",
            간단결과: "N/A (CME 미상장 자산)",
            클래스: "text-neutral",
            갱신시간: Date.now()
        };
        return;
    }
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`);
        if (!res.ok) throw new Error("CME Spot Klines Fetch Failed");
        const klines = await res.json();
        let fridayCloseCandle = null;
        let sundayOpenCandle = null;
        let sundayOpenIdx = -1;
        for (let i = klines.length - 1; i >= 0; i--) {
            const timeMs = klines[i][0];
            const date = new Date(timeMs);
            const day = date.getUTCDay();
            const hour = date.getUTCHours();
            if (!sundayOpenCandle && day === 0 && (hour >= 21 && hour <= 23)) {
                sundayOpenCandle = klines[i];
                sundayOpenIdx = i;
            }
            if (sundayOpenCandle && !fridayCloseCandle && day === 5 && (hour >= 20 && hour <= 22) && i < sundayOpenIdx) {
                fridayCloseCandle = klines[i];
            }
            if (sundayOpenCandle && fridayCloseCandle) break;
        }
        if (!fridayCloseCandle || !sundayOpenCandle) {
            상태.CME갭캐시[symbol] = {
                결과: "갭 미발생 (데이터 부족)",
                간단결과: "갭 미발생 (데이터 부족)",
                클래스: "text-neutral",
                갱신시간: Date.now()
            };
            return;
        }
        const fridayClose = parseFloat(fridayCloseCandle[4]);
        const sundayOpen = parseFloat(sundayOpenCandle[1]);
        const gapPrice = sundayOpen - fridayClose;
        const gapSize = Math.abs(gapPrice);
        const threshold = symbol === "BTCUSDT" ? 100 : 10;
        if (gapSize < threshold) {
            상태.CME갭캐시[symbol] = {
                결과: "갭 미발생 (안정적 흐름)",
                간단결과: "갭 미발생 (안정적 흐름)",
                클래스: "text-neutral",
                갱신시간: Date.now()
            };
            return;
        }
        const gapMin = Math.min(fridayClose, sundayOpen);
        const gapMax = Math.max(fridayClose, sundayOpen);
        let filled = false;
        let filledTime = "";
        for (let i = sundayOpenIdx; i < klines.length; i++) {
            const low = parseFloat(klines[i][3]);
            const high = parseFloat(klines[i][2]);
            if (low <= fridayClose && high >= fridayClose) {
                filled = true;
                const fillDate = new Date(klines[i][0]);
                filledTime = `${fillDate.getMonth()+1}/${fillDate.getDate()} ${fillDate.getHours()}시`;
                break;
            }
        }
        const gapTypeKo = gapPrice > 0 ? "상승 갭" : "하락 갭";
        if (filled) {
            상태.CME갭캐시[symbol] = {
                결과: `갭 메움 완료 (직전 갭: ${fridayClose.toLocaleString()} ~ ${sundayOpen.toLocaleString()} USDT)`,
                간단결과: `갭 메움 완료 (직전 ${gapTypeKo})`,
                클래스: "text-green",
                갱신시간: Date.now()
            };
        } else {
            상태.CME갭캐시[symbol] = {
                결과: `미해소 갭 (${gapTypeKo}, 갭가: ${gapMin.toLocaleString()} ~ ${gapMax.toLocaleString()} USDT)`,
                간단결과: `⚠️ 미해소 ${gapTypeKo} (크기: ${gapSize.toFixed(2)} USDT)`,
                클래스: "text-red animate-pulse",
                갱신시간: Date.now()
            };
        }
    } catch (err) {
        상태.CME갭캐시[symbol] = {
            결과: "분석 실패 (오류)",
            간단결과: "분석 실패 (오류)",
            클래스: "text-red",
            갱신시간: Date.now() - 180000
        };
    }
}
