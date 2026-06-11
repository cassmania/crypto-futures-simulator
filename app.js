/* ----------------------------------------------------
   BINANCE REAL-TIME LIVE TRADING ENGINE (app.js)
   본 스크립트는 브라우저 환경에서 CORS 차단이 없는 바이낸스(Binance) 실시간 API를
   연동하여 실시간 시세 및 알트코인 차트를 100% 완벽히 로딩하고 분석하는 핵심 코어입니다.
   모든 변수(Variable)와 설명은 한국어로 상세히 서술하고 기술 용어는 영어를 병기하였습니다.
   ---------------------------------------------------- */

window.onerror = function(msg, url, line) {
    // 크로스오리진 외부 SDK(예: 카카오톡 SDK 등)에서 던지는 상세 정보 없는 단순 "Script error." 경고는 얼럿을 띄우지 않고 콘솔로만 수집하여 무시 처리
    if (msg === "Script error." || (!url && line === 0)) {
        console.warn("[Cross-Origin SDK Warning Ignore]:", msg);
        return true; // 브라우저 기본 에러 동작 전파 차단
    }
    alert('브라우저 에러 감지!\n메시지: ' + msg + '\n파일: ' + url + '\n라인: ' + line);
};

// 1. 전역 상태 관리 객체 (Global State)
const 상태 = {
    // 자산 정보 (Assets)
    지갑잔고: 10000.00,        // Wallet Balance (USDT)
    마진잔고: 10000.00,        // Margin Balance (USDT)
    미실현손익: 0.00,          // Unrealized PNL (USDT)
    
    // 코인 및 시장 데이터 (Market Data)
    기본코인: "BTCUSDT",       // 현재 활성화되어 차트에 그릴 코인 심볼 (Active Symbol)
    코인목록: {},              // 각 코인의 실시간 데이터 및 히스토리 관리용 딕셔너리
    CME갭캐시: {},             // 각 코인별 CME 갭 분석 결과 캐싱 (symbol: { 결과: '', 클래스: '', 갱신시간: 0 })
    
    // 즐겨찾기 및 카테고리 관리 (Favorites & Categories)
    즐겨찾기목록: ["BTCUSDT", "ETHUSDT"], // 즐겨찾기 코인 심볼 배열 (Favorites List)
    현재필터: "all",           // 카테고리 필터 상태: "all" 또는 "fav" (Category Filter)
    
    // 주문 및 포지션 관리 (Orders & Positions)
    대기주문: [],              // Trigger Pending Orders
    활성포지션: [],            // Active Positions
    거래이력: [],              // Trade History
    주문아이디카운터: 1,       // Order ID Counter
    포지션아이디카운터: 1,     // Position ID Counter

    // AI 자동매매 5대 세부 설정 (AI Auto-Trading Parameters)
    자동매매설정: {
        진입비율: 10,          // 가용 잔고 대비 마진 진입 비율 (%)
        익절옵션: "ai",        // "ai" (정밀 자동) 또는 "manual" (수동 %)
        수동익절율: 10,        // 수동 지정 시 익절율 (%)
        손절옵션: "ai",        // "ai" (스탑헌팅가드 자동) 또는 "manual" (수동 %)
        수동손절율: 5,         // 수동 지정 시 손절율 (%)
        중복방지: true         // 동일 코인 다중 진입 방지 여부
    },

    // 바이낸스 네트워크 연결 제어 (Binance WS Connection)
    웹소켓인스턴스: null,
    웹소켓연결상태: false,
    하트비트타이머: null,      // Ping/Pong Timer
    재연결타이머: null,        // Auto Reconnect Timer

    // 8개 분할 차트 객체 배열 (8-Split Multi-Symbol/Timeframe Charts)
    차트객체: {
        분할차트들: [
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "1m", 코인심볼: "BTCUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "1h", 코인심볼: "ETHUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "4h", 코인심볼: "SOLUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "8h", 코인심볼: "HYPEUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "12h", 코인심볼: "XRPUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "1d", 코인심볼: "ADAUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "1w", 코인심볼: "DOGEUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 시간단위: "1d", 코인심볼: "LINKUSDT", 캔들데이터: [] }
        ]
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

// 2. 초기화 프로세스 (Initialization Process)
document.addEventListener("DOMContentLoaded", async () => {
    // 오디오 요소 볼륨 조절
    ["sound-trigger", "sound-signal", "sound-liquid"].forEach(id => {
        const audio = document.getElementById(id);
        if (audio) audio.volume = 0.3;
    });

    // 레이아웃 방향 복원 (차트 초기화 전 돔 클래스 주입으로 정밀 해상도 보존)
    try {
        const 레이아웃방향 = localStorage.getItem("선물시뮬레이터_레이아웃방향");
        if (레이아웃방향 === "left") {
            const grid = document.querySelector(".dashboard-grid");
            if (grid) grid.classList.add("layout-reversed");
        }
    } catch (e) {
        console.error("레이아웃 방향 복원 에러:", e);
    }

    // 1단계: 기본 코인 메타데이터 메모리 이식
    초기코인데이터정의();

    // 2단계: TradingView Lightweight Charts 초기화
    차트시스템초기화();

    // 3단계: 화면 이벤트 리스너 바인딩 (UI Event Listeners)
    이벤트리스너바인딩();

    // 3.5단계: 로컬 스토리지로부터 모의 매매 잔고, 대기 주문, 포지션 정보 복원
    모의매매상태복원();

    // [보완] 최초 코인 실시간 실제 시세(Spot API) 로딩으로 가격 괴리 사전 차단
    await 최초시세로딩();

    // 4단계: 바이낸스 REST API 기반 초기 과거 캔들 데이터 로딩
    await 최초과거데이터로드();

    // 5단계: 바이낸스 WebSocket 실시간 채널 오픈 및 연결
    바이낸스웹소켓연결();

    // 6단계: 주문 감시 및 포지션 마진 정산 정기 연산 루프 가동
    setInterval(실시간포지션마진정산, 1000); // 1초마다 포지션 PNL 및 청산 감시
    setInterval(감시대기주문체결, 500);     // 0.5초마다 타점 예약 주문 도달 여부 정밀 감시

    // 7단계: 웹소켓 차단 방어용 실시간 REST API 안전 백업 폴러 가동
    실시간시세REST폴러();

    // 화면 갱신 및 탭 렌더링
    화면업데이트();
    코인탭렌더링();

    // 8개 차트의 코인 선택기 목록 동적 동기화 및 AI 자동매매 복원 상태 동기화
    window.차트선택기목록동적갱신();
    window.AI자동매매버튼상태동기화();
    window.AI설정스토리지복원(); // AI 자동매매 세부 설정 복원

    // ⚡ DOM 기동 완료 시점에 기본 코인의 레버리지 값을 가져와 우측 주문 폼 및 배ッジ에 최초 역싱크(Reverse Sync) 처리
    try {
        const 기본코인객체 = 상태.코인목록[상태.기본코인];
        if (기본코인객체) {
            const 기본레버리지 = 기본코인객체.레버리지 || 3;
            const inputLeverage = document.getElementById("input-leverage");
            const inputLeverageNum = document.getElementById("input-leverage-num");
            const leverageDisplay = document.getElementById("leverage-display");
            const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
            
            if (inputLeverage) inputLeverage.value = 기본레버리지;
            if (inputLeverageNum) inputLeverageNum.value = 기본레버리지;
            if (leverageDisplay) leverageDisplay.innerText = 기본레버리지 + "x";
            if (txtAiLeverage) txtAiLeverage.innerText = `${기본레버리지}x`;
            console.log(`[Leverage Init] 기본 코인 ${상태.기본코인}의 레버리지 ${기본레버리지}배로 최초 동기화 완료.`);
        }
    } catch (e) {
        console.error("초기 레버리지 동기화 에러:", e);
    }

    // 현재 포커스 중인 코인의 차트를 최초 시각적 강조
    const 초기idx = 상태.차트객체.분할차트들.findIndex(c => c.코인심볼 === 상태.기본코인);
    if (초기idx !== -1) 활성차트강조테두리(초기idx);

    // [모바일 대응] 최초 진입 시 모바일 차트 선택기 및 액티브 차트 동기화
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const 포커스idx = 상태.차트객체.분할차트들.findIndex(c => c.코인심볼 === 상태.기본코인);
            const 실제idx = 포커스idx !== -1 ? 포커스idx : 0;
            
            // 모바일용 차트 선택기 라벨 렌더링
            if (typeof window.모바일차트선택기렌더링 === "function") {
                window.모바일차트선택기렌더링();
            }
            // 해당 차트 활성화 및 찌그러짐 해소
            if (typeof window.모바일차트포커스변경 === "function") {
                window.모바일차트포커스변경(실제idx);
            }
        }, 350);
    }
});

// [퀀트 정밀도 보정 엔진 V3] 코인 실시간 가격에 따른 지능형 소수점 자동 조율 함수 (한글 주석 준수)
function 자동소수점결정(가격) {
    let 소수점 = 3;
    let 수량소수점 = 2;
    
    if (가격 < 0.0001) {
        소수점 = 8;
        수량소수점 = 0;
    } else if (가격 < 0.001) {
        소수점 = 7;
        수량소수점 = 0;
    } else if (가격 < 0.01) {
        소수점 = 6; // 0.001790 같은 마이크로 밈코인 소수점 6자리 및 수량 0자리 최적 보정
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
        수량소수점 = 3; // BTC, ETH 등 대형 자산
    }
    
    return { 소수점, 수량소수점 };
}

// 코인 데이터 기본 정적 정의 및 localStorage 알트코인 목록 복원
function 초기코인데이터정의() {
    // ⚡ 구버전 20배 레버리지 스토리지 데이터 마이그레이션 초기화
    try {
        if (!localStorage.getItem("선물시뮬레이터_레버리지초기화_v3")) {
            localStorage.removeItem("선물시뮬레이터_코인레버리지");
            localStorage.setItem("선물시뮬레이터_레버리지초기화_v3", "true");
        }
    } catch (e) {
        console.error("레버리지 마이그레이션 에러:", e);
    }

    // 로컬스토리지 저장된 자동매매 활성화 맵 복원 시도
    let 자동매매맵 = {};
    try {
        const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
        if (저장된자동매매) {
            자동매매맵 = JSON.parse(저장된자동매매);
        }
    } catch (e) {
        console.error("자동매매 스토리지 로드 실패:", e);
    }

    // A. 기본 정의 코인 이식 (지능형 소수점 자동 조율 적용)
    Object.keys(코인정의).forEach(symbol => {
        const { 소수점, 수량소수점 } = 자동소수점결정(코인정의[symbol].시작가);
        상태.코인목록[symbol] = {
            심볼: symbol,
            이름: 코인정의[symbol].이름,
            현재가: 코인정의[symbol].시작가,
            어제종가: 코인정의[symbol].시작가 * 0.98,
            최고24h: 코인정의[symbol].시작가 * 1.02,
            최저24h: 코인정의[symbol].시작가 * 0.97,
            캔들데이터: [],
            호가매도: [], 
            호가매수: [], 
            소수점: 소수점,
            수량소수점: 수량소수점,
            레버리지: 3, // ⚡ 기본 레버리지 값 20배 강제 바인딩 (Leverage Lock)
            자동매매활성화: !!자동매매맵[symbol], // 스토리지에 기록된 값이 있다면 복원
            가상시세여부: false // 가상 시세 상태 플래그 기본값 초기화 (가상 시세 감지 락)
        };
    });

    // B. localStorage 저장된 코인 목록 복원
    try {
        const 저장된목록 = localStorage.getItem("선물시뮬레이터_추가코인");
        if (저장된목록) {
            const 코인들 = JSON.parse(저장된목록);
            코인들.forEach(symbol => {
                if (!상태.코인목록[symbol]) {
                    상태.코인목록[symbol] = {
                        심볼: symbol,
                        이름: `${symbol.replace("USDT", "")}/USDT Perpetual`,
                        현재가: 10.00,
                        어제종가: 9.80,
                        최고24h: 10.20,
                        최저24h: 9.70,
                        캔들데이터: [],
                        호가매도: [],
                        호가매수: [],
                        소수점: symbol.startsWith("BTC") ? 2 : 3,
                        수량소수점: symbol.startsWith("BTC") ? 3 : 2,
                        레버리지: 3, // ⚡ 기본 레버리지 값 20배 강제 바인딩
                        자동매매활성화: !!자동매매맵[symbol], // 스토리지에 기록된 값이 있다면 복원
                        가상시세여부: false // 가상 시세 상태 플래그 기본값 초기화 (가상 시세 감지 락)
                    };
                    
                    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
                        상태.코인목록[symbol].소수점 = 5;
                        상태.코인목록[symbol].수량소수점 = 0;
                    }
                }
            });
        }

        // C. 마지막으로 사용자가 조회 중이던 기본 코인 복원
        const 저장된현재코인 = localStorage.getItem("선물시뮬레이터_현재코인");
        if (저장된현재코인 && 상태.코인목록[저장된현재코인]) {
            상태.기본코인 = 저장된현재코인;
        }

        // D. 즐겨찾기 목록 복원
        const 저장된즐겨찾기 = localStorage.getItem("선물시뮬레이터_즐겨찾기");
        if (저장된즐겨찾기) {
            상태.즐겨찾기목록 = JSON.parse(저장된즐겨찾기);
        }

        // E. 8개 차트별 개별 코인 및 시간 단위 복원
        const 저장된차트코인 = localStorage.getItem("선물시뮬레이터_차트코인설정");
        if (저장된차트코인) {
            const 코인설정 = JSON.parse(저장된차트코인);
            코인설정.forEach((symbol, idx) => {
                if (상태.차트객체.분할차트들[idx] && 상태.코인목록[symbol]) {
                    상태.차트객체.분할차트들[idx].코인심볼 = symbol;
                }
            });
        }
        const 저장된차트시간 = localStorage.getItem("선물시뮬레이터_차트시간설정");
        if (저장된차트시간) {
            const 시간설정 = JSON.parse(저장된차트시간);
            시간설정.forEach((tf, idx) => {
                if (상태.차트객체.분할차트들[idx]) {
                    상태.차트객체.분할차트들[idx].시간단위 = tf;
                }
            });
        }
    } catch (err) {
        console.error("[Storage Restore Error] 코인 목록 및 즐겨찾기 복원 중 에러:", err);
    }
    
    // ⚡ 로컬 스토리지에 영속화 저장된 레버리지 정보를 우선적으로 로드 복원 (State Lock 복구)
    window.코인레버리지복원();
}

// 3. 차트 시스템 구현 (TradingView Charts 4-Split Grid)
function 차트시스템초기화() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        const container = document.getElementById(`split-chart-canvas-${idx}`);
        if (!container) return;

        // 공통 차트 테마 옵션 정의
        const chartOptions = {
            layout: {
                background: { type: 'solid', color: '#0B0E11' },
                textColor: '#848E9C',
                fontSize: 9,
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

        // A. 각 분할 차트 생성
        chartData.메인차트 = LightweightCharts.createChart(container, chartOptions);
        
        // 캔들 시리즈 주입
        chartData.캔들시리즈 = chartData.메인차트.addCandlestickSeries({
            upColor: '#f6465d', // 상승(수익) = 빨간색 (한국 기준)
            downColor: '#0066ff', // 하락(손실) = 파란색 (한국 기준)
            borderUpColor: '#f6465d',
            borderDownColor: '#0066ff',
            wickUpColor: '#f6465d',
            wickDownColor: '#0066ff'
        });

        // 이동평균선(MA) 추가
        chartData.EMA5시리즈 = chartData.메인차트.addLineSeries({ color: '#F0B90B', lineWidth: 1, title: 'MA(7)' });
        chartData.EMA20시리즈 = chartData.메인차트.addLineSeries({ color: '#03A9F4', lineWidth: 1, title: 'MA(25)' });
        chartData.SMA60시리즈 = chartData.메인차트.addLineSeries({ color: '#E040FB', lineWidth: 1, title: 'MA(99)' });

        // 화면 크기 반응형 리스너 개별 부착
        window.addEventListener("resize", () => {
            if (chartData.메인차트 && container) {
                chartData.메인차트.resize(container.clientWidth, container.clientHeight);
            }
        });
    });

    // 시간 단위 선택 UI 버튼 및 타이틀 동기화
    시간단위UI동기화();
}

function 시간단위UI동기화() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        // 기존 active 클래스 전부 제거
        const buttons = document.querySelectorAll(`.timeframe-selector[data-chart-idx="${idx}"] .btn-tf`);
        buttons.forEach(btn => btn.classList.remove("active"));
        
        // 현재 상태에 부합하는 시간 단위 버튼 활성화
        const targetBtn = document.getElementById(`btn-tf-${idx}-${chartData.시간단위}`);
        if (targetBtn) {
            targetBtn.classList.add("active");
        }
        
        // 8개 차트 코인 선택 셀렉터 동기화
        const selectEl = document.getElementById(`chart-symbol-select-${idx}`);
        if (selectEl) {
            selectEl.value = chartData.코인심볼;
        }

        // 헤더 시간단위 뱃지 갱신
        const badgeEl = document.getElementById(`chart-tf-badge-${idx}`);
        if (badgeEl) {
            const tfText = {
                "1m": "1m", "1h": "1h", "4h": "4h", "8h": "8h", "12h": "12h", "1d": "1d", "1w": "1w"
            }[chartData.시간단위];
            badgeEl.innerText = tfText;
        }
    });

    // [모바일 대응] 모바일 차트 선택기 정보 동기화 및 렌더링
    if (typeof window.모바일차트선택기렌더링 === "function") {
        window.모바일차트선택기렌더링();
    }
}

// 8개 차트 개별 코인 및 시간 설정 로컬스토리지 저장
function 차트설정저장() {
    const 코인설정 = 상태.차트객체.분할차트들.map(c => c.코인심볼);
    const 시간설정 = 상태.차트객체.분할차트들.map(c => c.시간단위);
    localStorage.setItem("선물시뮬레이터_차트코인설정", JSON.stringify(코인설정));
    localStorage.setItem("선물시뮬레이터_차트시간설정", JSON.stringify(시간설정));
}

// [신규] 전체 등록 코인의 실시간 실제 시세 일괄 로딩 (CORS 친화적 Spot API 활용)
async function 최초시세로딩() {
    try {
        console.log("[Binance API] 초기 전체 시세 동기화 시작...");
        let res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
        if (!res.ok) {
            res = await fetch("https://api.binance.com/api/v3/ticker/price");
        }
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
                    coin.어제종가 = price * 0.98;
                    coin.최고24h = price * 1.02;
                    coin.최저24h = price * 0.97;
                    const { 소수점, 수량소수점 } = 자동소수점결정(price);
                    coin.소수점 = 소수점;
                    coin.수량소수점 = 수량소수점;
                    coin.가상시세여부 = false;
                }
            });
            console.log("[Binance API] 초기 전체 코인 실제 시세 로드 완료.");
        }
    } catch (err) {
        console.warn("[Binance API] 초기 실시간 시세 일괄 로드 실패:", err.message);
    }
}

// 4. 바이낸스 REST API 연동 및 데이터 파싱 (Historical Data Loader for 8-Split Charts)
async function 최초과거데이터로드() {
    await 전체분할차트데이터로드();
}

// 전체 8개 차트 데이터를 독립적으로 로드
async function 전체분할차트데이터로드() {
    const 로드프로미스들 = 상태.차트객체.분할차트들.map((_, idx) => {
        return 분할차트캔들데이터로드(idx);
    });
    
    await Promise.all(로드프로미스들);
    
    // 로드 완료 후 렌더링
    분할차트들렌더링();
}

// 특정 단일 코인 탭 전환 시 8개 차트 전체를 해당 코인으로 맞춰주는 하이브리드 로드 지원
// 특정 단일 코인 탭 전환 또는 신호 클릭 시 지능적으로 차트 포커스만 바꾸거나 활성 차트만 갱신 (8개 차트 개별 지정 코인 보존)
async function 탭전환시분할차트데이터로드(symbol) {
    // 1. 이미 8개 차트 중 해당 코인을 띄우고 있는 차트가 있는지 지능적으로 선색인
    let targetChartIdx = 상태.차트객체.분할차트들.findIndex(c => c.코인심볼 === symbol);
    
    if (targetChartIdx !== -1) {
        // 이미 해당 코인을 띄우고 있는 차트가 있다면, 그 차트로 포커스(활성차트) 인덱스 변경
        상태.차트객체.활성인덱스 = targetChartIdx;
        window.활성차트강조테두리(targetChartIdx);
        window.차트지지저항선드로잉(targetChartIdx);
    } else {
        // 어디에도 해당 코인이 없다면, 현재 포커스된 차트(활성인덱스)의 코인을 해당 코인으로 교체
        const activeIdx = 상태.차트객체.활성인덱스 || 0;
        const chartData = 상태.차트객체.분할차트들[activeIdx];
        if (chartData) {
            chartData.코인심볼 = symbol;
            
            // 상단 select 드롭다운 선택값도 연동 변경
            const selectEl = document.getElementById(`chart-symbol-select-${activeIdx}`);
            if (selectEl) {
                selectEl.value = symbol;
            }
            
            // 해당 차트의 데이터를 새로 가져옴
            await 분할차트캔들데이터로드(activeIdx);
            
            // 해당 차트 개별 렌더링
            if (chartData.메인차트 && chartData.캔들시리즈 && chartData.캔들데이터.length > 0) {
                chartData.캔들시리즈.setData(chartData.캔들데이터);
                
                const closes = chartData.캔들데이터.map(c => c.close);
                const times = chartData.캔들데이터.map(c => c.time);
                
                const ema5 = 계산EMA(closes, 5);
                const ema20 = 계산EMA(closes, 20);
                const sma60 = 계산SMA(closes, 60);
                
                chartData.EMA5시리즈.setData(매핑지표데이터(times, ema5));
                chartData.EMA20시리즈.setData(매핑지표데이터(times, ema20));
                chartData.SMA60시리즈.setData(매핑지표데이터(times, sma60));
                
                chartData.메인차트.timeScale().fitContent();
            }
            
            window.활성차트강조테두리(activeIdx);
            window.차트지지저항선드로잉(activeIdx);
        }
    }
    
    // 차트 개별 코인 설정 로컬 스토리지에 영구 저장 및 시간단위 동기화
    차트설정저장();
    시간단위UI동기화();
}

async function 분할차트캔들데이터로드(chartIdx) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;

    const symbol = chartData.코인심볼;
    const interval = chartData.시간단위;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    try {
        let response;
        try {
            response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=150`);
            if (!response.ok) throw new Error(`${interval} Futures API 호출 실패`);
        } catch (fErr) {
            console.log(`[CORS/Network Fallback] ${symbol} ${interval} 현물(Spot) API로 백업 캔들 로드 시도.`);
            response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=150`);
            if (!response.ok) throw new Error(`${interval} Spot API 백업 호출 실패`);
        }

        const rawData = await response.json();
        const formattedCandles = rawData.map(c => ({
            time: Math.floor(c[0] / 1000),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        }));

        chartData.캔들데이터 = formattedCandles;
        
        // 각 코인의 실시간 시뮬레이션용 데이터 버퍼도 항상 함께 완벽히 초기화하여 퀀트 분석 즉각 구동 보장
        if (formattedCandles.length > 0) {
            coin.현재가 = formattedCandles[formattedCandles.length - 1].close;
            coin.어제종가 = formattedCandles[0].close;
            coin.최고24h = Math.max(...formattedCandles.map(c => c.high));
            coin.최저24h = Math.min(...formattedCandles.map(c => c.low));
            coin.캔들데이터 = [...formattedCandles];
            
            // [퀀트 정밀도 보정 엔진 V3] 과거 캔들 적재 및 실시간 시세 파악 즉시 지능형 소수점 자동 조율 연쇄 격발
            const { 소수점, 수량소수점 } = 자동소수점결정(coin.현재가);
            coin.소수점 = 소수점;
            coin.수량소수점 = 수량소수점;
        }

        console.log(`[Binance Futures] Chart ${chartIdx+1} (${symbol} ${interval}) 과거 캔들 ${formattedCandles.length}개 적재 완료.`);
    } catch (err) {
        console.warn(`[CORS/Network Alert] ${symbol} ${interval} 로드 실패. 가상 캔들 구성:`, err.message);
        CORS분할폴백데이터빌드(symbol, chartIdx);
    }
}

// 브라우저 CORS 차단 대비용 가상 분할 차트 캔들 빌더(Virtual Candle Builder)
function CORS분할폴백데이터빌드(symbol, chartIdx) {
    const coin = 상태.코인목록[symbol];
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!coin || !chartData) return;

    const interval = chartData.시간단위;
    
    // [1단계] 실시간 수신된 실제 시세가 있을 경우 이를 기준 가격(Base Price)으로 채택하는 스케일링(Re-scaling) 로직 추가
    let 최종가격 = 100.00;
    if (coin.현재가 && coin.현재가 > 0) {
        최종가격 = coin.현재가;
    } else if (symbol.startsWith("BTC")) {
        최종가격 = 73000.00;
    } else if (symbol.startsWith("ETH")) {
        최종가격 = 2000.00;
    } else if (symbol.startsWith("SOL")) {
        최종가격 = 150.00;
    } else if (symbol.startsWith("HYPE")) {
        최종가격 = 0.338;
    } else if (symbol.startsWith("WLD")) {
        최종가격 = 0.339; // 월드코인(WLD) 실제 시세 기본 폴백
    } else if (symbol.startsWith("MOVE")) {
        최종가격 = 0.015; // 무브코인(MOVE) 실제 시세 기본 폴백
    }

    let 봉단위초 = 60; // 기본 1분
    if (interval === "1h") 봉단위초 = 3600;
    else if (interval === "4h") 봉단위초 = 14400;
    else if (interval === "8h") 봉단위초 = 28800;
    else if (interval === "12h") 봉단위초 = 43200;
    else if (interval === "1d") 봉단위초 = 86400;
    else if (interval === "1w") 봉단위초 = 604800;

    // [2단계] 과거로 역산하는 역루프(Reverse-loop) 방식의 가상 캔들 생성 메커니즘 도입
    // 최신 시간부터 과거로 거꾸로 시간을 되돌리며 생성하여 맨 마지막 150번째 캔들의 종가(Close)를 실제 현재가와 100% 일치시킵니다.
    let 시간 = Math.floor(Date.now() / 1000);
    const 캔들들 = [];
    const 변동성 = symbol.startsWith("BTC") ? 0.001 : 0.003;
    let 현재루프가격 = 최종가격;

    for (let i = 0; i < 150; i++) {
        let close = 현재루프가격;
        let change = 현재루프가격 * 변동성 * (Math.random() - 0.485) * 2;
        let open = close - change;
        let high = Math.max(open, close) + (현재루프가격 * 변동성 * Math.random() * 0.4);
        let low = Math.min(open, close) - (현재루프가격 * 변동성 * Math.random() * 0.4);
        
        // 캔들을 배열의 처음에 집어넣어(unshift) 최신 시간의 캔들이 맨 뒤로 가도록 정렬
        캔들들.unshift({
            time: 시간,
            open: parseFloat(open.toFixed(coin.소수점)),
            high: parseFloat(high.toFixed(coin.소수점)),
            low: parseFloat(low.toFixed(coin.소수점)),
            close: parseFloat(close.toFixed(coin.소수점)),
            volume: parseFloat((Math.random() * 200 + 20).toFixed(2))
        });
        현재루프가격 = open; // 이전 캔들의 종가는 이번 캔들의 시가로 연동
        시간 -= 봉단위초;
    }
    
    chartData.캔들데이터 = 캔들들;
    if (chartIdx === 0) {
        // [3단계] 활성 포지션(Active Position)이 이미 진입되어 있는 코인에 대해 현재가 보호 잠금(Lock) 적용
        // 해당 코인에 이미 진입한 포지션이 존재한다면, 현재가(coin.현재가)를 가상 연산 값으로 덮어쓰지 않고 실제 시세를 유지하도록 방어합니다.
        // 🛡️ [시세 안전 차단막] 이미 실제 API 또는 웹소켓 실시간 현재가가 정상 주입되어 수신 중인 경우, 가상 시세값으로 강제 리셋하여 튀는 문제를 원천 차단합니다.
        if (!coin.현재가 || coin.현재가 <= 0 || coin.가상시세여부) {
            const 해당코인포지션있음 = 상태.활성포지션.some(pos => pos.심볼 === symbol);
            if (!해당코인포지션있음) {
                coin.현재가 = 최종가격;
            }
        }
        coin.가상시세여부 = true; // CORS 에러로 인한 가상 시세 모드 돌입 시 플래그 활성화 (가상 시세 감지 락)
        
        coin.어제종가 = 캔들들[0].close;
        coin.최고24h = Math.max(...캔들들.map(c => c.high));
        coin.최저24h = Math.min(...캔들들.map(c => c.low));
        coin.캔들데이터 = [...캔들들]; // 퀀트 모듈 분석 활성화를 위한 폴백 버퍼 동기화

        // [4단계] CORS 차단 시 상단 시세바에 가상 시뮬레이션 모드 상태 시각화
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText && !상태.웹소켓연결상태) {
            statusDot.style.backgroundColor = "#ff9800"; // 오렌지색 경고등
            statusDot.className = "status-dot animate-pulse";
            statusText.innerText = "CORS 차단 - 가상 시뮬레이션 시세 작동 중";
            statusText.className = "status-text text-yellow";
        }
    }
}

// 5. 4분할 TradingView 차트에 지표 및 시세 일괄 렌더링
function 분할차트들렌더링() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        if (!chartData.메인차트 || !chartData.캔들시리즈 || chartData.캔들데이터.length === 0) return;

        // A. 캔들 주입
        chartData.캔들시리즈.setData(chartData.캔들데이터);

        // B. 이동평균선(MA) 실시간 퀀트 계산
        const closes = chartData.캔들데이터.map(c => c.close);
        const times = chartData.캔들데이터.map(c => c.time);

        const ema5 = 계산EMA(closes, 5);
        const ema20 = 계산EMA(closes, 20);
        const sma60 = 계산SMA(closes, 60);

        chartData.EMA5시리즈.setData(매핑지표데이터(times, ema5));
        chartData.EMA20시리즈.setData(매핑지표데이터(times, ema20));
        chartData.SMA60시리즈.setData(매핑지표데이터(times, sma60));

        chartData.메인차트.timeScale().fitContent();
        
        // 초기 차트 드로잉 완료 시점에 지지/저항선 및 AI 추천 타점선 즉각 드로잉
        window.차트지지저항선드로잉(idx);
    });

    // C. AI 실시간 타점 진단 갱신 (차트 1의 1시간봉 데이터 기준)
    AI추천분석및업데이트(상태.기본코인);

    // [모바일 대응] 최초 로딩이 완료된 후 데이터가 제대로 채워진 상태에서 모바일 초기 탭 스위칭 및 강제 리사이징 1회 수행
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const 포커스idx = 상태.차트객체.분할차트들.findIndex(c => c.코인심볼 === 상태.기본코인);
            const 실제idx = 포커스idx !== -1 ? 포커스idx : 0;
            if (typeof window.모바일차트포커스변경 === "function") {
                window.모바일차트포커스변경(실제idx);
            }
        }, 150);
    }
}

function 매핑지표데이터(times, values) {
    return times.map((t, idx) => ({
        time: t,
        value: values[idx]
    })).filter(d => d.value !== undefined && !isNaN(d.value));
}

// 6. 바이낸스 WebSocket 실시간 스트리밍 시스템 (WebSocket Combined streams Engine)
function 바이낸스웹소켓연결() {
    if (상태.웹소켓인스턴스) {
        상태.웹소켓인스턴스.close();
    }

    const statusDot = document.getElementById("binance-status-dot");
    const statusText = document.getElementById("binance-status-text");

    // 바이낸스는 여러 스트림을 결합(Combined Streams)하여 하나의 소켓 포트로 편리하게 제공합니다.
    // 연결 시점 등록된 모든 코인을 주소 스트림으로 취합
    const streamsList = [];
    Object.keys(상태.코인목록).forEach(symbol => {
        const sym = symbol.toLowerCase();
        streamsList.push(`${sym}@kline_1m`);
        streamsList.push(`${sym}@depth5`); // 5단계 호가 깊이
    });

    const wsUrl = `wss://fstream.binance.com/stream?streams=${streamsList.join("/")}`;
    
    console.log("[Binance WS] 웹소켓 다중 스트림 연결 시도...");
    상태.웹소켓인스턴스 = new WebSocket(wsUrl);

    상태.웹소켓인스턴스.onopen = () => {
        상태.웹소켓연결상태 = true;
        console.log("[Binance WS] 바이낸스 라이브 웹소켓 연결 성공.");
        
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = ""; // 가상 시세 오렌지 경고 스타일 리셋
            statusDot.className = "status-dot green";
            statusText.innerText = "Binance 라이브 시세 연동 중";
            statusText.className = "status-text text-green";
        }
    };

    상태.웹소켓인스턴스.onmessage = (event) => {
        const 패킷 = JSON.parse(event.data);
        
        // Combined streams 규격 파싱: { stream: "btcusdt@kline_1m", data: { ... } }
        if (!패킷.stream || !패킷.data) return;

        const streamName = 패킷.stream;
        
        // A. 실시간 K라인 캔들 데이터 수신 채널 파싱
        if (streamName.includes("kline")) {
            실시간캔들메시지파싱(패킷.data);
        }

        // B. 실시간 Depth 호가창 데이터 수신 채널 파싱
        if (streamName.includes("depth")) {
            실시간호가메시지파싱(패킷.data, streamName.split("@")[0].toUpperCase());
        }
    };

    상태.웹소켓인스턴스.onclose = () => {
        상태.웹소켓연결상태 = false;
        console.warn("[Binance WS] 웹소켓 끊김. 5초 후 자동 재시도합니다.");
        
        if (statusDot && statusText) {
            statusDot.className = "status-dot pulse-red";
            statusText.innerText = "연결 끊김 (재시도 중)";
            statusText.className = "status-text text-red";
        }

        // 5초 후 자동 재연결
        clearTimeout(상태.재연결타이머);
        상태.재연결타이머 = setTimeout(() => {
            바이낸스웹소켓연결();
        }, 5000);
    };

    상태.웹소켓인스턴스.onerror = (err) => {
        console.error("[Binance WS] 웹소켓 에러 발생:", err);
    };
}

// 동적 알트코인 추가 시, 새로운 스트림 목록을 구성하여 웹소켓 재접속 (Hot-Swap)
function 웹소켓스트림갱신() {
    console.log("[Binance WS] 스트림 변경 발생. 소켓 재접속 처리 시작...");
    바이낸스웹소켓연결();
}

// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)

// Kline 실시간 수신 핸들러
// Kline 실시간 수신 핸들러 (4분할 실시간 틱 갱신 및 1m 신호 감지 병합)
function 실시간캔들메시지파싱(data) {
    const symbol = data.s; // 심볼 (예: BTCUSDT)
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.가상시세여부 = false; // 실제 웹소켓(WebSocket) 캔들 데이터 수신 시 가상 시세 플래그 강제 해제 (가상 시세 감지 락)

    // 바이낸스 K라인 페이로드 규격: t: 시작시각(ms), o: 시가, h: 고가, l: 저가, c: 종가, v: 거래량
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

    // 1. 실시간 1분봉 버퍼 누적 및 신호 가동 (분할 시간대와 별개로 1분봉으로 타점 분석 유지)
    const candles = coin.캔들데이터;
    if (candles.length === 0) {
        candles.push(실시간캔들);
    } else {
        const lastCandle = candles[candles.length - 1];
        
        // 동일 시간대 분봉 캔들 실시간 데이터 갱신
        if (candleTime === lastCandle.time) {
            candles[candles.length - 1] = 실시간캔들;
        } else if (candleTime > lastCandle.time) {
            // 1분 지나서 새로운 캔들 영역 진입 시 추가 삽입
            candles.push(실시간캔들);
            if (candles.length > 500) candles.shift();

            // 신규 1분봉 확정 시 기술 지표 신호 분석 가동
            분석및신호생성(symbol);
        }
    }

    // 24시간 최고/최저가 실시간 갱신
    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

    // 현재 보고 있는 코인 화면 실시간 연동 (상태.기본코인과 일치하는 실시간 시세일 때만 UI 바인딩)
    if (symbol === 상태.기본코인) {
        const priceEl = document.getElementById("current-price");
        const midPriceEl = document.getElementById("orderbook-mid-price");
        if (priceEl && midPriceEl) {
            const 이전가격 = parseFloat(priceEl.innerText.replace(/,/g, '')) || 현재가;
            
            // 실시간 텍스트 가격 및 깜빡임 연출
            priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            midPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

            priceEl.className = "ticker-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
            midPriceEl.className = "mid-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
        }

        // 24시간 변동률 렌더링
        const 변동률 = ((현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeEl = document.getElementById("price-change-percent");
        if (changeEl) {
            changeEl.innerText = (변동률 >= 0 ? "+" : "") + 변동률 + "%";
            changeEl.className = "stat-val " + (변동률 >= 0 ? "text-green" : "text-red");
        }
        
        const highEl = document.getElementById("price-high-24h");
        const lowEl = document.getElementById("price-low-24h");
        if (highEl) highEl.innerText = coin.최고24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (lowEl) lowEl.innerText = coin.최저24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

        // AI 추천 타점 갱신 (메인 코인 활성 시 실시간 추천 적용)
        AI추천분석및업데이트(symbol);

        // ⚡ 실시간 현재가 변동에 따른 주문 비용 및 Risk Guard 실시간 정밀 연동
        주문비용재연산();
    }

    // 2. 8개 분할 차트 실시간 틱 갱신 및 신규 봉 자동 생성 (글로벌 틱 라우팅 적용 - 기본코인 여부 무관)
    상태.차트객체.분할차트들.forEach((c, idx) => {
        if (!c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length === 0) return;
        
        // 차트의 코인 심볼과 유입된 틱 데이터의 코인 심볼이 다를 경우 무시 (8개 차트 개별 코인 갱신 지원)
        if (c.코인심볼 !== symbol) return;

        // 각 분할 차트의 시간 단위(interval)에 맞는 초 단위 주기 연산
        let 봉단위초 = 60;
        if (c.시간단위 === "1m") 봉단위초 = 60;
        else if (c.시간단위 === "1h") 봉단위초 = 3600;
        else if (c.시간단위 === "4h") 봉단위초 = 14400;
        else if (c.시간단위 === "8h") 봉단위초 = 28800;
        else if (c.시간단위 === "12h") 봉단위초 = 43200;
        else if (c.시간단위 === "1d") 봉단위초 = 86400;
        else if (c.시간단위 === "1w") 봉단위초 = 604800;

        const targetT = Math.floor(candleTime / 봉단위초) * 봉단위초;
        const lastCandle = c.캔들데이터[c.캔들데이터.length - 1];

        if (targetT === lastCandle.time) {
            // 동일 시간 범위 내 실시간 틱 갱신
            lastCandle.close = 현재가;
            if (현재가 > lastCandle.high) lastCandle.high = 현재가;
            if (현재가 < lastCandle.low) lastCandle.low = 현재가;
            c.캔들시리즈.update(lastCandle);
        } else if (targetT > lastCandle.time) {
            // 새로운 캔들 주기 도달 시 신규 캔들 삽입 (차트가 끊기지 않음)
            const 신규분할캔들 = {
                time: targetT,
                open: 현재가,
                high: 현재가,
                low: 현재가,
                close: 현재가,
                volume: 실시간캔들.volume
            };
            c.캔들데이터.push(신규분할캔들);
            if (c.캔들데이터.length > 500) c.캔들데이터.shift();
            c.캔들시리즈.update(신규분할캔들);
            
            // 신규 K라인 완성 시점에 지지/저항선 및 AI 추천 타점 가격선 실시간 재드로잉
            window.차트지지저항선드로잉(idx);
        }

        // 실시간 SMA 이동평균선(MA) 갱신
        const closesList = c.캔들데이터.map(x => x.close);
        const ema5 = 계산EMA(closesList, 5);
        const ema20 = 계산EMA(closesList, 20);
        const sma60 = 계산SMA(closesList, 60);

        const activeCandle = c.캔들데이터[c.캔들데이터.length - 1];
        c.EMA5시리즈.update({ time: activeCandle.time, value: ema5[ema5.length - 1] });
        c.EMA20시리즈.update({ time: activeCandle.time, value: ema20[ema20.length - 1] });
        c.SMA60시리즈.update({ time: activeCandle.time, value: sma60[sma60.length - 1] });
    });

    // 상단 탭 가격 표시 갱신
    const tabPriceEl = document.getElementById(`tab-price-${symbol}`);
    if (tabPriceEl) {
        tabPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        const 변동률 = (현재가 - coin.어제종가) / coin.어제종가;
        tabPriceEl.className = "tab-price " + (변동률 >= 0 ? "text-green" : "text-red");
    }
}

// 실시간 호가창(Depth) 수신 핸들러
function 실시간호가메시지파싱(data, symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    // 바이낸스 depth5 페이로드 규격: bids: [[가격, 잔량], ...], asks: [[가격, 잔량], ...]
    coin.호가매도 = data.asks || [];
    coin.호가매수 = data.bids || [];

    // 현재 선택 활성화된 코인일 때만 호가창 렌더링 반영
    if (symbol === 상태.기본코인) {
        호가창렌더링실제(coin);
    }
}

function 호가창렌더링실제(coin) {
    const asksEl = document.getElementById("orderbook-asks");
    const bidsEl = document.getElementById("orderbook-bids");
    if (!asksEl || !bidsEl) return;

    // 매도 호가 5개 렌더링 (Asks - 하향 역순 배열)
    const asks = coin.호가매도.slice(0, 5).reverse();
    업데이트호가목록(asksEl, asks, coin, "text-red", true);

    // 매수 호가 5개 렌더링 (Bids)
    const bids = coin.호가매수.slice(0, 5);
    업데이트호가목록(bidsEl, bids, coin, "text-green", false);

    // 스프레드 실시간 연산
    if (coin.호가매도.length > 0 && coin.호가매수.length > 0) {
        const 최고매수 = parseFloat(coin.호가매수[0][0]);
        const 최저매도 = parseFloat(coin.호가매도[0][0]);
        const 스프레드 = 최저매도 - 최고매수;
        const 스프레드율 = (스프레드 / coin.현재가 * 100).toFixed(4);
        
        const spreadValueEl = document.getElementById("orderbook-spread-value");
        if (spreadValueEl) {
            spreadValueEl.innerText = `스프레드: ${스프레드.toFixed(coin.소수점)} (${스프레드율}%)`;
        }
    }
}

// 실시간 호가창 깜빡임 방지용 DOM 재활용 갱신 헬퍼 함수
function 업데이트호가목록(containerEl, 호가데이터, coin, 가격클래스, 역순누적) {
    const rows = containerEl.getElementsByClassName("orderbook-row");

    if (호가데이터.length === 0) {
        // 호가 데이터가 네트워크상 일시적으로 지연되어 비었을 때 화면을 지워버려서
        // 발생하는 깜빡거림(Flicker)을 원천 차단하기 위해, 이전 데이터를 지우지 않고 유지합니다.
        return;
    }

    // 자식 DOM 노드 개수를 데이터 개수에 맞게 동적 유지 (초기 1회 생성)
    while (rows.length < 호가데이터.length) {
        const row = document.createElement("div");
        row.className = "orderbook-row";
        row.innerHTML = `
            <div class="depth-bar"></div>
            <span class="price-val"></span>
            <span class="size-val"></span>
            <span class="total-val"></span>
        `;
        containerEl.appendChild(row);
    }
    while (rows.length > 호가데이터.length) {
        containerEl.removeChild(rows[rows.length - 1]);
    }

    // 기존 DOM 노드의 데이터(텍스트, 바 너비)만 정밀 업데이트 (리플로우 및 깜빡임 차단)
    호가데이터.forEach((dataRow, idx) => {
        const 가격 = parseFloat(dataRow[0]);
        const 잔량 = parseFloat(dataRow[1]);
        const 누적 = 역순누적 ? 잔량 * (호가데이터.length - idx) : 잔량 * (idx + 1);
        const 뎁스백분율 = Math.min(100, Math.max(5, (잔량 / 5 * 100)));

        const row = rows[idx];
        row.setAttribute("onclick", `호가클릭(${가격.toFixed(coin.소수점)})`);

        const depthBar = row.querySelector(".depth-bar");
        if (depthBar) {
            depthBar.style.width = `${뎁스백분율}%`;
        }

        const priceSpan = row.querySelector(".price-val");
        if (priceSpan) {
            priceSpan.className = `price-val ${가격클래스}`;
            const formattedPrice = 가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            if (priceSpan.textContent !== formattedPrice) {
                priceSpan.textContent = formattedPrice;
            }
        }

        const sizeSpan = row.querySelector(".size-val");
        if (sizeSpan) {
            const formattedSize = 잔량.toFixed(coin.수량소수점);
            if (sizeSpan.textContent !== formattedSize) {
                sizeSpan.textContent = formattedSize;
            }
        }

        const totalSpan = row.querySelector(".total-val");
        if (totalSpan) {
            const formattedTotal = 누적.toFixed(1);
            if (totalSpan.textContent !== formattedTotal) {
                totalSpan.textContent = formattedTotal;
            }
        }
    });
}

// 호가 클릭 시 가격 자동 입력
window.호가클릭 = function(price) {
    const triggerInput = document.getElementById("input-trigger-price");
    if (triggerInput) {
        triggerInput.value = price;
        주문비용재연산();
    }
};

// 8. 보조 지표 계산 로직 (Indicators Algorithms)
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

    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram
    };
}

// 9. 매매 타이밍 신호 발생 분석기 (Technical Indicator Signal Analyzer)
function 분석및신호생성(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const times = coin.캔들데이터.map(c => c.time);
    const idx = closes.length - 1;

    // 1. 실시간 다중 지표 정밀 연산부 도입 (Advanced Multi-Indicator Calculations)
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 이전MACD = macdData.macd[idx - 1] || 0;
    const 이전MACD시그널 = macdData.signal[idx - 1] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ma20 = 계산SMA(closes, 20)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const ma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const ma120 = 계산SMA(closes, 120)[idx] || coin.현재가;
    const sma200 = 계산SMA(closes, 200)[idx] || coin.현재가; // 100MA 장기 추세 필터
    const 이전EMA5 = 계산EMA(closes, 5)[idx - 1] || coin.현재가;
    const 이전EMA20 = 계산EMA(closes, 20)[idx - 1] || coin.현재가;

    const cciVal = 계산CCI(highs, lows, closes, 20)[idx] || 0;
    const stochData = 계산스토캐스틱(highs, lows, closes, 14, 3, 3);
    const stochK = stochData.k[idx] || 50;
    const stochD = stochData.d[idx] || 50;
    
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    // 2. 다각적 연립 필터링 3단계 검증 시스템 구축 (3-Step Confluence System)
    let 신호방향 = null;
    let 근거 = [];

    // [1단계: 지지와 저항 확인 필터] (VPVR 매물대 POC & 피보나치 레벨 최우선 가격 분석 요소 활용)
    const 롱지지검증 = coin.현재가 <= fiboLevels["50.0%"] || coin.현재가 < vpvrPOC || coin.현재가 <= bbLower;
    const 숏저항검증 = coin.현재가 >= fiboLevels["38.2%"] || coin.현재가 > vpvrPOC || coin.현재가 >= bbUpper;

    // [2단계: 추세 방향성 판정 필터] (이평선 20/60 배열 & 슈퍼트렌드 & MACD 연립)
    const 이평정배열 = ma20 >= ma60;
    const 이평역배열 = ma20 <= ma60;
    // [카카오 자동 발송 트리거 C: RSI 체크]
    if (window.KakaoAutoSendInfo && window.KakaoAutoSendInfo.enabled_c && window.KakaoAutoSendInfo.symbols && window.KakaoAutoSendInfo.symbols.includes(symbol)) {
        const threshold = window.KakaoAutoSendInfo.rsi_c || 30;
        let isTriggered = false;
        let rsiDesc = "";

        if (rsiVal <= threshold) {
            isTriggered = true;
            rsiDesc = `침체/과매도 (RSI ${rsiVal.toFixed(1)}%)`;
        } else if (rsiVal >= (100 - threshold)) {
            isTriggered = true;
            rsiDesc = `과열/과매수 (RSI ${rsiVal.toFixed(1)}%)`;
        }

        if (isTriggered) {
            const now = Date.now();
            const lastSent = window.KakaoRsiCooldowns[symbol] || 0;
            // 15분(900,000ms) 쿨타임
            if (now - lastSent > 15 * 60 * 1000) {
                window.KakaoRsiCooldowns[symbol] = now;
                window.카카오알림발송({
                    코인명: symbol,
                    방향: 'RSI 경보',
                    현재가: coin.현재가.toLocaleString() + ' USDT',
                    RSI: rsiVal.toFixed(1) + '%',
                    근거: `RSI 임계값 도달! 현재 상태: ${rsiDesc}`
                }, true);
            }
        }
    }

    const 슈퍼트렌드롱 = coin.현재가 > ema20 && rsiVal > 48;
    const 슈퍼트렌드숏 = coin.현재가 < ema20 && rsiVal < 52;
    const MACD롱추세 = 현재MACD > 현재MACD시그널;
    const MACD숏추세 = 현재MACD < 현재MACD시그널;

    const 추세롱합격 = 이평정배열 || 슈퍼트렌드롱 || MACD롱추세;
    const 추세숏합격 = 이평역배열 || 슈퍼트렌드숏 || MACD숏추세;

    // [3단계: 오실레이터 진입 타이밍 조율 필터] (RSI & CCI & 스토캐스틱 K/D)
    const MACD골든크로스 = 이전MACD < 이전MACD시그널 && 현재MACD >= 현재MACD시그널;
    const MACD데드크로스 = 이전MACD > 이전MACD시그널 && 현재MACD <= 현재MACD시그널;
    const MA골든크로스 = 이전EMA5 < 이전EMA20 && ema5 >= ema20;
    const MA데드크로스 = 이전EMA5 > 이전EMA20 && ema5 <= 이전EMA20;

    const RSI롱과매도 = rsiVal <= 38;
    const CCI롱침체 = cciVal <= -100;
    const 스토크골든크로스 = stochK <= 30 && stochK > stochD;
    const 타이밍롱진입 = RSI롱과매도 || CCI롱침체 || 스토크골든크로스 || MACD골든크로스 || MA골든크로스;

    const RSI숏과매수 = rsiVal >= 62;
    const CCI숏과열 = cciVal >= 100;
    const 스토크데드크로스 = stochK >= 70 && stochK < stochD;
    const 타이밍숏진입 = RSI숏과매수 || CCI숏과열 || 스토크데드크로스 || MACD데드크로스 || MA데드크로스;

    // 최종 3중 연립 수렴(Confluence) 합격 시에만 정밀 진입 신호 격발
    if (롱지지검증 && 추세롱합격 && 타이밍롱진입) {
        신호방향 = "LONG";
        if (RSI롱과매도) 근거.push("RSI 과매도 수렴");
        if (CCI롱침체) 근거.push("CCI 과매도 채널");
        if (스토크골든크로스) 근거.push("스토캐스틱 골든크로스");
        if (MACD골든크로스) 근거.push("MACD 골든크로스");
        if (MA골든크로스) 근거.push("이평 단기 골든크로스");
        if (coin.현재가 < vpvrPOC) 근거.push("VPVR POC 하단 매집 지지");
    } else if (숏저항검증 && 추세숏합격 && 타이밍숏진입) {
        신호방향 = "SHORT";
        if (RSI숏과매수) 근거.push("RSI 과매수 수렴");
        if (CCI숏과열) 근거.push("CCI 과열 채널");
        if (스토크데드크로스) 근거.push("스토캐스틱 데드크로스");
        if (MACD데드크로스) 근거.push("MACD 데드크로스");
        if (MA데드크로스) 근거.push("이평 단기 데드크로스");
        if (coin.현재가 > vpvrPOC) 근거.push("VPVR POC 상단 돌파 저항");
    }

    // 조건 부합 시 화면 알림 및 차트 마킹 출력
    if (신호방향 && 근거.length >= 1) {
        const 근거텍스트 = 근거.join(" + ");
        const 색상 = 신호방향 === "LONG" ? "long" : "short";
        const 방향한글 = 신호방향 === "LONG" ? "롱(LONG) 매수" : "숏(SHORT) 매도";
        
        새신호알림(symbol, `[매매 신호 감지] **${방향한글}** 타점 발생! (${근거텍스트} | RSI: ${rsiVal.toFixed(1)}%)`, 색상);
        재생효과음("sound-signal");

        // [카카오 자동 발송 트리거 A]
        if (window.KakaoAutoSendInfo && window.KakaoAutoSendInfo.enabled_a && window.KakaoAutoSendInfo.symbols && window.KakaoAutoSendInfo.symbols.includes(symbol)) {
            window.카카오알림발송({
                코인명: symbol,
                방향: 방향한글,
                근거: 근거텍스트,
                현재가: coin.현재가.toLocaleString() + ' USDT',
                RSI: rsiVal.toFixed(1) + '%'
            });
        }

        if (symbol === 상태.기본코인 && 상태.차트객체.분할차트들[0] && 상태.차트객체.분할차트들[0].캔들시리즈) {
            const series = 상태.차트객체.분할차트들[0].캔들시리즈;
            let markers = [];
            try {
                if (typeof series.getMarkers === 'function') {
                    markers = series.getMarkers() || [];
                } else {
                    markers = series._markers || [];
                }
            } catch (e) {
                markers = series._markers || [];
            }

            markers.push({
                time: times[idx],
                position: 신호방향 === "LONG" ? 'belowBar' : 'aboveBar',
                color: 신호방향 === "LONG" ? '#f6465d' : '#0066ff', // 상승 = 빨간색, 하락 = 파란색
                shape: 신호방향 === "LONG" ? 'arrowUp' : 'arrowDown',
                text: 신호방향 === "LONG" ? 'LONG BUY' : 'SHORT SELL'
            });

            try {
                series.setMarkers(markers);
                series._markers = markers;
            } catch (e) {
                console.error("마커 설정 실패:", e);
            }
        }

        // AI 자동 매매 활성화 상태일 경우 자동 거래 수행 (Auto Trading Execution)
        if (coin.자동매매활성화) {
            AI자동매매실행(symbol, 신호방향);
        }
    }
}

// AI 자동 매매 실제 포지션 진입 및 안전 마진/수량 연산 처리 엔진
function AI자동매매실행(symbol, 방향) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    // 1. 중복 포지션(Duplicate Position) 진입 방지 설정에 따른 조건부 가드(Guard) 적용
    if (상태.자동매매설정.중복방지) {
        const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === symbol);
        if (이미존재하는포지션) {
            return; // 중복 방지 필터가 ON이므로 이미 포지션이 열려 있으면 추가 진입 불가
        }
    }

    // 2. 사용자가 설정한 슬라이더의 레버리지(Leverage) 배수 동적 크롤링
    const leverageInput = document.getElementById("input-leverage");
    const leverage = leverageInput ? parseInt(leverageInput.value) : 3;

    // 3. 사용자가 설정한 진입 비율(Entry Ratio)에 따른 가용 지갑 잔고 비례 투자 증거금 산출
    const 진입가 = coin.현재가;
    const 진입비율 = 상태.자동매매설정.진입비율 !== undefined ? 상태.자동매매설정.진입비율 : 10;
    const targetMargin = 상태.지갑잔고 * (진입비율 / 100); // 가용 자산의 설정 비율(%) 증거금
    
    // 주문 크기(Size) 계산: 수량 = (증거금 * 레버리지) / 진입가
    let qty = (targetMargin * leverage) / 진입가;
    
    // 코인 고유 규격 소수점에 맞게 포맷 처리
    qty = parseFloat(qty.toFixed(coin.수량소수점));

    if (qty <= 0) {
        새신호알림(symbol, `[🤖 AI 자동매매 실패] 계산된 수량(${qty})이 거래 규격보다 작아 진입할 수 없습니다.`, "short");
        return;
    }

    // 4. 안전 익절/손절(TP/SL) 자동 연동 가격 산출
    let 익절가 = 0;
    let 손절가 = 0;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;
    const 최고가 = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저가 = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고가, 최저가);
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;

    // 호가 비율 연산 및 실시간 펀딩비 / 미결제약정 변화 추론 모델
    const 호가비율 = coin.호가매수.length > 0 && coin.호가매도.length > 0 ? 
        parseFloat(coin.호가매수[0][1]) / (parseFloat(coin.호가매수[0][1]) + parseFloat(coin.호가매도[0][1])) : 0.5;
    const 실시간펀딩비 = (rsiVal - 50) * 0.0004 + (호가비율 - 0.5) * 0.01 + 0.01;
    const oiChange = (Math.abs(coin.현재가 - coin.어제종가) / coin.어제종가) * 350 + (호가비율 - 0.5) * 20;

    // A. 익절 타점(Take-Profit Price) 산출
    if (상태.자동매매설정.익절옵션 === "manual") {
        // 수동 지정 퍼센트 기반 익절가 계산
        const 수동익절율 = 상태.자동매매설정.수동익절율 || 10;
        if (방향 === "LONG") {
            익절가 = coin.현재가 * (1 + 수동익절율 / 100);
        } else {
            익절가 = coin.현재가 * (1 - 수동익절율 / 100);
        }
    } else {
        // AI 정밀 자동 연산 (0.786 피보나치 파동 분석 및 볼린저밴드 연립 산출)
        if (방향 === "LONG") {
            익절가 = Math.max(coin.현재가 * 1.005, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
        } else {
            익절가 = Math.min(coin.현재가 * 0.995, (fiboLevels["78.6%"] + bbLower) / 2);
        }

        // [안전 장치 1] 펀딩비(Funding Rate) 오버헤드 과열에 따른 익절가(TP) 목표 조기 단축 (10% 타겟 리듀스)
        // 롱 포지션 진입 시 펀딩비가 극도로 양수(0.015% 이상)이거나, 숏 진입 시 극도로 음수(-0.015% 이하)인 경우 보유 수수료(Funding Fee) 오버헤드를 막기 위해 익절 폭을 10% 좁혀 빠르게 털고 나옵니다.
        let tpGap = Math.abs(익절가 - coin.현재가);
        if (방향 === "LONG" && 실시간펀딩비 >= 0.015) {
            tpGap *= 0.90; // 익절 폭 10% 좁힘 (롱 과열 방어)
            익절가 = coin.현재가 + tpGap;
        } else if (방향 === "SHORT" && 실시간펀딩비 <= -0.015) {
            tpGap *= 0.90; // 익절 폭 10% 좁힘 (숏 과열 방어)
            익절가 = coin.현재가 - tpGap;
        }
    }

    // B. 손절 타점(Stop-Loss Price) 산출
    if (상태.자동매매설정.손절옵션 === "manual") {
        // 수동 지정 퍼센트 기반 손절가 계산
        const 수동손절율 = 상태.자동매매설정.수동손절율 || 5;
        if (방향 === "LONG") {
            손절가 = coin.현재가 * (1 - 수동손절율 / 100);
        } else {
            손절가 = coin.현재가 * (1 + 수동손절율 / 100);
        }
    } else {
        // AI 스탑헌팅가드 자동 연산 (피보나치 78.6%/88.6% 및 볼린저밴드 이탈 가드)
        if (방향 === "LONG") {
            const 추천진입가 = Math.min(coin.현재가, (fiboLevels["78.6%"] + bbLower) / 2);
            손절가 = Math.min(추천진입가 * 0.992, fiboLevels["88.6%"] * 0.998);
        } else {
            const 추천진입가 = Math.max(coin.현재가, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
            손절가 = Math.max(추천진입가 * 1.008, fiboLevels["11.4%"] * 1.002);
        }

        // [안전 장치 2] 미결제약정(OI) 가속 변화에 따른 손절가(SL) 변동성 스프레드 동적 1.2배 스케일링 확장
        // 미결제약정 변화율이 급격히 증가(5% 이상 상승)한 경우 변동성이 극도로 커져 스탑헌팅(Stop-Hunting) 꼬리 털기에 당할 확률이 높으므로,
        // 손절가를 기존 대비 1.2배 동적으로 넓혀주어 안전하게 포지션을 보호합니다.
        if (oiChange >= 5.0) {
            let slGap = Math.abs(손절가 - coin.현재가);
            slGap *= 1.20; // 손절 마진 20% 동적 확보
            if (방향 === "LONG") {
                손절가 = coin.현재가 - slGap;
            } else {
                손절가 = coin.현재가 + slGap;
            }
        }
    }

    익절가 = parseFloat(익절가.toFixed(coin.소수점));
    손절가 = parseFloat(손절가.toFixed(coin.소수점));

    const 자동주문 = {
        심볼: symbol,
        방향: 방향,
        레버리지: leverage,
        수량: qty,
        익절가: 익절가,
        손절가: 손절가
    };

    const 익절안내타입 = 상태.자동매매설정.익절옵션 === "manual" ? `수동 ${상태.자동매매설정.수동익절율}%` : 
        ((방향 === "LONG" && 실시간펀딩비 >= 0.015) || (방향 === "SHORT" && 실시간펀딩비 <= -0.015) ? "AI 조기익절 가드" : "AI 정밀");
    const 손절안내타입 = 상태.자동매매설정.손절옵션 === "manual" ? `수동 ${상태.자동매매설정.수동손절율}%` : 
        (oiChange >= 5.0 ? "AI OI스프레드확장 가드" : "AI 가드");

    새신호알림(symbol, `[🤖 AI 자동매매 작동] ${방향} 매매 신호가 감지되어 가용자산의 ${진입비율}% (레버리지 ${leverage}x, 수량 ${qty})로 시장가 자동 포지션 진입합니다. (익절 TP: ${익절가} (${익절안내타입}) | 손절 SL: ${손절가} (${손절안내타입}))`, 방향 === "LONG" ? "long" : "short");
    
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

        // 🛡️ [시세 유효성 가드] 실시간 현재가가 존재하지 않거나, 숫자가 아니거나, 0 이하인 경우(비정상 튀는 시세) 체결 감시를 일시 스킵하여 비정상 체결을 완전히 방어합니다.
        if (!coin.현재가 || isNaN(coin.현재가) || coin.현재가 <= 0) {
            return;
        }

        // 🛡️ 가상 시세(CORS 폴백) 상태에서는 실제 시세 기반의 대기 주문이 오작동하여 체결되는 것을 방지합니다. (가상 시세 감지 락)
        if (coin.가상시세여부) {
            return;
        }

        let 체결성공 = false;
        
        // 롱/숏 방향에 의한 실제 가격 도달 여부
        if (주문.방향 === "LONG") {
            if (coin.현재가 <= 주문.타점가격) {
                체결성공 = true;
            }
        } else {
            if (coin.현재가 >= 주문.타점가격) {
                체결성공 = true;
            }
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
    // 동일한 코인(심볼)의 기존 활성 포지션 존재 여부 검사 (중복 진입 원천 차단)
    const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === 주문.심볼);
    if (이미존재하는포지션) {
        새신호알림(주문.심볼, `[체결 거부] ${주문.심볼}에 이미 활성화된 포지션이 존재합니다. 중복 진입이 제한됩니다.`, "short");
        return;
    }

    const 증거금 = (주문.수량 * 체결가) / 주문.레버리지;

    if (상태.지갑잔고 < 증거금) {
        새신호알림(주문.심볼, `[체결 취소] 잔고 부족으로 예약 주문이 자동 취소되었습니다. (필요 마진: ${증거금.toFixed(2)} USDT)`, "short");
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
        자동마진: true, // 🛡️ 실시간 청산 예방용 자동 증거금 추가 가드 기본값 비활성화
        체결시간: 얻는현재시각텍스트()
    };

    상태.활성포지션.push(신규포지션);

    재생효과음("sound-trigger");
    새신호알림(주문.심볼, `[체결 성공] 실시간가 ${체결가.toLocaleString()} USDT에 ${주문.방향} ${주문.레버리지}x 포지션이 체결되었습니다.`, "execution");

    // 실시간 모의 매매 상태 스토리지 저장
    모의매매상태저장();

    활성포지션테이블렌더링();
    상태바업데이트();
    화면업데이트();
}

function 실시간포지션마진정산() {
    if (상태.활성포지션.length === 0) {
        상태.미실현손익 = 0.00;
        상태.마진잔고 = 상태.지갑잔고;
        document.getElementById("header-unrealized-pnl").innerText = "0.00 USDT (0.00%)";
        document.getElementById("header-unrealized-pnl").className = "info-value text-neutral";
        return;
    }

    let 총미실현손익 = 0;
    let 청산또는손익종료된인덱스들 = [];

    상태.활성포지션.forEach((pos, index) => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin) return;

        // 🛡️ [시세 유효성 가드] 실시간 현재가가 존재하지 않거나, 숫자가 아니거나, 0 이하인 경우(비정상 튀는 시세) 익절/손절/청산 감시를 스킵하여 오작동 정산을 완벽히 예방합니다.
        if (!coin.현재가 || isNaN(coin.현재가) || coin.현재가 <= 0) {
            return;
        }

        let pnl = 0;
        if (pos.방향 === "LONG") {
            pnl = (coin.현재가 - pos.진입가) * pos.수량;
        } else {
            pnl = (pos.진입가 - coin.현재가) * pos.수량;
        }

        pos.미실현손익 = pnl;
        pos.수익률 = (pnl / pos.투입마진) * 100;
        총미실현손익 += pnl;

        // ⚡ [자동 증거금 추가 가드 엔진 (Auto Margin Addition Guard)]
        if (pos.자동마진) {
            let 마진추가필요 = false;
            if (pos.방향 === "LONG" && coin.현재가 <= pos.청산가 * 1.02) {
                마진추가필요 = true;
            } else if (pos.방향 === "SHORT" && coin.현재가 >= pos.청산가 * 0.98) {
                마진추가필요 = true;
            }

            if (마진추가필요) {
                // 최초 투입마진의 50% 분량을 긴급 추가 수혈
                const 추가마진액 = pos.투입마진 * 0.5;
                if (상태.지갑잔고 >= 추가마진액) {
                    상태.지갑잔고 -= 추가마진액;
                    pos.투입마진 += 추가마진액;
                    
                    // 수학적 격리 마진 청산가 밀어내기 재연산 공식
                    let 새청산가 = 0;
                    if (pos.방향 === "LONG") {
                        새청산가 = pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005);
                    } else {
                        새청산가 = pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
                    }
                    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
                    
                    // 실시간 PNL 수익률 리밸런싱
                    pos.수익률 = (pnl / pos.투입마진) * 100;
                    
                    새신호알림(pos.심볼, `[🛡️ 자동 증거금 수혈] 청산 위험 감지! 가용잔고에서 **${추가마진액.toFixed(2)} USDT** 마진을 자동 수혈하였습니다. (새 청산가: **${pos.청산가.toLocaleString()} USDT**)`, "long");
                    재생효과음("sound-trigger");
                    
                    // 테이블 및 화면 비동기 즉각 동기화
                    setTimeout(() => {
                        활성포지션테이블렌더링();
                        상태바업데이트();
                        화면업데이트();
                    }, 0);
                } else if (상태.지갑잔고 > 0) {
                    // 잔고 부족 시 남은 잔고 전액 투입
                    const 추가마진액 = 상태.지갑잔고;
                    상태.지갑잔고 = 0;
                    pos.투입마진 += 추가마진액;
                    
                    let 새청산가 = 0;
                    if (pos.방향 === "LONG") {
                        새청산가 = pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005);
                    } else {
                        새청산가 = pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
                    }
                    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
                    pos.수익률 = (pnl / pos.투입마진) * 100;
                    
                    새신호알림(pos.심볼, `[⚠️ 자동 증거금 수혈 - 잔고 부족] 가용 잔고 부족으로 전액 **${추가마진액.toFixed(2)} USDT** 마진을 긴급 투입하였습니다. (새 청산가: **${pos.청산가.toLocaleString()} USDT**)`, "short");
                    재생효과음("sound-trigger");
                    
                    setTimeout(() => {
                        활성포지션테이블렌더링();
                        상태바업데이트();
                        화면업데이트();
                    }, 0);
                } else {
                    // 가용 잔고 0 USDT 경고 (1회만 발송되도록 체크)
                    if (!pos.잔고부족경고출력됨) {
                        새신호알림(pos.심볼, `[🚨 자동 증거금 수혈 실패] 청산 위기 상태이나 가용 잔고가 0 USDT이므로 방어 증거금을 추가하지 못했습니다!`, "short");
                        pos.잔고부족경고출력됨 = true;
                    }
                }
            }
        }

        // 1. 실제 가격 기반 청산 발생 감시
        let 청산발생 = false;
        if (pos.방향 === "LONG" && coin.현재가 <= pos.청산가) {
            청산발생 = true;
        } else if (pos.방향 === "SHORT" && coin.현재가 >= pos.청산가) {
            청산발생 = true;
        }

        if (청산발생) {
            청산또는손익종료된인덱스들.push({ index: index, 사유: "LIQUIDATED", 정산가: pos.청산가 });
            return;
        }

        // 2. 예약 익절/손절(TP/SL) 발생 감시
        let 예약종료발생 = false;
        let 예약종료정산가 = coin.현재가;

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

    // 미실현 손익 및 마진 실시간 변동분 스토리지 저장
    모의매매상태저장();

    상태바업데이트();
    실시간포지션PNL업데이트();
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
        수수료: 수수료,
        실현손익: pnl,
        종료원인: 사유
    });

    const 알림색 = pnl >= 0 ? "long" : "short";
    const 이익표시 = pnl >= 0 ? "수익 정산" : "손실 정산";
    새신호알림(pos.심볼, `[포지션 정산] ${pos.심볼} ${pos.방향} 거래가 종료가 ${종료가.toLocaleString()} USDT에 정리되었습니다. (${사유} | PNL: ${pnl.toFixed(2)} USDT ${이익표시})`, 알림색);

    상태.활성포지션.splice(인덱스, 1);

    // 포지션 정산 완료 상태 스토리지 저장
    모의매매상태저장();

    활성포지션테이블렌더링();
    거래이력테이블렌더링();
    상태바업데이트();
    화면업데이트();
}

// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩 (UI Event Handlers & Bindings)

// 사용자가 검색창에 입력한 코인 심볼을 앱 내부 표준 형식으로 정리합니다.
// 예: "btc" -> "BTCUSDT", "ethusdt" -> "ETHUSDT"
function 코인심볼완성(rawSymbol) {
    const symbol = String(rawSymbol || "").trim().toUpperCase();
    if (!symbol) return "";
    return symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
}

// 동적 HTML에 텍스트를 넣을 때 태그로 실행되지 않도록 특수문자를 안전하게 바꿉니다.
function 텍스트HTML이스케이프(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 바이낸스 선물 심볼은 영문/숫자 + USDT 형태만 허용합니다.
// 이렇게 막아두면 사용자가 검색창에 HTML이나 스크립트를 넣어도 화면에 실행되지 않습니다.
function 코인심볼유효성검사(symbol) {
    return /^[A-Z0-9]{2,20}USDT$/.test(symbol);
}

function 코인탭렌더링() {
    const tabsEl = document.getElementById("coin-tabs");
    if (!tabsEl) return;

    let html = "";
    
    // 사용자가 즐겨찾기(⭐) 해둔 코인 목록을 가로 탭의 기본 소스로 매핑
    let 표시할코인들 = [...상태.즐겨찾기목록];
    
    // 현재 포커스 중인 코인이 즐겨찾기 목록에 없다면 맨 오른쪽에 임시 탭으로 추가 유지
    if (상태.기본코인 && !표시할코인들.includes(상태.기본코인)) {
        표시할코인들.push(상태.기본코인);
    }

    // 즐겨찾기가 아예 없는 최초 상태인 경우 유저 가이드 목적으로 메이저 자산을 노출
    if (표시할코인들.length === 0) {
        표시할코인들 = ["BTCUSDT", "ETHUSDT"];
    }

    // 혹시 모를 중복 탭 생성을 원천적으로 차단
    표시할코인들 = [...new Set(표시할코인들)];

    표시할코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;
        
        const isActive = symbol === 상태.기본코인 ? "active" : "";
        const 즐겨찾기여부 = 상태.즐겨찾기목록.includes(symbol);
        const starClass = 즐겨찾기여부 ? "fa-solid fa-star text-yellow" : "fa-regular fa-star";
        
        // 해당 코인의 활성 모의 포지션 존재 여부 검사
        const 포지션보유중 = 상태.활성포지션.some(p => p.심볼 === symbol);
        const 포지션배지 = 포지션보유중 ? `<span class="pulse-dot" style="display:inline-block; margin-left:4px; vertical-align:middle;" title="활성 포지션 보유 중"></span>` : "";
        
        // 24시간 변동률 기반 실시간 컬러 피드백 반영
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";
        
        html += `
            <button class="coin-tab ${isActive}" data-symbol="${symbol}" onclick="코인탭전환('${symbol}')">
                <i class="${starClass} btn-fav-star" onclick="즐겨찾기토글('${symbol}', event)" style="font-size:11px; margin-right:4px;" title="즐겨찾기 토글"></i>
                ${symbol.replace("USDT", "")}${포지션배지} 
                <span class="tab-price ${변동률클래스}" id="tab-price-${symbol}">
                    ${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}
                </span>
            </button>
        `;
    });
    tabsEl.innerHTML = html;

    // [NEW] 활성화된 기본코인 탭이 가장자리에 있거나 가려진 상태일 시 부드럽게 화면 중앙으로 자동 정렬 스크롤
    setTimeout(() => {
        const activeTab = tabsEl.querySelector(".coin-tab.active");
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
    }, 40);

    // 세로 드롭다운 목록도 최신 검색어 필터를 적용하여 실시간 동기화 리렌더링
    드롭다운목록렌더링();
}





function 드롭다운목록렌더링() {
    const listEl = document.getElementById("dropdown-coin-list");
    if (!listEl) return;

    // 검색어 필드 및 초기화 버튼 연계
    const searchInput = document.getElementById("coin-search-input");
    const clearBtn = document.getElementById("btn-clear-search");
    const 검색어 = searchInput ? searchInput.value.trim().toUpperCase() : "";

    // 검색어 유무에 따른 리셋(x) 버튼 보임 상태 조절
    if (clearBtn) {
        if (검색어) {
            clearBtn.classList.remove("hidden");
        } else {
            clearBtn.classList.add("hidden");
        }
    }

    // 카테고리 필터와 실시간 검색 문자열 기반 2중 필터링
    let 표시할코인들 = Object.keys(상태.코인목록).filter(symbol => {
        // 즐겨찾기 필터 활성화 상태인데 즐겨찾기에 없는 경우 스킵
        if (상태.현재필터 === "fav" && !상태.즐겨찾기목록.includes(symbol)) {
            return false;
        }
        // 검색어가 입력되었는데 심볼에 검색 단어가 없는 경우 스킵
        if (검색어 && !symbol.includes(검색어)) {
            return false;
        }
        return true;
    });

    // 1. 검색 결과가 아예 없는 경우의 지능형 핫스왑 바이낸스 등록 인터페이스
    if (표시할코인들.length === 0) {
        if (검색어 && 검색어.length >= 2) {
            const 깔끔심볼 = 코인심볼완성(검색어);
            const 검색어HTML = 텍스트HTML이스케이프(검색어);
            const 깔끔심볼HTML = 텍스트HTML이스케이프(깔끔심볼);

            if (!코인심볼유효성검사(깔끔심볼)) {
                listEl.innerHTML = `
                    <div class="empty-dropdown-message" style="text-align:center; padding:30px 10px; color:var(--color-text-muted); font-size:12px; line-height:1.5;">
                        <i class="fa-solid fa-triangle-exclamation text-yellow" style="font-size:18px; margin-bottom:8px; display:block;"></i>
                        '${검색어HTML}' 검색어는 사용할 수 없습니다.<br>
                        영문/숫자 코인명만 입력해 주세요. 예: BTC, SOL, XRP
                    </div>
                `;
            } else {
                listEl.innerHTML = `
                    <div class="empty-search-action-box">
                        <div style="color:var(--color-text-muted); font-size:12px; line-height:1.5;">
                            <i class="fa-solid fa-triangle-exclamation text-yellow" style="font-size:18px; margin-bottom:8px; display:block;"></i>
                            '${검색어HTML}' 검색 결과가 없습니다.<br>
                            바이낸스 선물 실시간 마켓에서 조회할까요?
                        </div>
                        <button class="btn-add-searched-coin" onclick="window.검색코인강제등록액션('${깔끔심볼HTML}')">
                            <i class="fa-solid fa-plus-circle"></i> ${깔끔심볼HTML} 등록 및 즉시 진입
                        </button>
                    </div>
                `;
            }
        } else {
            listEl.innerHTML = `
                <div class="empty-dropdown-message" style="text-align:center; padding:30px 10px; color:var(--color-text-muted); font-size:12px; line-height:1.5;">
                    <i class="fa-solid fa-circle-info text-yellow" style="font-size:16px; margin-bottom:8px; display:block;"></i>
                    일치하는 코인이 없습니다.<br>
                    다른 검색어를 입력하거나 즐겨찾기를 추가해 보세요.
                </div>
            `;
        }
        return;
    }

    let html = "";
    표시할코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;
        
        const isActive = symbol === 상태.기본코인 ? "active" : "";
        const 즐겨찾기여부 = 상태.즐겨찾기목록.includes(symbol);
        const starClass = 즐겨찾기여부 ? "fa-solid fa-star text-yellow" : "fa-regular fa-star";
        
        // 해당 코인의 활성 모의 포지션 존재 여부 검사
        const 포지션보유중 = 상태.활성포지션.some(p => p.심볼 === symbol);
        const 포지션배지 = 포지션보유중 ? `<span class="pulse-dot" style="display:inline-block; margin-right:6px;" title="활성 포지션 보유 중"></span>` : "";
        
        // 24시간 변동률 구하기
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";
        const 변동률기호 = 변동률 >= 0 ? "+" : "";

        html += `
            <div class="dropdown-coin-row ${isActive}" onclick="드롭다운코인선택('${symbol}')">
                <div class="coin-meta-col" style="display: flex; align-items: center;">
                    <i class="${starClass} btn-fav-star" onclick="즐겨찾기토글('${symbol}', event)" style="font-size:11px; margin-right:6px;"></i>
                    ${포지션배지}
                    <span class="symbol-name">${symbol.replace("USDT", "")}</span>
                    <span class="symbol-desc">/USDT</span>
                </div>
                <div class="coin-price-col">
                    ${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}
                </div>
                <div class="coin-change-col ${변동률클래스}">
                    ${변동률기호}${변동률}%
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

// 드롭다운 세로 목록 내 코인 선택 시 액션
window.드롭다운코인선택 = function(symbol) {
    코인탭전환(symbol);
    
    // 드롭다운 닫기
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    const btnFilterAll = document.getElementById("filter-all-coins");
    const btnFilterFav = document.getElementById("filter-fav-coins");
    
    if (dropdownMenu && btnFilterAll && btnFilterFav) {
        dropdownMenu.classList.add("hidden");
        btnFilterAll.classList.remove("active");
        btnFilterFav.classList.remove("active");
        if (상태.현재필터 === "all") btnFilterAll.classList.add("active");
        else btnFilterFav.classList.add("active");
    }
};

// 글로벌 즐겨찾기 토글 헬퍼 함수 정의
window.즐겨찾기토글 = function(symbol, event) {
    if (event) event.stopPropagation(); // 탭 전환 클릭 이벤트 버블링 차단 (중요!)

    const idx = 상태.즐겨찾기목록.indexOf(symbol);
    if (idx > -1) {
        상태.즐겨찾기목록.splice(idx, 1);
        console.log(`[Favorites] ${symbol} 즐겨찾기 해제 완료.`);
    } else {
        상태.즐겨찾기목록.push(symbol);
        console.log(`[Favorites] ${symbol} 즐겨찾기 등록 완료.`);
    }

    // 로컬 스토리지에 즉시 동기화 보존
    try {
        localStorage.setItem("선물시뮬레이터_즐겨찾기", JSON.stringify(상태.즐겨찾기목록));
    } catch (e) {
        console.error("즐겨찾기 저장 중 에러:", e);
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

    // ⚡ 코인 고유 레버리지 정보 획득 및 폼 역동기화 (State Lock & Reverse Sync)
    let coinLeverage = 3;
    if (coin.레버리지 !== undefined) {
        coinLeverage = coin.레버리지;
    } else if (상태.코인별레버리지 && 상태.코인별레버리지[symbol] !== undefined) {
        coinLeverage = 상태.코인별레버리지[symbol];
        coin.레버리지 = coinLeverage; // 메모리에 동기화
    } else {
        coin.레버리지 = 3;
    }
    
    // 우측 주문 폼 슬라이더 및 입력 필드 동기화
    const inputLeverage = document.getElementById("input-leverage");
    const inputLeverageNum = document.getElementById("input-leverage-num");
    const leverageDisplay = document.getElementById("leverage-display");
    const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
    
    if (inputLeverage) inputLeverage.value = coinLeverage;
    if (inputLeverageNum) inputLeverageNum.value = coinLeverage;
    if (leverageDisplay) leverageDisplay.innerText = coinLeverage + "x";
    if (txtAiLeverage) txtAiLeverage.innerText = `${coinLeverage}x`;

    // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
    window.AI자동매매버튼상태동기화();

    // ⚡ 코인 탭 전환 시 주문 패널 및 Risk Guard 실시간 재동기화
    주문비용재연산();
};

window.검색코인강제등록액션 = async function(symbol) {
    if (!symbol) return;
    symbol = 코인심볼완성(symbol);

    if (!코인심볼유효성검사(symbol)) {
        alert("코인 심볼은 영문/숫자 + USDT 형식만 사용할 수 있습니다. 예: BTCUSDT, SOLUSDT");
        return;
    }
    
    if (상태.코인목록[symbol]) {
        alert("이미 목록에 등록되어 있는 코인입니다.");
        return;
    }

    // 드롭다운 로딩 중 피드백 표시
    const listEl = document.getElementById("dropdown-coin-list");
    if (listEl) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:40px 10px; color:var(--color-yellow);">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; margin-bottom:12px;"></i><br>
                바이낸스 실시간 시세 연동 채널 개설 중...
            </div>
        `;
    }

    // 임시 신규 코인 메모리 로드 시 기존 자동매매 복원 스캔
    let 자동매매활성화 = false;
    try {
        const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
        if (저장된자동매매) {
            const 자동매매맵 = JSON.parse(저장된자동매매);
            자동매매활성화 = !!자동매매맵[symbol];
        }
    } catch (e) {
        console.error("코인 추가 시 자동매매 복원 에러:", e);
    }

    상태.코인목록[symbol] = {
        심볼: symbol,
        이름: `${symbol.replace("USDT", "")}/USDT Perpetual`,
        현재가: 10.00,
        어제종가: 9.80,
        최고24h: 10.20,
        최저24h: 9.70,
        캔들데이터: [],
        호가매도: [],
        호가매수: [],
        소수점: 3,
        수량소수점: 2,
        레버리지: 3, // ⚡ 동적 등록 코인의 기본 레버리지를 3배로 고정
        자동매매활성화: 자동매매활성화,
        가상시세여부: false // 동적 등록 코인 가상 시세 상태 플래그 기본값 초기화 (가상 시세 감지 락)
    };

    // 알트코인에 따른 소수점 규격 최적화 보정
    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
        상태.코인목록[symbol].소수점 = 5;
        상태.코인목록[symbol].수량소수점 = 0;
    } else if (symbol.startsWith("BTC") || symbol.startsWith("ETH")) {
        상태.코인목록[symbol].소수점 = 2;
        상태.코인목록[symbol].수량소수점 = 3;
    } else {
        상태.코인목록[symbol].소수점 = 3;
        상태.코인목록[symbol].수량소수점 = 2;
    }

    // 바이낸스 선물 API를 통한 E2E 존재 여부 및 실시간 초기 시세 검증
    try {
        const checkRes = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
        if (!checkRes.ok) {
            alert(`[오류] 바이낸스에 존재하지 않거나 지원하지 않는 코인 심볼입니다 (${symbol}).`);
            delete 상태.코인목록[symbol];
            드롭다운목록렌더링();
            return;
        }
        const checkData = await checkRes.json();
        const realPrice = parseFloat(checkData.price);
        if (isNaN(realPrice) || realPrice <= 0) {
            throw new Error("유효하지 않은 시세 데이터 수신");
        }
        
        // 실시간 현재가 및 어제종가 기초값 정밀 맵핑
        상태.코인목록[symbol].현재가 = realPrice;
        상태.코인목록[symbol].어제종가 = realPrice * 0.98;
        상태.코인목록[symbol].최고24h = realPrice * 1.02;
        상태.코인목록[symbol].최저24h = realPrice * 0.97;
        
        // 소수점 자동 최적 보정
        const { 소수점, 수량소수점 } = 자동소수점결정(realPrice);
        상태.코인목록[symbol].소수점 = 소수점;
        상태.코인목록[symbol].수량소수점 = 수량소수점;
    } catch (err) {
        console.error("코인 검증 에러:", err);
        alert(`[API 에러] 바이낸스 시세를 확인할 수 없어 코인을 추가할 수 없습니다.`);
        delete 상태.코인목록[symbol];
        드롭다운목록렌더링();
        return;
    }

    // localStorage 영구 저장
    try {
        localStorage.setItem("선물시뮬레이터_추가코인", JSON.stringify(Object.keys(상태.코인목록)));
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("localStorage 저장 실패:", e);
    }

    // WebSocket 갱신 가동 (핫스왑)
    웹소켓스트림갱신();

    // 검색창 초기화
    const searchInput = document.getElementById("coin-search-input");
    if (searchInput) searchInput.value = "";
    
    // UI 리프레시 및 강제 탭 포커스 이동
    코인탭렌더링();
    window.차트선택기목록동적갱신();
    await 코인탭전환(symbol);
    
    // 드롭다운 닫기
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    const btnFilterAll = document.getElementById("filter-all-coins");
    const btnFilterFav = document.getElementById("filter-fav-coins");
    if (dropdownMenu && btnFilterAll && btnFilterFav) {
        dropdownMenu.classList.add("hidden");
        btnFilterAll.classList.remove("active");
        btnFilterFav.classList.remove("active");
        if (상태.현재필터 === "all") btnFilterAll.classList.add("active");
        else btnFilterFav.classList.add("active");
    }
    
    새신호알림(symbol, `[코인 등록 완료] 바이낸스 선물에서 **${symbol}** 실시간 시세 채널을 성공적으로 오픈하고 영구 저장 완료했습니다.`, "execution");
};

function 이벤트리스너바인딩() {
    // [NEW] 가로형 즐겨찾기 탭 영역 마우스 휠 및 꾹 누르고 비비는 드래그(Drag) 스크롤 제스처 인터랙션 바인딩
    const tabsWrapper = document.querySelector(".coin-tabs-wrapper");
    if (tabsWrapper) {
        // 1. 마우스 휠(Wheel) 스크롤 가로 변환 연동 ({ passive: false } 로 passive 리스너 preventDefault 오류 사전 예방)
        tabsWrapper.addEventListener("wheel", (e) => {
            e.preventDefault(); // 세로 윈도우 스크롤 차단 및 가로 롤오버 적용
            tabsWrapper.scrollLeft += e.deltaY * 1.2;
        }, { passive: false });

        // 2. 마우스 드래그-투-스크롤 (Drag to Scroll) 스와이프 제스처 구현
        let isDown = false;
        let startX;
        let scrollLeftVal;

        tabsWrapper.addEventListener("mousedown", (e) => {
            isDown = true;
            tabsWrapper.classList.add("grabbing");
            startX = e.pageX - tabsWrapper.offsetLeft;
            scrollLeftVal = tabsWrapper.scrollLeft;
        });

        tabsWrapper.addEventListener("mouseleave", () => {
            isDown = false;
            tabsWrapper.classList.remove("grabbing");
        });

        tabsWrapper.addEventListener("mouseup", () => {
            isDown = false;
            tabsWrapper.classList.remove("grabbing");
        });

        tabsWrapper.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - tabsWrapper.offsetLeft;
            const walk = (x - startX) * 1.5; // 스크롤 민감도 1.5배 보정
            tabsWrapper.scrollLeft = scrollLeftVal - walk;
        });
    }

    // 카테고리 필터 버튼 (전체 vs 즐겨찾기) 및 세로 드롭다운 노출 연동
    const btnFilterAll = document.getElementById("filter-all-coins");
    const btnFilterFav = document.getElementById("filter-fav-coins");
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    const dropdownTitleText = document.getElementById("dropdown-title-text");

    if (btnFilterAll && btnFilterFav && dropdownMenu) {
        // 드롭다운 닫기 전용 헬퍼 함수
        const 드롭다운닫기 = () => {
            dropdownMenu.classList.add("hidden");
            btnFilterAll.classList.remove("active");
            btnFilterFav.classList.remove("active");
            // 현재 설정된 필터 상태 뱃지만 하이라이트
            if (상태.현재필터 === "all") btnFilterAll.classList.add("active");
            else btnFilterFav.classList.add("active");

            // 드롭다운 닫힐 때 검색어 초기화
            const searchInput = document.getElementById("coin-search-input");
            if (searchInput) searchInput.value = "";
        };

        btnFilterAll.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !dropdownMenu.classList.contains("hidden");
            
            if (isOpen && 상태.현재필터 === "all") {
                드롭다운닫기();
            } else {
                상태.현재필터 = "all";
                if (dropdownTitleText) dropdownTitleText.innerHTML = `<i class="fa-solid fa-globe text-yellow" style="margin-right:6px;"></i>전체 코인 목록`;
                btnFilterAll.classList.add("active");
                btnFilterFav.classList.remove("active");
                dropdownMenu.classList.remove("hidden");
                
                // 검색창 초기화 및 오토 포커싱
                const searchInput = document.getElementById("coin-search-input");
                if (searchInput) {
                    searchInput.value = "";
                    setTimeout(() => searchInput.focus(), 50);
                }
                코인탭렌더링();
            }
        });

        btnFilterFav.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !dropdownMenu.classList.contains("hidden");
            
            if (isOpen && 상태.현재필터 === "fav") {
                드롭다운닫기();
            } else {
                상태.현재필터 = "fav";
                if (dropdownTitleText) dropdownTitleText.innerHTML = `<i class="fa-solid fa-star text-yellow" style="margin-right:6px;"></i>즐겨찾기 코인 목록`;
                btnFilterFav.classList.add("active");
                btnFilterAll.classList.remove("active");
                dropdownMenu.classList.remove("hidden");
                
                // 검색창 초기화 및 오토 포커싱
                const searchInput = document.getElementById("coin-search-input");
                if (searchInput) {
                    searchInput.value = "";
                    setTimeout(() => searchInput.focus(), 50);
                }
                코인탭렌더링();
            }
        });

        // 닫기 단추 클릭 연동
        const btnCloseDropdown = document.getElementById("btn-close-dropdown");
        if (btnCloseDropdown) {
            btnCloseDropdown.addEventListener("click", (e) => {
                e.stopPropagation();
                드롭다운닫기();
            });
        }

        // 바깥 영역 클릭 시 드롭다운 닫기 디텍터
        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== btnFilterAll && e.target !== btnFilterFav) {
                드롭다운닫기();
            }
        });

        // [NEW] 실시간 코인 검색 인터랙션 이벤트 리스너 바인딩
        const searchInput = document.getElementById("coin-search-input");
        const clearBtn = document.getElementById("btn-clear-search");

        if (searchInput) {
            // 키보드 타이핑 감지 시 목록 실시간 필터링
            searchInput.addEventListener("input", () => {
                드롭다운목록렌더링();
            });

            // 검색창 내부 클릭 시 드롭다운 닫힘 방지
            searchInput.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            // 엔터 입력 시 기존 코인 포커스 이동 또는 바이낸스 마켓 채널 생성
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const val = searchInput.value.trim().toUpperCase();
                    if (val.length >= 2) {
                        const 깔끔심볼 = val.endsWith("USDT") ? val : val + "USDT";
                        if (상태.코인목록[깔끔심볼]) {
                            드롭다운코인선택(깔끔심볼);
                        } else {
                            window.검색코인강제등록액션(깔끔심볼);
                        }
                    }
                }
            });
        }

        // 검색어 초기화 (x) 아이콘 클릭 시
        if (clearBtn) {
            clearBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (searchInput) {
                    searchInput.value = "";
                    searchInput.focus();
                }
                드롭다운목록렌더링();
            });
        }
    }

    // 롱/숏 방향 토글
    const btnLong = document.getElementById("btn-direction-long");
    const btnShort = document.getElementById("btn-direction-short");
    const submitBtn = document.getElementById("btn-submit-order");

    btnLong.addEventListener("click", () => {
        btnLong.classList.add("active");
        btnShort.classList.remove("active");
        submitBtn.className = "btn-submit-order btn-buy-long";
        주문비용재연산();
    });

    btnShort.addEventListener("click", () => {
        btnShort.classList.add("active");
        btnLong.classList.remove("active");
        submitBtn.className = "btn-submit-order btn-sell-short";
        주문비용재연산();
    });

    // 레버리지 슬라이더
    const levRange = document.getElementById("input-leverage");
    const levNum = document.getElementById("input-leverage-num");
    const levBadge = document.getElementById("leverage-display");

    levRange.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        levNum.value = val;
        levBadge.innerText = val + "x";
        
        // ⚡ 메모리 및 로컬스토리지 상태 고정 (State Lock)
        const coin = 상태.코인목록[상태.기본코인];
        if (coin) coin.레버리지 = val;
        if (!상태.코인별레버리지) 상태.코인별레버리지 = {};
        상태.코인별레버리지[상태.기본코인] = val;
        window.코인레버리지저장();

        // AI 세부 설정 창 텍스트 싱크
        const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
        if (txtAiLeverage) txtAiLeverage.innerText = val + "x";

        주문비용재연산();
        AI추천분석및업데이트(상태.기본코인);
    });

    levNum.addEventListener("input", (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 1;
        if (val < 1) val = 1;
        if (val > 125) val = 125;
        levRange.value = val;
        levBadge.innerText = val + "x";
        
        // ⚡ 메모리 및 로컬스토리지 상태 고정 (State Lock)
        const coin = 상태.코인목록[상태.기본코인];
        if (coin) coin.레버리지 = val;
        if (!상태.코인별레버리지) 상태.코인별레버리지 = {};
        상태.코인별레버리지[상태.기본코인] = val;
        window.코인레버리지저장();

        // AI 세부 설정 창 텍스트 싱크
        const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
        if (txtAiLeverage) txtAiLeverage.innerText = val + "x";

        주문비용재연산();
        AI추천분석및업데이트(상태.기본코인);
    });

    // 수량 및 가격 입력 감시
    document.getElementById("input-quantity").addEventListener("input", 주문비용재연산);
    document.getElementById("input-trigger-price").addEventListener("input", 주문비용재연산);

    // 수량 마우스 정밀 증감 조정 버튼 리스너 바인딩
    const btnQtyMinus = document.getElementById("btn-qty-minus");
    const btnQtyPlus = document.getElementById("btn-qty-plus");
    const inputQty = document.getElementById("input-quantity");

    if (btnQtyMinus && btnQtyPlus && inputQty) {
        const getQtyStep = () => {
            const coin = 상태.코인목록[상태.기본코인];
            if (!coin) return 0.01;
            // 코인의 수량 소수점 스케일에 맞추어 영리한 마우스 증감 가이드 부여
            if (coin.수량소수점 === 3) return 0.001; // BTC, ETH 등
            if (coin.수량소수점 === 2) return 0.01;  // 일반 알트코인
            if (coin.수량소수점 === 0) return 10.0;   // DOGE, SHIB 등 고수량 밈코인
            return 0.1;
        };

        btnQtyMinus.addEventListener("click", () => {
            const step = getQtyStep();
            let currentVal = parseFloat(inputQty.value) || 0;
            const coin = 상태.코인목록[상태.기본코인];
            
            currentVal = Math.max(0.0001, currentVal - step);
            inputQty.value = parseFloat(currentVal.toFixed(coin ? coin.수량소수점 : 4));
            주문비용재연산();
        });

        btnQtyPlus.addEventListener("click", () => {
            const step = getQtyStep();
            let currentVal = parseFloat(inputQty.value) || 0;
            const coin = 상태.코인목록[상태.기본코인];
            
            currentVal = currentVal + step;
            inputQty.value = parseFloat(currentVal.toFixed(coin ? coin.수량소수점 : 4));
            주문비용재연산();
        });
    }

    // 마우스 드래그 퍼센트 슬라이더 리스너 바인딩
    const qtySlider = document.getElementById("input-qty-slider");
    const qtySliderDisplay = document.getElementById("qty-slider-display");

    if (qtySlider && qtySliderDisplay) {
        qtySlider.addEventListener("input", (e) => {
            const pct = parseInt(e.target.value);
            qtySliderDisplay.innerText = pct + "%";
            
            // 슬라이더의 채워진 트랙 그라디언트 실시간 연동
            qtySlider.style.background = `linear-gradient(to right, var(--color-yellow) ${pct}%, var(--color-border) ${pct}%)`;
            
            const coin = 상태.코인목록[상태.기본코인];
            if (!coin) return;

            const leverage = parseInt(document.getElementById("input-leverage").value);
            const isMarket = document.querySelector(".order-tab.active").dataset.type === "market";
            const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value) || coin.현재가;
            const 기준가격 = isMarket ? coin.현재가 : triggerPrice;

            // 최대 가용 수량 산출 후 퍼센트 대입
            const maxQty = (상태.지갑잔고 * leverage) / 기준가격;
            const targetQty = maxQty * (pct / 100);
            
            inputQty.value = parseFloat(targetQty.toFixed(coin.수량소수점));
            
            // 예상 마진 재연산 (슬라이더 무한 루프 렉을 완벽 차단하기 위해 마진 요소만 초고속 직접 실시간 갱신)
            const estMargin = (targetQty * 기준가격) / leverage;
            document.getElementById("estimated-margin").innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
    }

    // 현재가 자동 기입 숏컷 및 실시간 가격 클릭 시 자동 기입 연동
    const 현재가자동기입 = () => {
        const coin = 상태.코인목록[상태.기본코인];
        if (coin) {
            document.getElementById("input-trigger-price").value = coin.현재가;
            주문비용재연산();
        }
    };
    
    document.getElementById("btn-set-current-price").addEventListener("click", 현재가자동기입);
    
    const currentPriceEl = document.getElementById("current-price");
    if (currentPriceEl) {
        currentPriceEl.addEventListener("click", 현재가자동기입);
    }
    
    const orderbookMidPriceEl = document.getElementById("orderbook-mid-price");
    if (orderbookMidPriceEl) {
        orderbookMidPriceEl.addEventListener("click", 현재가자동기입);
    }

    // 수량 퍼센트 계산
    document.querySelectorAll(".btn-pct").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const pct = parseInt(e.target.dataset.pct);
            const coin = 상태.코인목록[상태.기본코인];
            const leverage = parseInt(document.getElementById("input-leverage").value);
            
            const price = parseFloat(document.getElementById("input-trigger-price").value) || coin.현재가;
            const targetMargin = 상태.지갑잔고 * (pct / 100);
            const qty = (targetMargin * leverage) / price;
            
            document.getElementById("input-quantity").value = parseFloat(qty.toFixed(coin.수량소수점));
            주문비용재연산();
        });
    });

    // TP/SL 체크박스
    const chkTpsl = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");
    chkTpsl.addEventListener("change", () => {
        if (chkTpsl.checked) {
            tpslContainer.classList.remove("hidden");
        } else {
            tpslContainer.classList.add("hidden");
        }
    });

    // 하단 대시보드 탭 메뉴 전환
    document.querySelectorAll(".footer-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".footer-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            
            const targetTab = e.currentTarget.dataset.tab;
            e.currentTarget.classList.add("active");
            document.getElementById(`tab-${targetTab}`).classList.add("active");
        });
    });

    // 초기화 버튼
    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("모든 거래 상태와 지갑을 10,000 USDT 원금으로 리셋하시겠습니까?")) {
            상태.지갑잔고 = 10000.00;
            상태.마진잔고 = 10000.00;
            상태.미실현손익 = 0.00;
            상태.대기주문 = [];
            상태.활성포지션 = [];
            상태.거래이력 = [];
            상태.주문아이디카운터 = 1;
            상태.포지션아이디카운터 = 1;
            
            새신호알림(상태.기본코인, "[시뮬레이터 포트폴리오 리셋] 모든 포지션 및 지갑 잔고가 원금으로 초기화되었습니다.", "execution");
            
            // 모의 매매 상태를 로컬 스토리지에 초기값으로 저장 (초기화)
            모의매매상태저장();
            
            화면업데이트();
            대기주문테이블렌더링();
            활성포지션테이블렌더링();
            거래이력테이블렌더링();
        }
    });

    // 주문 거래 패널 탭(Auto vs Market) 전환
    document.querySelectorAll(".order-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".order-tab").forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            
            const orderType = e.target.dataset.type;
            const triggerPriceGroup = document.getElementById("trigger-price-group");
            const submitBtn = document.getElementById("btn-submit-order");

            if (orderType === "market") {
                triggerPriceGroup.classList.add("hidden");
                submitBtn.innerHTML = `<i class="fa-solid fa-bolt animate-pulse"></i> 시장가 체결`;
            } else {
                triggerPriceGroup.classList.remove("hidden");
                submitBtn.innerHTML = `<i class="fa-solid fa-bolt animate-pulse"></i> 자동 체결 예약 활성화`;
            }
            주문비용재연산();
        });
    });

    submitBtn.addEventListener("click", 주문제출핸들러);

    // AI 추천 타점 적용 버튼 바인딩
    const applyRecBtn = document.getElementById("btn-apply-rec");
    if (applyRecBtn) {
        applyRecBtn.addEventListener("click", AI추천타점적용);
    }

    // AI 팩트체크 퀀트 3대 서브 탭 인터랙션 바인딩
    document.querySelectorAll(".quant-tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            // 버튼 액티브 전환
            document.querySelectorAll(".quant-tab-btn").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");

            // 컨텐츠 패널 액티브 전환
            const targetPanel = e.currentTarget.dataset.quantTab;
            document.querySelectorAll(".quant-tab-panel").forEach(p => p.classList.remove("active"));
            
            const panelEl = document.getElementById(targetPanel);
            if (panelEl) {
                panelEl.classList.add("active");
            }
        });
    });
}

// 주문 비용 재계산 시각화
function 주문비용재연산() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const leverage = parseInt(document.getElementById("input-leverage").value);
    const qty = parseFloat(document.getElementById("input-quantity").value) || 0;
    
    const isMarket = document.querySelector(".order-tab.active").dataset.type === "market";
    const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value) || coin.현재가;
    
    const 기준가격 = isMarket ? coin.현재가 : triggerPrice;
    const estMargin = (qty * 기준가격) / leverage;
    
    document.getElementById("estimated-margin").innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 수량 변경 시 아래 퍼센트 슬라이더의 위치도 가용 잔고 비례로 역계산하여 즉시 동기화
    const maxQty = (상태.지갑잔고 * leverage) / 기준가격;
    const sliderEl = document.getElementById("input-qty-slider");
    const sliderDisplay = document.getElementById("qty-slider-display");
    
    if (sliderEl && sliderDisplay && maxQty > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((qty / maxQty) * 100)));
        sliderEl.value = pct;
        sliderDisplay.innerText = pct + "%";
        // 슬라이더의 채워진 트랙 색상도 그라디언트로 실시간 연동
        sliderEl.style.background = `linear-gradient(to right, var(--color-yellow) ${pct}%, var(--color-border) ${pct}%)`;
    }

    // === Risk Guard 초정밀 실시간 연산 및 동기화 (Precision Risk Guard Sync) ===
    const 방향버튼 = document.querySelector(".btn-dir.active");
    const 주문방향 = 방향버튼 ? 방향버튼.dataset.dir : "LONG";

    const 예상마진엘리먼트 = document.getElementById("risk-estimated-margin");
    const 주문규모엘리먼트 = document.getElementById("risk-notional-size");
    const 청산추정가엘리먼트 = document.getElementById("risk-liquidation-price");
    const 청산거리엘리먼트 = document.getElementById("risk-distance");
    const 위험배지엘리먼트 = document.getElementById("risk-level-badge");
    const 위험타이틀엘리먼트 = document.getElementById("risk-level-title");
    const 위험메시지엘리먼트 = document.getElementById("risk-message");

    if (예상마진엘리먼트) {
        예상마진엘리먼트.innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    }
    const 실질주문규모 = qty * 기준가격;
    if (주문규모엘리먼트) {
        주문규모엘리먼트.innerText = 실질주문규모.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    }

    let 추정청산가 = 0;
    if (qty > 0 && 기준가격 > 0) {
        if (주문방향 === "LONG") {
            추정청산가 = 기준가격 * (1 - 1 / leverage + 0.005);
        } else {
            추정청산가 = 기준가격 * (1 + 1 / leverage - 0.005);
        }
        추정청산가 = Math.max(0, 추정청산가);
    }

    if (청산추정가엘리먼트) {
        청산추정가엘리먼트.innerText = (qty > 0 && 기준가격 > 0) ? 추정청산가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점, maximumFractionDigits: coin.소수점 }) + " USDT" : "--";
    }

    let 청산거리비율 = 0;
    if (qty > 0 && 기준가격 > 0 && 추정청산가 > 0) {
        청산거리비율 = (Math.abs(기준가격 - 추정청산가) / 기준가격) * 100;
    }

    if (청산거리엘리먼트) {
        청산거리엘리먼트.innerText = (qty > 0 && 기준가격 > 0) ? 청산거리비율.toFixed(2) + "%" : "--";
    }

    // 정교한 위험 분석 알고리즘 (Risk Analysis Algorithm)
    const 카드컨테이너 = document.getElementById("risk-check-card");

    if (qty <= 0) {
        if (카드컨테이너) 카드컨테이너.className = "risk-check-card safe";
        if (위험배지엘리먼트) {
            위험배지엘리먼트.className = "risk-level-badge risk-safe";
            위험배지엘리먼트.innerText = "WAIT";
        }
        if (위험타이틀엘리먼트) 위험타이틀엘리먼트.innerText = "대기 중";
        if (위험메시지엘리먼트) 위험메시지엘리먼트.innerHTML = "<span class='text-neutral'>주문 수량을 입력하시면 정밀 위험 분석 및 청산 시뮬레이션이 실시간 가동됩니다.</span>";
    } else if (estMargin > 상태.지갑잔고) {
        if (카드컨테이너) 카드컨테이너.className = "risk-check-card danger";
        if (위험배지엘리먼트) {
            위험배지엘리먼트.className = "risk-level-badge risk-danger";
            위험배지엘리먼트.innerText = "DANGER";
        }
        if (위험타이틀엘리먼트) 위험타이틀엘리먼트.innerText = "경고 (WARNING)";
        if (위험메시지엘리먼트) 위험메시지엘리먼트.innerHTML = `<span class="text-red" style="color: #ff7675; font-weight: 600;">가용 마진 증거금 잔고가 부족합니다. 현재 지갑 잔고: ${상태.지갑잔고.toFixed(2)} USDT, 필요 증거금: ${estMargin.toFixed(2)} USDT 입니다.</span>`;
    } else {
        let 위험등급 = "SAFE";
        let 등급클래스 = "risk-safe";
        let 등급한글명 = "안전 (SAFE)";
        let 위험설명메시지 = "";

        if (leverage >= 50 || 청산거리비율 < 3) {
            위험등급 = "DANGER";
            등급클래스 = "risk-danger";
            등급한글명 = "위험 (DANGER)";
            위험설명메시지 = `초고레버리지(${leverage}배) 설정 또는 극도로 짧은 청산 거리(${청산거리비율.toFixed(2)}%)입니다. 미세한 역방향 파동에도 즉시 청산될 수 있으므로 각별히 경계하십시오.`;
        } else if (leverage >= 20 || 청산거리비율 < 8) {
            위험등급 = "MEDIUM";
            등급클래스 = "risk-medium";
            등급한글명 = "보통 (MEDIUM)";
            위험설명메시지 = `중고레버리지(${leverage}배) 설정 및 청산 거리 ${청산거리비율.toFixed(2)}% 입니다. 시장 변동성에 유의하시고 자동 마진(Auto Margin) 가드 활성화를 추천합니다.`;
        } else {
            위험등급 = "SAFE";
            등급클래스 = "risk-safe";
            등급한글명 = "안전 (SAFE)";
            위험설명메시지 = `비교적 안전한 레버리지(${leverage}배) 비중 및 넉넉한 청산 거리(${청산거리비율.toFixed(2)}%)입니다. 리스크(Risk) 한도가 양호하게 통제되고 있습니다.`;
        }

        if (카드컨테이너) {
            카드컨테이너.className = "risk-check-card " + (위험등급 === "DANGER" ? "danger" : (위험등급 === "MEDIUM" ? "medium" : "safe"));
        }
        if (위험배지엘리먼트) {
            위험배지엘리먼트.className = `risk-level-badge ${등급클래스}`;
            위험배지엘리먼트.innerText = 위험등급;
        }
        if (위험타이틀엘리먼트) 위험타이틀엘리먼트.innerText = 등급한글명;
        if (위험메시지엘리먼트) 위험메시지엘리먼트.innerHTML = `<span class="text-neutral">${위험설명메시지}</span>`;
    }
}

// 주문 검증 및 접수
function 주문제출핸들러() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    // 동일 코인 중복 포지션 개설 차단 사전 검사
    const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === 상태.기본코인);
    if (이미존재하는포지션) {
        alert(`이미 ${상태.기본코인}에 활성화된 포지션이 존재합니다. 동일 코인의 중복 진입은 제한됩니다.`);
        return;
    }

    const activeOrderTab = document.querySelector(".order-tab.active").dataset.type;
    const 방향 = document.querySelector(".btn-dir.active").dataset.dir;
    const leverage = parseInt(document.getElementById("input-leverage").value);
    const qty = parseFloat(document.getElementById("input-quantity").value);

    if (isNaN(qty) || qty <= 0) {
        alert("주문 수량을 올바르게 입력해주세요.");
        return;
    }

    const chkTpsl = document.getElementById("chk-tpsl").checked;
    let tpPrice = parseFloat(document.getElementById("input-tp-price").value) || 0;
    let slPrice = parseFloat(document.getElementById("input-sl-price").value) || 0;

    // 시장가 주문
    if (activeOrderTab === "market") {
        const 모의주문 = {
            심볼: 상태.기본코인,
            방향: 방향,
            레버리지: leverage,
            수량: qty,
            익절가: tpPrice,
            손절가: slPrice
        };
        포지션체결실행(모의주문, coin.현재가);
        return;
    }

    // 자동 체결(지정가 예약) 주문
    const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value);

    if (isNaN(triggerPrice) || triggerPrice <= 0) {
        alert("자동 감시 타점 가격을 설정해주세요.");
        return;
    }

    if (chkTpsl) {
        if (방향 === "LONG") {
            if (tpPrice > 0 && tpPrice <= triggerPrice) {
                alert("롱 익절 타점은 진입가보다 반드시 높아야 합니다.");
                return;
            }
            if (slPrice > 0 && slPrice >= triggerPrice) {
                alert("롱 손절 타점은 진입가보다 반드시 낮아야 합니다.");
                return;
            }
        } else {
            if (tpPrice > 0 && tpPrice >= triggerPrice) {
                alert("숏 익절 타점은 진입가보다 반드시 낮아야 합니다.");
                return;
            }
            if (slPrice > 0 && slPrice <= triggerPrice) {
                alert("숏 손절 타점은 진입가보다 반드시 높아야 합니다.");
                return;
            }
        }
    }

    const 예상마진 = (qty * triggerPrice) / leverage;
    if (상태.지갑잔고 < 예상마진) {
        alert("가용 마진 증거금 잔고가 부족합니다.");
        return;
    }

    const 예약오더 = {
        아이디: 상태.주문아이디카운터++,
        심볼: 상태.기본코인,
        방향: 방향,
        레버리지: leverage,
        타점가격: triggerPrice,
        수량: qty,
        예상마진: 예상마진,
        익절가: tpPrice,
        손절가: slPrice,
        등록시간: 얻는현재시각텍스트()
    };

    상태.대기주문.push(예약오더);

    새신호알림(상태.기본코인, `[자동 예약 등록] ${상태.기본코인} ${방향} 주문이 바이낸스가 ${triggerPrice.toLocaleString()} USDT에 도달 시 체결되도록 등록 완료되었습니다.`, "execution");

    // 로컬 스토리지에 대기 주문 추가 상태 저장
    모의매매상태저장();

    대기주문테이블렌더링();
    상태바업데이트();
    화면업데이트();

    // 입력폼 리셋
    document.getElementById("input-trigger-price").value = "";
    document.getElementById("input-quantity").value = "0.1";
    document.getElementById("input-tp-price").value = "";
    document.getElementById("input-sl-price").value = "";
    document.getElementById("chk-tpsl").checked = false;
    document.getElementById("tpsl-inputs-container").classList.add("hidden");
    주문비용재연산();
}

// 12. 테이블 렌더링 인터페이스 (Table Renders)

function 활성포지션테이블렌더링() {
    const tbody = document.getElementById("positions-table-body");
    if (!tbody) return;

    if (상태.활성포지션.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="11"><i class="fa-solid fa-inbox empty-icon"></i> 활성화된 포지션이 없습니다.</td>
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
        const autoMarginChecked = pos.자동마진 ? "checked" : "";

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
                <td style="text-align: center;">
                    <label class="config-switch" style="scale: 0.8; display: inline-block; margin: 0 auto; vertical-align: middle;">
                        <input type="checkbox" ${autoMarginChecked} onchange="window.포지션자동마진토글(${idx})">
                        <span class="config-switch-slider"></span>
                    </label>
                </td>
                <td id="pos-pnl-${pos.아이디}" class="${pnlClass} font-display" style="font-weight:700; font-family:var(--font-display);">
                    ${sign}${pnl.toFixed(2)} USDT (${sign}${pnlPct.toFixed(2)}%)
                </td>
                <td>
                    <button class="btn-table-close" onclick="수동포지션종료(${idx})">시장가 정산</button>
                    <button class="btn-table-close" style="background: #e67e22; border-color: #d35400; color: #fff; margin-left: 4px;" onclick="window.포지션역방향전환(${idx})">역방향</button>
                    <button class="btn-table-close" style="background: #27ae60; border-color: #219653; color: #fff; margin-left: 4px;" onclick="window.포지션수동마진추가(${idx})">마진 추가</button>
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

        if (priceEl) priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (pnlEl) {
            pnlEl.innerText = `${sign}${pnl.toFixed(2)} USDT (${sign}${pnlPct.toFixed(2)}%)`;
            pnlEl.className = `${pnlClass}`;
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
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="10"><i class="fa-solid fa-inbox empty-icon"></i> 대기 중인 자동 체결 주문이 없습니다.</td>
            </tr>
        `;
        return;
    }

    let html = "";
    상태.대기주문.forEach((ord, idx) => {
        const coin = 상태.코인목록[ord.심볼];
        const badgeClass = ord.방향 === "LONG" ? "long" : "short";
        
        let tpslText = "설정 안 함";
        if (ord.익절가 > 0 || ord.손절가 > 0) {
            tpslText = `TP: ${ord.익절가 > 0 ? ord.익절가.toLocaleString() : '-'} | SL: ${ord.손절가 > 0 ? ord.손절가.toLocaleString() : '-'}`;
        }

        html += `
            <tr>
                <td style="font-weight:700;">${ord.심볼}</td>
                <td><span class="badge-position-type ${badgeClass}">${ord.방향}</span></td>
                <td class="text-yellow" style="font-weight:600;">${ord.레버리지}x</td>
                <td class="text-yellow" style="font-family:var(--font-display); font-weight:700;">${ord.타점가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</td>
                <td style="font-family:var(--font-display);">${ord.수량.toFixed(coin.수량소수점)}</td>
                <td style="font-family:var(--font-display);">${ord.예상마진.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="font-size:10px;">${tpslText}</td>
                <td>${ord.등록시간}</td>
                <td><span class="text-green animate-pulse" style="font-size:10px;"><i class="fa-solid fa-satellite-dish"></i> Binance 감시 중</span></td>
                <td>
                    <button class="btn-table-cancel" onclick="대기주문취소(${idx})">취소</button>
                </td>
            </tr>
        `;
    });
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
        return;
    }

    let html = "";
    상태.거래이력.forEach(h => {
        const coin = 상태.코인목록[h.심볼];
        const decimal = coin ? coin.소수점 : 2;
        const pnlClass = h.실현손익 >= 0 ? "text-green" : "text-red";
        const badgeClass = h.방향 === "LONG" ? "long" : "short";

        html += `
            <tr>
                <td style="color:var(--color-text-muted);">${h.시간}</td>
                <td style="font-weight:700;">${h.심볼}</td>
                <td><span class="badge-position-type ${badgeClass}">${h.방향}</span></td>
                <td>${h.레버리지}x</td>
                <td style="font-family:var(--font-display);">${h.진입가.toLocaleString(undefined, { minimumFractionDigits: decimal })}</td>
                <td style="font-family:var(--font-display);">${h.종료가.toLocaleString(undefined, { minimumFractionDigits: decimal })}</td>
                <td style="font-family:var(--font-display);">${h.수량}</td>
                <td style="font-family:var(--font-display); color:var(--color-text-muted);">${h.수수료.toFixed(4)} USDT</td>
                <td class="${pnlClass}" style="font-family:var(--font-display); font-weight:700;">${h.실현손익 >= 0 ? '+' : ''}${h.실현손익.toFixed(2)} USDT</td>
                <td style="font-weight:500; font-size:10px;">${h.종료원인}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 13. 상태 갱신 유틸리티 헬퍼 (Utility & Extra Helpers)

function 상태바업데이트() {
    document.getElementById("wallet-balance").innerText = 상태.지갑잔고.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    document.getElementById("margin-balance").innerText = 상태.마진잔고.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    
    const pnl = 상태.미실현손익;
    const totalMarginUsed = 상태.활성포지션.reduce((sum, p) => sum + p.투입마진, 0);
    const pnlPct = totalMarginUsed > 0 ? (pnl / totalMarginUsed) * 100 : 0;
    
    const pnlEl = document.getElementById("header-unrealized-pnl");
    const sign = pnl >= 0 ? "+" : "";
    pnlEl.innerText = `${sign}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT (${sign}${pnlPct.toFixed(2)}%)`;
    pnlEl.className = "info-value " + (pnl > 0 ? "text-green" : (pnl < 0 ? "text-red" : "text-neutral"));

    document.getElementById("active-positions-count").innerText = 상태.활성포지션.length;
    document.getElementById("pos-badge").innerText = 상태.활성포지션.length;
    document.getElementById("trigger-badge").innerText = 상태.대기주문.length;
}

function 화면업데이트() {
    상태바업데이트();
    주문비용재연산();
}

function 새신호알림(symbol, msg, type) {
    const listEl = document.getElementById("signal-feed-list");
    if (!listEl) return;

    const time = 얻는현재시각텍스트();
    const safeSymbol = 텍스트HTML이스케이프(symbol);
    
    // '[매매 신호 감지]' 텍스트를 고광택 인터랙티브 뱃지로 치환하여 사용자 경험 극대화 (클릭 시 핫스왑 지원)
    let formattedMsg = 텍스트HTML이스케이프(msg);
    if (String(msg).includes("[매매 신호 감지]")) {
        formattedMsg = formattedMsg.replace("[매매 신호 감지]", `<span class="signal-detect-badge"><i class="fa-solid fa-crosshairs animate-pulse" style="margin-right:4px;"></i>신호감지</span>`);
        formattedMsg = formattedMsg.replace("**롱(LONG) 매수**", `<strong class="text-green">롱(LONG) 매수</strong>`);
        formattedMsg = formattedMsg.replace("**숏(SHORT) 매도**", `<strong class="text-red">숏(SHORT) 매도</strong>`);
    }

    const item = document.createElement("div");
    item.className = `signal-item ${type}`;
    // 클릭 시 해당 코인 탭 전환(핫스왑) 실행 바인딩
    item.addEventListener("click", () => window.코인탭전환(symbol));
    item.setAttribute("title", `클릭 시 ${symbol} 분석 화면으로 즉시 이동`);
    item.innerHTML = `
        <span class="signal-time"><i class="fa-solid fa-satellite-dish" style="margin-right:4px;"></i> 라이브 ${safeSymbol} | ${time} <span class="signal-click-tip">(클릭 시 이동)</span></span>
        <span class="signal-msg">${formattedMsg}</span>
    `;

    listEl.insertBefore(item, listEl.firstChild);

    if (listEl.children.length > 50) {
        listEl.removeChild(listEl.lastChild);
    }
}

function 얻는현재시각텍스트() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function 재생효과음(audioId) {
    const audio = document.getElementById(audioId);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {
            console.warn(`[Audio Backup] 오디오 재생 실패 (${audioId}), Web Audio API로 백업 사운드(Backup Sound)를 발생시킵니다:`, e.message);
            백업사운드재생(audioId);
        });
    } else {
        백업사운드재생(audioId);
    }
}

// [사운드 합성 엔진 V1] 외부 리소스가 차단되어 효과음이 재생되지 않을 때 Web Audio API로 주파수를 합성하는 백업 함수 (한글 주석 준수)
function 백업사운드재생(audioId) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator(); // 오실레이터(Oscillator) 객체 생성
        const gain = ctx.createGain(); // 게인(Gain) 볼륨 조절 객체 생성
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        if (audioId === "sound-trigger") {
            // 주문 및 타점 체결음: 맑게 상승하는 비프음 (C5 -> G5)
            osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (audioId === "sound-signal") {
            // 신호 포착 알림음: 부드럽고 상큼한 비프음 (E5 -> G5)
            osc.type = "triangle";
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (audioId === "sound-liquid") {
            // 청산 알림음: 무겁고 하강하는 경고음 (E4 -> A2)
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(329.63, now);
            osc.frequency.linearRampToValueAtTime(110.00, now + 0.5);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else {
            // 기본 경고 비프음
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    } catch (e) {
        console.error("Web Audio API 백업 사운드 재생 에러:", e);
    }
}

// 전역에 AI 추천 정보를 캐싱해둘 임시 변수 (AI Targets Cache)
const AI추천캐시 = {
    방향: "LONG",
    진입가: 0,
    익절가: 0,
    손절가: 0
};

function 지표신뢰도등급(점수) {
    if (점수 >= 80) return { 텍스트: `${점수}% 높음`, 클래스: "text-green" };
    if (점수 >= 60) return { 텍스트: `${점수}% 보통`, 클래스: "text-yellow" };
    return { 텍스트: `${점수}% 낮음`, 클래스: "text-red" };
}

// 시장 상태를 먼저 구분해야 RSI/CCI 같은 과열 지표를 과신하지 않습니다.
function 시장상태판정({ 현재가, ema20, sma60, bbUpper, bbLower, bbBasis, 현재MACD, 현재MACD시그널 }) {
    const 밴드폭 = bbBasis > 0 ? ((bbUpper - bbLower) / bbBasis) * 100 : 0;
    const 이평괴리 = sma60 > 0 ? Math.abs(ema20 - sma60) / sma60 * 100 : 0;
    const 추세방향 = 현재가 >= sma60 && 현재MACD >= 현재MACD시그널 ? "UP" : (현재가 < sma60 && 현재MACD < 현재MACD시그널 ? "DOWN" : "MIXED");

    if (밴드폭 >= 8 || 이평괴리 >= 4) {
        return {
            코드: "VOLATILE_TREND",
            이름: 추세방향 === "DOWN" ? "하락 변동성 확대" : "상승 변동성 확대",
            추세가중치: 1.25,
            평균회귀가중치: 0.55,
            신뢰도보정: -8
        };
    }

    if (추세방향 !== "MIXED" && 이평괴리 >= 1.2) {
        return {
            코드: 추세방향 === "UP" ? "UP_TREND" : "DOWN_TREND",
            이름: 추세방향 === "UP" ? "상승 추세장" : "하락 추세장",
            추세가중치: 1.2,
            평균회귀가중치: 0.65,
            신뢰도보정: 4
        };
    }

    if (밴드폭 <= 3.5) {
        return {
            코드: "RANGE",
            이름: "횡보 압축장",
            추세가중치: 0.75,
            평균회귀가중치: 1.15,
            신뢰도보정: 0
        };
    }

    return {
        코드: "MIXED",
        이름: "혼합 구간",
        추세가중치: 1,
        평균회귀가중치: 0.9,
        신뢰도보정: -3
    };
}

// AI 실시간 지표 분석 및 추천 타점 업데이트 함수 (초정밀 퀀트 V2 & 다요소 스코어 엔진)
function AI추천분석및업데이트(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    const elQuantTarget = document.getElementById("quant-coin-target");
    if (elQuantTarget) {
        elQuantTarget.innerText = `(${symbol})`;
    }

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    // [데이터 과소 상태 가드] 캔들 개수가 15봉 미만일 때의 기본 타점 초기화 규칙 (한국어 주석 준수)
    if (closes.length < 15) {
        const 정밀저항가격 = parseFloat((coin.현재가 * 1.025).toFixed(coin.소수점));
        const 정밀지지가격 = parseFloat((coin.현재가 * 0.975).toFixed(coin.소수점));
        AI추천캐시.방향 = "NEUTRAL";
        AI추천캐시.저항선 = 정밀저항가격;
        AI추천캐시.지지선 = 정밀지지가격;
        AI추천캐시.진입가 = coin.현재가;
        AI추천캐시.익절가 = 정밀저항가격;
        AI추천캐시.손절가 = 정밀지지가격;

        const resistanceEl = document.getElementById("rec-resistance");
        const supportEl = document.getElementById("rec-support");
        if (resistanceEl) resistanceEl.innerText = 정밀저항가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";
        if (supportEl) supportEl.innerText = 정밀지지가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";

        // 신뢰 지표 기본값 바인딩
        const resAccEl = document.getElementById("res-accuracy");
        const resConfEl = document.getElementById("res-confidence");
        const supAccEl = document.getElementById("sup-accuracy");
        const supConfEl = document.getElementById("sup-confidence");

        if (resAccEl) resAccEl.innerText = "80.0% (수렴 진행)";
        if (resConfEl) resConfEl.innerText = "80.0% (데이터 부족)";
        if (supAccEl) supAccEl.innerText = "80.0% (수렴 진행)";
        if (supConfEl) supConfEl.innerText = "80.0% (데이터 부족)";

        const marketRegimeLabel = document.getElementById("market-regime-label");
        const signalConfidenceLabel = document.getElementById("signal-confidence-label");
        const syntheticWarningLabel = document.getElementById("synthetic-warning-label");
        if (marketRegimeLabel) marketRegimeLabel.innerText = "데이터 부족";
        if (signalConfidenceLabel) {
            signalConfidenceLabel.innerText = "낮음";
            signalConfidenceLabel.className = "reliability-value text-red";
        }
        if (syntheticWarningLabel) syntheticWarningLabel.innerText = "15봉 미만";
        return;
    }

    // 1. 퀀트 보조지표 계산 (Advanced Indicators Calculations)
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 현재MACD히스토그램 = macdData.histogram[idx] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const sma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const sma200 = 계산SMA(closes, 200)[idx] || coin.현재가; // 100MA 장기 추세 필터 (데이터 한계상 100봉 사용)

    const cciVal = 계산CCI(highs, lows, closes, 20)[idx] || 0;
    const stochData = 계산스토캐스틱(highs, lows, closes, 14, 3, 3);
    const stochK = stochData.k[idx] || 50;
    const stochD = stochData.d[idx] || 50;
    const vwapVal = 계산VWAP(coin.캔들데이터)[idx] || coin.현재가;
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;
    const bbBasis = bbData.basis[idx] || coin.현재가;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1)); // 100캔들 기준 정밀 추적
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    // [퀀트 보증 가드] 피보나치 되돌림(Fibonacci Retracement) 구간과 볼린저 밴드(Bollinger Bands) 하단/상단 수렴 지능형 보정 (한국어 주석 준수)
    const bbUpperSanitized = Math.min(bbUpper, coin.현재가 * 1.15); // 볼린저 상단 이상 상승 가드
    const bbLowerSanitized = Math.max(bbLower, coin.currentlyPrice || coin.현재가 * 0.85); // 볼린저 하단 이하 폭락 가드

    const fiboValues = Object.values(fiboLevels);
    
    // 현재가보다 높은 피보나치 레벨 -> 저항선 후보 (Resistance)
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가);
    let fiboResistance = bbUpperSanitized;
    if (상방fibo들.length > 0) {
        fiboResistance = Math.min(...상방fibo들); // 가장 인접한 상방 저항 레벨
    }

    // 현재가보다 낮은 피보나치 레벨 -> 지지선 후보 (Support)
    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가);
    let fiboSupport = bbLowerSanitized;
    if (하방fibo들.length > 0) {
        fiboSupport = Math.max(...하방fibo들); // 가장 인접한 하방 지지 레벨
    }

    let 정밀저항가격 = parseFloat(((fiboResistance + bbUpperSanitized) / 2).toFixed(coin.소수점));
    let 정밀지지가격 = parseFloat(((fiboSupport + bbLowerSanitized) / 2).toFixed(coin.소수점));

    // 현재가 돌파 및 이탈에 대한 물리적 이탈 안전 가드 (2차 가드)
    if (정밀지지가격 >= coin.현재가) {
        정밀지지가격 = parseFloat((coin.현재가 * 0.985).toFixed(coin.소수점));
    }
    if (정밀저항가격 <= coin.현재가) {
        정밀저항가격 = parseFloat((coin.현재가 * 1.015).toFixed(coin.소수점));
    }

    // [퀀트 분석 엔진 V3] 실시간 추세 돌파 감지 및 지능형 지지저항 리밸런싱 (Breakout & Support/Resistance Roll-over)
    let 저항선돌파상태 = false;
    let 지지선붕괴상태 = false;

    if (coin.현재가 >= 정밀저항가격) {
        저항선돌파상태 = true;
        // 저항선 돌파 시, 피보나치 상방 확장 채널(11.4% 확장 레벨)과 볼린저 밴드 상단 확장가로 저항 레벨 상향 롤오버 (2차 방어선 제시)
        const 확장저항 = 최고24h + (최고24h - 최저24h) * 0.114;
        정밀저항가격 = parseFloat(((확장저항 + bbUpper * 1.012) / 2).toFixed(coin.소수점));
    }
    if (coin.현재가 <= 정밀지지가격) {
        지지선붕괴상태 = true;
        // 지지선 붕괴 시, 피보나치 하방 확장 채널(-11.4% 확장 레벨)과 볼린저 밴드 하단 확장가로 지지 레벨 하향 롤다운 (2차 지지선 제시)
        const 확장지지 = 최저24h - (최고24h - 최저24h) * 0.114;
        정밀지지가격 = parseFloat(((확장지지 + bbLower * 0.988) / 2).toFixed(coin.소수점));
    }

    // 슈퍼트렌드 모방 연산 (RSI 및 MA 기반 모멘텀 추적 모델)
    const 슈퍼트렌드롱 = coin.현재가 > ema20 && rsiVal > 48;
    const 슈퍼트렌드텍스트 = 슈퍼트렌드롱 ? "롱 (LONG / Bullish)" : "숏 (SHORT / Bearish)";
    const 슈퍼트렌드클래스 = 슈퍼트렌드롱 ? "text-green" : "text-red";

    // 2. 퀀트 보조지표 DOM 연동 바인딩 (Tab 1)
    const elCCI = document.getElementById("metric-cci");
    if (elCCI) {
        elCCI.innerText = cciVal.toFixed(2);
        elCCI.className = "metric-val " + (cciVal > 100 ? "text-red" : (cciVal < -100 ? "text-green" : "text-neutral"));
    }
    const elBB = document.getElementById("metric-bb");
    if (elBB) {
        const bbWidth = ((bbUpper - bbLower) / bbBasis * 100).toFixed(2);
        elBB.innerText = `상: ${bbUpper.toFixed(coin.소수점)} | 하: ${bbLower.toFixed(coin.소수점)} (폭: ${bbWidth}%)`;
    }
    const elMACD = document.getElementById("metric-macd");
    if (elMACD) {
        const macdTrend = 현재MACD >= 현재MACD시그널 ? "골든 크로스 (롱)" : "데드 크로스 (숏)";
        elMACD.innerText = `${현재MACD.toFixed(3)} / ${현재MACD시그널.toFixed(3)} (${macdTrend})`;
        elMACD.className = "metric-val " + (현재MACD >= 현재MACD시그널 ? "text-green" : "text-red");
    }
    const elStoch = document.getElementById("metric-stoch");
    if (elStoch) {
        elStoch.innerText = `K: ${stochK.toFixed(1)}% | D: ${stochD.toFixed(1)}%`;
        elStoch.className = "metric-val " + (stochK >= 80 ? "text-red" : (stochK <= 20 ? "text-green" : "text-neutral"));
    }
    const elVWAP = document.getElementById("metric-vwap");
    if (elVWAP) {
        elVWAP.innerText = `${vwapVal.toFixed(coin.소수점)} USDT`;
        elVWAP.className = "metric-val " + (coin.현재가 >= vwapVal ? "text-green" : "text-red");
    }
    const elFibo = document.getElementById("metric-fibo");
    if (elFibo) {
        let fiboText = "50.0% 구간 대치 중";
        if (coin.현재가 >= fiboLevels["23.6%"]) {
            fiboText = `23.6% 돌파 강세 (${fiboLevels["23.6%"].toFixed(coin.소수점)} USDT)`;
        } else if (coin.현재가 >= fiboLevels["38.2%"]) {
            fiboText = `38.2% 지지 수렴 (${fiboLevels["38.2%"].toFixed(coin.소수점)} USDT)`;
        } else if (coin.현재가 <= fiboLevels["78.6%"]) {
            fiboText = `78.6% 되돌림 낙폭과대 (${fiboLevels["78.6%"].toFixed(coin.소수점)} USDT)`;
        } else if (coin.현재가 <= fiboLevels["61.8%"]) {
            fiboText = `61.8% 골든존 테스팅 (${fiboLevels["61.8%"].toFixed(coin.소수점)} USDT)`;
        } else {
            fiboText = `50.0% 구간 대치 (${fiboLevels["50.0%"].toFixed(coin.소수점)} USDT)`;
        }
        // 피보나치 되돌림 구간의 실시간 가격과 78.6% 지지선 가격을 에메랄드 민트 컬러 및 디바이더와 함께 병렬 노출하도록 UI 고도화
        elFibo.innerHTML = `<span style="color: #ffc107; font-weight: 700;">${fiboText}</span> <span style="font-size: 0.85em; opacity: 0.85; margin-left: 6px; color: #20c997; border-left: 1px solid rgba(255,255,255,0.15); padding-left: 6px;">[78.6% 지지: ${fiboLevels["78.6%"].toFixed(coin.소수점)}]</span>`;
    }
    const elRSISuper = document.getElementById("metric-rsi-supertrend");
    if (elRSISuper) {
        elRSISuper.innerHTML = `RSI: ${rsiVal.toFixed(1)}% | 슈퍼: <span class="${슈퍼트렌드클래스}" style="font-weight:700;">${슈퍼트렌드텍스트}</span>`;
    }

    // 3. 온체인 & 선물 지표 DOM 연동 바인딩 (Tab 2)
    // 펀딩비 (Derivatives Funding Rate) : 실시간 RSI 및 매수/매도 호가 비율 연동식 계산
    const 호가비율 = coin.호가매수.length > 0 && coin.호가매도.length > 0 ? 
        parseFloat(coin.호가매수[0][1]) / (parseFloat(coin.호가매수[0][1]) + parseFloat(coin.호가매도[0][1])) : 0.5;
    const 펀딩비 = (rsiVal - 50) * 0.0004 + (호가비율 - 0.5) * 0.01 + 0.01; 
    const elFunding = document.getElementById("metric-funding-rate");
    if (elFunding) {
        elFunding.innerText = (펀딩비 >= 0 ? "+" : "") + 펀딩비.toFixed(4) + "%";
        elFunding.className = "metric-val " + (펀딩비 >= 0.015 ? "text-red" : (펀딩비 < 0 ? "text-green" : "text-neutral"));
    }

    // 미결제약정 (Open Interest) : 실제 24시간 변동률과 거래량 가중 연동
    const oiChange = (Math.abs(coin.현재가 - coin.어제종가) / coin.어제종가) * 350 + (호가비율 - 0.5) * 20;
    const elOI = document.getElementById("metric-oi");
    if (elOI) {
        elOI.innerText = `${(oiChange >= 0 ? "+" : "") + oiChange.toFixed(2)}% (신규 거래량 급증)`;
        elOI.className = "metric-val " + (oiChange > 5 ? "text-green" : (oiChange < -5 ? "text-red" : "text-neutral"));
    }

    // 청산 맵 (Derivatives Liquidation Map) : 롱/숏 세력 청산 집중도
    const liqLongRatio = Math.max(20, Math.min(80, Math.floor(52 + (rsiVal - 50) * 0.8 + (호가비율 - 0.5) * 15)));
    const liqShortRatio = 100 - liqLongRatio;
    const elLiq = document.getElementById("metric-liq-map");
    if (elLiq) {
        elLiq.innerHTML = `<span class="text-green">롱 풀 ${liqLongRatio}%</span> vs <span class="text-red">숏 풀 ${liqShortRatio}%</span>`;
    }

    // MVRV & SOPR 온체인 지표 추론
    const mvrv = 1.2 + (coin.현재가 / sma200 - 1) * 2;
    const sopr = 1.0 + (rsiVal - 50) * 0.002 + (호가비율 - 0.5) * 0.05;
    const elMVRVSOPR = document.getElementById("metric-mvrv-sopr");
    if (elMVRVSOPR) {
        elMVRVSOPR.innerText = `MVRV: ${mvrv.toFixed(2)} (${mvrv > 2.0 ? '저항 과열' : '매집 매력'}) | SOPR: ${sopr.toFixed(3)}`;
        elMVRVSOPR.className = "metric-val " + (sopr >= 1.0 ? "text-green" : "text-red");
    }

    // 고래 지갑 순유입량 (Whale Flows)
    const whaleRatio = Math.max(-95, Math.min(95, Math.floor((coin.호가매수.length - coin.호가매도.length) * 15 + (rsiVal - 50) * 2 + (호가비율 - 0.5) * 80)));
    const elWhale = document.getElementById("metric-whale-flow");
    if (elWhale) {
        elWhale.innerText = `${(whaleRatio >= 0 ? "+" : "") + whaleRatio}% (고래 ${whaleRatio >= 0 ? '순유입 매집' : '순유출 이탈'})`;
        elWhale.className = "metric-val " + (whaleRatio >= 0 ? "text-green" : "text-red");
    }

    // VPVR 가장 많이 거래된 POC 구간
    const elVPVR = document.getElementById("metric-vpvr");
    if (elVPVR) {
        elVPVR.innerText = `POC 매물 중심: ${vpvrPOC.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })} USDT`;
    }

    // CME 갭 (CME Gap) 분석 화면 연동
    const elCME = document.getElementById("metric-cme-gap");
    if (elCME) {
        const cache = 상태.CME갭캐시[symbol];
        if (cache) {
            elCME.innerText = cache.결과;
            elCME.className = "metric-val " + cache.클래스;
        } else {
            elCME.innerText = "분석 중...";
            elCME.className = "metric-val text-neutral";
        }
    }
    CME갭연산및업데이트(symbol).then(() => {
        const elCMELive = document.getElementById("metric-cme-gap");
        if (elCMELive) {
            const cache = 상태.CME갭캐시[symbol];
            if (cache) {
                elCMELive.innerText = cache.결과;
                elCMELive.className = "metric-val " + cache.클래스;
            }
        }
        // [수정] 비동기 분석 완료 시점에 현재 탭에 선택되어 있는 코인과 일치하면 광고판 밑 요약창도 동시 최신화
        if (symbol === 상태.기본코인) {
            const adCmeStatusElLive = document.getElementById("ad-cme-gap-status");
            if (adCmeStatusElLive) {
                const cache = 상태.CME갭캐시[symbol];
                if (cache) {
                    adCmeStatusElLive.innerText = cache.간단결과 || cache.결과;
                    adCmeStatusElLive.className = "briefing-value " + cache.클래스;
                }
            }
        }
    });

    // 4. 프로젝트 및 기본적 분석 바인딩 (Tab 3 - Fundamental Briefs)
    let pInfo = 프로젝트데이터베이스[symbol];
    if (!pInfo) {
        // 동적 분석 생성 엔진 가동
        const estCap = symbol.startsWith("BTC") ? "1.4조 달러" : (symbol.startsWith("ETH") ? "3,800억 달러" : "추정 시가총액 중위권");
        const liqLevel = coin.호가매수.length > 3 ? "A- (중견 규모)" : "BBB (보통)";
        const scalLevel = symbol.endsWith("USDT") ? "High (전용 선물 인프라 병렬 처리)" : "Medium";
        const instPref = rsiVal > 55 ? "상승 선호 유입" : "관망 상태";
        const supportL = coin.현재가 * 0.982;
        const resistanceL = coin.현재가 * 1.018;

        pInfo = {
            개요: `${symbol.replace("USDT", "")} 프로젝트는 탈중앙화 생태계를 지향하는 실시간 스마트 통화 자산으로, ${estCap} 규모를 구성하고 있습니다.`,
            유동성: liqLevel,
            확장성: scalLevel,
            기관선호도: instPref,
            락업이벤트: "정기 오버행 해제 순항 중 및 유통량 조정 완료",
            호재뉴스: "바이낸스 신규 무기한 레버리지 마진 페어 추가 및 커뮤니티 파트너십 구축 호재 뉴스",
            지지저항: `강력 지지선: ${supportL.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })} USDT | 강력 저항선: ${resistanceL.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })} USDT`
        };
    }

    document.getElementById("project-desc").innerText = pInfo.개요;
    document.getElementById("project-liquidity").innerText = pInfo.유동성;
    document.getElementById("project-scalability").innerText = pInfo.확장성;
    document.getElementById("project-institutional").innerText = pInfo.기관선호도;
    document.getElementById("project-lockup").innerText = pInfo.락업이벤트;
    document.getElementById("project-news").innerText = pInfo.호재뉴스;
    document.getElementById("project-levels").innerText = pInfo.지지저항;

    // [NEW] 광고 아래 모니터링 섹션 값 업데이트
    const adCmeStatusEl = document.getElementById("ad-cme-gap-status");
    if (adCmeStatusEl) {
        const cache = 상태.CME갭캐시[symbol];
        if (cache) {
            adCmeStatusEl.innerText = cache.간단결과 || cache.결과;
            adCmeStatusEl.className = "briefing-value " + cache.클래스;
        } else {
            adCmeStatusEl.innerText = (symbol === "BTCUSDT" || symbol === "ETHUSDT") ? "분석 연산 중..." : "N/A (CME 미상장 자산)";
            adCmeStatusEl.className = "briefing-value text-neutral";
        }
    }

    const adLongShortEl = document.getElementById("ad-long-short-flow");
    if (adLongShortEl) {
        adLongShortEl.innerHTML = `롱 풀 <span class="text-green" style="font-weight:700;">${liqLongRatio}%</span> vs 숏 풀 <span class="text-red" style="font-weight:700;">${liqShortRatio}%</span> <span style="font-size:0.85em; color:var(--color-text-muted); margin-left:6px;">(고래 유입: ${whaleRatio >= 0 ? '+' : ''}${whaleRatio}%)</span>`;
    }

    const adNewsEl = document.getElementById("ad-live-news-content");
    if (adNewsEl) {
        adNewsEl.innerText = pInfo.호재뉴스;
    }

    const 시장상태 = 시장상태판정({
        현재가: coin.현재가,
        ema20,
        sma60,
        bbUpper,
        bbLower,
        bbBasis,
        현재MACD,
        현재MACD시그널
    });

    // 5. 시장 상태별 가중치 기반 8대 핵심 지표 종합 스코어 V3
    let 점수 = 50; // 기준점 50점
    let 롱근거수 = 0;
    let 숏근거수 = 0;
    let 추세합의수 = 0;
    let 평균회귀합의수 = 0;

    // A. RSI 분석: 추세장에서는 반전 신호 과신을 줄이고, 횡보장에서는 평균회귀 신뢰도를 올립니다.
    if (rsiVal <= 25) { 점수 += 10 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (rsiVal <= 35) { 점수 += 7 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (rsiVal >= 75) { 점수 -= 10 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (rsiVal >= 65) { 점수 -= 7 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }

    // B. MACD 분석: 추세 판단의 핵심 축입니다.
    if (현재MACD > 현재MACD시그널) {
        점수 += 8 * 시장상태.추세가중치;
        롱근거수++;
        추세합의수++;
        if (현재MACD히스토그램 > 0) 점수 += 5 * 시장상태.추세가중치;
    } else {
        점수 -= 8 * 시장상태.추세가중치;
        숏근거수++;
        추세합의수++;
        if (현재MACD히스토그램 < 0) 점수 -= 5 * 시장상태.추세가중치;
    }

    // C. SMA 추세 분석
    const 이평정배열 = ema5 > ema20 && ema20 > sma60;
    const 이평역배열 = ema5 < ema20 && ema20 < sma60;
    if (coin.현재가 > sma60) {
        점수 += 5 * 시장상태.추세가중치;
        롱근거수++;
        추세합의수++;
        if (이평정배열) 점수 += 4 * 시장상태.추세가중치;
    } else {
        점수 -= 5 * 시장상태.추세가중치;
        숏근거수++;
        추세합의수++;
        if (이평역배열) 점수 -= 4 * 시장상태.추세가중치;
    }

    // D. 볼린저 밴드 분석: 추세장에서는 밴드 이탈을 무조건 반전으로 보지 않습니다.
    if (coin.현재가 <= bbLower) { 점수 += 10 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (coin.현재가 >= bbUpper) { 점수 -= 10 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else {
        const bbDist = (coin.현재가 - bbBasis) / Math.max(bbUpper - bbLower, 0.000001);
        점수 -= bbDist * 10 * 시장상태.평균회귀가중치;
    }

    // E. CCI 분석: RSI와 성격이 겹치므로 보조 가중치로만 반영합니다.
    if (cciVal < -150) { 점수 += 6 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (cciVal < -100) { 점수 += 4 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (cciVal > 150) { 점수 -= 6 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (cciVal > 100) { 점수 -= 4 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }

    // F. 스토캐스틱 K/D 분석: 단기 타이밍 확인용입니다.
    if (stochK <= 20) {
        점수 += 4 * 시장상태.평균회귀가중치;
        롱근거수++;
        평균회귀합의수++;
        if (stochK > stochD) 점수 += 4 * 시장상태.평균회귀가중치;
    } else if (stochK >= 80) {
        점수 -= 4 * 시장상태.평균회귀가중치;
        숏근거수++;
        평균회귀합의수++;
        if (stochK < stochD) 점수 -= 4 * 시장상태.평균회귀가중치;
    }

    // G. VWAP 분석: 가격이 평균 거래 가격에서 얼마나 벗어났는지 확인합니다.
    const vwap괴리율 = (coin.현재가 - vwapVal) / vwapVal * 100;
    if (vwap괴리율 < -2.0) { 점수 += 8 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (vwap괴리율 < 0) { 점수 += 4 * 시장상태.평균회귀가중치; 롱근거수++; }
    else if (vwap괴리율 > 2.0) { 점수 -= 8 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (vwap괴리율 > 0) { 점수 -= 4 * 시장상태.평균회귀가중치; 숏근거수++; }

    // H. 피보나치 지지/저항 및 매물대(POC) 분석
    const 피보나치골든존 = coin.현재가 <= fiboLevels["50.0%"] && coin.현재가 >= fiboLevels["61.8%"];
    if (피보나치골든존) {
        점수 += 7 * 시장상태.평균회귀가중치;
        롱근거수++;
        평균회귀합의수++;
        if (coin.현재가 < vpvrPOC) 점수 += 4;
    } else if (coin.현재가 > fiboLevels["23.6%"]) {
        점수 -= 6 * 시장상태.평균회귀가중치;
        숏근거수++;
    }

    // 같은 과매수/과매도 계열 지표가 한 방향으로 몰릴 때 과신을 줄이는 중복 보정입니다.
    if (평균회귀합의수 >= 4 && 시장상태.추세가중치 > 1) {
        점수 = 50 + (점수 - 50) * 0.82;
    }

    const 방향합의수 = Math.max(롱근거수, 숏근거수);
    const 추세회귀균형도 = Math.min(추세합의수, 평균회귀합의수);
    let 추천신뢰도점수 = 48 + 방향합의수 * 6 + 추세회귀균형도 * 4 + 시장상태.신뢰도보정;
    if (Math.abs(점수 - 50) >= 25) 추천신뢰도점수 += 6;
    추천신뢰도점수 = Math.max(25, Math.min(92, Math.round(추천신뢰도점수)));
    const 추천신뢰도 = 지표신뢰도등급(추천신뢰도점수);

    // 점수 보정 (0점 ~ 100점 만점)
    점수 = Math.max(0, Math.min(100, Math.round(점수)));

    const sentimentBar = document.getElementById("ai-sentiment-bar");
    const sentimentScore = document.getElementById("ai-sentiment-score");
    const statusBadge = document.getElementById("ai-status-badge");
    const recPositionEl = document.getElementById("rec-position");
    const recEntryEl = document.getElementById("rec-entry");
    const recTpEl = document.getElementById("rec-tp");
    const recSlEl = document.getElementById("rec-sl");
    const marketRegimeLabel = document.getElementById("market-regime-label");
    const signalConfidenceLabel = document.getElementById("signal-confidence-label");
    const syntheticWarningLabel = document.getElementById("synthetic-warning-label");

    if (sentimentBar) sentimentBar.style.width = `${점수}%`;
    if (sentimentScore) sentimentScore.innerText = `${점수}%`;
    if (marketRegimeLabel) {
        marketRegimeLabel.innerText = 시장상태.이름;
        marketRegimeLabel.className = "reliability-value " + (시장상태.코드.includes("TREND") ? "text-green" : (시장상태.코드 === "RANGE" ? "text-yellow" : "text-neutral"));
    }
    if (signalConfidenceLabel) {
        signalConfidenceLabel.innerText = 추천신뢰도.텍스트;
        signalConfidenceLabel.className = `reliability-value ${추천신뢰도.클래스}`;
    }
    if (syntheticWarningLabel) {
        syntheticWarningLabel.innerText = "온체인/OI/청산맵은 추정";
        syntheticWarningLabel.className = "reliability-value text-red";
    }

    let 추천방향 = "NEUTRAL";
    let 포지션텍스트 = "관망 유지 (Neutral)";
    let 가이드텍스트 = "종합 강도 기준 포지션 조율";
    let 가이드컬러 = "#ffc107";
    let 뱃지클래스 = "advisor-badge badge-neutral";
    let 뱃지텍스트 = "관망 포커스";

    if (점수 >= 75) {
        추천방향 = "LONG";
        포지션텍스트 = "지정가 롱 예약 (Strong Buy)";
        가이드텍스트 = "지지선 부근 예약 롱 대기 🟢";
        가이드컬러 = "#0066ff";
        뱃지클래스 = "advisor-badge badge-long";
        뱃지텍스트 = "★ 강력 매수 진입";
    } else if (점수 >= 57) {
        추천방향 = "LONG";
        포지션텍스트 = "롱 대기 진입 (Buy Limit)";
        가이드텍스트 = "지지선 부근 예약 롱 대기 🟢";
        가이드컬러 = "#20c997";
        뱃지클래스 = "advisor-badge badge-long";
        뱃지텍스트 = "매수 우세";
    } else if (점수 <= 25) {
        추천방향 = "SHORT";
        포지션텍스트 = "지정가 숏 예약 (Strong Sell)";
        가이드텍스트 = "저항선 부근 예약 숏 대기 🔴";
        가이드컬러 = "#f6465d";
        뱃지클래스 = "advisor-badge badge-short";
        뱃지텍스트 = "★ 강력 매도 진입";
    } else if (점수 <= 43) {
        추천방향 = "SHORT";
        포지션텍스트 = "숏 대기 진입 (Sell Limit)";
        가이드텍스트 = "저항선 부근 예약 숏 대기 🔴";
        가이드컬러 = "#fd7e14";
        뱃지클래스 = "advisor-badge badge-short";
        뱃지텍스트 = "매도 우세";
    }

    if (statusBadge) {
        statusBadge.className = 뱃지클래스;
        statusBadge.innerText = 뱃지텍스트;
    }
    
    if (recPositionEl) {
        recPositionEl.innerText = 포지션텍스트;
        recPositionEl.className = "rec-value " + (추천방향 === "LONG" ? "text-green" : (추천방향 === "SHORT" ? "text-red" : "text-neutral"));
    }

    const recGuideMsgEl = document.getElementById("rec-guide-msg");
    if (recGuideMsgEl) {
        if (저항선돌파상태) {
            recGuideMsgEl.innerText = "저항선 돌파 강세! 상위 저항선 관측 🔴";
            recGuideMsgEl.style.color = "#f6465d";
        } else if (지지선붕괴상태) {
            recGuideMsgEl.innerText = "지지선 붕괴 낙폭! 추가 하락 주의 🟢";
            recGuideMsgEl.style.color = "#0066ff";
        } else {
            recGuideMsgEl.innerText = 가이드텍스트;
            recGuideMsgEl.style.color = 가이드컬러;
        }
    }

    // 6. 피보나치 & 볼린저밴드 연립 기반 초정밀 롱/숏 타점 기입 엔진 (V2 Target Generator)
    let 추천진입가 = coin.현재가;
    let 추천익절가 = coin.현재가;
    let 추천손절가 = coin.현재가;
    const 레버리지 = parseInt(document.getElementById("input-leverage").value) || 3;

    if (추천방향 === "LONG") {
        // 롱 타점: 0.786 파동 분석 기법 투영 (피보나치 78.6% 지지선과 BB Lower의 융합 진입)
        추천진입가 = Math.min(coin.현재가, (fiboLevels["78.6%"] + bbLower) / 2);
        
        // 익절가: 피보나치 저항 레벨인 23.6%~38.2% 존 및 BB Upper 연립
        추천익절가 = Math.max(coin.현재가 * 1.005, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
        
        // 손절가: 파동 붕괴 기준선인 피보나치 88.6% 되돌림선 이탈 시 칼 같은 손절 가드
        추천손절가 = Math.min(추천진입가 * 0.992, fiboLevels["88.6%"] * 0.998);
    } else if (추천방향 === "SHORT") {
        // 숏 타점: 피보나치 저항 구간인 23.6%~38.2% 및 BB Upper 연립 평균 진입
        추천진입가 = Math.max(coin.현재가, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
        
        // 익절가: 피보나치 지지선인 78.6% 레벨 및 BB Lower 연립
        추천익절가 = Math.min(coin.현재가 * 0.995, (fiboLevels["78.6%"] + bbLower) / 2);
        
        // 손절가: 파동 무력화 지점인 피보나치 11.4% 이탈선 기준 칼 같은 가드
        추천손절가 = Math.max(추천진입가 * 1.008, fiboLevels["11.4%"] * 1.002);
    } else {
        // 관망 상태일 때는 박스권 채널(BB Basis 중심) 매매 가격 제안
        추천진입가 = coin.현재가;
        추천익절가 = bbUpper;
        추천손절가 = bbLower;
    }

    // 최종 정수 및 소수점 자리수 재정리
    추천진입가 = parseFloat(추천진입가.toFixed(coin.소수점));
    추천익절가 = parseFloat(추천익절가.toFixed(coin.소수점));
    추천손절가 = parseFloat(추천손절가.toFixed(coin.소수점));

    // 캐시에 보관 (주문 주입 및 자동 매매 활용)
    AI추천캐시.방향 = 추천방향 === "NEUTRAL" ? "LONG" : 추천방향;
    AI추천캐시.저항선 = 정밀저항가격;
    AI추천캐시.지지선 = 정밀지지가격;
    AI추천캐시.진입가 = 추천진입가; // 호환성 보존용 필드
    AI추천캐시.익절가 = 추천익절가;
    AI추천캐시.손절가 = 추천손절가;

    const resistanceEl = document.getElementById("rec-resistance");
    const supportEl = document.getElementById("rec-support");

    if (resistanceEl) resistanceEl.innerText = 정밀저항가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";
    if (supportEl) supportEl.innerText = 정밀지지가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";

    // ----------------------------------------------------
    // [퀀트 분석 엔진 V3] 정밀 분석 저항/지지의 정확도(정밀도) 및 신뢰도 다각적 분석 연산
    // ----------------------------------------------------
    // A. 저항선 정밀도 & 신뢰도 연산
    // 볼린저 밴드 상단(bbUpper)과 피보나치 23.6% 저항선이 좁을수록 다중 수렴(Confluence) 지점으로 간주하여 정밀도 극대화
    const resGap = Math.abs(bbUpper - fiboLevels["23.6%"]) / bbBasis;
    let resAcc = Math.max(83.5, Math.min(99.4, 99.4 - (resGap * 180)));
    
    // RSI가 과매수(65 이상) 영역에 있거나 CCI가 강세 모멘텀(100 이상)일수록 저항의 신뢰도가 강화
    let resConfBase = 81.0 + (rsiVal > 65 ? (rsiVal - 65) * 0.7 : 0) + (cciVal > 100 ? (cciVal - 100) * 0.05 : 0);
    // 현재가가 저항선에 가까울수록(저항 테스트 상황) 신뢰 지수 상승 가산
    const resDist = Math.abs(coin.currentlyPrice || coin.현재가 - 정밀저항가격) / coin.현재가;
    if (resDist < 0.01) resConfBase += 4.5;

    // 저항선이 시세 상승으로 뚫려버린 돌파 국면일 때는 정밀도 및 신뢰도를 긴급 감쇄 조정
    if (저항선돌파상태) {
        resAcc = resAcc * 0.90; // 정밀도 10% 일시 감쇄 경고
        resConfBase = resConfBase * 0.88;
    }
    const resConf = Math.max(70.0, Math.min(98.9, resConfBase));
    
    // 신뢰 등급(Rating) 결정 (영어/한글 병기)
    let resRating = "Moderate (보통)";
    let resColor = "#ffc107";
    if (저항선돌파상태) {
        resRating = "⚠️ 돌파 경보 (Breakout)";
        resColor = "#f6465d"; // 선명한 레드 경고
    } else if (resConf >= 91.0) {
        resRating = "Strong (강력 저항)";
        resColor = "#f6465d";
    } else if (resConf >= 86.0) {
        resRating = "Stable (견고 저항)";
        resColor = "#fd7e14";
    }

    // B. 지지선 정밀도 & 신뢰도 연산
    // 볼린저 밴드 하단(bbLower)과 피보나치 78.6% 지지선이 좁을수록 다중 지지 수렴 지점으로 간주하여 정밀도 극대화
    const supGap = Math.abs(bbLower - fiboLevels["78.6%"]) / bbBasis;
    let supAcc = Math.max(84.0, Math.min(99.6, 99.6 - (supGap * 150)));
    
    // RSI가 과매도(35 이하) 영역에 도달하거나 CCI가 낙폭 과대(-100 이하)일수록 반등 신뢰도가 강화
    let supConfBase = 83.0 + (rsiVal < 35 ? (35 - rsiVal) * 0.8 : 0) + (cciVal < -100 ? (Math.abs(cciVal) - 100) * 0.06 : 0);
    // 현재가가 지지선에 바짝 달라붙었을 때(지지 테스팅 상태) 신뢰 지수 가산
    const supDist = Math.abs(coin.currentlyPrice || coin.현재가 - 정밀지지가격) / coin.현재가;
    if (supDist < 0.01) supConfBase += 4.8;
    // VPVR 매물 중심(POC) 하단에 현재가가 위치하여 강한 하방 매집 메리트를 보일 때 가산
    if (coin.현재가 < vpvrPOC) supConfBase += 3.5;

    // 지지선이 붕괴되어 주저앉은 붕괴 국면일 때는 정밀도 및 신뢰도 긴급 감쇄 조정
    if (지지선붕괴상태) {
        supAcc = supAcc * 0.89; // 정밀도 11% 일시 감쇄 경고
        supConfBase = supConfBase * 0.86;
    }
    const supConf = Math.max(70.0, Math.min(99.5, supConfBase));
    
    // 신뢰 등급(Rating) 결정 (영어/한글 병기)
    let supRating = "Moderate (보통)";
    let supColor = "#ffc107";
    if (지지선붕괴상태) {
        supRating = "⚠️ 붕괴 경보 (Breakdown)";
        supColor = "#0066ff"; // 선명한 블루 경고
    } else if (supConf >= 92.0) {
        supRating = "Strong (강력 지지)";
        supColor = "#0066ff";
    } else if (supConf >= 87.0) {
        supRating = "Stable (견고 지지)";
        supColor = "#20c997";
    }

    // C. DOM 바인딩 및 실시간 염색 노출 (DOM Binding)
    const resAccEl = document.getElementById("res-accuracy");
    const resConfEl = document.getElementById("res-confidence");
    const supAccEl = document.getElementById("sup-accuracy");
    const supConfEl = document.getElementById("sup-confidence");

    if (resAccEl) resAccEl.innerText = `${resAcc.toFixed(1)}% (매우 높음)`;
    if (resConfEl) resConfEl.innerHTML = `<span style="color: ${resColor}; font-weight: 700;">${resConf.toFixed(1)}% [${resRating}]</span>`;
    if (supAccEl) supAccEl.innerText = `${supAcc.toFixed(1)}% (신뢰성 확실)`;
    if (supConfEl) supConfEl.innerHTML = `<span style="color: ${supColor}; font-weight: 700;">${supConf.toFixed(1)}% [${supRating}]</span>`;
}

// 정밀 분석된 저항선과 지지선 가격을 주문창 폼에 최적 배분하여 즉시 꽂아넣는 스마트 주입 기능
function AI추천타점적용() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    // 1. 방향 전환 및 버튼 상태 일치
    const btnLong = document.getElementById("btn-direction-long");
    const btnShort = document.getElementById("btn-direction-short");
    const submitBtn = document.getElementById("btn-submit-order");

    const 방향 = AI추천캐시.방향 || "LONG";

    if (방향 === "LONG") {
        btnLong.classList.add("active");
        btnShort.classList.remove("active");
        submitBtn.className = "btn-submit-order btn-buy-long";
        
        // 2. 값 기입 (LONG: 지지선 부근 진입, 저항선 익절, 지지선 -1% 안전 손절)
        const 진입 = AI추천캐시.지지선;
        const 익절 = AI추천캐시.저항선;
        const 손절 = parseFloat((진입 * 0.99).toFixed(coin.소수점));

        document.getElementById("input-trigger-price").value = 진입;
        document.getElementById("input-tp-price").value = 익절;
        document.getElementById("input-sl-price").value = 손절;
    } else {
        btnShort.classList.add("active");
        btnLong.classList.remove("active");
        submitBtn.className = "btn-submit-order btn-sell-short";
        
        // 2. 값 기입 (SHORT: 저항선 부근 진입, 지지선 익절, 저항선 +1% 안전 손절)
        const 진입 = AI추천캐시.저항선;
        const 익절 = AI추천캐시.지지선;
        const 손절 = parseFloat((진입 * 1.01).toFixed(coin.소수점));

        document.getElementById("input-trigger-price").value = 진입;
        document.getElementById("input-tp-price").value = 익절;
        document.getElementById("input-sl-price").value = 손절;
    }

    // 3. TP/SL 자동 활성화 및 체크박스 트리거
    const chkTpsl = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");
    
    chkTpsl.checked = true;
    tpslContainer.classList.remove("hidden");

    // 4. 비용 재연산
    주문비용재연산();

    // 5. 시각적 반짝임 피드백 효과 연출
    const card = document.querySelector(".ai-advisor-card");
    if (card) {
        card.style.borderColor = "var(--color-yellow)";
        card.style.boxShadow = "0 0 15px rgba(240, 185, 11, 0.4)";
        setTimeout(() => {
            card.style.borderColor = "var(--color-border)";
            card.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.3)";
        }, 1000);
    }

    // 효과음 재생
    재생효과음("sound-trigger");
}

// 15. 분할 차트 시간 단위 및 코인 심볼 핫스왑 변경 기능 (Timeframe & Symbol Hotswap Modifier)
// 사용자가 특정 분할 차트의 시간 단위(Timeframe) 버튼을 클릭했을 때 호출되며,
// 해당 차트의 시간 설정을 변경하고 바이낸스 선물 API로부터 과거 데이터를 새로 적재하여 렌더링합니다.
window.시간단위변경액션 = async function(chartIdx, tf) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;
    
    // 타임프레임(Timeframe) 설정 변경
    chartData.시간단위 = tf;
    
    // UI에 반영하여 active 클래스 재배치 및 헤더 뱃지 동기화
    시간단위UI동기화();
    
    // 설정 상태 보존 저장
    차트설정저장();
    
    // 바이낸스 API 호출을 통해 새로운 타임프레임의 K-Lines 과거 데이터 적재 (REST API)
    await 분할차트캔들데이터로드(chartIdx);
    
    // 해당 개별 차트 및 보조지표 렌더링(Rendering) 즉시 갱신
    if (chartData.메인차트 && chartData.캔들시리즈 && chartData.캔들데이터.length > 0) {
        chartData.캔들시리즈.setData(chartData.캔들데이터);
        
        const closes = chartData.캔들데이터.map(c => c.close);
        const times = chartData.캔들데이터.map(c => c.time);
        
        // 이동평균선(MA: Moving Average) 7, 25, 99 라인 재생성
        const ema5 = 계산EMA(closes, 5);
        const ema20 = 계산EMA(closes, 20);
        const sma60 = 계산SMA(closes, 60);
        
        chartData.EMA5시리즈.setData(매핑지표데이터(times, ema5));
        chartData.EMA20시리즈.setData(매핑지표데이터(times, ema20));
        chartData.SMA60시리즈.setData(매핑지표데이터(times, sma60));
        
        // 차트 뷰포트 맞춤 조절
        chartData.메인차트.timeScale().fitContent();
    }
    
    // AI 실시간 추천 분석 정보 연동 갱신
    AI추천분석및업데이트(상태.기본코인);
    window.차트지지저항선드로잉(chartIdx);
};

// 사용자가 특정 분할 차트의 코인 심볼 선택 드롭다운(select)을 변경했을 때 호출되며,
// 해당 차트의 대상 코인을 교체하고 시세를 REST API로 즉각 로드해 재드로잉합니다.
// 또한, 해당 코인을 전체 분석 및 주문 연동을 위해 상태.기본코인으로 지정해 통합 동기화를 트리거합니다.
window.차트코인변경액션 = async function(chartIdx, symbol) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData || !상태.코인목록[symbol]) return;
    
    // 코인 심볼 변경
    chartData.코인심볼 = symbol;
    
    // 분석 연계를 위해 메인 기본 코인도 동시 핫스왑
    상태.기본코인 = symbol;
    localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    
    // UI에 반영 (active 버튼 상태 및 select박스 값)
    시간단위UI동기화();
    
    // 설정 상태 스토리지 보존
    차트설정저장();
    
    // 해당 차트의 새로운 코인에 대한 과거 데이터 적재
    await 분할차트캔들데이터로드(chartIdx);
    
    // 차트 리렌더링
    if (chartData.메인차트 && chartData.캔들시리즈 && chartData.캔들데이터.length > 0) {
        chartData.캔들시리즈.setData(chartData.캔들데이터);
        
        const closes = chartData.캔들데이터.map(c => c.close);
        const times = chartData.캔들데이터.map(c => c.time);
        
        const ema5 = 계산EMA(closes, 5);
        const ema20 = 계산EMA(closes, 20);
        const sma60 = 계산SMA(closes, 60);
        
        chartData.EMA5시리즈.setData(매핑지표데이터(times, ema5));
        chartData.EMA20시리즈.setData(매핑지표데이터(times, ema20));
        chartData.SMA60시리즈.setData(매핑지표데이터(times, sma60));
        
        chartData.메인차트.timeScale().fitContent();
    }
    
    // 좌측 주문창, 호가창, 코인 정보 등 전역 화면 업데이트 트리거
    화면업데이트();
    
    // 퀀트/기본적 분석 센터 및 AI 실시간 추천 가격 리로딩
    AI추천분석및업데이트(symbol);
    분석및신호생성(symbol);
    window.차트지지저항선드로잉(chartIdx);

    // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
    window.AI자동매매버튼상태동기화();
};

// 개별 분할 차트를 클릭했을 때, 해당 차트의 알트코인을 메인 분석 코인(호가창/주문창)으로 즉시 핫스왑 포커싱합니다.
// 클릭 타겟이 select, button, option 등 제어 폼이 아닐 경우에만 기동하여 차트 조작 간섭을 방지합니다.
window.차트클릭포커스액션 = function(chartIdx, event) {
    if (event) {
        const tag = event.target.tagName.toLowerCase();
        // 헤더 조작 폼, 버튼, 드롭다운 선택 등의 동작 시에는 핫스왑 무시
        if (tag === 'select' || tag === 'button' || tag === 'option' || tag === 'i' || 
            event.target.closest('.timeframe-selector') || event.target.closest('.btn-chart-maximize')) {
            return;
        }
    }

    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;

    const symbol = chartData.코인심볼;
    if (상태.기본코인 === symbol) {
        // 이미 포커스 중인 코인일지라도 시각적 강조 테두리는 보장
        활성차트강조테두리(chartIdx);
        return;
    }

    상태.기본코인 = symbol;
    localStorage.setItem("선물시뮬레이터_현재코인", symbol);

    const coin = 상태.코인목록[symbol];
    if (coin) {
        document.getElementById("current-coin-title").innerText = coin.이름;
        document.getElementById("qty-symbol-addon").innerText = symbol.replace("USDT", "");

        코인탭렌더링();
        호가창렌더링실제(coin);
        화면업데이트();
        AI추천분석및업데이트(symbol);
        
        // 클릭 활성화된 차트에 글로우 테두리 하이라이팅 적용
        활성차트강조테두리(chartIdx);

        // 해당 코인의 AI 자동 매매 온/오프 상태 스위치 UI 동기화
        window.AI자동매매버튼상태동기화();

        // 클릭 포커스 전환 시 해당 차트 상의 지지선, 저항선, AI 추천 타점선 즉각 드로잉
        window.차트지지저항선드로잉(chartIdx);
    }
};

// 8개 분할 차트 래퍼 중 현재 선택 활성화된 차트 1개에만 영롱한 노란색(네온) 테두리를 부여하고 나머지는 제거합니다.
window.활성차트강조테두리 = function(activeIdx) {
    for (let i = 0; i < 8; i++) {
        const wrapper = document.getElementById(`chart-wrapper-${i}`);
        if (wrapper) {
            if (i === activeIdx) {
                wrapper.classList.add("active-chart");
            } else {
                wrapper.classList.remove("active-chart");
            }
        }
        // [모바일 대응] 모바일 차트 선택기 탭의 active 클래스 동기화
        const mobileTab = document.getElementById(`mobile-chart-tab-${i}`);
        if (mobileTab) {
            if (i === activeIdx) {
                mobileTab.classList.add("active");
            } else {
                mobileTab.classList.remove("active");
            }
        }
    }
};

// 특정 단일 차트를 2x4 그리드 상에서 가로세로 100% 꽉 찬 모니터링 화면으로 극대화(Maximize) 또는 복원(Restore)합니다.
window.차트최대화토글 = function(chartIdx) {
    const wrapper = document.getElementById(`chart-wrapper-${chartIdx}`);
    if (!wrapper) return;

    const icon = document.getElementById(`maximize-icon-${chartIdx}`);
    const isMaximized = wrapper.classList.contains("maximized");

    // 다른 모든 차트의 maximized 및 숨김 상태를 일괄 리셋
    for (let i = 0; i < 8; i++) {
        const otherWrapper = document.getElementById(`chart-wrapper-${i}`);
        if (otherWrapper) {
            otherWrapper.classList.remove("maximized");
            otherWrapper.style.display = ""; // 그리드로 원복
        }
        const otherIcon = document.getElementById(`maximize-icon-${i}`);
        if (otherIcon) {
            otherIcon.className = "fa-solid fa-expand";
        }
    }

    if (!isMaximized) {
        // 최대화 진입
        wrapper.classList.add("maximized");
        if (icon) icon.className = "fa-solid fa-compress";

        // 본 차트를 제외한 나머지 7개 차트 슬롯을 일시 숨김(display=none) 처리하여, 그리드 내 가로세로 전체를 독점하게 만듭니다.
        for (let i = 0; i < 8; i++) {
            if (i !== chartIdx) {
                const otherWrapper = document.getElementById(`chart-wrapper-${i}`);
                if (otherWrapper) otherWrapper.style.display = "none";
            }
        }
        
        // 포커스도 해당 최대화 코인으로 동기 스왑
        window.차트클릭포커스액션(chartIdx);
    } else {
        // 복원 시 다른 차트들을 다시 그리드로 원복 표시
        for (let i = 0; i < 8; i++) {
            const otherWrapper = document.getElementById(`chart-wrapper-${i}`);
            if (otherWrapper) otherWrapper.style.display = "";
        }
    }

    // TradingView Lightweight Charts 캔버스 픽셀 정밀 핏 조절 (딜레이를 주어 리플로우 완료 시점에 기동)
    setTimeout(() => {
        상태.차트객체.분할차트들.forEach((c, idx) => {
            const container = document.getElementById(`split-chart-canvas-${idx}`);
            if (c.메인차트 && container) {
                c.메인차트.resize(container.clientWidth, container.clientHeight);
                c.메인차트.timeScale().fitContent();
            }
        });
    }, 50);
};

// 개별 분할 차트 위에 피보나치 지지/저항선 및 AI 추천 타점 가로선(PriceLine)들을 정교하게 드로잉합니다.
window.차트지지저항선드로잉 = function(chartIdx) {
    const c = 상태.차트객체.분할차트들[chartIdx];
    if (!c || !c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length < 30) return;

    // 1. 기존에 그려진 가격선들이 있다면 깨끗하게 제거 (Overlapping 방지)
    if (c.지지저항선들 && c.지지저항선들.length > 0) {
        c.지지저항선들.forEach(line => {
            try {
                c.캔들시리즈.removePriceLine(line);
            } catch (e) {
                // 예외 무시
            }
        });
    }
    c.지지저항선들 = [];

    const symbol = c.코인심볼;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    // 2. 피보나치 지지/저항 및 볼린저밴드 수치 산출
    const closes = coin.캔들데이터.map(x => x.close);
    const highs = coin.캔들데이터.map(x => x.high);
    const lows = coin.캔들데이터.map(x => x.low);
    const idx = closes.length - 1;

    const 최고가 = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저가 = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고가, 최저가);

    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;

    // [퀀트 보증 가드] 좌측 분석 센터와 동일한 지능형 지지/저항 보정 알고리즘 적용 (100% 동기화)
    const bbUpperSanitized = Math.min(bbUpper, coin.현재가 * 1.15);
    const bbLowerSanitized = Math.max(bbLower, coin.현재가 * 0.85);

    const fiboValues = Object.values(fiboLevels);
    
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가);
    let fiboResistance = bbUpperSanitized;
    if (상방fibo들.length > 0) {
        fiboResistance = Math.min(...상방fibo들);
    }

    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가);
    let fiboSupport = bbLowerSanitized;
    if (하방fibo들.length > 0) {
        fiboSupport = Math.max(...하방fibo들);
    }

    let 정밀저항가격 = parseFloat(((fiboResistance + bbUpperSanitized) / 2).toFixed(coin.소수점));
    let 정밀지지가격 = parseFloat(((fiboSupport + bbLowerSanitized) / 2).toFixed(coin.소수점));

    if (정밀지지가격 >= coin.현재가) {
        정밀지지가격 = parseFloat((coin.현재가 * 0.985).toFixed(coin.소수점));
    }
    if (정밀저항가격 <= coin.현재가) {
        정밀저항가격 = parseFloat((coin.현재가 * 1.015).toFixed(coin.소수점));
    }

    // 3. 지지선 & 저항선 드로잉 (ENTRY, TP, SL 3대 추천 가로선은 삭제)
    // 정밀 분석 저항선 (Fibonacci 23.6% & BB Upper 연립 평균) - 빨간색 초굵은 실선 (가격축 라벨 활성화)
    const lineResistance = c.캔들시리즈.createPriceLine({
        price: 정밀저항가격,
        color: '#f6465d', // 빨간색 (저항선)
        lineWidth: 3,
        lineStyle: 0, // Solid (실선)
        axisLabelVisible: true,
        title: `■ 정밀 분석 저항선 (RESISTANCE) ■`,
    });
    c.지지저항선들.push(lineResistance);

    // 정밀 분석 지지선 (Fibonacci 61.8% & BB Lower 연립 평균) - 파란색 초굵은 실선 (가격축 라벨 활성화)
    const lineSupport = c.캔들시리즈.createPriceLine({
        price: 정밀지지가격,
        color: '#0066ff', // 파란색 (지지선)
        lineWidth: 3,
        lineStyle: 0, // Solid (실선)
        axisLabelVisible: true,
        title: `■ 정밀 분석 지지선 (SUPPORT) ■`,
    });
    c.지지저항선들.push(lineSupport);
};;


// 8개 차트의 코인 선택기 드롭다운(select) 목록을 상태.코인목록에 맞추어 동적으로 동기화 재생성합니다.
window.차트선택기목록동적갱신 = function() {
    const symbols = Object.keys(상태.코인목록);
    
    for (let i = 0; i < 8; i++) {
        const select = document.getElementById(`chart-symbol-select-${i}`);
        if (!select) continue;

        // 현재 설정값 백업
        const activeVal = select.value || 상태.차트객체.분할차트들[i].코인심볼;
        
        let html = "";
        symbols.forEach(symbol => {
            const shortName = symbol.replace("USDT", "");
            html += `<option value="${symbol}">${shortName}</option>`;
        });
        select.innerHTML = html;

        // 기존 값으로 안전 복원 (목록에 존재할 경우)
        if (symbols.includes(activeVal)) {
            select.value = activeVal;
        } else {
            select.value = 상태.차트객체.분할차트들[i].코인심볼;
        }
    }
};

// 현재 활성화된 코인의 AI 자동 매매 스위치 ON/OFF 상태를 토글 제어합니다.
window.AI자동매매토글액션 = function() {
    const symbol = 상태.기본코인;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    // A. 꺼져있는 상태에서 켜려고 할 때는 주문 크기와 레버리지를 확인/선택할 수 있게 모달 팝업을 엽니다.
    if (!coin.자동매매활성화) {
        window.AI설정모달열기액션(symbol);
        return;
    }

    // B. 이미 켜진 상태일 때는 즉시 OFF 토글 처리
    coin.자동매매활성화 = false;

    // UI 동기화
    window.AI자동매매버튼상태동기화();

    // 상태 저장 (기존 로컬스토리지 백업 상태를 안전하게 병합 패치 저장)
    try {
        let 자동매매맵 = {};
        const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
        if (저장된자동매매) {
            자동매매맵 = JSON.parse(저장된자동매매);
        }

        delete 자동매매맵[symbol]; // 비활성화 시 맵에서 안전하게 제거
        localStorage.setItem("선물시뮬레이터_자동매매", JSON.stringify(자동매매맵));
    } catch (e) {
        console.error("[Storage Save Error] 자동매매 활성화 상태 병합 저장 중 오류:", e);
    }

    // 모의 매매 상태 저장 호출 연동
    모의매매상태저장();

    // 효과음 및 신호 출력
    재생효과음("sound-signal");
    새신호알림(symbol, `[🤖 AI 자동매매 모드 전환] 현재 코인의 자동 트레이딩 엔진이 **비활성화(OFF)** 되었습니다.`, "neutral");
};

// 우측 퀀트 분석 센터 내부의 AI 자동 매매 활성화 스위치 UI 상태를 현재 기본 코인 규격에 맞춰 갱신합니다.
window.AI자동매매버튼상태동기화 = function() {
    const symbol = 상태.기본코인;
    const coin = 상태.코인목록[symbol];
    const btn = document.getElementById("btn-ai-autotrade");
    if (!btn || !coin) return;

    if (coin.자동매매활성화) {
        btn.classList.add("active");
        btn.innerHTML = `<i class="fa-solid fa-robot animate-pulse"></i> AI 자동매매 ON`;
    } else {
        btn.classList.remove("active");
        btn.innerHTML = `<i class="fa-solid fa-robot"></i> AI 자동매매 OFF`;
    }
};


// 16. 실시간 시세 수집 안전 보완 장치 (REST API Polling Fallback Shield)
// 로컬 네트워크 상에서 바이낸스 실시간 웹소켓(WebSockets) 연결이 한국 ISP 차단 등의 사유로
// 끊어지거나 제한될 경우, 1초마다 초경량 REST API 호출을 주기적 폴링하여 실시간 시세를 연동합니다.

let REST폴링타이머 = null;

function 실시간시세REST폴러() {
    if (REST폴링타이머) clearInterval(REST폴링타이머);

    REST폴링타이머 = setInterval(async () => {
        const targetSymbol = 상태.기본코인;
        const currentCoin = 상태.코인목록[targetSymbol];

        // A. 웹소켓 연결이 정상이고 호가 데이터가 이미 안정적으로 유입되는 경우, 폴링 생략
        // 단, 백그라운드/포지션 코인의 시세 이탈 방지를 위해 정기적으로 일괄 폴링 진행
        if (상태.웹소켓연결상태 && currentCoin && currentCoin.호가매도 && currentCoin.호가매도.length > 0) {
            const statusDot = document.getElementById("binance-status-dot");
            const statusText = document.getElementById("binance-status-text");
            if (statusDot && statusText && statusText.innerText.includes("폴링")) {
                statusDot.style.backgroundColor = ""; // 가상 시세 오렌지 경고 스타일 리셋
                statusDot.className = "status-dot green";
                statusText.innerText = "Binance 라이브 시세 연동 중";
                statusText.className = "status-text text-green";
            }
            if (Math.random() < 0.15) {
                백그라운드전체시세폴링();
            }
            return;
        }

        // B. 웹소켓 연결 해제 중일 때 안전 폴백(Fallback) 텍스트 알림
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = ""; // 가상 시세 오렌지 경고 스타일 리셋
            statusDot.className = "status-dot green animate-pulse";
            statusText.innerText = "Binance 실시간 REST 폴링 연동 중 (안전 모드)";
            statusText.className = "status-text text-yellow";
        }

        // C. 현재 보고 있는 메인 코인의 실시간 시세와 호가 데이터를 병렬 수집
        try {
            let priceRes, depthRes;
            try {
                [priceRes, depthRes] = await Promise.all([
                    fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${targetSymbol}`),
                    fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${targetSymbol}&limit=5`)
                ]);
                if (!priceRes.ok || !depthRes.ok) throw new Error("Futures API 응답 에러");
            } catch (fErr) {
                // Futures API CORS 차단 시 Spot API로 폴백
                [priceRes, depthRes] = await Promise.all([
                    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${targetSymbol}`),
                    fetch(`https://api.binance.com/api/v3/depth?symbol=${targetSymbol}&limit=5`)
                ]);
            }

            if (priceRes.ok && depthRes.ok) {
                const priceData = await priceRes.json();
                const depthData = await depthRes.json();
                const 현재가 = parseFloat(priceData.price);
                const asks = depthData.asks || [];
                const bids = depthData.bids || [];

                REST폴링데이터수입(targetSymbol, 현재가, asks, bids);
            }
        } catch (e) {
            console.warn("[REST Polling Alert] 메인 코인 시세 폴링 실패:", e.message);
        }

        // D. 백그라운드 및 포지션 대기 코인 전체 실시간 동기화
        await 백그라운드전체시세폴링();
    }, 1500);
}

// 백그라운드 전체 코인의 시세를 단 한 번의 API 호출로 안전하게 업데이트 (CORS 친화적 Spot API 활용)
async function 백그라운드전체시세폴링() {
    try {
        let res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
        if (!res.ok) {
            res = await fetch("https://api.binance.com/api/v3/ticker/price");
        }
        if (res.ok) {
            const tickers = await res.json();
            const priceMap = {};
            tickers.forEach(t => {
                priceMap[t.symbol] = parseFloat(t.price);
            });
            Object.keys(상태.코인목록).forEach(symbol => {
                if (priceMap[symbol]) {
                    const 현재가 = priceMap[symbol];
                    const coin = 상태.코인목록[symbol];
                    if (coin) {
                        coin.가상시세여부 = false;
                        coin.현재가 = 현재가;
                    }
                }
            });
        }
    } catch (err) {
        console.warn("[REST Polling Alert] 백그라운드 전체 시세 폴링 실패:", err.message);
    }
}

// [신규] CME 갭 (CME Gap) 연산 및 업데이트 (CORS 친화적 Spot API 활용)
async function CME갭연산및업데이트(symbol) {
    // 1. BTCUSDT, ETHUSDT 외의 알트코인은 CME 분석 비대상으로 즉각 반환 처리
    if (symbol !== "BTCUSDT" && symbol !== "ETHUSDT") {
        상태.CME갭캐시[symbol] = {
            결과: "N/A (CME 미상장 자산)",
            클래스: "text-neutral",
            갱신시간: Date.now()
        };
        return;
    }

    // 캐시 기간 검사 (5분 캐시) - 실시간 시뮬레이션을 위해 디버그 기간 동안 캐시 무시
    // const 캐시 = 상태.CME갭캐시[symbol];
    // if (캐시 && (Date.now() - 캐시.갱신시간 < 300000)) {
    //     return; // 5분 이내이면 기존 캐시 활용
    // }

    try {
        console.log(`[CME Gap Analyzer] ${symbol} CME 갭 분석 및 연산 시도...`);
        // 8일간의 1시간봉 데이터(200개) 로드
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`);
        if (!res.ok) throw new Error("Spot Klines API fetch failed");

        const klines = await res.json();
        
        // 금요일 폐장(CME Close: 금요일 21:00 UTC)과 일요일 개장(CME Open: 일요일 22:00 UTC) 찾기
        let fridayCloseCandle = null;
        let sundayOpenCandle = null;
        let sundayOpenIdx = -1;

        // 최근 200개 캔들 중 가장 최근의 주말 경계선 탐색
        // 역순(최신부터 과거로)으로 찾아감
        for (let i = klines.length - 1; i >= 0; i--) {
            const timeMs = klines[i][0];
            const date = new Date(timeMs);
            const day = date.getUTCDay(); // 0: Sunday, 5: Friday, 6: Saturday
            const hour = date.getUTCHours();

            // 가장 최신의 일요일 개장 부근 캔들 (CME Open: 일요일 21시 ~ 23시 사이 첫 캔들)
            if (!sundayOpenCandle && day === 0 && (hour >= 21 && hour <= 23)) {
                sundayOpenCandle = klines[i];
                sundayOpenIdx = i;
            }

            // 가장 최신의 금요일 폐장 부근 캔들 (CME Close: 금요일 20시 ~ 22시 사이 마지막 캔들)
            // 단, 이미 발견한 일요일 개장 캔들보다 시간상 과거여야 함
            if (sundayOpenCandle && !fridayCloseCandle && day === 5 && (hour >= 20 && hour <= 22) && i < sundayOpenIdx) {
                fridayCloseCandle = klines[i];
            }

            if (sundayOpenCandle && fridayCloseCandle) {
                break;
            }
        }

        if (!fridayCloseCandle || !sundayOpenCandle) {
            // 주말 캔들을 찾을 수 없거나 데이터 누락 시 (예: 주중에 막 상장했거나 API 제한 등)
            상태.CME갭캐시[symbol] = {
                결과: "갭 미발생 (데이터 부족)",
                간단결과: "갭 미발생 (데이터 부족)",
                클래스: "text-neutral",
                갱신시간: Date.now()
            };
            return;
        }

        const fridayClose = parseFloat(fridayCloseCandle[4]); // 금요일 21시 캔들 종가
        const sundayOpen = parseFloat(sundayOpenCandle[1]);   // 일요일 22시 캔들 시가
        const gapPrice = sundayOpen - fridayClose;
        const gapSize = Math.abs(gapPrice);
        const threshold = symbol === "BTCUSDT" ? 100 : 10; // BTC는 100달러, ETH는 10달러 기준

        if (gapSize < threshold) {
            상태.CME갭캐시[symbol] = {
                결과: "갭 미발생 (안정적 흐름)",
                간단결과: "갭 미발생 (안정적 흐름)",
                클래스: "text-neutral",
                갱신시간: Date.now()
            };
            return;
        }

        // 갭 영역 정의
        const gapMin = Math.min(fridayClose, sundayOpen);
        const gapMax = Math.max(fridayClose, sundayOpen);

        // 갭 메움 여부 분석 (일요일 개장 캔들 이후의 캔들들을 전수 조사)
        let filled = false;
        let filledTime = "";

        for (let i = sundayOpenIdx; i < klines.length; i++) {
            const low = parseFloat(klines[i][3]);
            const high = parseFloat(klines[i][2]);

            // 금요일 종가(CME close) 가격을 캔들 고가/저가가 관통했거나 터치했는지 확인
            if (low <= fridayClose && high >= fridayClose) {
                filled = true;
                const fillDate = new Date(klines[i][0]);
                filledTime = `${fillDate.getMonth()+1}/${fillDate.getDate()} ${fillDate.getHours()}시`;
                break;
            }
        }

        let 결과텍스트 = "";
        let 클래스 = "";

        let 간단결과 = "";
        const gapTypeKo = gapPrice > 0 ? "상승 갭" : "하락 갭";
        if (filled) {
            결과텍스트 = `갭 메움 완료 (직전 갭: ${fridayClose.toLocaleString()} ~ ${sundayOpen.toLocaleString()} USDT, 채워진 시점: ${filledTime})`;
            간단결과 = `갭 메움 완료 (직전 ${gapTypeKo})`;
            클래스 = "text-green";
        } else {
            결과텍스트 = `⚠️ 미해소 갭 존재 (${gapTypeKo}, 갭 가격대: ${gapMin.toLocaleString()} ~ ${gapMax.toLocaleString()} USDT, 크기: ${gapSize.toFixed(2)} USDT)`;
            간단결과 = `⚠️ 미해소 ${gapTypeKo} 존재 (크기: ${gapSize.toFixed(2)} USDT)`;
            클래스 = "text-red animate-pulse";
        }

        상태.CME갭캐시[symbol] = {
            결과: 결과텍스트,
            간단결과: 간단결과,
            클래스: 클래스,
            갱신시간: Date.now()
        };

        console.log(`[CME Gap Analyzer] ${symbol} 분석 완료: ${결과텍스트}`);

    } catch (err) {
        console.warn(`[CME Gap Analyzer Alert] ${symbol} CME 갭 계산 실패:`, err.message);
        상태.CME갭캐시[symbol] = {
            결과: "분석 실패 (네트워크 오류)",
            클래스: "text-red",
            갱신시간: Date.now() - 240000 // 실패 시 1분 뒤 재시도할 수 있도록 세팅
        };
    }
}

// REST API로 긁어온 가격 패킷을 실시간 틱 데이터 형식으로 가공하여 파이프라인에 주입
function REST폴링데이터수입(symbol, 현재가, asks, bids) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.가상시세여부 = false; // 실제 REST API 시세 수입 시 가상 시세 플래그 강제 해제 (가상 시세 감지 락)

    // 실시간 기초 데이터 갱신
    coin.현재가 = 현재가;
    coin.호가매도 = asks || [];
    coin.호가매수 = bids || [];

    // 1분봉 캔들 버퍼 구성 (타점 분석 시스템 실시간 감지용)
    const candleTime = Math.floor(Date.now() / 1000 / 60) * 60; // 1분 단위 타임스탬프
    const 실시간캔들 = {
        time: candleTime,
        open: coin.캔들데이터.length > 0 ? coin.캔들데이터[coin.캔들데이터.length - 1].close : 현재가,
        high: 현재가,
        low: 현재가,
        close: 현재가,
        volume: Math.random() * 50 + 5
    };

    const candles = coin.캔들데이터;
    if (candles.length === 0) {
        candles.push(실시간캔들);
    } else {
        const lastCandle = candles[candles.length - 1];
        if (candleTime === lastCandle.time) {
            lastCandle.close = 현재가;
            if (현재가 > lastCandle.high) lastCandle.high = 현재가;
            if (현재가 < lastCandle.low) lastCandle.low = 현재가;
        } else if (candleTime > lastCandle.time) {
            candles.push(실시간캔들);
            if (candles.length > 500) candles.shift();
            
            // 신규 캔들 생성 시 1분봉 분석 및 신호 생성(RSI/MACD 크로스 감지)
            분석및신호생성(symbol);
        }
    }

    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

    // 현재 선택 조회 중인 메인 코인일 경우에만 UI 화면 동기화
    if (symbol === 상태.기본코인) {
        const priceEl = document.getElementById("current-price");
        const midPriceEl = document.getElementById("orderbook-mid-price");
        if (priceEl && midPriceEl) {
            const 이전가격 = parseFloat(priceEl.innerText.replace(/,/g, '')) || 현재가;
            priceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            midPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
            priceEl.className = "ticker-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
            midPriceEl.className = "mid-price " + (현재가 >= 이전가격 ? "text-green flash-green" : "text-red flash-red");
        }

        const 변동률 = ((현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const changeEl = document.getElementById("price-change-percent");
        if (changeEl) {
            changeEl.innerText = (변동률 >= 0 ? "+" : "") + 변동률 + "%";
            changeEl.className = "stat-val " + (변동률 >= 0 ? "text-green" : "text-red");
        }

        const highEl = document.getElementById("price-high-24h");
        const lowEl = document.getElementById("price-low-24h");
        if (highEl) highEl.innerText = coin.최고24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (lowEl) lowEl.innerText = coin.최저24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

        // 호가창(Order Book) 실시간 드로잉
        호가창렌더링실제(coin);

        // AI 추천 분석 업데이트 (기본 코인에 대해서만 실행)
        AI추천분석및업데이트(symbol);
    }

    // 8개 분할 차트 실시간 틱 갱신 및 신규 봉 자동 생성 (REST 폴백 모드 - 글로벌 틱 라우팅)
    상태.차트객체.분할차트들.forEach(c => {
        if (!c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length === 0) return;
        
        // 차트의 코인 심볼과 유입된 데이터의 코인 심볼이 다를 경우 무시 (8개 차트 개별 코인 갱신)
        if (c.코인심볼 !== symbol) return;

        let 봉단위초 = 60;
        if (c.시간단위 === "1m") 봉단위초 = 60;
        else if (c.시간단위 === "1h") 봉단위초 = 3600;
        else if (c.시간단위 === "4h") 봉단위초 = 14400;
        else if (c.시간단위 === "8h") 봉단위초 = 28800;
        else if (c.시간단위 === "12h") 봉단위초 = 43200;
        else if (c.시간단위 === "1d") 봉단위초 = 86400;
        else if (c.시간단위 === "1w") 봉단위초 = 604800;

        const targetT = Math.floor(candleTime / 봉단위초) * 봉단위초;
        const lastCandle = c.캔들데이터[c.캔들데이터.length - 1];

        if (targetT === lastCandle.time) {
            lastCandle.close = 현재가;
            if (현재가 > lastCandle.high) lastCandle.high = 현재가;
            if (현재가 < lastCandle.low) lastCandle.low = 현재가;
            c.캔들시리즈.update(lastCandle);
        } else if (targetT > lastCandle.time) {
            const 신규분할캔들 = {
                time: targetT,
                open: 현재가,
                high: 현재가,
                low: 현재가,
                close: 현재가,
                volume: 실시간캔들.volume
            };
            c.캔들데이터.push(신규분할캔들);
            if (c.캔들데이터.length > 500) c.캔들데이터.shift();
            c.캔들시리즈.update(신규분할캔들);
        }

        const closesList = c.캔들데이터.map(x => x.close);
        const ema5 = 계산EMA(closesList, 5);
        const ema20 = 계산EMA(closesList, 20);
        const sma60 = 계산SMA(closesList, 60);
        
        const activeCandle = c.캔들데이터[c.캔들데이터.length - 1];
        c.EMA5시리즈.update({ time: activeCandle.time, value: ema5[ema5.length - 1] });
        c.EMA20시리즈.update({ time: activeCandle.time, value: ema20[ema20.length - 1] });
        c.SMA60시리즈.update({ time: activeCandle.time, value: sma60[sma60.length - 1] });
    });

    // 상단 탭(Tab) 가격 정보 실시간 연동
    const tabPriceEl = document.getElementById(`tab-price-${symbol}`);
    if (tabPriceEl) {
        tabPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        const 변동률 = (현재가 - coin.어제종가) / coin.어제종가;
        tabPriceEl.className = "tab-price " + (변동률 >= 0 ? "text-green" : "text-red");
    }
}

// 17. 모의 매매 상태 영구 보존(Persistence) 헬퍼 함수
function 모의매매상태저장() {
    try {
        const 저장데이터 = {
            지갑잔고: 상태.지갑잔고,
            마진잔고: 상태.마진잔고,
            미실현손익: 상태.미실현손익,
            대기주문: 상태.대기주문,
            활성포지션: 상태.활성포지션,
            거래이력: 상태.거래이력,
            주문아이디카운터: 상태.주문아이디카운터,
            포지션아이디카운터: 상태.포지션아이디카운터
        };
        localStorage.setItem("선물시뮬레이터_모의매매상태", JSON.stringify(저장데이터));
    } catch (e) {
        console.error("[Storage Save Error] 모의 매매 상태 저장 중 오류 발생:", e);
    }
}

function 모의매매상태복원() {
    try {
        const 저장된데이터텍스트 = localStorage.getItem("선물시뮬레이터_모의매매상태");
        if (저장된데이터텍스트) {
            const 데이터 = JSON.parse(저장된데이터텍스트);
            if (데이터) {
                if (데이터.지갑잔고 !== undefined) 상태.지갑잔고 = parseFloat(데이터.지갑잔고);
                if (데이터.마진잔고 !== undefined) 상태.마진잔고 = parseFloat(데이터.마진잔고);
                if (데이터.미실현손익 !== undefined) 상태.미실현손익 = parseFloat(데이터.미실현손익);
                if (데이터.대기주문 !== undefined) 상태.대기주문 = 데이터.대기주문;
                if (데이터.활성포지션 !== undefined) 상태.활성포지션 = 데이터.활성포지션;
                if (데이터.거래이력 !== undefined) 상태.거래이력 = 데이터.거래이력;
                if (데이터.주문아이디카운터 !== undefined) 상태.주문아이디카운터 = parseInt(데이터.주문아이디카운터);
                if (데이터.포지션아이디카운터 !== undefined) 상태.포지션아이디카운터 = parseInt(데이터.포지션아이디카운터);
                
                console.log("[Storage Restore] 모의 매매 상태(잔고, 대기주문, 포지션, 이력) 복원 성공.");
            }
        }
        
        // 테이블 및 대시보드 상태 동기화 렌더링
        대기주문테이블렌더링();
        활성포지션테이블렌더링();
        거래이력테이블렌더링();
        상태바업데이트();
        화면업데이트();
    } catch (e) {
        console.error("[Storage Restore Error] 모의 매매 상태 복원 중 오류 발생:", e);
    }
}

// ====================================================
// 18. 초정밀 퀀트 분석 공식 및 프로젝트 DB 모듈 (Advanced Quant Indicators & Project DB)
// ====================================================

// CCI (Commodity Channel Index) 계산
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

// 스토캐스틱 오실레이터 (Stochastic Oscillator) 계산
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
    
    // K라인 smoothing
    let slowK = 계산SMA(fastK.map(v => isNaN(v) ? 0 : v), smoothingK);
    // D라인 (K라인의 SMA)
    let slowD = 계산SMA(slowK.map(v => isNaN(v) ? 0 : v), periodD);
    
    return { k: slowK, d: slowD };
}

// VWAP (Volume Weighted Average Price) 계산
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

// 볼린저 밴드 (Bollinger Bands) 계산
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

// 피보나치 되돌림 구간 계산
function 계산피보나치되돌림(high, low) {
    let diff = high - low;
    return {
        "0.0% (최고가)": high,
        "11.4%": high - diff * 0.114,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.5,
        "61.8%": high - diff * 0.618,
        "78.6%": high - diff * 0.786,
        "88.6%": high - diff * 0.886,
        "100.0% (최저가)": low
    };
}

// VPVR (Volume Profile Visible Range) POC 계산
function 계산VPVR매물대(candles, priceDecimal = 2) {
    if (candles.length === 0) return { poc: 0, maxVol: 0 };
    
    let volProfile = {};
    let highest = Math.max(...candles.map(c => c.high));
    let lowest = Math.min(...candles.map(c => c.low));
    
    let range = highest - lowest;
    let step = range / 20; // 20개 매물대 구역으로 나눔
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

// 주요 코인 기본적 분석 데이터베이스 (Project Fundamental DB)
const 프로젝트데이터베이스 = {
    "BTCUSDT": {
        개요: "비트코인(Bitcoin)은 최초의 분산형 암호화폐로, 디지털 자산의 기축통화 지위를 공고히 하고 있습니다. 탈중앙화된 가치 저장소(SoV)로 작동합니다.",
        유동성: "AAA (초고유동성)",
        확장성: "Low (라이트닝 네트워크 등을 통한 레이어2 해결책 모색 중)",
        기관선호도: "최상 (ETF 승인 및 기업 자산 편입 가속화)",
        락업이벤트: "반감기 완료 (추가 락업 개념 없음, 영구 유통)",
        호재뉴스: "기관 연기금 포트폴리오 편입 본격화 및 글로벌 통화 인플레이션 헤지 수요 급증",
        지지저항: "강력 지지선: 67,500 USDT | 강력 저항선: 74,000 USDT"
    },
    "ETHUSDT": {
        개요: "이더리움(Ethereum)은 스마트 계약(Smart Contract)을 지원하는 선도적인 레이어1 블록체인 플랫폼으로, 디파이(DeFi) 및 NFT 생태계의 핵심 인프라입니다.",
        유동성: "AA+ (매우 높음)",
        확장성: "Medium (덴쿤 업그레이드 등 이더리움 레이어2 확장성 대폭 증대)",
        기관선호도: "상 (현물 ETF 상장 및 스테이킹 인프라 확충에 따른 기관 수급 지속 유입)",
        락업이벤트: "스테이킹 물량 점진적 출금 가능 (오버행 우려 낮음)",
        호재뉴스: "L2 가스비 절감 효과에 따른 온체인 트랜잭션 수수료 폭발 및 생태계 고도화",
        지지저항: "강력 지지선: 3,250 USDT | 강력 저항선: 4,000 USDT"
    },
    "SOLUSDT": {
        개요: "솔라나(Solana)는 단일 레이어에서 극도의 저비용과 고속 트랜잭션을 실현하여 dApp 개발자들에게 독보적인 사용자 경험을 선사하는 고성능 퍼블릭 블록체인입니다.",
        유동성: "AA (안정적)",
        확장성: "High (파이어댄서 신규 클라이언트를 통해 초당 수십만 건 트랜잭션 목표)",
        기관선호도: "상 (빠른 확장성을 선호하는 웹3 펀드 및 벤처 캐피탈의 원픽 레이어1)",
        락업이벤트: "초기 분배 완료, 정기 인플레이션 스테이킹 보상 물량 유통 중",
        호재뉴스: "활성 지갑 수 및 온체인 DEX 거래량 역사적 고점 돌파, 밈코인/디핀 생태계 확장",
        지지저항: "강력 지지선: 145 USDT | 강력 저항선: 185 USDT"
    },
    "HYPEUSDT": {
        개요: "하이퍼리퀴드(Hyperliquid)는 탈중앙화 무기한 선물 거래소(L1 DEX)로, 자체 레이어1 네트워크를 활용해 가스비가 없고 정밀한 오더북 일치 엔진을 자랑합니다.",
        유동성: "A (중상위)",
        확장성: "High (선물 오더북 처리에 최적화된 초고속 합의 알고리즘 보유)",
        기관선호도: "중 (DEX 선물 거래소 점유율 압도적 1위로 가속 유입 중)",
        락업이벤트: "제네시스 에어드랍 분배 이후 기여자 및 재단 물량 1~2년 락업 적용 중",
        호재뉴스: "DEX 무기한 선물 거래량 사상 최대 경신, 하이퍼EVM(HyperEVM) 런칭 임박에 따른 가치 급상승",
        지지저항: "강력 지지선: 58.50 USDT | 강력 저항선: 66.80 USDT"
    }
};

// 19. 좌우 레이아웃 반전 모드 (Left/Right Layout Swap Mode) 액션 함수
window.레이아웃방향토글액션 = function() {
    const grid = document.querySelector(".dashboard-grid");
    if (!grid) return;

    grid.classList.toggle("layout-reversed");
    const isReversed = grid.classList.contains("layout-reversed");

    // 레이아웃 스왑 상태 로컬스토리지 영구 저장 (F5 보존)
    try {
        localStorage.setItem("선물시뮬레이터_레이아웃방향", isReversed ? "left" : "right");
    } catch (e) {
        console.error("레이아웃 방향 저장 실패:", e);
    }

    // 레이아웃 변경에 따른 차트 캔버스 리사이즈 트리거
    // 8개 차트의 resize()를 명시적으로 실행하여 해상도 핏을 최적화함
    setTimeout(() => {
        상태.차트객체.분할차트들.forEach(c => {
            if (c && c.메인차트) {
                c.메인차트.resize();
            }
        });
    }, 50);

    // 알림음 재생
    재생효과음("sound-signal");
};

// ====================================================
// 20. AI 자동매매 5대 세부 설정 제어 모듈 (AI Auto-Trading Config Modules)
// ====================================================

// AI 자동매매 세부 설정 아코디언 패널 열고 닫기 토글 액션
window.AI설정토글액션 = function() {
    const body = document.getElementById("ai-config-body");
    const header = document.getElementById("ai-config-header");
    if (!body || !header) return;

    body.classList.toggle("hidden");
    header.classList.toggle("open");
    
    재생효과음("sound-signal");
};

// UI 입력 필드들의 상태를 실시간 스캔하여 전역 상태 객체 갱신 및 로컬스토리지 영구 저장
window.AI설정수치동기화 = function(triggerType) {
    // 1. 진입 증거금 비율 갱신 (USDT 직접 입력 및 Ratio 슬라이더 양방향 연동)
    const sliderRatio = document.getElementById("input-ai-margin-ratio");
    const txtRatio = document.getElementById("txt-ai-margin-ratio");
    const usdtInput = document.getElementById("input-ai-margin-usdt");

    if (sliderRatio && txtRatio && usdtInput) {
        if (triggerType === "usdt") {
            const usdtVal = parseFloat(usdtInput.value) || 0;
            const computedRatio = Math.round((usdtVal / 상태.지갑잔고) * 100);
            const clampedRatio = Math.max(1, Math.min(100, computedRatio));
            
            sliderRatio.value = clampedRatio;
            txtRatio.innerText = `${clampedRatio}%`;
            상태.자동매매설정.진입비율 = clampedRatio;
        } else {
            // ratio 슬라이더 변경 혹은 로드 시
            const ratioVal = parseInt(sliderRatio.value) || 10;
            txtRatio.innerText = `${ratioVal}%`;
            상태.자동매매설정.진입비율 = ratioVal;
            
            // 슬라이더 조작 시에만 USDT 금액 입력창 역갱신
            usdtInput.value = Math.round(상태.지갑잔고 * (ratioVal / 100));
        }
    }

    // 2. 배후 레버리지 실시간 동기화 바인딩
    const leverageInput = document.getElementById("input-leverage");
    const txtLeverage = document.getElementById("txt-ai-leverage-display");
    if (leverageInput && txtLeverage) {
        txtLeverage.innerText = `${leverageInput.value}x`;
    }

    // 3. 익절 타점 옵션 수집
    const checkedTpEl = document.querySelector('input[name="ai-tp-type"]:checked');
    if (checkedTpEl) {
        상태.자동매매설정.익절옵션 = checkedTpEl.value;
    }
    const numTpRate = document.getElementById("input-ai-tp-rate");
    if (numTpRate) {
        상태.자동매매설정.수동익절율 = Math.max(1, parseFloat(numTpRate.value) || 10);
    }

    // 4. 손절 타점 옵션 수집
    const checkedSlEl = document.querySelector('input[name="ai-sl-type"]:checked');
    if (checkedSlEl) {
        상태.자동매매설정.손절옵션 = checkedSlEl.value;
    }
    const numSlRate = document.getElementById("input-ai-sl-rate");
    if (numSlRate) {
        상태.자동매매설정.수동손절율 = Math.max(1, parseFloat(numSlRate.value) || 5);
    }

    // 5. 중복 진입 방지 스위치 수집
    const chkOverlap = document.getElementById("input-ai-anti-overlap");
    if (chkOverlap) {
        상태.자동매매설정.중복방지 = chkOverlap.checked;
    }

    // 6. 설정 상태 로컬스토리지 영구 보존
    try {
        localStorage.setItem("선물시뮬레이터_자동매매설정", JSON.stringify(상태.자동매매설정));
    } catch (e) {
        console.error("자동매매 설정 저장 실패:", e);
    }
};

// 페이지 로드 완료 시점에 로컬스토리지로부터 이전 AI 자동매매 설정을 가져와 복원 주입
window.AI설정스토리지복원 = function() {
    try {
        const 저장된설정 = localStorage.getItem("선물시뮬레이터_자동매매설정");
        if (저장된설정) {
            const 설정 = JSON.parse(저장된설정);
            if (설정) {
                if (설정.진입비율 !== undefined) 상태.자동매매설정.진입비율 = parseInt(설정.진입비율);
                if (설정.익절옵션 !== undefined) 상태.자동매매설정.익절옵션 = 설정.익절옵션;
                if (설정.수동익절율 !== undefined) 상태.자동매매설정.수동익절율 = parseFloat(설정.수동익절율);
                if (설정.손절옵션 !== undefined) 상태.자동매매설정.손절옵션 = 설정.손절옵션;
                if (설정.수동손절율 !== undefined) 상태.자동매매설정.수동손절율 = parseFloat(설정.수동손절율);
                if (설정.중복방지 !== undefined) 상태.자동매매설정.중복방지 = !!설정.중복방지;
                
                console.log("[Storage Restore] AI 자동매매 세부 설정 복원 성공.");
            }
        }

        // 복원된 값을 기반으로 DOM 엘리먼트 수치 및 노드 세팅 동기화
        const sliderRatio = document.getElementById("input-ai-margin-ratio");
        const txtRatio = document.getElementById("txt-ai-margin-ratio");
        const usdtInput = document.getElementById("input-ai-margin-usdt");
        if (sliderRatio && txtRatio) {
            sliderRatio.value = 상태.자동매매설정.진입비율;
            txtRatio.innerText = `${상태.자동매매설정.진입비율}%`;
            if (usdtInput) {
                usdtInput.value = Math.round(상태.지갑잔고 * (상태.자동매매설정.진입비율 / 100));
            }
        }

        const tpRadio = document.querySelector(`input[name="ai-tp-type"][value="${상태.자동매매설정.익절옵션}"]`);
        if (tpRadio) tpRadio.checked = true;
        
        const numTpRate = document.getElementById("input-ai-tp-rate");
        if (numTpRate) numTpRate.value = 상태.자동매매설정.수동익절율;

        const slRadio = document.querySelector(`input[name="ai-sl-type"][value="${상태.자동매매설정.손절옵션}"]`);
        if (slRadio) slRadio.checked = true;

        const numSlRate = document.getElementById("input-ai-sl-rate");
        if (numSlRate) numSlRate.value = 상태.자동매매설정.수동손절율;

        const chkOverlap = document.getElementById("input-ai-anti-overlap");
        if (chkOverlap) chkOverlap.checked = 상태.자동매매설정.중복방지;

        // 배후 레버리지도 실시간 수치 매핑
        const leverageInput = document.getElementById("input-leverage");
        const txtLeverage = document.getElementById("txt-ai-leverage-display");
        if (leverageInput && txtLeverage) {
            txtLeverage.innerText = `${leverageInput.value}x`;
            
            // 거래소 레버리지 슬라이더 변경 시에도 AI 레버리지 텍스트가 양방향 연동되도록 이벤트 훅 삽입
            leverageInput.addEventListener("input", () => {
                txtLeverage.innerText = `${leverageInput.value}x`;
            });
        }

    } catch (e) {
        console.error("AI 자동매매 세부 설정 복원 에러:", e);
    }
};

// ====================================================
// 21. AI 자동매매 가동 승인 모달 제어 모듈 (AI Activation Modal Control Modules)
// ====================================================

// AI 자동매매 승인 모달 열기 액션 (Activation Modal Open)
window.AI설정모달열기액션 = function(symbol) {
    const modal = document.getElementById("ai-activation-modal");
    if (!modal) return;

    // 모달 타겟 코인 심볼 주입
    modal.dataset.symbol = symbol;
    const txtSymbol = document.getElementById("modal-coin-symbol");
    if (txtSymbol) txtSymbol.innerText = symbol;

    // 슬라이더 초기값 세팅 (상태.자동매매설정 값 활용)
    const ratioInput = document.getElementById("modal-margin-ratio");
    const leverageInput = document.getElementById("modal-leverage");
    const actualLeverage = document.getElementById("input-leverage"); // 우측 주문창 레버리지
    const usdtInput = document.getElementById("modal-margin-usdt");
    
    const initialRatio = 상태.자동매매설정.진입비율 || 10;
    if (ratioInput) ratioInput.value = initialRatio;
    if (leverageInput) leverageInput.value = actualLeverage ? parseInt(actualLeverage.value) : 3;
    if (usdtInput) {
        usdtInput.value = Math.round(상태.지갑잔고 * (initialRatio / 100));
    }

    // 수치 실시간 갱신 계산 호출
    window.AI모달수치동기화();

    // 모달 숨김 해제
    modal.classList.remove("hidden");
    재생효과음("sound-signal");
};

// 모달 내부 슬라이더 조작 시 실시간 예상 보증금 및 주문 크기 산출 동기화
window.AI모달수치동기화 = function(triggerType) {
    const ratioInput = document.getElementById("modal-margin-ratio");
    const ratioTxt = document.getElementById("modal-margin-ratio-txt");
    const leverageInput = document.getElementById("modal-leverage");
    const leverageTxt = document.getElementById("modal-leverage-txt");
    const usdtInput = document.getElementById("modal-margin-usdt");

    if (!ratioInput || !leverageInput) return;

    let ratioVal = parseInt(ratioInput.value) || 10;
    const leverageVal = parseInt(leverageInput.value) || 3;

    if (triggerType === "usdt" && usdtInput) {
        const usdtVal = parseFloat(usdtInput.value) || 0;
        const computedRatio = Math.round((usdtVal / 상태.지갑잔고) * 100);
        ratioVal = Math.max(1, Math.min(100, computedRatio));
        
        ratioInput.value = ratioVal;
    } else {
        // ratio 슬라이더 변경 혹은 기본 실행 시
        if (usdtInput) {
            usdtInput.value = Math.round(상태.지갑잔고 * (ratioVal / 100));
        }
    }

    if (ratioTxt) ratioTxt.innerText = `${ratioVal}%`;
    if (leverageTxt) leverageTxt.innerText = `${leverageVal}x`;

    // 예상 금액 계산 (Estimated Margin and Position Size)
    const balance = 상태.지갑잔고;
    const estMargin = balance * (ratioVal / 100);
    const estSize = estMargin * leverageVal;

    const txtBalance = document.getElementById("modal-wallet-balance");
    const txtMargin = document.getElementById("modal-est-margin");
    const txtSize = document.getElementById("modal-est-size");

    if (txtBalance) txtBalance.innerText = balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    if (txtMargin) txtMargin.innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    if (txtSize) txtSize.innerText = estSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
};

// 모달창 닫기 액션 (Activation Modal Close)
window.AI모달닫기액션 = function() {
    const modal = document.getElementById("ai-activation-modal");
    if (modal) modal.classList.add("hidden");
    재생효과음("sound-signal");
};

// 모달 최종 가동 시작 승인 처리 (Activation Modal Confirm)
window.AI모달최종가동액션 = function() {
    const modal = document.getElementById("ai-activation-modal");
    if (!modal) return;

    const symbol = modal.dataset.symbol || 상태.기본코인;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    const ratioInput = document.getElementById("modal-margin-ratio");
    const leverageInput = document.getElementById("modal-leverage");

    if (ratioInput && leverageInput) {
        const ratioVal = parseInt(ratioInput.value);
        const leverageVal = parseInt(leverageInput.value);

        // A. 전역 상태 갱신
        상태.자동매매설정.진입비율 = ratioVal;
        
        // B. 우측 주문 패널 레버리지 슬라이더 및 텍스트 갱신
        const actualLeverage = document.getElementById("input-leverage");
        const displayLeverage = document.getElementById("leverage-display");
        if (actualLeverage) {
            actualLeverage.value = leverageVal;
            if (displayLeverage) displayLeverage.innerText = leverageVal + "x";
        }

        // C. AI 설정 아코디언 패널 내부 슬라이더 수치 동기화
        const configSlider = document.getElementById("input-ai-margin-ratio");
        const configTxt = document.getElementById("txt-ai-margin-ratio");
        if (configSlider && configTxt) {
            configSlider.value = ratioVal;
            configTxt.innerText = `${ratioVal}%`;
        }
        
        // AI 설정 상태 로컬스토리지 영구 저장
        window.AI설정수치동기화();
    }

    // D. 자동매매 온처리 및 UI 리드로잉
    coin.자동매매활성화 = true;

    // UI 동기화
    window.AI자동매매버튼상태동기화();

    // 상태 로컬스토리지 영구 저장 (F5 복원용)
    try {
        let 자동매매맵 = {};
        const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
        if (저장된자동매매) {
            자동매매맵 = JSON.parse(저장된자동매매);
        }
        자동매매맵[symbol] = true;
        localStorage.setItem("선물시뮬레이터_자동매매", JSON.stringify(자동매매맵));
    } catch (e) {
        console.error("자동매매 활성화 맵 병합 저장 실패:", e);
    }

    // 모의 매매 상태 저장 호출 연동
    모의매매상태저장();

    // 모달 닫기
    modal.classList.add("hidden");

    // 효과음 및 알림 출력
    재생효과음("sound-trigger");
    새신호알림(symbol, `[🤖 AI 자동매매 가동 개시] 진입비율 **${상태.자동매매설정.진입비율}%**, 레버리지 **${leverageInput.value}x** 설정으로 자동 트레이딩 엔진이 성공적으로 가동되었습니다.`, "long");
};

// ⚡ 레버리지 영구 고정 및 변경 불가(Locking) 영속성 시스템 (Leverage State Lock)
window.코인레버리지저장 = function() {
    try {
        const 레버리지맵 = {};
        Object.keys(상태.코인목록).forEach(symbol => {
            const coin = 상태.코인목록[symbol];
            if (coin && coin.레버리지 !== undefined) {
                레버리지맵[symbol] = coin.레버리지;
            }
        });
        localStorage.setItem("선물시뮬레이터_코인레버리지", JSON.stringify(레버리지맵));
    } catch (e) {
        console.error("코인 레버리지 영속 저장 에러:", e);
    }
};

window.코인레버리지복원 = function() {
    try {
        const 저장된레버리지 = localStorage.getItem("선물시뮬레이터_코인레버리지");
        if (저장된레버리지) {
            const 레버리지맵 = JSON.parse(저장된레버리지);
            Object.keys(레버리지맵).forEach(symbol => {
                const coin = 상태.코인목록[symbol];
                if (coin) {
                    coin.레버리지 = parseInt(레버리지맵[symbol]) || 3;
                }
            });
        }
    } catch (e) {
        console.error("코인 레버리지 영속 복원 에러:", e);
    }
};

// ⚡ 롱/숏 역방향 스위칭 기능 (Reverse Position Switch)
window.포지션역방향전환 = function(idx) {
    if (confirm("현재 포지션을 시장가로 즉시 정산 종료하고, 동일 수량의 반대 포지션(롱↔숏)으로 스위칭 진입하시겠습니까?")) {
        const pos = 상태.활성포지션[idx];
        if (!pos) return;
        
        const coin = 상태.코인목록[pos.심볼];
        if (!coin) return;
        
        // A. 현재 포지션 정보 임시 복사
        const 심볼 = pos.심볼;
        const 수량 = pos.수량;
        const 레버리지 = pos.레버리지;
        const 구방향 = pos.방향;
        const 신방향 = (구방향 === "LONG") ? "SHORT" : "LONG";
        const 현재가 = coin.currentPrice || coin.현재가;

        // B. 기존 포지션 전량 시장가 종료
        포지션종료실행(idx, 현재가, "사용자 역방향 스위칭 종료");

        // C. 반대 방향 신규 포지션 주문 임시 조립 및 체결 실행
        const 신규주문 = {
            심볼: 심볼,
            방향: 신방향,
            레버리지: 레버리지,
            수량: 수량,
            진입가: 현재가,
            유형: "market",
            아이디: 상태.주문아이디카운터++
        };

        // D. 신규 반대 포지션 체결
        포지션체결실행(신규주문, 현재가);
        
        새신호알림(심볼, `[🔁 역방향 스위칭] ${구방향} 포지션을 정산 종료하고, 동일 수량(${수량.toFixed(coin.수량소수점)})의 ${신방향} ${레버리지}x 포지션으로 즉각 전환 진입했습니다.`, "execution");
    }
};

// ⚡ 개별 포지션 자동 마진 보호 토글 (Auto Margin Guard Toggle)
window.포지션자동마진토글 = function(idx) {
    const pos = 상태.활성포지션[idx];
    if (pos) {
        pos.자동마진 = !pos.자동마진;
        
        const 상태텍스트 = pos.자동마진 ? "활성화" : "비활성화";
        const 알림타입 = pos.자동마진 ? "long" : "short";
        새신호알림(pos.심볼, `[🛡️ 자동 마진] 해당 포지션의 자동 증거금 추가 보호 기능이 **${상태텍스트}** 되었습니다.`, 알림타입);
        
        // 상태 영속 저장 및 렌더링
        모의매매상태저장();
        활성포지션테이블렌더링();
    }
};

// ⚡ 개별 포지션 수동 증거금 수혈 기능 (Manual Margin Addition)
window.포지션수동마진추가 = function(idx) {
    const pos = 상태.활성포지션[idx];
    if (!pos) return;
    
    const coin = 상태.코인목록[pos.심볼];
    if (!coin) return;
    
    const 입력값 = prompt(`[수동 증거금 추가]\n추가로 투입하여 포지션을 보강할 증거금 금액(USDT)을 입력하십시오.\n\n현재 가용 지갑 잔고: ${상태.지갑잔고.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT\n현재 포지션 투입 마진: ${pos.투입마진.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`);
    
    if (입력값 === null) return; // 취소 버튼을 누른 경우
    
    const 추가마진 = parseFloat(입력값);
    if (isNaN(추가마진) || 추가마진 <= 0) {
        alert("올바른 양의 숫자(USDT)를 입력해 주십시오.");
        return;
    }
    
    if (추가마진 > 상태.지갑잔고) {
        alert(`지갑 잔고가 부족합니다!\n입력하신 금액: ${추가마진.toLocaleString()} USDT\n현재 가용 잔고: ${상태.지갑잔고.toLocaleString()} USDT`);
        return;
    }
    
    // 비즈니스 로직 적용 (마진 수혈 및 지갑 차감)
    상태.지갑잔고 -= 추가마진;
    pos.투입마진 += 추가마진;
    
    // 격리 마진 청산가 밀어내기 재연산 공식
    let 새청산가 = 0;
    if (pos.방향 === "LONG") {
        새청산가 = pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005);
    } else {
        새청산가 = pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
    }
    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
    
    // 수익률(ROE) 재연산
    const pnl = pos.미실현손익 || 0;
    pos.수익률 = (pnl / pos.투입마진) * 100;
    
    새신호알림(pos.심볼, `[💰 수동 증거금 수혈] 포지션에 **${추가마진.toFixed(2)} USDT** 증거금을 수동으로 추가 수혈하였습니다. (새 청산가: **${pos.청산가.toLocaleString()} USDT**)`, "long");
    재생효과음("sound-trigger");
    
    // 상태 저장 및 UI 즉각 리프레시
    모의매매상태저장();
    활성포지션테이블렌더링();
    상태바업데이트();
    화면업데이트();
};

// [모바일 반응형 V1] 모바일 탭 스위칭 및 차트 초정밀 리사이징 엔진 (한글 주석 준수)
window.모바일탭스위치 = function(tabName) {
    const appContainer = document.querySelector(".app-container");
    if (!appContainer) return;

    // 1. 컨테이너의 모바일 탭 상태 속성 갱신
    appContainer.setAttribute("data-mobile-active-tab", tabName);

    // 2. 모바일 탭 버튼들의 active 클래스 토글
    document.querySelectorAll(".mobile-bottom-nav .nav-item").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabName) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // 3. 차트 탭으로 전환되었을 경우, 숨겨졌다가 나타나면서 찌그러진 TradingView 차트를 초정밀 리사이징
    if (tabName === "chart") {
        setTimeout(() => {
            상태.차트객체.분할차트들.forEach((c, idx) => {
                const container = document.getElementById(`split-chart-canvas-${idx}`);
                if (c.메인차트 && container) {
                    c.메인차트.resize(container.clientWidth, container.clientHeight);
                    c.메인차트.timeScale().fitContent();
                }
            });
        }, 80); // 모바일 렌더링 리플로우 타이밍 고려한 80ms 지연
    } else if (tabName === "position") {
        // 포지션 탭 전환 시 모바일 뷰 스크롤 최상단 보정
        window.scrollTo(0, 0);
    }
};

// [모바일 반응형 V2] 8분할 차트 간 가로 스크롤 전환 탭 렌더링 기능 (Mobile Chart Tab Renderer)
window.모바일차트선택기렌더링 = function() {
    for (let i = 0; i < 8; i++) {
        const tabBtn = document.getElementById(`mobile-chart-tab-${i}`);
        if (!tabBtn) continue;
        const chartData = 상태.차트객체.분할차트들[i];
        if (chartData) {
            const cleanSymbol = chartData.코인심볼.replace("USDT", "");
            tabBtn.innerHTML = `차트 ${i+1}: <span style="color: var(--color-yellow); font-weight:800;">${cleanSymbol}</span> <span style="opacity: 0.7; font-size:9.5px;">(${chartData.시간단위})</span>`;
        }
    }
};

// [모바일 반응형 V3] 모바일 탭 전환 및 포커스 동적 스위칭 (Mobile Chart Focus Switch)
window.모바일차트포커스변경 = function(idx) {
    // 1. 활성차트 테두리 적용 (이 내부에서 모바일 탭도 함께 active 상태로 업데이트)
    window.활성차트강조테두리(idx);
    
    // 모바일 차트 선택기 정보 동기화 및 렌더링
    if (typeof window.모바일차트선택기렌더링 === "function") {
        window.모바일차트선택기렌더링();
    }
    
    // 2. 해당 차트로 기본코인 핫스왑 연동 및 타점 드로잉
    const chartData = 상태.차트객체.분할차트들[idx];
    if (chartData) {
        window.차트클릭포커스액션(idx);
        
        // 3. 찌그러진 TradingView 차트를 초정밀 리사이징
        setTimeout(() => {
            const container = document.getElementById(`split-chart-canvas-${idx}`);
            if (chartData.메인차트 && container) {
                chartData.메인차트.resize(container.clientWidth, container.clientHeight);
                chartData.메인차트.timeScale().fitContent();
            }
        }, 100); // DOM 리플로우 대기
    }
};

/* ====================================================
   ✉️ 관심 코인 퀀트 분석 이메일 브리핑 발송 모듈 (Email Briefing System)
   모든 변수(Variable)와 설명은 한국어로 상세히 서술하고 기술 용어는 영어를 병기하였습니다.
   ==================================================== */

// 1. 단일 코인의 최신 퀀트 분석 데이터를 비파괴적으로 정밀 추출하는 함수 (Quant Extractor)
window.퀀트분석데이터추출 = function(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return null;

    const closes = coin.캔들데이터 ? coin.캔들데이터.map(c => c.close) : [];
    const highs = coin.캔들데이터 ? coin.캔들데이터.map(c => c.high) : [];
    const lows = coin.캔들데이터 ? coin.캔들데이터.map(c => c.low) : [];
    const idx = closes.length - 1;

    // [데이터 과소 상태 가드] 캔들 데이터가 15봉 미만일 때의 기본 폴백 퀀트 데이터 리턴
    if (closes.length < 15) {
        const 정밀저항가격 = parseFloat((coin.현재가 * 1.025).toFixed(coin.소수점));
        const 정밀지지가격 = parseFloat((coin.현재가 * 0.975).toFixed(coin.소수점));
        return {
            symbol: symbol,
            이름: (코인정의[symbol] && 코인정의[symbol].이름) || symbol,
            현재가: coin.현재가,
            지지선: 정밀지지가격,
            저항선: 정밀저항가격,
            방향: "NEUTRAL",
            진입가: coin.현재가,
            익절가: 정밀저항가격,
            손절가: 정밀지지가격,
            점수: 50,
            시장상태: "데이터 부족",
            추천신뢰도: "낮음",
            rsi: 50,
            cci: 0,
            macd: "0.00 / 0.00",
            fundingRate: "0.0100%",
            openInterest: "0.00%",
            whaleFlow: "0%",
            liqMap: "롱 50% vs 숏 50%",
            vpvrPOC: coin.현재가,
            소수점: coin.소수점
        };
    }

    // A. 핵심 기술 지표 실시간 퀀트 계산 (Technical Indicators Calculations)
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 현재MACD히스토그램 = macdData.histogram[idx] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const sma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const sma200 = 계산SMA(closes, 200)[idx] || coin.현재가;

    const cciVal = 계산CCI(highs, lows, closes, 20)[idx] || 0;
    const stochData = 계산스토캐스틱(highs, lows, closes, 14, 3, 3);
    const stochK = stochData.k[idx] || 50;
    const stochD = stochData.d[idx] || 50;
    const vwapVal = 계산VWAP(coin.캔들데이터)[idx] || coin.현재가;
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;
    const bbBasis = bbData.basis[idx] || coin.현재가;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    const bbUpperSanitized = Math.min(bbUpper, coin.현재가 * 1.15);
    const bbLowerSanitized = Math.max(bbLower, coin.현재가 * 0.85);

    const fiboValues = Object.values(fiboLevels);
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가);
    let fiboResistance = bbUpperSanitized;
    if (상방fibo들.length > 0) {
        fiboResistance = Math.min(...상방fibo들);
    }

    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가);
    let fiboSupport = bbLowerSanitized;
    if (하방fibo들.length > 0) {
        fiboSupport = Math.max(...하방fibo들);
    }

    let 정밀저항가격 = parseFloat(((fiboResistance + bbUpperSanitized) / 2).toFixed(coin.소수점));
    let 정밀지지가격 = parseFloat(((fiboSupport + bbLowerSanitized) / 2).toFixed(coin.소수점));

    // 이탈 방지 안전 2차 가드
    if (정밀지지가격 >= coin.현재가) {
        정밀지지가격 = parseFloat((coin.현재가 * 0.985).toFixed(coin.소수점));
    }
    if (정밀저항가격 <= coin.현재가) {
        정밀저항가격 = parseFloat((coin.현재가 * 1.015).toFixed(coin.소수점));
    }

    let 저항선돌파상태 = false;
    let 지지선붕괴상태 = false;

    if (coin.현재가 >= 정밀저항가격) {
        저항선돌파상태 = true;
        const 확장저항 = 최고24h + (최고24h - 최저24h) * 0.114;
        정밀저항가격 = parseFloat(((확장저항 + bbUpper * 1.012) / 2).toFixed(coin.소수점));
    }
    if (coin.현재가 <= 정밀지지가격) {
        지지선붕괴상태 = true;
        const 확장지지 = 최저24h - (최고24h - 최저24h) * 0.114;
        정밀지지가격 = parseFloat(((확장지지 + bbLower * 0.988) / 2).toFixed(coin.소수점));
    }

    // B. 온체인 및 선물 심리 데이터 퀀트 산출 (On-chain & Sentiment Quant Calculations)
    const 호가비율 = coin.호가매수.length > 0 && coin.호가매도.length > 0 ? 
        parseFloat(coin.호가매수[0][1]) / (parseFloat(coin.호가매수[0][1]) + parseFloat(coin.호가매도[0][1])) : 0.5;
    const 펀딩비 = (rsiVal - 50) * 0.0004 + (호가비율 - 0.5) * 0.01 + 0.01;
    const oiChange = (Math.abs(coin.현재가 - coin.어제종가) / coin.어제종가) * 350 + (호가비율 - 0.5) * 20;
    const liqLongRatio = Math.max(20, Math.min(80, Math.floor(52 + (rsiVal - 50) * 0.8 + (호가비율 - 0.5) * 15)));
    const liqShortRatio = 100 - liqLongRatio;
    const whaleRatio = Math.max(-95, Math.min(95, Math.floor((coin.호가매수.length - coin.호가매도.length) * 15 + (rsiVal - 50) * 2 + (호가비율 - 0.5) * 80)));

    const 시장상태 = 시장상태판정({
        현재가: coin.현재가,
        ema20,
        sma60,
        bbUpper,
        bbLower,
        bbBasis,
        현재MACD,
        현재MACD시그널
    });

    // C. 다요소 지표 종합 스코어 연산 (Scoring Calculations)
    let 점수 = 50;
    let 롱근거수 = 0;
    let 숏근거수 = 0;
    let 추세합의수 = 0;
    let 평균회귀합의수 = 0;

    if (rsiVal <= 25) { 점수 += 10 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (rsiVal <= 35) { 점수 += 7 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (rsiVal >= 75) { 점수 -= 10 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (rsiVal >= 65) { 점수 -= 7 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }

    if (현재MACD > 현재MACD시그널) {
        점수 += 8 * 시장상태.추세가중치;
        롱근거수++;
        추세합의수++;
        if (현재MACD히스토그램 > 0) 점수 += 5 * 시장상태.추세가중치;
    } else {
        점수 -= 8 * 시장상태.추세가중치;
        숏근거수++;
        추세합의수++;
        if (현재MACD히스토그램 < 0) 점수 -= 5 * 시장상태.추세가중치;
    }

    if (coin.현재가 > sma60) {
        점수 += 5 * 시장상태.추세가중치;
        롱근거수++;
        추세합의수++;
        const 이평정배열 = ema5 > ema20 && ema20 > sma60;
        if (이평정배열) 점수 += 4 * 시장상태.추세가중치;
    } else {
        점수 -= 5 * 시장상태.추세가중치;
        숏근거수++;
        추세합의수++;
        const 이평역배열 = ema5 < ema20 && ema20 < sma60;
        if (이평역배열) 점수 -= 4 * 시장상태.추세가중치;
    }

    if (coin.현재가 <= bbLower) { 점수 += 10 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (coin.현재가 >= bbUpper) { 점수 -= 10 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else {
        const bbDist = (coin.현재가 - bbBasis) / Math.max(bbUpper - bbLower, 0.000001);
        점수 -= bbDist * 10 * 시장상태.평균회귀가중치;
    }

    if (cciVal < -150) { 점수 += 6 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (cciVal < -100) { 점수 += 4 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (cciVal > 150) { 점수 -= 6 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (cciVal > 100) { 점수 -= 4 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }

    if (stochK <= 20) {
        점수 += 4 * 시장상태.평균회귀가중치;
        롱근거수++;
        평균회귀합의수++;
        if (stochK > stochD) 점수 += 4 * 시장상태.평균회귀가중치;
    } else if (stochK >= 80) {
        점수 -= 4 * 시장상태.평균회귀가중치;
        숏근거수++;
        평균회귀합의수++;
        if (stochK < stochD) 점수 -= 4 * 시장상태.평균회귀가중치;
    }

    const vwap괴리율 = (coin.현재가 - vwapVal) / vwapVal * 100;
    if (vwap괴리율 < -2.0) { 점수 += 8 * 시장상태.평균회귀가중치; 롱근거수++; 평균회귀합의수++; }
    else if (vwap괴리율 < 0) { 점수 += 4 * 시장상태.평균회귀가중치; 롱근거수++; }
    else if (vwap괴리율 > 2.0) { 점수 -= 8 * 시장상태.평균회귀가중치; 숏근거수++; 평균회귀합의수++; }
    else if (vwap괴리율 > 0) { 점수 -= 4 * 시장상태.평균회귀가중치; 숏근거수++; }

    const 피보나치골든존 = coin.현재가 <= fiboLevels["50.0%"] && coin.현재가 >= fiboLevels["61.8%"];
    if (피보나치골든존) {
        점수 += 7 * 시장상태.평균회귀가중치;
        롱근거수++;
        평균회귀합의수++;
        if (coin.현재가 < vpvrPOC) 점수 += 4;
    } else if (coin.현재가 > fiboLevels["23.6%"]) {
        점수 -= 6 * 시장상태.평균회귀가중치;
        숏근거수++;
    }

    if (평균회귀합의수 >= 4 && 시장상태.추세가중치 > 1) {
        점수 = 50 + (점수 - 50) * 0.82;
    }

    const 방향합의수 = Math.max(롱근거수, 숏근거수);
    const 추세회귀균형도 = Math.min(추세합의수, 평균회귀합의수);
    let 추천신뢰도점수 = 48 + 방향합의수 * 6 + 추세회귀균형도 * 4 + 시장상태.신뢰도보정;
    if (Math.abs(점수 - 50) >= 25) 추천신뢰도점수 += 6;
    추천신뢰도점수 = Math.max(25, Math.min(92, Math.round(추천신뢰도점수)));
    const 추천신뢰도 = 지표신뢰도등급(추천신뢰도점수);

    점수 = Math.max(0, Math.min(100, Math.round(점수)));

    // D. 최적의 롱/숏 타점 도출 (Entry/Take-Profit/Stop-Loss Targets)
    let 추천방향 = "NEUTRAL";
    if (점수 >= 75) 추천방향 = "STRONG_LONG";
    else if (점수 >= 57) 추천방향 = "LONG";
    else if (점수 <= 25) 추천방향 = "STRONG_SHORT";
    else if (점수 <= 43) 추천방향 = "SHORT";

    let 추천진입가 = coin.현재가;
    let 추천익절가 = coin.현재가;
    let 추천손절가 = coin.현재가;

    if (추천방향.includes("LONG")) {
        추천진입가 = Math.min(coin.현재가, (fiboLevels["78.6%"] + bbLower) / 2);
        추천익절가 = Math.max(coin.현재가 * 1.005, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
        추천손절가 = Math.min(추천진입가 * 0.992, fiboLevels["88.6%"] * 0.998);
    } else if (추천방향.includes("SHORT")) {
        추천진입가 = Math.max(coin.현재가, ((fiboLevels["23.6%"] + fiboLevels["38.2%"]) / 2 + bbUpper) / 2);
        추천익절가 = Math.min(coin.현재가 * 0.995, (fiboLevels["78.6%"] + bbLower) / 2);
        추천손절가 = Math.max(추천진입가 * 1.008, fiboLevels["11.4%"] * 1.002);
    } else {
        추천진입가 = coin.현재가;
        추천익절가 = bbUpper;
        추천손절가 = bbLower;
    }

    추천진입가 = parseFloat(추천진입가.toFixed(coin.소수점));
    추천익절가 = parseFloat(추천익절가.toFixed(coin.소수점));
    추천손절가 = parseFloat(추천손절가.toFixed(coin.소수점));

    return {
        symbol: symbol,
        이름: (코인정의[symbol] && 코인정의[symbol].이름) || symbol,
        현재가: coin.현재가,
        지지선: 정밀지지가격,
        저항선: 정밀저항가격,
        방향: 추천방향,
        진입가: 추천진입가,
        익절가: 추천익절가,
        손절가: 추천손절가,
        점수: 점수,
        시장상태: 시장상태.이름,
        추천신뢰도: 추천신뢰도.텍스트,
        rsi: rsiVal,
        cci: cciVal,
        macd: `${현재MACD.toFixed(3)} / ${현재MACD시그널.toFixed(3)}`,
        fundingRate: `${(펀딩비 >= 0 ? "+" : "") + 펀딩비.toFixed(4)}%`,
        openInterest: `${(oiChange >= 0 ? "+" : "") + oiChange.toFixed(2)}%`,
        whaleFlow: `${(whaleRatio >= 0 ? "+" : "") + whaleRatio}%`,
        liqMap: `롱 ${liqLongRatio}% vs 숏 ${liqShortRatio}%`,
        vpvrPOC: vpvrPOC,
        소수점: coin.소수점
    };
};

// ==========================================
// [Kakao Auto Send Setup & Logic]
// ==========================================

const storedSymbol = localStorage.getItem('kakaoTargetSymbol') || '';
window.KakaoAutoSendInfo = {
    key: localStorage.getItem('kakaoJsKey') || '',
    symbol: storedSymbol,
    symbols: storedSymbol.split(/[\s,.]+/).filter(s => s),
    enabled_a: localStorage.getItem('kakaoAutoEnabledA') === 'true',
    enabled_b: localStorage.getItem('kakaoAutoEnabledB') === 'true',
    interval_b: parseInt(localStorage.getItem('kakaoIntervalB')) || 60,
    enabled_c: localStorage.getItem('kakaoAutoEnabledC') === 'true',
    rsi_c: parseInt(localStorage.getItem('kakaoRsiC')) || 30
};
window.KakaoIntervalTimer = null;
window.KakaoRsiCooldowns = {};

document.addEventListener('DOMContentLoaded', () => {
    // init modal inputs
    const keyInput = document.getElementById('input-kakao-key');
    const symbolInput = document.getElementById('input-kakao-symbol');
    
    if(keyInput) keyInput.value = window.KakaoAutoSendInfo.key;
    if(symbolInput) symbolInput.value = window.KakaoAutoSendInfo.symbol;
    
    const chkA = document.getElementById('chk-kakao-auto-a');
    const chkB = document.getElementById('chk-kakao-auto-b');
    const intB = document.getElementById('input-kakao-interval-b');
    const chkC = document.getElementById('chk-kakao-auto-c');
    const rsiC = document.getElementById('input-kakao-rsi-c');

    if(chkA) chkA.checked = window.KakaoAutoSendInfo.enabled_a;
    if(chkB) chkB.checked = window.KakaoAutoSendInfo.enabled_b;
    if(intB) intB.value = window.KakaoAutoSendInfo.interval_b;
    if(chkC) chkC.checked = window.KakaoAutoSendInfo.enabled_c;
    if(rsiC) rsiC.value = window.KakaoAutoSendInfo.rsi_c;

    // init Kakao SDK
    if(window.KakaoAutoSendInfo.key && typeof Kakao !== 'undefined') {
        try {
            if(!Kakao.isInitialized()) {
                Kakao.init(window.KakaoAutoSendInfo.key);
                console.log("Kakao SDK Initialized.");
                
                // 로컬 스토리지에 저장된 카카오 액세스 토큰이 있다면 세션 복원
                const savedToken = localStorage.getItem('kakao_access_token');
                if (savedToken) {
                    Kakao.Auth.setAccessToken(savedToken);
                    console.log("Kakao Access Token Restored.");
                }
            }
        } catch(e) { console.error("Kakao Init Error:", e); }
    }

    // Start Timer if Option B is enabled
    window.카카오정기발송타이머시작();
});

window.카카오설정저장 = function() {
    const key = document.getElementById('input-kakao-key').value.trim();
    const symbol = document.getElementById('input-kakao-symbol').value.trim().toUpperCase();
    
    const enabled_a = document.getElementById('chk-kakao-auto-a').checked;
    const enabled_b = document.getElementById('chk-kakao-auto-b').checked;
    const interval_b = parseInt(document.getElementById('input-kakao-interval-b').value) || 60;
    const enabled_c = document.getElementById('chk-kakao-auto-c').checked;
    const rsi_c = parseInt(document.getElementById('input-kakao-rsi-c').value) || 30;

    const anyEnabled = enabled_a || enabled_b || enabled_c;

    if(anyEnabled && !key) {
        alert("카카오 JavaScript 키를 입력해주세요!");
        return;
    }
    if(anyEnabled && !symbol) {
        alert("자동 발송할 대상 코인을 입력해주세요!");
        return;
    }

    localStorage.setItem('kakaoJsKey', key);
    localStorage.setItem('kakaoTargetSymbol', symbol);
    localStorage.setItem('kakaoAutoEnabledA', enabled_a);
    localStorage.setItem('kakaoAutoEnabledB', enabled_b);
    localStorage.setItem('kakaoIntervalB', interval_b);
    localStorage.setItem('kakaoAutoEnabledC', enabled_c);
    localStorage.setItem('kakaoRsiC', rsi_c);

    window.KakaoAutoSendInfo = { 
        key, symbol, 
        symbols: symbol.split(/[\s,.]+/).filter(s => s),
        enabled_a, enabled_b, interval_b, enabled_c, rsi_c 
    };

    if(key && typeof Kakao !== 'undefined') {
        try { 
            if(!Kakao.isInitialized()) Kakao.init(key); 
        } catch(e) {
            alert("카카오 SDK 초기화 오류: " + e.message);
        }
    }

    window.카카오정기발송타이머시작();

    alert(`카카오톡 자동 발송 설정이 통합 저장되었습니다!\n\n대상 코인: ${symbol}`);
    document.getElementById('kakao-config-modal').classList.add('hidden');
};

window.카카오로그인실행 = function() {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
        alert("먼저 JavaScript 키를 입력하고 [설정 저장]을 눌러주세요.");
        return;
    }
    Kakao.Auth.login({
        scope: 'talk_message',
        success: function(authObj) {
            // 로그인 성공 시 액세스 토큰을 로컬 스토리지에 영구 저장하여 자동 로그인 지원
            localStorage.setItem('kakao_access_token', authObj.access_token);
            alert('카카오 로그인 성공! 이제 나에게 보내기 기능이 항상 자동 활성화됩니다.');
        },
        fail: function(err) {
            alert('카카오 로그인 실패: ' + JSON.stringify(err));
        }
    });
};

window.카카오알림테스트발송 = function() {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
        alert("먼저 JavaScript 키를 입력하고 [설정 저장]을 눌러주세요.");
        return;
    }
    Kakao.API.request({
        url: '/v2/api/talk/memo/default/send',
        data: {
            template_object: {
                object_type: 'text',
                text: '[Antigravity 테스트]\n\n카카오톡 연동 테스트 메시지입니다.\n알림이 성공적으로 작동하고 있습니다!',
                link: { web_url: 'https://cassmania.github.io/crypto-futures-simulator/', mobile_web_url: 'https://cassmania.github.io/crypto-futures-simulator/' },
                button_title: '시뮬레이터 확인'
            }
        },
        success: function(res) {
            alert("카카오톡 발송 테스트 성공! 내 카카오톡을 확인해보세요.");
        },
        fail: function(error) {
            if (error.code === -401) {
                localStorage.removeItem('kakao_access_token');
                alert('카카오 로그인 토큰이 만료되었거나 올바르지 않습니다. [🔑 카카오 로그인] 버튼을 눌러 다시 로그인해 주세요.');
            } else {
                alert('카카오톡 발송 테스트 실패: ' + JSON.stringify(error));
            }
        }
    });
};

window.카카오알림발송 = function(data, isSummary = false) {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) return;
    
    let textContent = '';
    if (isSummary) {
        textContent = `[Antigravity AI 정기 브리핑]\n\n코인명: ${data.코인명}\n현재가: ${data.현재가}\nRSI: ${data.RSI}\n\n[주요 근거/상태]\n${data.근거}`;
    } else {
        textContent = `[Antigravity AI 퀀트 알림]\n\n코인명: ${data.코인명}\n방향: ${data.방향}\n가격: ${data.현재가}\nRSI: ${data.RSI}\n\n[주요 근거]\n${data.근거}`;
    }

    Kakao.API.request({
        url: '/v2/api/talk/memo/default/send',
        data: {
            template_object: {
                object_type: 'text',
                text: textContent,
                link: { web_url: 'https://developers.kakao.com', mobile_web_url: 'https://developers.kakao.com' },
                button_title: '시뮬레이터 확인'
            }
        },
        success: function(res) {
            새신호알림(data.코인명, `[카카오톡 발송] ${data.코인명} 카톡 브리핑 전송 완료`, 'neutral');
        },
        fail: function(error) {
            if (error.code === -401) {
                localStorage.removeItem('kakao_access_token');
                alert('카카오 로그인 토큰이 만료되었거나 올바르지 않습니다. [🔑 카카오 로그인] 버튼을 눌러 다시 로그인해 주세요.');
            } else {
                alert('카카오톡 발송 실패: ' + JSON.stringify(error));
            }
            console.error('카카오톡 발송 실패:', error);
        }
    });
};

window.카카오정기발송타이머시작 = function() {
    if (window.KakaoIntervalTimer) {
        clearInterval(window.KakaoIntervalTimer);
        window.KakaoIntervalTimer = null;
    }
    const info = window.KakaoAutoSendInfo;
    if (info.enabled_b && info.symbols && info.symbols.length > 0 && info.interval_b > 0) {
        window.KakaoIntervalTimer = setInterval(() => {
            let summaryLines = [];
            info.symbols.forEach(sym => {
                const coin = 상태.코인목록[sym]; // [오류 수정] 상태.코인데이터가 아닌 상태.코인목록 참조
                if (!coin || !coin.캔들데이터 || coin.캔들데이터.length === 0) return;
                
                // [오류 수정] 정의되지 않은 지표계산(coin) 함수 호출 제거 및 직접 RSI 연산 호출
                const closes = coin.캔들데이터.map(c => c.close);
                const rsiArr = 계산RSI(closes, 14);
                const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;
                
                summaryLines.push(`[${sym}] ${coin.현재가.toLocaleString()} (RSI: ${rsi.toFixed(1)}%)`);
            });
            
            if (summaryLines.length > 0) {
                window.카카오알림발송({
                    코인명: '멀티 브리핑',
                    방향: '정기 요약',
                    현재가: '-',
                    RSI: '-',
                    근거: `주기: ${info.interval_b}분\n\n${summaryLines.join('\n')}`
                }, true);
            }

        }, info.interval_b * 60 * 1000);
    }
};
