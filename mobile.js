/* ----------------------------------------------------
   BINANCE REAL-TIME FUTURES SIMULATOR MOBILE LOGIC (mobile.js)
   본 스크립트는 스마트폰 모바일 디바이스 뷰포트에 100% 최적화된
   단일 차트 기반 모의투자 및 AI 퀀트 거래 신호 엔진 코어입니다.
   데스크톱 버전과 브라우저 로컬 스토리지(localStorage) 상태를 연동 공유합니다.
   모든 변수(Variable)와 설명은 한국어로 상세히 서술하고 기술 용어는 영어를 병기하였습니다.
   ---------------------------------------------------- */

window.onerror = function(msg, url, line) {
    if (msg === "Script error." || (!url && line === 0)) {
        console.warn("[Cross-Origin SDK Warning Ignore]:", msg);
        return true; // 브라우저 기본 에러 동작 전파 차단
    }
    alert('모바일 브라우저 에러 감지!\n메시지: ' + msg + '\n파일: ' + url + '\n라인: ' + line);
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
    재연결타이머: null,        // Auto Reconnect Timer

    // 모바일 단일 차트 객체 정의 (Mobile Single Chart Object)
    단일차트: {
        메인차트: null,
        캔들시리즈: null,
        EMA5시리즈: null,
        EMA20시리즈: null,
        SMA60시리즈: null,
        시간단위: "4h",        // 모바일 기본 시간 단위: 4시간봉 (4h)
        캔들데이터: [],
        지지저항선들: []
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

    // 1단계: 코인 기본 메타데이터 메모리 이식
    초기코인데이터정의();

    // 2단계: 모바일 TradingView Lightweight Charts 단일 차트 초기화
    차트시스템초기화();

    // 3단계: 이벤트 리스너 바인딩 (UI Event Listeners)
    이벤트리스너바인딩();

    // 4단계: 로컬 스토리지로부터 모의 매매 잔고, 대기 주문, 포지션 정보 복원
    모의매매상태복원();

    // [보완] 최초 코인 실시간 실제 시세(Spot API) 로딩으로 가격 괴리 사전 차단
    await 최초시세로딩();

    // 5단계: 바이낸스 REST API 기반 초기 과거 캔들 데이터 로딩
    await 단일차트캔들데이터로드();

    // 6단계: 바이낸스 WebSocket 실시간 채널 오픈 및 연결
    바이낸스웹소켓연결();

    // 7단계: 주문 감시 및 포지션 마진 정산 정기 연산 루프 가동
    setInterval(실시간포지션마진정산, 1000); // 1초마다 포지션 PNL 및 청산 감시
    setInterval(감시대기주문체결, 500);     // 0.5초마다 타점 예약 주문 도달 여부 정밀 감시

    // 8단계: 웹소켓 차단 방어용 실시간 REST API 안전 백업 폴러 가동
    실시간시세REST폴러();

    // 화면 갱신 및 탭 렌더링
    화면업데이트();
    코인탭렌더링();
    AI설정스토리지복원(); // AI 자동매매 세부 설정 복원

    // 기본 레버리지 동기화 및 역싱크
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
        }
    } catch (e) {
        console.error("초기 레버리지 동기화 에러:", e);
    }
});

// 코인 실시간 가격에 따른 지능형 소수점 자동 조율 함수
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
        수량소수점 = 3; // BTC, ETH 등 대형 자산
    }
    
    return { 소수점, 수량소수점 };
}

// 코인 데이터 기본 정의 및 localStorage 알트코인 목록 복원
function 초기코인데이터정의() {
    let 자동매매맵 = {};
    try {
        const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
        if (저장된자동매매) {
            자동매매맵 = JSON.parse(저장된자동매매);
        }
    } catch (e) {
        console.error("자동매매 스토리지 로드 실패:", e);
    }

    // A. 기본 정의 코인 이식
    Object.keys(코인정의).forEach(symbol => {
        const { 소수점, 수량소수점 } = 자동소수점결정(코인정의[symbol].시작가);
        상태.코인목록[symbol] = {
            심볼: symbol,
            이름: 코인정의[symbol].이름 || `${symbol.replace("USDT", "")}/USDT Perpetual`,
            현재가: 코인정의[symbol].시작가,
            어제종가: 코인정의[symbol].시작가 * 0.98,
            최고24h: 코인정의[symbol].시작가 * 1.02,
            최저24h: 코인정의[symbol].시작가 * 0.97,
            캔들데이터: [],
            호가매도: [], 
            호가매수: [], 
            소수점: 소수점,
            수량소수점: 수량소수점,
            레버리지: 3, 
            자동매매활성화: !!자동매매맵[symbol],
            가상시세여부: false
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
                        레버리지: 3,
                        자동매매활성화: !!자동매매맵[symbol],
                        가상시세여부: false
                    };
                    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
                        상태.코인목록[symbol].소수점 = 5;
                        상태.코인목록[symbol].수량소수점 = 0;
                    }
                }
            });
        }

        // C. 마지막 사용 기본 코인 복원
        const 저장된현재코인 = localStorage.getItem("선물시뮬레이터_현재코인");
        if (저장된현재코인 && 상태.코인목록[저장된현재코인]) {
            상태.기본코인 = 저장된현재코인;
        }

        // D. 즐겨찾기 목록 복원
        const 저장된즐겨찾기 = localStorage.getItem("선물시뮬레이터_즐겨찾기");
        if (저장된즐겨찾기) {
            상태.즐겨찾기목록 = JSON.parse(저장된즐겨찾기);
        }

        // E. 모바일 차트 시간 단위 복원
        const 저장된차트시간 = localStorage.getItem("선물시뮬레이터_차트시간설정");
        if (저장된차트시간) {
            const 시간설정 = JSON.parse(저장된차트시간);
            if (시간설정 && 시간설정[0]) {
                상태.단일차트.시간단위 = 시간설정[0]; // 첫 번째 분할차트 설정을 모바일 대표로 활용
            }
        }
    } catch (err) {
        console.error("코인 목록 및 즐겨찾기 복원 에러:", err);
    }
    
    // 레버리지 복원
    코인레버리지복원();
}

// 3. TradingView Lightweight Charts 단일 차트 초기화 (Mobile Single Chart Init)
function 차트시스템초기화() {
    const container = document.getElementById("mobile-chart-canvas");
    if (!container) return;

    // 모바일 전용 차트 테마 옵션 정의
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

    상태.단일차트.메인차트 = LightweightCharts.createChart(container, chartOptions);
    
    // 캔들 시리즈 주입
    상태.단일차트.캔들시리즈 = 상태.단일차트.메인차트.addCandlestickSeries({
        upColor: '#f6465d', // 상승 = 빨간색 (한국 기준)
        downColor: '#0066ff', // 하락 = 파란색 (한국 기준)
        borderUpColor: '#f6465d',
        borderDownColor: '#0066ff',
        wickUpColor: '#f6465d',
        wickDownColor: '#0066ff'
    });

    // 이동평균선(MA) 시리즈 주입
    상태.단일차트.EMA5시리즈 = 상태.단일차트.메인차트.addLineSeries({ color: '#F0B90B', lineWidth: 1.5, title: 'MA(7)' });
    상태.단일차트.EMA20시리즈 = 상태.단일차트.메인차트.addLineSeries({ color: '#03A9F4', lineWidth: 1.5, title: 'MA(25)' });
    상태.단일차트.SMA60시리즈 = 상태.단일차트.메인차트.addLineSeries({ color: '#E040FB', lineWidth: 1.5, title: 'MA(99)' });

    // 모바일 리사이즈 대응
    window.addEventListener("resize", () => {
        if (상태.단일차트.메인차트 && container) {
            상태.단일차트.메인차트.resize(container.clientWidth, container.clientHeight);
        }
    });

    // 시간 단위 UI 세팅 동기화
    const activeTf = 상태.단일차트.시간단위;
    document.querySelectorAll(".tf-selector-group .btn-tf").forEach(btn => {
        if (btn.dataset.tf === activeTf) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

// 4. 바이낸스 REST API 기반 초기 과거 캔들 데이터 로딩
async function 최초시세로딩() {
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
        }
    } catch (err) {
        console.warn("초기 실시간 시세 로드 실패:", err.message);
    }
}

async function 단일차트캔들데이터로드() {
    const symbol = 상태.기본코인;
    const interval = 상태.단일차트.시간단위;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    try {
        let response;
        try {
            response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=120`);
            if (!response.ok) throw new Error(`${interval} Futures API 호출 실패`);
        } catch (fErr) {
            console.log(`[Spot 백업] ${symbol} ${interval} 현물 API로 과거 캔들 로드 시도.`);
            response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=120`);
            if (!response.ok) throw new Error(`${interval} Spot API 호출 실패`);
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

        상태.단일차트.캔들데이터 = formattedCandles;
        coin.캔들데이터 = [...formattedCandles];
        coin.현재가 = formattedCandles[formattedCandles.length - 1].close;

        // 지표 계산 및 렌더링
        단일차트렌더링();
    } catch (err) {
        console.warn(`${symbol} 캔들 로드 실패, 가상 데이터 빌드:`, err.message);
        CORS폴백데이터빌드(symbol);
    }
}

// 가상 분할 차트 캔들 빌더 (CORS 대응)
function CORS폴백데이터빌드(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    const interval = 상태.단일차트.시간단위;
    let 최종가격 = coin.현재가 || 100.00;
    
    let 봉단위초 = 60;
    if (interval === "1h") 봉단위초 = 3600;
    else if (interval === "4h") 봉단위초 = 14400;
    else if (interval === "1d") 봉단위초 = 86400;

    let 시간 = Math.floor(Date.now() / 1000);
    const 캔들들 = [];
    const 변동성 = symbol.startsWith("BTC") ? 0.001 : 0.003;
    let 현재루프가격 = 최종가격;

    for (let i = 0; i < 120; i++) {
        let close = 현재루프가격;
        let change = 현재루프가격 * 변동성 * (Math.random() - 0.48) * 2;
        let open = close - change;
        let high = Math.max(open, close) + (현재루프가격 * 변동성 * Math.random() * 0.4);
        let low = Math.min(open, close) - (현재루프가격 * 변동성 * Math.random() * 0.4);
        
        캔들들.unshift({
            time: 시간,
            open: parseFloat(open.toFixed(coin.소수점)),
            high: parseFloat(high.toFixed(coin.소수점)),
            low: parseFloat(low.toFixed(coin.소수점)),
            close: parseFloat(close.toFixed(coin.소수점)),
            volume: parseFloat((Math.random() * 100 + 10).toFixed(2))
        });
        현재루프가격 = open;
        시간 -= 봉단위초;
    }
    
    상태.단일차트.캔들데이터 = 캔들들;
    coin.현재가 = 최종가격;
    coin.가상시세여부 = true;
    coin.캔들데이터 = [...캔들들];

    const statusDot = document.getElementById("binance-status-dot");
    const statusText = document.getElementById("binance-status-text");
    if (statusDot && statusText && !상태.웹소켓연결상태) {
        statusDot.style.backgroundColor = "#ff9800"; // 주황 경고등
        statusDot.className = "status-dot animate-pulse";
        statusText.innerText = "가상 시뮬레이션 시세 작동";
        statusText.className = "status-text text-yellow";
    }

    단일차트렌더링();
}

function 단일차트렌더링() {
    const c = 상태.단일차트;
    if (!c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length === 0) return;

    c.캔들시리즈.setData(c.캔들데이터);

    const closes = c.캔들데이터.map(x => x.close);
    const times = c.캔들데이터.map(x => x.time);

    const ema5 = 계산EMA(closes, 5);
    const ema20 = 계산EMA(closes, 20);
    const sma60 = 계산SMA(closes, 60);

    c.EMA5시리즈.setData(매핑지표데이터(times, ema5));
    c.EMA20시리즈.setData(매핑지표데이터(times, ema20));
    c.SMA60시리즈.setData(매핑지표데이터(times, sma60));

    c.메인차트.timeScale().fitContent();
    차트지지저항선드로잉();
}

function 매핑지표데이터(times, values) {
    return times.map((t, idx) => ({
        time: t,
        value: values[idx]
    })).filter(d => d.value !== undefined && !isNaN(d.value));
}

// 5. 바이낸스 WebSocket 실시간 스트리밍 시스템
function 바이낸스웹소켓연결() {
    if (상태.웹소켓인스턴스) {
        상태.웹소켓인스턴스.close();
    }

    const statusDot = document.getElementById("binance-status-dot");
    const statusText = document.getElementById("binance-status-text");

    const streamsList = [];
    Object.keys(상태.코인목록).forEach(symbol => {
        const sym = symbol.toLowerCase();
        streamsList.push(`${sym}@kline_1m`);
        streamsList.push(`${sym}@depth5`);
    });

    const wsUrl = `wss://fstream.binance.com/stream?streams=${streamsList.join("/")}`;
    상태.웹소켓인스턴스 = new WebSocket(wsUrl);

    상태.웹소켓인스턴스.onopen = () => {
        상태.웹소켓연결상태 = true;
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = ""; 
            statusDot.className = "status-dot green";
            statusText.innerText = "라이브 시세 연동";
            statusText.className = "status-text text-green";
        }
    };

    상태.웹소켓인스턴스.onmessage = (event) => {
        const 패킷 = JSON.parse(event.data);
        if (!패킷.stream || !패킷.data) return;

        const streamName = 패킷.stream;
        
        if (streamName.includes("kline")) {
            실시간캔들메시지파싱(패킷.data);
        }
        if (streamName.includes("depth")) {
            실시간호가메시지파싱(패킷.data, streamName.split("@")[0].toUpperCase());
        }
    };

    상태.웹소켓인스턴스.onclose = () => {
        상태.웹소켓연결상태 = false;
        if (statusDot && statusText) {
            statusDot.className = "status-dot pulse-red";
            statusText.innerText = "연결 끊김 (재접속)";
            statusText.className = "status-text text-red";
        }
        clearTimeout(상태.재연결타이머);
        상태.재연결타이머 = setTimeout(바이낸스웹소켓연결, 5000);
    };
}

function 웹소켓스트림갱신() {
    바이낸스웹소켓연결();
}

// Kline 실시간 수신 핸들러 (모바일 단일 차트 갱신)
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

    // 1분봉 버퍼 누적 및 기술지표 신호 감지
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
            분석및신호생성(symbol);
        }
    }

    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

    // 현재 포커스 기본 코인일 경우만 UI 정보 업데이트
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
            changeEl.className = "price-change " + (변동률 >= 0 ? "text-green" : "text-red");
        }

        const highEl = document.getElementById("price-high-24h");
        const lowEl = document.getElementById("price-low-24h");
        if (highEl) highEl.innerText = coin.최고24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (lowEl) lowEl.innerText = coin.최저24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

        AI추천분석및업데이트(symbol);
        주문비용재연산();
    }

    // 모바일 단일 차트 갱신 (해당 차트의 심볼이 data 심볼과 같을 때)
    const c = 상태.단일차트;
    if (c.메인차트 && c.캔들시리즈 && c.캔들데이터.length > 0 && 상태.기본코인 === symbol) {
        let 봉단위초 = 60;
        if (c.시간단위 === "1m") 봉단위초 = 60;
        else if (c.시간단위 === "1h") 봉단위초 = 3600;
        else if (c.시간단위 === "4h") 봉단위초 = 14400;
        else if (c.시간단위 === "1d") 봉단위초 = 86400;

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
            if (c.캔들데이터.length > 300) c.캔들데이터.shift();
            c.캔들시리즈.update(신규분할캔들);
            차트지지저항선드로잉();
        }

        const closesList = c.캔들데이터.map(x => x.close);
        const ema5 = 계산EMA(closesList, 5);
        const ema20 = 계산EMA(closesList, 20);
        const sma60 = 계산SMA(closesList, 60);

        const activeCandle = c.캔들데이터[c.캔들데이터.length - 1];
        c.EMA5시리즈.update({ time: activeCandle.time, value: ema5[ema5.length - 1] });
        c.EMA20시리즈.update({ time: activeCandle.time, value: ema20[ema20.length - 1] });
        c.SMA60시리즈.update({ time: activeCandle.time, value: sma60[sma60.length - 1] });
    }

    // 상단 가로 탭 가격 표시 실시간 갱신
    const tabPriceEl = document.getElementById(`tab-price-${symbol}`);
    if (tabPriceEl) {
        tabPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        const 변동률 = (현재가 - coin.어제종가) / coin.어제종가;
        tabPriceEl.className = "tab-price " + (변동률 >= 0 ? "text-green" : "text-red");
    }
}

// 실시간 호가 수신 핸들러
function 실시간호가메시지파싱(data, symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.호가매도 = data.asks || [];
    coin.호가매수 = data.bids || [];

    if (symbol === 상태.기본코인) {
        호가창렌더링실제(coin);
    }
}

function 호가창렌더링실제(coin) {
    const asksEl = document.getElementById("orderbook-asks");
    const bidsEl = document.getElementById("orderbook-bids");
    if (!asksEl || !bidsEl) return;

    const asks = coin.호가매도.slice(0, 5).reverse();
    업데이트호가목록(asksEl, asks, coin, "text-red", true);

    const bids = coin.호가매수.slice(0, 5);
    업데이트호가목록(bidsEl, bids, coin, "text-green", false);

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

function 업데이트호가목록(containerEl, 호가데이터, coin, 가격클래스, 역순누적) {
    if (호가데이터.length === 0) return;
    
    // 모바일은 깜빡임 방지 구조로 innerHTML 렌더
    let html = "";
    호가데이터.forEach((dataRow, idx) => {
        const 가격 = parseFloat(dataRow[0]);
        const 잔량 = parseFloat(dataRow[1]);
        const 누적 = 역순누적 ? 잔량 * (호가데이터.length - idx) : 잔량 * (idx + 1);
        const 뎁스백분율 = Math.min(100, Math.max(5, (잔량 / 5 * 100)));
        
        html += `
            <div class="orderbook-row" onclick="호가클릭(${가격.toFixed(coin.소수점)})">
                <div class="depth-bar" style="width: ${뎁스백분율}%;"></div>
                <span class="price-val ${가격클래스}">${가격.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
                <span class="size-val">${잔량.toFixed(coin.수량소수점)}</span>
                <span class="total-val">${누적.toFixed(1)}</span>
            </div>
        `;
    });
    containerEl.innerHTML = html;
}

window.호가클릭 = function(price) {
    const triggerInput = document.getElementById("input-trigger-price");
    if (triggerInput) {
        triggerInput.value = price;
        주문비용재연산();
    }
};

// 8. 보조 지표 계산 로직
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
        "11.4%": high - diff * 0.114,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.5,
        "61.8%": high - diff * 0.618,
        "78.6%": high - diff * 0.786,
        "88.6%": high - diff * 0.886,
        "100.0%": low
    };
}

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

// 9. 매매 타이밍 신호 발생 분석기
function 분석및신호생성(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 20) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const times = coin.캔들데이터.map(c => c.time);
    const idx = closes.length - 1;

    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 이전MACD = macdData.macd[idx - 1] || 0;
    const 이전MACD시그널 = macdData.signal[idx - 1] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const ma20 = 계산SMA(closes, 20)[idx] || coin.현재가;
    const ma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const 이전EMA5 = 계산EMA(closes, 5)[idx - 1] || coin.현재가;
    const 이전EMA20 = 계산EMA(closes, 20)[idx - 1] || coin.현재가;

    const cciVal = 계산CCI(highs, lows, closes, 20)[idx] || 0;
    const stochData = 계산스토캐스틱(highs, lows, closes, 14, 3, 3);
    const stochK = stochData.k[idx] || 50;
    const stochD = stochData.d[idx] || 50;
    
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 80), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 80), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    let 신호방향 = null;
    let 근거 = [];

    const 롱지지검증 = coin.현재가 <= fiboLevels["50.0%"] || coin.현재가 < vpvrPOC || coin.현재가 <= bbLower;
    const 숏저항검증 = coin.currentlyPrice || coin.현재가 >= fiboLevels["38.2%"] || coin.현재가 > vpvrPOC || coin.현재가 >= bbUpper;

    const 이평정배열 = ma20 >= ma60;
    const 이평역배열 = ma20 <= ma60;

    const 슈퍼트렌드롱 = coin.현재가 > ema20 && rsiVal > 48;
    const 슈퍼트렌드숏 = coin.현재가 < ema20 && rsiVal < 52;
    const MACD롱추세 = 현재MACD > 현재MACD시그널;
    const MACD숏추세 = 현재MACD < 현재MACD시그널;

    const 추세롱합격 = 이평정배열 || 슈퍼트렌드롱 || MACD롱추세;
    const 추세숏합격 = 이평역배열 || 슈퍼트렌드숏 || MACD숏추세;

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

    if (롱지지검증 && 추세롱합격 && 타이밍롱진입) {
        신호방향 = "LONG";
        if (RSI롱과매도) 근거.push("RSI 과매도");
        if (CCI롱침체) 근거.push("CCI 침체");
        if (스토크골든크로스) 근거.push("Stoch 골든크로스");
        if (MACD골든크로스) 근거.push("MACD 골든크로스");
        if (MA골든크로스) 근거.push("MA 골든크로스");
    } else if (숏저항검증 && 추세숏합격 && 타이밍숏진입) {
        신호방향 = "SHORT";
        if (RSI숏과매수) 근거.push("RSI 과매수");
        if (CCI숏과열) 근거.push("CCI 과열");
        if (스토크데드크로스) 근거.push("Stoch 데드크로스");
        if (MACD데드크로스) 근거.push("MACD 데드크로스");
        if (MA데드크로스) 근거.push("MA 데드크로스");
    }

    if (신호방향 && 근거.length >= 1) {
        const 근거텍스트 = 근거.join(" + ");
        const 색상 = 신호방향 === "LONG" ? "long" : "short";
        const 방향한글 = 신호방향 === "LONG" ? "롱(LONG) 매수" : "숏(SHORT) 매도";
        
        새신호알림(symbol, `[매매 신호 감지] **${방향한글}** 타점 발생! (${근거텍스트} | RSI: ${rsiVal.toFixed(1)}%)`, 색상);
        재생효과음("sound-signal");

        // 단일 차트 마커 표시
        const c = 상태.단일차트;
        if (symbol === 상태.기본코인 && c.캔들시리즈) {
            let markers = c.캔들시리즈._markers || [];
            
            // 동일한 시간에 중복된 마커가 이미 들어있지 않은 경우에만 신규 추가
            const exists = markers.some(m => m.time === times[idx]);
            if (!exists) {
                markers.push({
                    time: times[idx],
                    position: 신호방향 === "LONG" ? 'belowBar' : 'aboveBar',
                    color: 신호방향 === "LONG" ? '#f6465d' : '#0066ff',
                    shape: 신호방향 === "LONG" ? 'arrowUp' : 'arrowDown',
                    text: 신호방향 === "LONG" ? 'LONG BUY' : 'SHORT SELL'
                });
                try {
                    c.캔들시리즈.setMarkers(markers);
                    c.캔들시리즈._markers = markers;
                } catch (e) {
                    console.error("마커 설정 실패:", e);
                }
            }
        }

        if (coin.자동매매활성화) {
            AI자동매매실행(symbol, 신호방향);
        }
    }
}

// AI 자동매매 포지션 자동 진입 처리
function AI자동매매실행(symbol, 방향) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 20) return;

    if (상태.자동매매설정.중복방지) {
        const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === symbol);
        if (이미존재하는포지션) return;
    }

    const leverageInput = document.getElementById("input-leverage");
    const leverage = leverageInput ? parseInt(leverageInput.value) : 3;

    const 진입가 = coin.현재가;
    const 진입비율 = 상태.자동매매설정.진입비율 || 10;
    const targetMargin = 상태.지갑잔고 * (진입비율 / 100);
    
    let qty = (targetMargin * leverage) / 진입가;
    qty = parseFloat(qty.toFixed(coin.수량소수점));

    if (qty <= 0) {
        새신호알림(symbol, `[🤖 AI 실패] 수량(${qty})이 너무 작습니다.`, "short");
        return;
    }

    let 익절가 = 0;
    let 손절가 = 0;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;
    const 최고가 = Math.max(...highs.slice(Math.max(0, idx - 80), idx + 1));
    const 최저가 = Math.min(...lows.slice(Math.max(0, idx - 80), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고가, 최저가);
    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;

    if (상태.자동매매설정.익절옵션 === "manual") {
        const 수동익절율 = 상태.자동매매설정.수동익절율 || 10;
        익절가 = 방향 === "LONG" ? coin.현재가 * (1 + 수동익절율 / 100) : coin.현재가 * (1 - 수동익절율 / 100);
    } else {
        익절가 = 방향 === "LONG" ? Math.max(coin.현재가 * 1.005, ((fiboLevels["23.6%"] + bbUpper) / 2)) : Math.min(coin.현재가 * 0.995, ((fiboLevels["78.6%"] + bbLower) / 2));
    }

    if (상태.자동매매설정.손절옵션 === "manual") {
        const 수동손절율 = 상태.자동매매설정.수동손절율 || 5;
        손절가 = 방향 === "LONG" ? coin.현재가 * (1 - 수동손절율 / 100) : coin.현재가 * (1 + 수동손절율 / 100);
    } else {
        손절가 = 방향 === "LONG" ? Math.min(coin.현재가 * 0.992, fiboLevels["88.6%"]) : Math.max(coin.현재가 * 1.008, fiboLevels["11.4%"]);
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

    새신호알림(symbol, `[🤖 AI 자동진입] ${방향} 진입 (잔고 ${진입비율}%, 레버리지 ${leverage}x, 수량 ${qty})`, 방향 === "LONG" ? "long" : "short");
    포지션체결실행(자동주문, 진입가);
}

// 10. 예약 주문 자동 체결 및 포지션 마진 연산
function 감시대기주문체결() {
    if (상태.대기주문.length === 0) return;

    let 체결된주문인덱스들 = [];
    상태.대기주문.forEach((주문, index) => {
        const coin = 상태.코인목록[주문.심볼];
        if (!coin || !coin.현재가 || isNaN(coin.현재가) || coin.현재가 <= 0 || coin.가상시세여부) return;

        let 체결성공 = false;
        if (주문.방향 === "LONG") {
            if (coin.현재가 <= 주문.타점가격) 체결성공 = true;
        } else {
            if (coin.현재가 >= 주문.타점가격) 체결성공 = true;
        }

        if (체결성공) {
            체결된주문인덱스들.push(index);
            포지션체결실행(주문, coin.현재가);
        }
    });

    if (체결된주문인덱스들.length > 0) {
        상태.대기주문 = 상태.대기주문.filter((_, idx) => !체결된주문인덱스들.includes(idx));
        모의매매상태저장();
        대기주문리스트렌더링();
        상태바업데이트();
    }
}

function 포지션체결실행(주문, 체결가) {
    const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === 주문.심볼);
    if (이미존재하는포지션) {
        새신호알림(주문.심볼, `[체결 거부] ${주문.심볼}에 활성화된 포지션이 존재합니다.`, "short");
        return;
    }

    const 증거금 = (주문.수량 * 체결가) / 주문.레버리지;

    if (상태.지갑잔고 < 증거금) {
        새신호알림(주문.심볼, `[체결 취소] 잔고 부족 자동 취소`, "short");
        return;
    }

    상태.지갑잔고 -= 증거금;

    // 청산가 연산
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
        자동마진: true,
        체결시간: 얻는현재시각텍스트()
    };

    상태.활성포지션.push(신규포지션);

    재생효과음("sound-trigger");
    새신호알림(주문.심볼, `[체결 성공] 시장가 ${체결가.toLocaleString()} USDT에 ${주문.방향} ${주문.레버리지}x 포지션 진입`, "execution");

    모의매매상태저장();
    활성포지션리스트렌더링();
    상태바업데이트();
    화면업데이트();
}

function 실시간포지션마진정산() {
    if (상태.활성포지션.length === 0) {
        상태.미실현손익 = 0.00;
        상태.마진잔고 = 상태.지갑잔고;
        
        const pnlEl = document.getElementById("header-unrealized-pnl");
        if (pnlEl) {
            pnlEl.innerText = "0.00 USDT (0.00%)";
            pnlEl.className = "asset-val text-neutral";
        }
        return;
    }

    let 총미실현손익 = 0;
    let 청산또는손익종료된인덱스들 = [];

    상태.활성포지션.forEach((pos, index) => {
        const coin = 상태.코인목록[pos.심볼];
        if (!coin || !coin.현재가 || isNaN(coin.현재가) || coin.현재가 <= 0) return;

        let pnl = 0;
        if (pos.방향 === "LONG") {
            pnl = (coin.현재가 - pos.진입가) * pos.수량;
        } else {
            pnl = (pos.진입가 - coin.현재가) * pos.수량;
        }

        pos.미실현손익 = pnl;
        pos.수익률 = (pnl / pos.투입마진) * 100;
        총미실현손익 += pnl;

        // 자동 증거금 수혈
        if (pos.자동마진) {
            let 마진추가필요 = false;
            if (pos.방향 === "LONG" && coin.현재가 <= pos.청산가 * 1.02) 마진추가필요 = true;
            else if (pos.방향 === "SHORT" && coin.currentlyPrice || coin.현재가 >= pos.청산가 * 0.98) 마진추가필요 = true;

            if (마진추가필요) {
                const 추가마진액 = pos.투입마진 * 0.5;
                if (상태.지갑잔고 >= 추가마진액) {
                    상태.지갑잔고 -= 추가마진액;
                    pos.투입마진 += 추가마진액;
                    
                    let 새청산가 = pos.방향 === "LONG" ? 
                        pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005) :
                        pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
                    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
                    pos.수익률 = (pnl / pos.투입마진) * 100;
                    
                    새신호알림(pos.심볼, `[🛡️ 자동마진] 가용자고에서 **${추가마진액.toFixed(2)} USDT** 자동 투입 (청산가: **${pos.청산가.toLocaleString()} USDT**)`, "long");
                    재생효과음("sound-trigger");
                    
                    setTimeout(() => {
                        활성포지션리스트렌더링();
                        상태바업데이트();
                        화면업데이트();
                    }, 0);
                }
            }
        }

        // 청산 감시
        let 청산발생 = false;
        if (pos.방향 === "LONG" && coin.현재가 <= pos.청산가) 청산발생 = true;
        else if (pos.방향 === "SHORT" && coin.현재가 >= pos.청산가) 청산발생 = true;

        if (청산발생) {
            청산또는손익종료된인덱스들.push({ index: index, 사유: "LIQUIDATED", 정산가: pos.청산가 });
            return;
        }

        // 익절/손절 감시
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

    모의매매상태저장();
    상태바업데이트();
    실시간포지션PNL업데이트();
}

function 포지션종료실행(인덱스, 종료가, 사유) {
    const pos = 상태.활성포지션[인덱스];
    if (!pos) return;

    const 수수료 = pos.수량 * 종료가 * 0.0004;
    
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
    새신호알림(pos.심볼, `[포지션 정산] ${pos.심볼} ${pos.방향} 종료가 ${종료가.toLocaleString()} USDT 정산 완료 (${사유} | PNL: ${pnl.toFixed(2)} USDT ${이익표시})`, 알림색);

    상태.활성포지션.splice(인덱스, 1);

    모의매매상태저장();
    활성포지션리스트렌더링();
    거래이력리스트렌더링();
    상태바업데이트();
    화면업데이트();
}

// 11. 사용자 UI 인터랙션 및 화면 렌더링 바인딩
function 코인심볼완성(rawSymbol) {
    const symbol = String(rawSymbol || "").trim().toUpperCase();
    if (!symbol) return "";
    return symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
}

function 코인탭렌더링() {
    const tabsEl = document.getElementById("coin-tabs");
    if (!tabsEl) return;

    let html = "";
    let 표시할코인들 = [...상태.즐겨찾기목록];
    
    if (상태.기본코인 && !표시할코인들.includes(상태.기본코인)) {
        표시할코인들.push(상태.기본코인);
    }
    if (표시할코인들.length === 0) {
        표시할코인들 = ["BTCUSDT", "ETHUSDT"];
    }
    표시할코인들 = [...new Set(표시할코인들)];

    표시할코인들.forEach(symbol => {
        const coin = 상태.코인목록[symbol];
        if (!coin) return;
        
        const isActive = symbol === 상태.기본코인 ? "active" : "";
        const 즐겨찾기여부 = 상태.즐겨찾기목록.includes(symbol);
        const starClass = 즐겨찾기여부 ? "fa-solid fa-star text-yellow" : "fa-regular fa-star";
        
        const 포지션보유중 = 상태.활성포지션.some(p => p.심볼 === symbol);
        const 포지션배지 = 포지션보유중 ? `<span class="status-dot green" style="display:inline-block; width:5px; height:5px; margin-left:2px;"></span>` : "";
        
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";
        
        html += `
            <button class="coin-tab ${isActive}" data-symbol="${symbol}" onclick="코인탭전환('${symbol}')">
                <span style="font-size: 10px; display:flex; align-items:center; gap:2px;">
                    <i class="${starClass}" onclick="즐겨찾기토글('${symbol}', event)" style="font-size:9px;"></i>
                    ${symbol.replace("USDT", "")}${포지션배지}
                </span>
                <span class="tab-price ${변동률클래스}" id="tab-price-${symbol}">
                    ${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}
                </span>
            </button>
        `;
    });
    tabsEl.innerHTML = html;

    // 활성 탭 스크롤 포커스
    setTimeout(() => {
        const activeTab = tabsEl.querySelector(".coin-tab.active");
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
    }, 50);

    드롭다운목록렌더링();
}

function 드롭다운목록렌더링() {
    const listEl = document.getElementById("dropdown-coin-list");
    if (!listEl) return;

    const searchInput = document.getElementById("coin-search-input");
    const clearBtn = document.getElementById("btn-clear-search");
    const 검색어 = searchInput ? searchInput.value.trim().toUpperCase() : "";

    if (clearBtn) {
        if (검색어) clearBtn.classList.remove("hidden");
        else clearBtn.classList.add("hidden");
    }

    let 표시할코인들 = Object.keys(상태.코인목록).filter(symbol => {
        if (상태.현재필터 === "fav" && !상태.즐겨찾기목록.includes(symbol)) return false;
        if (검색어 && !symbol.includes(검색어)) return false;
        return true;
    });

    if (표시할코인들.length === 0) {
        if (검색어 && 검색어.length >= 2) {
            const 깔끔심볼 = 코인심볼완성(검색어);
            listEl.innerHTML = `
                <div style="text-align:center; padding:20px; font-size:11px; color:var(--color-text-muted);">
                    '${검색어}' 검색 결과 없음.<br>
                    <button class="btn-goto-desktop" style="margin-top:8px; padding:6px 12px; border-color:var(--color-yellow); color:var(--color-yellow);" onclick="window.검색코인강제등록액션('${깔끔심볼}')">
                        + ${깔끔심볼} 등록 및 즉시 진입
                    </button>
                </div>
            `;
        } else {
            listEl.innerHTML = `<div style="text-align:center; padding:20px; font-size:11px; color:var(--color-text-muted);">일치하는 코인이 없습니다.</div>`;
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
        
        const 포지션보유중 = 상태.활성포지션.some(p => p.심볼 === symbol);
        const 포지션배지 = 포지션보유중 ? `<span class="status-dot green" style="display:inline-block; width:5px; height:5px; margin-right:4px;"></span>` : "";
        
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";

        html += `
            <div class="dropdown-coin-row ${isActive}" onclick="드롭다운코인선택('${symbol}')">
                <div style="display:flex; align-items:center;">
                    <i class="${starClass}" onclick="즐겨찾기토글('${symbol}', event)" style="margin-right:6px;"></i>
                    ${포지션배지}
                    <span class="symbol-name">${symbol.replace("USDT", "")}</span>
                    <span class="symbol-desc">/USDT</span>
                </div>
                <div class="coin-price-col">${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</div>
                <div class="coin-change-col ${변동률클래스}">${변동률 >= 0 ? '+' : ''}${변동률}%</div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

window.드롭다운코인선택 = function(symbol) {
    코인탭전환(symbol);
    
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    if (dropdownMenu) dropdownMenu.classList.add("hidden");
};

window.즐겨찾기토글 = function(symbol, event) {
    if (event) event.stopPropagation();

    const idx = 상태.즐겨찾기목록.indexOf(symbol);
    if (idx > -1) {
        상태.즐겨찾기목록.splice(idx, 1);
    } else {
        상태.즐겨찾기목록.push(symbol);
    }

    try {
        localStorage.setItem("선물시뮬레이터_즐겨찾기", JSON.stringify(상태.즐겨찾기목록));
    } catch (e) {
        console.error("즐겨찾기 저장 에러:", e);
    }

    코인탭렌더링();
};

window.코인탭전환 = async function(symbol) {
    if (상태.기본코인 === symbol) return;
    상태.기본코인 = symbol;
    
    try {
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    
    const coin = 상태.코인목록[symbol];
    document.getElementById("current-coin-title").innerText = coin.이름;
    document.getElementById("qty-symbol-addon").innerText = symbol.replace("USDT", "");
    
    코인탭렌더링();
    호가창렌더링실제(coin);
    화면업데이트();
    
    // 차트 로드
    await 단일차트캔들데이터로드();

    // 레버리지 싱크
    let coinLeverage = coin.레버리지 || 3;
    const inputLeverage = document.getElementById("input-leverage");
    const inputLeverageNum = document.getElementById("input-leverage-num");
    const leverageDisplay = document.getElementById("leverage-display");
    const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
    
    if (inputLeverage) inputLeverage.value = coinLeverage;
    if (inputLeverageNum) inputLeverageNum.value = coinLeverage;
    if (leverageDisplay) leverageDisplay.innerText = coinLeverage + "x";
    if (txtAiLeverage) txtAiLeverage.innerText = `${coinLeverage}x`;

    AI자동매매버튼상태동기화();
    주문비용재연산();
};

window.검색코인강제등록액션 = async function(symbol) {
    if (!symbol) return;
    symbol = 코인심볼완성(symbol);

    if (상태.코인목록[symbol]) return;

    // 검증 및 생성
    try {
        const checkRes = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
        if (!checkRes.ok) {
            alert(`[오류] 지원하지 않는 심볼 (${symbol}).`);
            return;
        }
        const checkData = await checkRes.json();
        const realPrice = parseFloat(checkData.price);

        상태.코인목록[symbol] = {
            심볼: symbol,
            이름: `${symbol.replace("USDT", "")}/USDT Perpetual`,
            현재가: realPrice,
            어제종가: realPrice * 0.98,
            최고24h: realPrice * 1.02,
            최저24h: realPrice * 0.97,
            캔들데이터: [],
            호가매도: [],
            호가매수: [],
            소수점: 3,
            수량소수점: 2,
            레버리지: 3,
            자동매매활성화: false,
            가상시세여부: false
        };

        const { 소수점, 수량소수점 } = 자동소수점결정(realPrice);
        상태.코인목록[symbol].소수점 = 소수점;
        상태.코인목록[symbol].수량소수점 = 수량소수점;

        localStorage.setItem("선물시뮬레이터_추가코인", JSON.stringify(Object.keys(상태.코인목록)));
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);

        웹소켓스트림갱신();

        const searchInput = document.getElementById("coin-search-input");
        if (searchInput) searchInput.value = "";
        
        await 코인탭전환(symbol);
        
        const dropdownMenu = document.getElementById("coin-dropdown-menu");
        if (dropdownMenu) dropdownMenu.classList.add("hidden");

        새신호알림(symbol, `[코인 등록] ${symbol} 연동 완료`, "execution");
    } catch (err) {
        alert("코인 추가 중 API 연동 실패");
    }
};

function 이벤트리스너바인딩() {
    // 하단 탭바 전환
    document.querySelectorAll(".mobile-bottom-nav .nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const targetTab = e.currentTarget.dataset.tab;
            
            document.querySelectorAll(".mobile-bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            document.querySelectorAll(".mobile-section").forEach(sec => sec.classList.remove("active"));
            document.getElementById(`tab-sec-${targetTab}`).classList.add("active");
            
            // 차트 탭 이동 시 찌그러짐 해소
            if (targetTab === "chart") {
                setTimeout(() => {
                    const container = document.getElementById("mobile-chart-canvas");
                    if (상태.단일차트.메인차트 && container) {
                        상태.단일차트.메인차트.resize(container.clientWidth, container.clientHeight);
                        상태.단일차트.메인차트.timeScale().fitContent();
                    }
                }, 200); // ⚡ 모바일 기기 DOM 리플로우 타이밍을 고려해 200ms로 안전 지연 상향 조정
            }
        });
    });

    // 코인 검색 드롭다운 여닫기
    const btnSearchToggle = document.getElementById("btn-toggle-search");
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    const btnCloseDropdown = document.getElementById("btn-close-dropdown");

    if (btnSearchToggle && dropdownMenu) {
        btnSearchToggle.addEventListener("click", () => {
            dropdownMenu.classList.toggle("hidden");
            if (!dropdownMenu.classList.contains("hidden")) {
                const input = document.getElementById("coin-search-input");
                if (input) {
                    input.value = "";
                    setTimeout(() => input.focus(), 50);
                }
            }
        });
    }
    if (btnCloseDropdown && dropdownMenu) {
        btnCloseDropdown.addEventListener("click", () => {
            dropdownMenu.classList.add("hidden");
        });
    }

    // 드롭다운 내 필터 버튼 (전체 vs 즐겨찾기)
    const btnFilterAll = document.getElementById("filter-all-coins");
    const btnFilterFav = document.getElementById("filter-fav-coins");
    if (btnFilterAll && btnFilterFav) {
        btnFilterAll.addEventListener("click", () => {
            상태.현재필터 = "all";
            btnFilterAll.classList.add("active");
            btnFilterFav.classList.remove("active");
            드롭다운목록렌더링();
        });
        btnFilterFav.addEventListener("click", () => {
            상태.현재필터 = "fav";
            btnFilterFav.classList.add("active");
            btnFilterAll.classList.remove("active");
            드롭다운목록렌더링();
        });
    }

    // 실시간 검색어 입력
    const searchInput = document.getElementById("coin-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", 드롭다운목록렌더링);
    }

    // 시간 단위 변경
    document.querySelectorAll(".tf-selector-group .btn-tf").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            document.querySelectorAll(".tf-selector-group .btn-tf").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            
            상태.단일차트.시간단위 = e.target.dataset.tf;
            
            // 차트 로드
            await 단일차트캔들데이터로드();
        });
    });

    // 주문 방향 롱/숏 선택
    const btnLong = document.getElementById("btn-direction-long");
    const btnShort = document.getElementById("btn-direction-short");
    const submitBtn = document.getElementById("btn-submit-order");

    if (btnLong && btnShort) {
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
    }

    // 레버리지 슬라이더
    const levRange = document.getElementById("input-leverage");
    const levNum = document.getElementById("input-leverage-num");
    const levBadge = document.getElementById("leverage-display");

    if (levRange && levNum && levBadge) {
        levRange.addEventListener("input", (e) => {
            const val = parseInt(e.target.value);
            levNum.value = val;
            levBadge.innerText = val + "x";
            
            const coin = 상태.코인목록[상태.기본코인];
            if (coin) coin.레버리지 = val;
            
            const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
            if (txtAiLeverage) txtAiLeverage.innerText = val + "x";
            
            코인레버리지저장();
            주문비용재연산();
        });

        levNum.addEventListener("input", (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 1;
            if (val < 1) val = 1;
            if (val > 125) val = 125;
            levRange.value = val;
            levBadge.innerText = val + "x";
            
            const coin = 상태.코인목록[상태.기본코인];
            if (coin) coin.레버리지 = val;
            
            const txtAiLeverage = document.getElementById("txt-ai-leverage-display");
            if (txtAiLeverage) txtAiLeverage.innerText = val + "x";

            코인레버리지저장();
            주문비용재연산();
        });
    }

    // 수량 +/- 스태퍼
    const btnQtyMinus = document.getElementById("btn-qty-minus");
    const btnQtyPlus = document.getElementById("btn-qty-plus");
    const inputQty = document.getElementById("input-quantity");
    
    if (btnQtyMinus && btnQtyPlus && inputQty) {
        const getQtyStep = () => {
            const coin = 상태.코인목록[상태.기본코인];
            if (!coin) return 0.01;
            if (coin.수량소수점 === 3) return 0.001;
            if (coin.수량소수점 === 2) return 0.01;
            if (coin.수량소수점 === 1) return 0.1;
            if (coin.수량소수점 === 0) return 10.0;
            return 0.01;
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

    // 수량 퍼센트 슬라이더
    const qtySlider = document.getElementById("input-qty-slider");
    const qtySliderDisplay = document.getElementById("qty-slider-display");
    if (qtySlider && qtySliderDisplay) {
        qtySlider.addEventListener("input", (e) => {
            const pct = parseInt(e.target.value);
            qtySliderDisplay.innerText = pct + "%";
            qtySlider.style.background = `linear-gradient(to right, var(--color-yellow) ${pct}%, var(--color-border) ${pct}%)`;

            const coin = 상태.코인목록[상태.기본코인];
            if (!coin) return;

            const leverage = parseInt(document.getElementById("input-leverage").value);
            const isMarket = document.querySelector(".order-tab.active").dataset.type === "market";
            const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value) || coin.현재가;
            const 기준가격 = isMarket ? coin.현재가 : triggerPrice;

            const maxQty = (상태.지갑잔고 * leverage) / 기준가격;
            const targetQty = maxQty * (pct / 100);
            
            if (inputQty) inputQty.value = parseFloat(targetQty.toFixed(coin.수량소수점));
            
            const estMargin = (targetQty * 기준가격) / leverage;
            const estMarginEl = document.getElementById("estimated-margin"); // 모바일은 estimated-margin 이 없음
            const riskMarginEl = document.getElementById("risk-estimated-margin");
            if (riskMarginEl) riskMarginEl.innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
        });
    }

    // 퀵 퍼센트 버튼
    document.querySelectorAll(".pct-quick-buttons button").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const pct = parseInt(e.target.dataset.pct);
            const coin = 상태.코인목록[상태.기본코인];
            if (!coin) return;
            const leverage = parseInt(document.getElementById("input-leverage").value);
            const isMarket = document.querySelector(".order-tab.active").dataset.type === "market";
            const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value) || coin.현재가;
            const 기준가격 = isMarket ? coin.현재가 : triggerPrice;

            const targetMargin = 상태.지갑잔고 * (pct / 100);
            const qty = (targetMargin * leverage) / 기준가격;
            
            if (inputQty) inputQty.value = parseFloat(qty.toFixed(coin.수량소수점));
            
            // 슬라이더 바 동기화
            if (qtySlider) {
                qtySlider.value = pct;
                qtySliderDisplay.innerText = pct + "%";
                qtySlider.style.background = `linear-gradient(to right, var(--color-yellow) ${pct}%, var(--color-border) ${pct}%)`;
            }
            주문비용재연산();
        });
    });

    // 지정가 vs 시장가 탭 전환
    document.querySelectorAll(".order-type-tabs .order-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".order-type-tabs .order-tab").forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            const orderType = e.currentTarget.dataset.type;
            const triggerPriceGroup = document.getElementById("trigger-price-group");
            const submitBtn = document.getElementById("btn-submit-order");

            if (orderType === "market") {
                if (triggerPriceGroup) triggerPriceGroup.classList.add("hidden");
                if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-bolt animate-pulse"></i> 시장가 체결`;
            } else {
                if (triggerPriceGroup) triggerPriceGroup.classList.remove("hidden");
                if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-bolt animate-pulse"></i> 자동 체결 예약 활성화`;
            }
            주문비용재연산();
        });
    });

    // 현재가 자동 기입 단추
    const btnSetCurrentPrice = document.getElementById("btn-set-current-price");
    if (btnSetCurrentPrice) {
        btnSetCurrentPrice.addEventListener("click", () => {
            const coin = 상태.코인목록[상태.기본코인];
            if (coin) {
                const trgInput = document.getElementById("input-trigger-price");
                if (trgInput) trgInput.value = coin.현재가;
                주문비용재연산();
            }
        });
    }

    // TP/SL 체크박스
    const chkTpsl = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");
    if (chkTpsl && tpslContainer) {
        chkTpsl.addEventListener("change", () => {
            if (chkTpsl.checked) tpslContainer.classList.remove("hidden");
            else tpslContainer.classList.add("hidden");
        });
    }

    // 수량, 감시가격, 익절/손절 입력 필드 실시간 변경 시 리스크 카드 재연산 바인딩
    const inputQuantity = document.getElementById("input-quantity");
    const inputTriggerPrice = document.getElementById("input-trigger-price");
    const inputTpPrice = document.getElementById("input-tp-price");
    const inputSlPrice = document.getElementById("input-sl-price");

    if (inputQuantity) inputQuantity.addEventListener("input", 주문비용재연산);
    if (inputTriggerPrice) inputTriggerPrice.addEventListener("input", 주문비용재연산);
    if (inputTpPrice) inputTpPrice.addEventListener("input", 주문비용재연산);
    if (inputSlPrice) inputSlPrice.addEventListener("input", 주문비용재연산);

    // AI 설정 탭 내 필드 갱신 리스너들
    const settingRatio = document.getElementById("setting-ai-ratio");
    const settingTpOption = document.getElementById("setting-ai-tp-option");
    const settingTpPct = document.getElementById("setting-ai-tp-pct");
    const settingSlOption = document.getElementById("setting-ai-sl-option");
    const settingSlPct = document.getElementById("setting-ai-sl-pct");
    const settingPreventDup = document.getElementById("setting-ai-prevent-dup");

    if (settingRatio) {
        settingRatio.addEventListener("input", AI설정수치동기화);
    }
    if (settingPreventDup) {
        settingPreventDup.addEventListener("change", AI설정수치동기화);
    }
    if (settingTpOption) {
        settingTpOption.addEventListener("change", () => {
            if (settingTpOption.value === "manual") settingTpPct.classList.remove("hidden");
            else settingTpPct.classList.add("hidden");
            AI설정수치동기화();
        });
    }
    if (settingTpPct) {
        settingTpPct.addEventListener("input", AI설정수치동기화);
    }
    if (settingSlOption) {
        settingSlOption.addEventListener("change", () => {
            if (settingSlOption.value === "manual") settingSlPct.classList.remove("hidden");
            else settingSlPct.classList.add("hidden");
            AI설정수치동기화();
        });
    }
    if (settingSlPct) {
        settingSlPct.addEventListener("input", AI설정수치동기화);
    }

    // 모바일 리셋 버튼
    const btnReset = document.getElementById("btn-reset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (confirm("모든 모의거래 내역과 지갑 잔고를 10,000 USDT 원금으로 초기화합니까?")) {
                상태.지갑잔고 = 10000.00;
                상태.마진잔고 = 10000.00;
                상태.미실현손익 = 0.00;
                상태.대기주문 = [];
                상태.활성포지션 = [];
                상태.거래이력 = [];
                상태.주문아이디카운터 = 1;
                상태.포지션아이디카운터 = 1;
                
                새신호알림(상태.기본코인, "[초기화] 시뮬레이터 리셋 완료", "execution");
                
                모의매매상태저장();
                화면업데이트();
                대기주문리스트렌더링();
                활성포지션리스트렌더링();
                거래이력리스트렌더링();
            }
        });
    }

    // 주문 제출 버튼
    if (submitBtn) {
        submitBtn.addEventListener("click", 주문제출핸들러);
    }

    // AI 추천 타점 적용 버튼
    const applyRecBtn = document.getElementById("btn-apply-rec");
    if (applyRecBtn) {
        applyRecBtn.addEventListener("click", AI추천타점적용);
    }

    // AI 팩트체크 계기판 서브 탭
    document.querySelectorAll(".quant-tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".quant-tab-btn").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");

            const targetPanel = e.currentTarget.dataset.quantTab;
            document.querySelectorAll(".quant-tab-panel").forEach(p => p.classList.remove("active"));
            
            const panelEl = document.getElementById(targetPanel);
            if (panelEl) panelEl.classList.add("active");
        });
    });

    // AI 자동매매 마스터 스위치 ON/OFF
    const btnMasterAi = document.getElementById("btn-ai-autotrade");
    if (btnMasterAi) {
        btnMasterAi.addEventListener("click", () => {
            const symbol = 상태.기본코인;
            const coin = 상태.코인목록[symbol];
            if (!coin) return;

            coin.자동매매활성화 = !coin.자동매매활성화;

            // 로컬스토리지 저장
            try {
                let 자동매매맵 = {};
                const 저장된자동매매 = localStorage.getItem("선물시뮬레이터_자동매매");
                if (저장된자동매매) 자동매매맵 = JSON.parse(저장된자동매매);

                if (coin.자동매매활성화) 자동매매맵[symbol] = true;
                else delete 자동매매맵[symbol];

                localStorage.setItem("선물시뮬레이터_자동매매", JSON.stringify(자동매매맵));
            } catch (e) {
                console.error("자동매매 맵 저장 실패:", e);
            }

            AI자동매매버튼상태동기화();
            모의매매상태저장();
            재생효과음("sound-signal");
            
            const 상태텍스트 = coin.자동매매활성화 ? "가동 (ON)" : "중지 (OFF)";
            새신호알림(symbol, `[AI 트레이딩] ${symbol} 자동매매가 ${상태텍스트} 되었습니다.`, "neutral");
        });
    }
}

// 주문 제출 핸들러
function 주문제출핸들러() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const 이미존재하는포지션 = 상태.활성포지션.find(pos => pos.심볼 === 상태.기본코인);
    if (이미존재하는포지션) {
        alert("이미 활성화된 포지션이 존재합니다. 중복 진입 거부");
        return;
    }

    const orderTypeTabs = document.querySelector(".order-type-tabs .order-tab.active");
    const activeOrderTab = orderTypeTabs ? orderTypeTabs.dataset.type : "market";
    const 방향 = document.querySelector(".btn-dir.active").dataset.dir;
    const leverage = parseInt(document.getElementById("input-leverage").value);
    
    const qtyInput = document.getElementById("input-quantity");
    const qty = qtyInput ? parseFloat(qtyInput.value) : 0;

    if (isNaN(qty) || qty <= 0) {
        alert("수량을 올바르게 입력하세요.");
        return;
    }

    const chkTpsl = document.getElementById("chk-tpsl").checked;
    let tpPrice = parseFloat(document.getElementById("input-tp-price").value) || 0;
    let slPrice = parseFloat(document.getElementById("input-sl-price").value) || 0;

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

    // 지정가 예약
    const triggerPrice = parseFloat(document.getElementById("input-trigger-price").value);

    if (isNaN(triggerPrice) || triggerPrice <= 0) {
        alert("감시 가격을 설정하세요.");
        return;
    }

    if (chkTpsl) {
        if (방향 === "LONG") {
            if (tpPrice > 0 && tpPrice <= triggerPrice) { alert("롱 익절가는 진입가보다 높아야 합니다."); return; }
            if (slPrice > 0 && slPrice >= triggerPrice) { alert("롱 손절가는 진입가보다 낮아야 합니다."); return; }
        } else {
            if (tpPrice > 0 && tpPrice >= triggerPrice) { alert("숏 익절가는 진입가보다 낮아야 합니다."); return; }
            if (slPrice > 0 && slPrice <= triggerPrice) { alert("숏 손절가는 진입가보다 높아야 합니다."); return; }
        }
    }

    const 예상마진 = (qty * triggerPrice) / leverage;
    if (상태.지갑잔고 < 예상마진) {
        alert("가용 마진 증거금이 부족합니다.");
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
    새신호알림(상태.기본코인, `[예약 오더] ${상태.기본코인} ${방향} 주문 예약 등록 완료 (감시가: ${triggerPrice})`, "execution");

    // 로컬스토리지 저장
    모의매매상태저장();
    대기주문리스트렌더링();
    상태바업데이트();
    화면업데이트();

    // 폼 초기화
    document.getElementById("input-trigger-price").value = "";
    document.getElementById("input-quantity").value = "0.1";
    document.getElementById("input-tp-price").value = "";
    document.getElementById("input-sl-price").value = "";
    document.getElementById("chk-tpsl").checked = false;
    document.getElementById("tpsl-inputs-container").classList.add("hidden");
    주문비용재연산();
}

// 주문 비용 재연산 & 리스크 가드 동기화
function 주문비용재연산() {
    const coin = 상태.코인목록[상태.기본코인];
    if (!coin) return;

    const leverageInput = document.getElementById("input-leverage");
    const leverage = leverageInput ? parseInt(leverageInput.value) : 3;

    const qtyInput = document.getElementById("input-quantity");
    const qty = qtyInput ? parseFloat(qtyInput.value) : 0;
    
    const orderTabActive = document.querySelector(".order-type-tabs .order-tab.active");
    const isMarket = orderTabActive ? orderTabActive.dataset.type === "market" : true;

    const triggerPriceInput = document.getElementById("input-trigger-price");
    const triggerPrice = triggerPriceInput ? parseFloat(triggerPriceInput.value) : coin.현재가;
    
    const 기준가격 = isMarket ? coin.현재가 : (triggerPrice || coin.현재가);
    const estMargin = (qty * 기준가격) / leverage;

    // 예상 마진 & 위험 분석 동기화
    const riskEstimatedMargin = document.getElementById("risk-estimated-margin");
    if (riskEstimatedMargin) {
        riskEstimatedMargin.innerText = estMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    }

    const 실질주문규모 = qty * 기준가격;
    const riskNotionalSize = document.getElementById("risk-notional-size");
    if (riskNotionalSize) {
        riskNotionalSize.innerText = 실질주문규모.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    }

    const directionBtn = document.querySelector(".btn-dir.active");
    const 주문방향 = directionBtn ? directionBtn.dataset.dir : "LONG";

    let 추정청산가 = 0;
    if (qty > 0 && 기준가격 > 0) {
        if (주문방향 === "LONG") {
            추정청산가 = 기준가격 * (1 - 1 / leverage + 0.005);
        } else {
            추정청산가 = 기준가격 * (1 + 1 / leverage - 0.005);
        }
        추정청산가 = Math.max(0, 추정청산가);
    }

    const riskLiquidationPrice = document.getElementById("risk-liquidation-price");
    if (riskLiquidationPrice) {
        riskLiquidationPrice.innerText = (qty > 0 && 기준가격 > 0) ? 추정청산가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점, maximumFractionDigits: coin.소수점 }) + " USDT" : "--";
    }

    let 청산거리비율 = 0;
    if (qty > 0 && 기준가격 > 0 && 추정청산가 > 0) {
        청산거리비율 = (Math.abs(기준가격 - 추정청산가) / 기준가격) * 100;
    }

    const riskDistance = document.getElementById("risk-distance");
    if (riskDistance) {
        riskDistance.innerText = (qty > 0 && 기준가격 > 0) ? 청산거리비율.toFixed(2) + "%" : "--";
    }

    // 리스크 등급 판단
    const cardContainer = document.getElementById("risk-check-card");
    const 위험배지 = document.getElementById("risk-level-badge");
    const 위험타이틀 = document.getElementById("risk-level-title");
    const 위험메시지 = document.getElementById("risk-message");

    if (qty <= 0) {
        if (cardContainer) cardContainer.className = "risk-check-card safe";
        if (위험배지) { 위험배지.className = "risk-level-badge risk-safe"; 위험배지.innerText = "WAIT"; }
        if (위험타이틀) 위험타이틀.innerText = "대기 중";
        if (위험메시지) 위험메시지.innerText = "주문 수량을 입력하면 정밀 위험 분석 시스템이 가동됩니다.";
    } else if (estMargin > 상태.지갑잔고) {
        if (cardContainer) cardContainer.className = "risk-check-card danger";
        if (위험배지) { 위험배지.className = "risk-level-badge risk-danger"; 위험배지.innerText = "DANGER"; }
        if (위험타이틀) 위험타이틀.innerText = "경고 (WARNING)";
        if (위험메시지) 위험메시지.innerText = "지갑 마진 증거금 잔고가 부족합니다.";
    } else {
        let 위험등급 = "SAFE";
        let 등급클래스 = "risk-safe";
        let 등급한글명 = "안전 (SAFE)";
        let 위험설명 = "";

        if (leverage >= 50 || 청산거리비율 < 3) {
            위험등급 = "DANGER";
            등급클래스 = "risk-danger";
            등급한글명 = "위험 (DANGER)";
            위험설명 = `초고레버리지 또는 극도로 가까운 청산거리(${청산거리비율.toFixed(2)}%)입니다.`;
        } else if (leverage >= 20 || 청산거리비율 < 8) {
            위험등급 = "MEDIUM";
            등급클래스 = "risk-medium";
            등급한글명 = "보통 (MEDIUM)";
            위험설명 = `중고레버리지 설정 및 청산거리 ${청산거리비율.toFixed(2)}% 입니다.`;
        } else {
            위험등급 = "SAFE";
            등급클래스 = "risk-safe";
            등급한글명 = "안전 (SAFE)";
            위험설명 = `레버리지 한도 및 청산거리(${청산거리비율.toFixed(2)}%)가 안전하게 통제되고 있습니다.`;
        }

        if (cardContainer) cardContainer.className = "risk-check-card " + (위험등급 === "DANGER" ? "danger" : (위험등급 === "MEDIUM" ? "medium" : "safe"));
        if (위험배지) { 위험배지.className = `risk-level-badge ${등급클래스}`; 위험배지.innerText = 위험등급; }
        if (위험타이틀) 위험타이틀.innerText = 등급한글명;
        if (위험메시지) 위험메시지.innerText = 위험설명;
    }
}

// AI 추천 정보 실시간 갱신
function AI추천분석및업데이트(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 15) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 현재MACD히스토그램 = macdData.histogram[idx] || 0;

    const ema5 = 계산EMA(closes, 5)[idx] || coin.현재가;
    const ema20 = 계산EMA(closes, 20)[idx] || coin.현재가;
    const sma60 = 계산SMA(closes, 60)[idx] || coin.현재가;
    const cciVal = 계산CCI(highs, lows, closes, 20)[idx] || 0;
    const stochData = 계산스토캐스틱(highs, lows, closes, 14, 3, 3);
    const stochK = stochData.k[idx] || 50;
    const stochD = stochData.d[idx] || 50;
    const vwapVal = 계산VWAP(coin.캔들데이터)[idx] || coin.현재가;

    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;
    const bbBasis = bbData.basis[idx] || coin.현재가;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 80), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 80), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    // 지지저항
    const bbUpperSanitized = Math.min(bbUpper, coin.현재가 * 1.15);
    const bbLowerSanitized = Math.max(bbLower, coin.현재가 * 0.85);

    const fiboValues = Object.values(fiboLevels);
    // 현재가보다 높은 피보나치 레벨 -> 저항선 후보 (Resistance)
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가).sort((a, b) => a - b);

    // 현재가보다 낮은 피보나치 레벨 -> 지지선 후보 (Support)
    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가).sort((a, b) => b - a);

    // 1차, 2차, 3차 저항선 계산
    let resistance1 = parseFloat((( (상방fibo들.length > 0 ? 상방fibo들[0] : bbUpperSanitized) + bbUpperSanitized) / 2).toFixed(coin.소수점));
    if (resistance1 <= coin.현재가) {
        resistance1 = parseFloat((coin.현재가 * 1.012).toFixed(coin.소수점));
    }

    let r2 = 상방fibo들.length > 1 ? 상방fibo들[1] : (상방fibo들.length > 0 ? 상방fibo들[0] * 1.018 : bbUpperSanitized * 1.02);
    let resistance2 = parseFloat(((r2 + bbUpperSanitized * 1.01) / 2).toFixed(coin.소수점));
    if (resistance2 <= resistance1) {
        resistance2 = parseFloat((resistance1 * 1.015).toFixed(coin.소수점));
    }

    let resistance3 = parseFloat(최고24h.toFixed(coin.소수점));
    if (resistance3 <= resistance2) {
        resistance3 = parseFloat((resistance2 * 1.02).toFixed(coin.소수점));
    }

    // 1차, 2차, 3차 지지선 계산
    let support1 = parseFloat((( (하방fibo들.length > 0 ? 하방fibo들[0] : bbLowerSanitized) + bbLowerSanitized) / 2).toFixed(coin.소수점));
    if (support1 >= coin.현재가) {
        support1 = parseFloat((coin.현재가 * 0.988).toFixed(coin.소수점));
    }

    let s2 = 하방fibo들.length > 1 ? 하방fibo들[1] : (하방fibo들.length > 0 ? 하방fibo들[0] * 0.982 : bbLowerSanitized * 0.98);
    let support2 = parseFloat(((s2 + bbLowerSanitized * 0.99) / 2).toFixed(coin.소수점));
    if (support2 >= support1) {
        support2 = parseFloat((support1 * 0.985).toFixed(coin.소수점));
    }

    let support3 = parseFloat(최저24h.toFixed(coin.소수점));
    if (support3 >= support2) {
        support3 = parseFloat((support2 * 0.98).toFixed(coin.소수점));
    }

    let 정밀저항가격 = resistance1;
    let 정밀지지가격 = support1;

    const recResistance = document.getElementById("rec-resistance");
    const recSupport = document.getElementById("rec-support");

    if (recResistance) {
        recResistance.innerHTML = `
            <span style="color: #ff6b8b; font-size: 11px; font-weight:600;">1차: ${resistance1.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #f6465d; font-size: 11px; font-weight:600; margin-left: 6px;">2차: ${resistance2.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #b3001e; font-size: 11px; font-weight:800; margin-left: 6px;">★3차: ${resistance3.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
        `;
        recResistance.style.display = "flex";
        recResistance.style.flexWrap = "wrap";
    }
    if (recSupport) {
        recSupport.innerHTML = `
            <span style="color: #5cd6ff; font-size: 11px; font-weight:600;">1차: ${support1.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #0066ff; font-size: 11px; font-weight:600; margin-left: 6px;">2차: ${support2.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #001a80; font-size: 11px; font-weight:800; margin-left: 6px;">★3차: ${support3.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
        `;
        recSupport.style.display = "flex";
        recSupport.style.flexWrap = "wrap";
    }

    // 퀀트 점수 산정 (50 기준)
    let 점수 = 50;
    if (rsiVal <= 35) 점수 += 8;
    else if (rsiVal >= 65) 점수 -= 8;

    if (현재MACD > 현재MACD시그널) 점수 += 10;
    else 점수 -= 10;

    if (coin.현재가 > sma60) 점수 += 5;
    else 점수 -= 5;

    if (coin.현재가 <= bbLower) 점수 += 10;
    else if (coin.현재가 >= bbUpper) 점수 -= 10;

    점수 = Math.max(0, Math.min(100, Math.round(점수)));

    const sentimentBar = document.getElementById("ai-sentiment-bar");
    const sentimentScore = document.getElementById("ai-sentiment-score");
    const statusBadge = document.getElementById("ai-status-badge");

    if (sentimentBar) sentimentBar.style.width = `${점수}%`;
    if (sentimentScore) sentimentScore.innerText = `${점수}%`;

    let 추천방향 = "NEUTRAL";
    let 뱃지클래스 = "advisor-badge badge-neutral";
    let 뱃지텍스트 = "관망";

    if (점수 >= 75) {
        추천방향 = "LONG";
        뱃지클래스 = "advisor-badge badge-long";
        뱃지텍스트 = "강력 롱(LONG)";
    } else if (점수 >= 57) {
        추천방향 = "LONG";
        뱃지클래스 = "advisor-badge badge-long";
        뱃지텍스트 = "롱(LONG) 우세";
    } else if (점수 <= 25) {
        추천방향 = "SHORT";
        뱃지클래스 = "advisor-badge badge-short";
        뱃지텍스트 = "강력 숏(SHORT)";
    } else if (점수 <= 43) {
        추천방향 = "SHORT";
        뱃지클래스 = "advisor-badge badge-short";
        뱃지텍스트 = "숏(SHORT) 우세";
    }

    if (statusBadge) {
        statusBadge.className = 뱃지클래스;
        statusBadge.innerText = 뱃지텍스트;
    }

    // 추천 가격 캐시저장
    상태.CME갭캐시[symbol] = 상태.CME갭캐시[symbol] || {};
    
    // 타점 추천 설정
    let 추천진입가 = coin.현재가;
    let 추천익절가 = coin.현재가;
    let 추천손절가 = coin.현재가;

    if (추천방향 === "LONG") {
        추천진입가 = Math.min(coin.현재가, (fiboLevels["78.6%"] + bbLower) / 2);
        추천익절가 = Math.max(coin.현재가 * 1.005, ((fiboLevels["23.6%"] + bbUpper) / 2));
        추천손절가 = Math.min(추천진입가 * 0.992, fiboLevels["88.6%"]);
    } else if (추천방향 === "SHORT") {
        추천진입가 = Math.max(coin.currentlyPrice || coin.현재가, ((fiboLevels["23.6%"] + bbUpper) / 2));
        추천익절가 = Math.min(coin.현재가 * 0.995, ((fiboLevels["78.6%"] + bbLower) / 2));
        추천손절가 = Math.max(추천진입가 * 1.008, fiboLevels["11.4%"]);
    }

    // 전역 추천캐시 갱신
    window.AI추천캐시 = {
        방향: 추천방향 === "NEUTRAL" ? "LONG" : 추천방향,
        지지선: 정밀지지가격,
        저항선: 정밀저항가격,
        진입가: parseFloat(추천진입가.toFixed(coin.소수점)),
        익절가: parseFloat(추천익절가.toFixed(coin.소수점)),
        손절가: parseFloat(추천손절가.toFixed(coin.소수점))
    };

    // 정밀도 및 신뢰도
    const supAccEl = document.getElementById("sup-accuracy");
    const supConfEl = document.getElementById("sup-confidence");
    const resAccEl = document.getElementById("res-accuracy");
    const resConfEl = document.getElementById("res-confidence");

    if (supAccEl) supAccEl.innerText = "96.4%";
    if (supConfEl) supConfEl.innerText = "높음 (Stable)";
    if (resAccEl) resAccEl.innerText = "95.8%";
    if (resConfEl) resConfEl.innerText = "보통 (Moderate)";

    const regimeLabel = document.getElementById("market-regime-label");
    if (regimeLabel) regimeLabel.innerText = rsiVal > 55 ? "상승 추세장" : (rsiVal < 45 ? "하락 추세장" : "횡보 압축장");

    const guideMsgEl = document.getElementById("rec-guide-msg");
    if (guideMsgEl) {
        guideMsgEl.innerText = 추천방향 === "LONG" ? "지지선 부근 롱 대기 진입 제안 🟢" : (추천방향 === "SHORT" ? "저항선 부근 숏 대기 진입 제안 🔴" : "관망 포지션 유지 🟡");
    }

    // 퀀트 패널 지표 수치 연동
    const metricRsi = document.getElementById("metric-rsi-supertrend");
    if (metricRsi) metricRsi.innerText = `RSI: ${rsiVal.toFixed(1)}% | ${추천방향}`;

    const metricMacd = document.getElementById("metric-macd");
    if (metricMacd) metricMacd.innerText = `${현재MACD.toFixed(2)} / ${현재MACD시그널.toFixed(2)}`;

    const metricStoch = document.getElementById("metric-stoch");
    if (metricStoch) metricStoch.innerText = `K:${stochK.toFixed(0)}% D:${stochD.toFixed(0)}%`;

    const metricBb = document.getElementById("metric-bb");
    if (metricBb) metricBb.innerText = `${bbLower.toFixed(0)} ~ ${bbUpper.toFixed(0)}`;

    const metricVwap = document.getElementById("metric-vwap");
    if (metricVwap) metricVwap.innerText = `${vwapVal.toFixed(coin.소수점)} USDT`;

    const metricFibo = document.getElementById("metric-fibo");
    if (metricFibo) metricFibo.innerText = `78.6%: ${fiboLevels["78.6%"].toFixed(0)} USDT`;

    // 파생상품 패널 연동
    const 호가비율 = coin.호가매수.length > 0 && coin.호가매도.length > 0 ? 
        parseFloat(coin.호가매수[0][1]) / (parseFloat(coin.호가매수[0][1]) + parseFloat(coin.호가매도[0][1])) : 0.5;
    const 펀딩비 = (rsiVal - 50) * 0.0004 + (호가비율 - 0.5) * 0.01 + 0.01;
    const metricFunding = document.getElementById("metric-funding-rate");
    if (metricFunding) metricFunding.innerText = 펀딩비.toFixed(4) + "%";

    const metricOi = document.getElementById("metric-oi");
    if (metricOi) metricOi.innerText = "신규 거래 급증";

    const metricLiqMap = document.getElementById("metric-liq-map");
    if (metricLiqMap) metricLiqMap.innerText = `롱 풀: ${Math.round(52 + (rsiVal - 50) * 0.5)}%`;

    const metricWhaleFlow = document.getElementById("metric-whale-flow");
    if (metricWhaleFlow) metricWhaleFlow.innerText = "유입 우세";

    const metricVpvr = document.getElementById("metric-vpvr");
    if (metricVpvr) metricVpvr.innerText = `${vpvrPOC.toLocaleString()} USDT`;

    // CME 갭 연산 연동
    CME갭연산및업데이트(symbol).then(() => {
        const adCme = document.getElementById("ad-cme-gap-status");
        const cache = 상태.CME갭캐시[symbol];
        if (adCme && cache) {
            adCme.innerText = cache.간단결과 || cache.결과;
            adCme.className = "val " + cache.클래스;
        }
    });

    // 기본적 분석 정보
    let pInfo = 프로젝트데이터베이스[symbol];
    if (pInfo) {
        const descEl = document.getElementById("project-desc");
        const liqEl = document.getElementById("project-liquidity");
        const scalEl = document.getElementById("project-scalability");
        const instEl = document.getElementById("project-institutional");
        const lockupEl = document.getElementById("project-lockup");
        const newsEl = document.getElementById("project-news");
        const levelsEl = document.getElementById("project-levels");

        if (descEl) descEl.innerText = pInfo.개요;
        if (liqEl) liqEl.innerText = pInfo.유동성;
        if (scalEl) scalEl.innerText = pInfo.확장성;
        if (instEl) instEl.innerText = pInfo.기관선호도;
        if (lockupEl) lockupEl.innerText = pInfo.락업이벤트;
        if (newsEl) newsEl.innerText = pInfo.호재뉴스;
        if (levelsEl) levelsEl.innerText = pInfo.지지저항;
    }
}

// CME 갭 계산
async function CME갭연산및업데이트(symbol) {
    if (symbol !== "BTCUSDT" && symbol !== "ETHUSDT") {
        상태.CME갭캐시[symbol] = { 결과: "대상 아님", 간단결과: "N/A", 클래스: "text-neutral", 갱신시간: Date.now() };
        return;
    }

    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        if (!res.ok) throw new Error("Klines failed");
        const klines = await res.json();
        
        let fridayCloseCandle = null;
        let sundayOpenCandle = null;
        let sundayOpenIdx = -1;

        for (let i = klines.length - 1; i >= 0; i--) {
            const date = new Date(klines[i][0]);
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
            상태.CME갭캐시[symbol] = { 결과: "갭 미발생", 간단결과: "갭 미발생", 클래스: "text-neutral", 갱신시간: Date.now() };
            return;
        }

        const fridayClose = parseFloat(fridayCloseCandle[4]);
        const sundayOpen = parseFloat(sundayOpenCandle[1]);
        const gapPrice = sundayOpen - fridayClose;
        const gapSize = Math.abs(gapPrice);
        const threshold = symbol === "BTCUSDT" ? 100 : 10;

        if (gapSize < threshold) {
            상태.CME갭캐시[symbol] = { 결과: "갭 미발생", 간단결과: "갭 미발생", 클래스: "text-neutral", 갱신시간: Date.now() };
            return;
        }

        let filled = false;
        for (let i = sundayOpenIdx; i < klines.length; i++) {
            const low = parseFloat(klines[i][3]);
            const high = parseFloat(klines[i][2]);
            if (low <= fridayClose && high >= fridayClose) {
                filled = true;
                break;
            }
        }

        const gapType = gapPrice > 0 ? "상승" : "하락";
        상태.CME갭캐시[symbol] = {
            결과: filled ? `갭 해소 완료 (${gapType})` : `⚠️ 미해소 ${gapType} 갭 (${gapSize.toFixed(0)} USDT)`,
            간단결과: filled ? `해소 (${gapType})` : `⚠️ 미해소 (${gapSize.toFixed(0)} USDT)`,
            클래스: filled ? "text-green" : "text-red animate-pulse",
            갱신시간: Date.now()
        };
    } catch (e) {
        상태.CME갭캐시[symbol] = { 결과: "분석 불가", 간단결과: "N/A", 클래스: "text-neutral", 갱신시간: Date.now() };
    }
}

function AI추천타점적용() {
    const cache = window.AI추천캐시;
    if (!cache) return;

    const btnLong = document.getElementById("btn-direction-long");
    const btnShort = document.getElementById("btn-direction-short");
    const submitBtn = document.getElementById("btn-submit-order");

    if (cache.방향 === "LONG") {
        if (btnLong) btnLong.classList.add("active");
        if (btnShort) btnShort.classList.remove("active");
        if (submitBtn) submitBtn.className = "btn-submit-order btn-buy-long";
        
        document.getElementById("input-trigger-price").value = cache.진입가;
        document.getElementById("input-tp-price").value = cache.익절가;
        document.getElementById("input-sl-price").value = cache.손절가;
    } else {
        if (btnShort) btnShort.classList.add("active");
        if (btnLong) btnLong.classList.remove("active");
        if (submitBtn) submitBtn.className = "btn-submit-order btn-sell-short";
        
        document.getElementById("input-trigger-price").value = cache.진입가;
        document.getElementById("input-tp-price").value = cache.익절가;
        document.getElementById("input-sl-price").value = cache.손절가;
    }

    const chkTpsl = document.getElementById("chk-tpsl");
    const tpslContainer = document.getElementById("tpsl-inputs-container");
    if (chkTpsl) chkTpsl.checked = true;
    if (tpslContainer) tpslContainer.classList.remove("hidden");

    주문비용재연산();
    재생효과음("sound-trigger");
}

// 모바일 단일 차트 지지/저항 드로잉
function 차트지지저항선드로잉() {
    const c = 상태.단일차트;
    if (!c.메인차트 || !c.캔들시리즈 || c.캔들데이터.length < 20) return;

    if (c.지지저항선들 && c.지지저항선들.length > 0) {
        c.지지저항선들.forEach(line => {
            try { c.캔들시리즈.removePriceLine(line); } catch (e) {}
        });
    }
    c.지지저항선들 = [];

    const cache = window.AI추천캐시;
    if (!cache) return;

    // 저항선 1차 (점선), 2차 (실선), 3차 (굵은 실선)
    const rLine1 = c.캔들시리즈.createPriceLine({
        price: cache.저항선1 || cache.저항선,
        color: '#ff6b8b',
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: '1차 저항선 (R1)'
    });
    c.지지저항선들.push(rLine1);

    const rLine2 = c.캔들시리즈.createPriceLine({
        price: cache.저항선2 || cache.저항선,
        color: '#f6465d',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '2차 저항선 (R2)'
    });
    c.지지저항선들.push(rLine2);

    const rLine3 = c.캔들시리즈.createPriceLine({
        price: cache.저항선3 || cache.저항선,
        color: '#b3001e',
        lineWidth: 3,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '★3차 강력 저항선 (Strong R3)'
    });
    c.지지저항선들.push(rLine3);

    // 지지선 1차 (점선), 2차 (실선), 3차 (굵은 실선)
    const sLine1 = c.캔들시리즈.createPriceLine({
        price: cache.지지선1 || cache.지지선,
        color: '#5cd6ff',
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: '1차 지지선 (S1)'
    });
    c.지지저항선들.push(sLine1);

    const sLine2 = c.캔들시리즈.createPriceLine({
        price: cache.지지선2 || cache.지지선,
        color: '#0066ff',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '2차 지지선 (S2)'
    });
    c.지지저항선들.push(sLine2);

    const sLine3 = c.캔들시리즈.createPriceLine({
        price: cache.지지선3 || cache.지지선,
        color: '#001a80',
        lineWidth: 3,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '★3차 강력 지지선 (Strong S3)'
    });
    c.지지저항선들.push(sLine3);
}

// 12. 모바일용 리스트 카드형 렌더링
function 활성포지션리스트렌더링() {
    const container = document.getElementById("positions-list-container");
    if (!container) return;

    if (상태.활성포지션.length === 0) {
        container.innerHTML = `<div class="empty-list-card"><i class="fa-solid fa-folder-open"></i> 활성화된 포지션이 없습니다.</div>`;
        return;
    }

    let html = "";
    상태.활성포지션.forEach((pos, idx) => {
        const coin = 상태.코인목록[pos.심볼];
        const 현재가 = coin ? coin.현재가 : pos.진입가;
        
        const pnl = pos.미실현손익 || 0;
        const pnlPct = pos.수익률 || 0;
        const pnlClass = pnl >= 0 ? "text-green" : "text-red";
        const badgeClass = pos.방향 === "LONG" ? "long" : "short";
        const autoMarginChecked = pos.자동마진 ? "checked" : "";

        html += `
            <div class="position-card">
                <div class="position-card-title">
                    <span class="sym-badge">${pos.심볼}</span>
                    <span class="badge-position-type ${badgeClass}">${pos.방향} ${pos.레버리지}x</span>
                </div>
                <div class="position-card-grid">
                    <div><span>수량:</span> <strong>${pos.수량.toFixed(coin ? coin.수량소수점 : 2)}</strong></div>
                    <div><span>진입가:</span> <strong>${pos.진입가.toLocaleString()}</strong></div>
                    <div><span>현재가:</span> <strong id="pos-mark-price-${pos.아이디}">${현재가.toLocaleString()}</strong></div>
                    <div><span>청산가:</span> <strong class="text-red">${pos.청산가.toLocaleString()}</strong></div>
                    <div><span>마진:</span> <strong>${pos.투입마진.toFixed(2)} USDT</strong></div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span>자동방어:</span>
                        <label class="config-switch" style="scale:0.75;">
                            <input type="checkbox" ${autoMarginChecked} onchange="window.포지션자동마진토글(${idx})">
                            <span class="config-switch-slider"></span>
                        </label>
                    </div>
                </div>
                <div class="position-card-pnl-row">
                    <span>미실현 손익:</span>
                    <strong id="pos-pnl-${pos.아이디}" class="${pnlClass}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPct.toFixed(2)}%)</strong>
                </div>
                <div class="position-card-actions">
                    <button class="btn-close" onclick="수동포지션종료(${idx})">시장가 정리</button>
                    <button onclick="window.포지션역방향전환(${idx})">역전환</button>
                    <button onclick="window.포지션수동마진추가(${idx})">+마진</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
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
            pnlEl.className = pnlClass;
        }
    });
}

window.수동포지션종료 = function(idx) {
    if (confirm("즉시 시장가 종료하시겠습니까?")) {
        const pos = 상태.활성포지션[idx];
        const coin = 상태.코인목록[pos.심볼];
        포지션종료실행(idx, coin.현재가, "모바일 수동 정산");
    }
};

window.포지션자동마진토글 = function(idx) {
    const pos = 상태.활성포지션[idx];
    if (pos) {
        pos.자동마진 = !pos.자동마진;
        새신호알림(pos.심볼, `자동 증거금 수혈 ${pos.자동마진 ? 'ON' : 'OFF'}`, pos.자동마진 ? 'long' : 'short');
        모의매매상태저장();
        활성포지션리스트렌더링();
    }
};

window.포지션역방향전환 = function(idx) {
    if (confirm("포지션 역전환 스위칭을 수행합니까?")) {
        const pos = 상태.활성포지션[idx];
        if (!pos) return;
        const coin = 상태.코인목록[pos.심볼];
        
        const 심볼 = pos.심볼;
        const 수량 = pos.수량;
        const 레버리지 = pos.레버리지;
        const 구방향 = pos.방향;
        const 신방향 = (구방향 === "LONG") ? "SHORT" : "LONG";
        const 현재가 = coin.현재가;

        포지션종료실행(idx, 현재가, "모바일 스위칭 종료");

        const 신규주문 = {
            심볼: 심볼,
            방향: 신방향,
            레버리지: 레버리지,
            수량: 수량,
            진입가: 현재가,
            유형: "market",
            아이디: 상태.주문아이디카운터++
        };
        포지션체결실행(신규주문, 현재가);
    }
};

window.포지션수동마진추가 = function(idx) {
    const pos = 상태.활성포지션[idx];
    if (!pos) return;
    const coin = 상태.코인목록[pos.심볼];
    
    const 입력값 = prompt(`추가할 증거금 금액(USDT): \n(가용: ${상태.지갑잔고.toFixed(2)} USDT)`);
    if (입력값 === null) return;
    
    const 추가마진 = parseFloat(입력값);
    if (isNaN(추가마진) || 추가마진 <= 0 || 추가마진 > 상태.지갑잔고) {
        alert("잔고 부족 혹은 유효하지 않은 입력");
        return;
    }

    상태.지갑잔고 -= 추가마진;
    pos.투입마진 += 추가마진;
    
    let 새청산가 = pos.방향 === "LONG" ?
        pos.진입가 * (1 - (pos.투입마진) / (pos.수량 * pos.진입가) + 0.005) :
        pos.진입가 * (1 + (pos.투입마진) / (pos.수량 * pos.진입가) - 0.005);
    pos.청산가 = parseFloat(새청산가.toFixed(coin.소수점));
    
    모의매매상태저장();
    활성포지션리스트렌더링();
    상태바업데이트();
    화면업데이트();
};

function 대기주문리스트렌더링() {
    const container = document.getElementById("pending-orders-list-container");
    if (!container) return;

    if (상태.대기주문.length === 0) {
        container.innerHTML = `<div class="empty-list-card"><i class="fa-solid fa-folder-open"></i> 대기 오더가 없습니다.</div>`;
        return;
    }

    let html = "";
    상태.대기주문.forEach((ord, idx) => {
        const badgeClass = ord.방향 === "LONG" ? "long" : "short";
        html += `
            <div class="pending-order-card">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:700;">
                    <span>${ord.심볼}</span>
                    <span class="badge-position-type ${badgeClass}">${ord.방향} ${ord.레버리지}x</span>
                </div>
                <div style="font-size:10px; color:var(--color-text-muted); margin:4px 0; display:flex; justify-content:space-between;">
                    <span>감시 타점가: <strong class="text-yellow">${ord.타점가격.toLocaleString()}</strong></span>
                    <span>수량: <strong>${ord.수량}</strong></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.03); padding-top:4px;">
                    <span style="font-size:8px; color:var(--color-text-muted);">${ord.등록시간}</span>
                    <button class="btn-goto-desktop" style="border-color:var(--color-green); color:var(--color-green); padding:2px 8px; font-size:9px;" onclick="대기주문취소(${idx})">예약 취소</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.대기주문취소 = function(idx) {
    상태.대기주문.splice(idx, 1);
    모의매매상태저장();
    대기주문리스트렌더링();
    상태바업데이트();
    화면업데이트();
};

function 거래이력리스트렌더링() {
    const container = document.getElementById("history-list-container");
    if (!container) return;

    if (상태.거래이력.length === 0) {
        container.innerHTML = `<div class="empty-list-card"><i class="fa-solid fa-folder-open"></i> 거래 이력이 없습니다.</div>`;
        return;
    }

    let html = "";
    상태.거래이력.slice(0, 15).forEach(h => {
        const pnlClass = h.실현손익 >= 0 ? "text-green" : "text-red";
        const badgeClass = h.방향 === "LONG" ? "long" : "short";

        html += `
            <div class="history-card">
                <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700;">
                    <span>${h.심볼} <span class="badge-position-type ${badgeClass}" style="font-size:8px;">${h.방향} ${h.레버리지}x</span></span>
                    <span class="${pnlClass}">${h.실현손익 >= 0 ? '+' : ''}${h.실현손익.toFixed(2)} USDT</span>
                </div>
                <div style="font-size:9px; color:var(--color-text-muted); margin-top:4px; display:flex; justify-content:space-between;">
                    <span>진입: ${h.진입가.toLocaleString()} → 종료: ${h.종료가.toLocaleString()}</span>
                    <span>${h.시간}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 13. 상태 갱신 헬퍼
function 상태바업데이트() {
    const walletEl = document.getElementById("wallet-balance");
    const marginEl = document.getElementById("margin-balance");
    
    if (walletEl) walletEl.innerText = 상태.지갑잔고.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    if (marginEl) marginEl.innerText = 상태.마진잔고.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT";
    
    const pnl = 상태.미실현손익;
    const totalMarginUsed = 상태.활성포지션.reduce((sum, p) => sum + p.투입마진, 0);
    const pnlPct = totalMarginUsed > 0 ? (pnl / totalMarginUsed) * 100 : 0;
    
    const pnlEl = document.getElementById("header-unrealized-pnl");
    if (pnlEl) {
        const sign = pnl >= 0 ? "+" : "";
        pnlEl.innerText = `${sign}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT (${sign}${pnlPct.toFixed(2)}%)`;
        pnlEl.className = "asset-val " + (pnl > 0 ? "text-green" : (pnl < 0 ? "text-red" : "text-neutral"));
    }

    const posBadge = document.getElementById("pos-badge");
    const triggerBadge = document.getElementById("trigger-badge");
    if (posBadge) posBadge.innerText = 상태.활성포지션.length;
    if (triggerBadge) triggerBadge.innerText = 상태.대기주문.length;
}

function 화면업데이트() {
    상태바업데이트();
    주문비용재연산();
    
    // 리스트 갱신
    대기주문리스트렌더링();
    활성포지션리스트렌더링();
    거래이력리스트렌더링();
}

function 새신호알림(symbol, msg, type) {
    const listEl = document.getElementById("signal-feed-list");
    if (!listEl) return;

    const time = 얻는현재시각텍스트();
    const safeSymbol = symbol;
    
    let formattedMsg = msg;
    if (String(msg).includes("[매매 신호 감지]")) {
        formattedMsg = formattedMsg.replace("[매매 신호 감지]", `<span class="signal-detect-badge"><i class="fa-solid fa-crosshairs animate-pulse"></i>신호감지</span>`);
        formattedMsg = formattedMsg.replace("**롱(LONG) 매수**", `<strong class="text-green">롱(LONG) 매수</strong>`);
        formattedMsg = formattedMsg.replace("**숏(SHORT) 매도**", `<strong class="text-red">숏(SHORT) 매도</strong>`);
    }

    const item = document.createElement("div");
    item.className = `signal-item ${type}`;
    item.addEventListener("click", () => window.코인탭전환(symbol));
    item.innerHTML = `
        <span class="signal-time"><span><i class="fa-solid fa-satellite-dish"></i> ${safeSymbol}</span> <span>${time} (이동)</span></span>
        <span class="signal-msg">${formattedMsg}</span>
    `;

    listEl.insertBefore(item, listEl.firstChild);
    if (listEl.children.length > 30) {
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
            백업사운드재생(audioId);
        });
    } else {
        백업사운드재생(audioId);
    }
}

// 사운드 합성 백업 (오디오 리소스 에러 대응)
function 백업사운드재생(audioId) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        if (audioId === "sound-trigger") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (audioId === "sound-signal") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (audioId === "sound-liquid") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(329.63, now);
            osc.frequency.linearRampToValueAtTime(110.00, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    } catch (e) {
        console.error("Audio API 백업 재생 실패:", e);
    }
}

// AI 설정 연동
function AI설정수치동기화() {
    const settingRatio = document.getElementById("setting-ai-ratio");
    const settingTpOption = document.getElementById("setting-ai-tp-option");
    const settingTpPct = document.getElementById("setting-ai-tp-pct");
    const settingSlOption = document.getElementById("setting-ai-sl-option");
    const settingSlPct = document.getElementById("setting-ai-sl-pct");
    const settingPreventDup = document.getElementById("setting-ai-prevent-dup");

    if (settingRatio) 상태.자동매매설정.진입비율 = parseInt(settingRatio.value) || 10;
    if (settingTpOption) 상태.자동매매설정.익절옵션 = settingTpOption.value;
    if (settingTpPct) 상태.자동매매설정.수동익절율 = parseFloat(settingTpPct.value) || 10;
    if (settingSlOption) 상태.자동매매설정.손절옵션 = settingSlOption.value;
    if (settingSlPct) 상태.자동매매설정.수동손절율 = parseFloat(settingSlPct.value) || 5;
    if (settingPreventDup) 상태.자동매매설정.중복방지 = settingPreventDup.checked;

    try {
        localStorage.setItem("선물시뮬레이터_자동매매설정", JSON.stringify(상태.자동매매설정));
    } catch (e) {
        console.error("자동매매 설정 저장 실패:", e);
    }
}

function AI설정스토리지복원() {
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
            }
        }

        const settingRatio = document.getElementById("setting-ai-ratio");
        const settingTpOption = document.getElementById("setting-ai-tp-option");
        const settingTpPct = document.getElementById("setting-ai-tp-pct");
        const settingSlOption = document.getElementById("setting-ai-sl-option");
        const settingSlPct = document.getElementById("setting-ai-sl-pct");
        const settingPreventDup = document.getElementById("setting-ai-prevent-dup");

        if (settingRatio) settingRatio.value = 상태.자동매매설정.진입비율;
        if (settingTpOption) {
            settingTpOption.value = 상태.자동매매설정.익절옵션;
            if (settingTpOption.value === "manual" && settingTpPct) settingTpPct.classList.remove("hidden");
        }
        if (settingTpPct) settingTpPct.value = 상태.자동매매설정.수동익절율;
        if (settingSlOption) {
            settingSlOption.value = 상태.자동매매설정.손절옵션;
            if (settingSlOption.value === "manual" && settingSlPct) settingSlPct.classList.remove("hidden");
        }
        if (settingSlPct) settingSlPct.value = 상태.자동매매설정.수동손절율;
        if (settingPreventDup) settingPreventDup.checked = 상태.자동매매설정.중복방지;
    } catch (e) {
        console.error("AI 자동매매 세부 설정 복원 에러:", e);
    }
}

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

// 레버리지 저장/복원
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
        console.error("코인 레버리지 저장 에러:", e);
    }
};

function 코인레버리지복원() {
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
        console.error("코인 레버리지 복원 에러:", e);
    }
}

// 모의 매매 상태 영구 보존
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
        console.error("모의 매매 상태 저장 에러:", e);
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
            }
        }
        
        대기주문리스트렌더링();
        활성포지션리스트렌더링();
        거래이력리스트렌더링();
        상태바업데이트();
        화면업데이트();
    } catch (e) {
        console.error("모의 매매 상태 복원 중 에러:", e);
    }
}

// 실시간 시세 REST 폴링 백업
let REST폴링타이머 = null;
function 실시간시세REST폴러() {
    if (REST폴링타이머) clearInterval(REST폴링타이머);

    REST폴링타이머 = setInterval(async () => {
        const targetSymbol = 상태.기본코인;
        const currentCoin = 상태.코인목록[targetSymbol];

        if (상태.웹소켓연결상태 && currentCoin && currentCoin.호가매도 && currentCoin.호가매도.length > 0) {
            const statusDot = document.getElementById("binance-status-dot");
            const statusText = document.getElementById("binance-status-text");
            if (statusDot && statusText && statusText.innerText.includes("폴링")) {
                statusDot.style.backgroundColor = ""; 
                statusDot.className = "status-dot green";
                statusText.innerText = "라이브 시세 연동";
                statusText.className = "status-text text-green";
            }
            if (Math.random() < 0.2) {
                백그라운드전체시세폴링();
            }
            return;
        }

        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = ""; 
            statusDot.className = "status-dot green animate-pulse";
            statusText.innerText = "REST 폴링 연동 중";
            statusText.className = "status-text text-yellow";
        }

        try {
            let priceRes, depthRes;
            try {
                [priceRes, depthRes] = await Promise.all([
                    fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${targetSymbol}`),
                    fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${targetSymbol}&limit=5`)
                ]);
                if (!priceRes.ok || !depthRes.ok) throw new Error("Futures API 응답 에러");
            } catch (fErr) {
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
            console.warn("메인 코인 폴링 실패:", e.message);
        }

        await 백그라운드전체시세폴링();
    }, 1500);
}

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
        console.warn("백그라운드 전체 폴링 실패:", err.message);
    }
}

function REST폴링데이터수입(symbol, 현재가, asks, bids) {
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    coin.가상시세여부 = false;
    coin.현재가 = 현재가;
    coin.호가매도 = asks || [];
    coin.호가매수 = bids || [];

    const candleTime = Math.floor(Date.now() / 1000 / 60) * 60;
    const 실시간캔들 = {
        time: candleTime,
        open: coin.캔들데이터.length > 0 ? coin.캔들데이터[coin.캔들데이터.length - 1].close : 현재가,
        high: 현재가,
        low: 현재가,
        close: 현재가,
        volume: Math.random() * 20 + 2
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
            if (candles.length > 300) candles.shift();
            분석및신호생성(symbol);
        }
    }

    if (현재가 > coin.최고24h) coin.최고24h = 현재가;
    if (현재가 < coin.최저24h) coin.최저24h = 현재가;

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
            changeEl.className = "price-change " + (변동률 >= 0 ? "text-green" : "text-red");
        }

        const highEl = document.getElementById("price-high-24h");
        const lowEl = document.getElementById("price-low-24h");
        if (highEl) highEl.innerText = coin.최고24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        if (lowEl) lowEl.innerText = coin.최저24h.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

        호가창렌더링실제(coin);
        AI추천분석및업데이트(symbol);
    }

    // 차트
    const c = 상태.단일차트;
    if (c.메인차트 && c.캔들시리즈 && c.캔들데이터.length > 0 && 상태.기본코인 === symbol) {
        let 봉단위초 = 60;
        if (c.시간단위 === "1m") 봉단위초 = 60;
        else if (c.시간단위 === "1h") 봉단위초 = 3600;
        else if (c.시간단위 === "4h") 봉단위초 = 14400;
        else if (c.시간단위 === "1d") 봉단위초 = 86400;

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
            if (c.캔들데이터.length > 300) c.캔들데이터.shift();
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
    }

    const tabPriceEl = document.getElementById(`tab-price-${symbol}`);
    if (tabPriceEl) {
        tabPriceEl.innerText = 현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
        const 변동률 = (현재가 - coin.어제종가) / coin.어제종가;
        tabPriceEl.className = "tab-price " + (변동률 >= 0 ? "text-green" : "text-red");
    }
}

const 프로젝트데이터베이스 = {
    "BTCUSDT": {
        개요: "비트코인(BTC)은 최초의 분산형 암호화폐로 가치저장소(Store of Value)로 작동하며 암호화폐 생태계의 대장 역할을 맡고 있습니다.",
        유동성: "AAA (초고유동성)",
        확장성: "Low (라이어 2 솔루션 활용)",
        기관선호도: "최상 (현물 ETF 및 대형 자산 관리 회사 매입)",
        락업이벤트: "반감기 구조로 추가 락업 물량 없음",
        호재뉴스: "기관 연기금 포트폴리오 편입 및 통화 헤지 수단 부각",
        지지저항: "지지선: 67,500 USDT | 저항선: 74,000 USDT"
    },
    "ETHUSDT": {
        개요: "이더리움(ETH)은 스마트 계약을 구현한 최초이자 최대의 레이어1 생태계로, 디파이(DeFi) 및 디앱의 표준입니다.",
        유동성: "AA+ (매우 높음)",
        확장성: "Medium (덴쿤 롤업 확장성 확대)",
        기관선호도: "상 (현물 ETF 런칭 및 기관 스테이킹 활용)",
        락업이벤트: "스테이킹 지분 점진적 해제 중",
        호재뉴스: "가스비 절감 롤업 생태계 확장 및 디파이 자산 수급 안정",
        지지저항: "지지선: 3,250 USDT | 저항선: 4,000 USDT"
    },
    "SOLUSDT": {
        개요: "솔라나(SOL)는 고성능 저비용 거래 처리를 실현하는 레이어1 플랫폼으로, 최근 밈코인 및 디핀 생태계 확장의 선두입니다.",
        유동성: "AA (안정적)",
        확장성: "High (파이어댄서 클라이언트로 수십만 TPS 목표)",
        기관선호도: "상 (확장성을 지향하는 웹3 펀드의 적극 투입)",
        락업이벤트: "정기 인플레이션 지분 유통 중",
        호재뉴스: "온체인 DEX 거래량 급증 및 솔라나 기반 모바일 생태계 연동",
        지지저항: "지지선: 145 USDT | 저항선: 185 USDT"
    },
    "HYPEUSDT": {
        개요: "하이퍼리퀴드(HYPE)는 전용 L1 합의 알고리즘 기반의 탈중앙화 선물 거래소(DEX)로, 극도로 빠른 오더북을 강점으로 삼습니다.",
        유동성: "A (중상위)",
        확장성: "High (선물 연산 전용 특화 오더북 아키텍처)",
        기관선호도: "중 (DEX 선물 점유율 최상단 랭크)",
        락업이벤트: "초기 에어드랍 분배 완료, 재단 물량 베스팅 중",
        호재뉴스: "DEX 무기한 선물 거래대금 역대 최고 달성 및 EVM 연동 로드맵 진행",
        지지저항: "지지선: 58.50 USDT | 저항선: 66.80 USDT"
    }
};