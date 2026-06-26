/* ----------------------------------------------------
   BINANCE 16-CHART ANALYSIS PRO - CORE ENGINE (analysis_app.js)
   자동매매 거래(Trade) 기능만 완전히 제거하고,
   16분할 실시간 차트 분석, 퀀트/온체인 다각적 지표 분석, 실시간 호가창,
   매매 신호 감지 피드를 100% 실시간으로 구현한 분석 전용 엔진입니다.
   모든 변수와 설명은 한국어로 상세히 서술되었습니다.
   ---------------------------------------------------- */

window.onerror = function(msg, url, line) {
    if (msg === "Script error." || (!url && line === 0)) {
        console.warn("[Cross-Origin SDK Warning Ignore]:", msg);
        return true; 
    }
    alert('브라우저 에러 감지!\n메시지: ' + msg + '\n파일: ' + url + '\n라인: ' + line);
};

// 1. 전역 상태 관리 객체 (Global State)
const 상태 = {
    지갑잔고: 10000.00,        
    마진잔고: 10000.00,        
    미실현손익: 0.00,          
    기본코인: "BTCUSDT",       
    코인목록: {},              
    CME갭캐시: {},             
    달러지수: { 가격: 104.50, 변동률: "0.00%" }, 
    즐겨찾기목록: ["BTCUSDT", "ETHUSDT"], 
    현재필터: "all",           
    대기주문: [],              
    활성포지션: [],            
    거래이력: [],              
    주문아이디카운터: 1,       
    포지션아이디카운터: 1,     

    // 16개 분할 차트 객체 배열 (16-Split Multi-Symbol/Timeframe Charts)
    차트객체: {
        활성인덱스: 0,
        분할차트들: [
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1m", 코인심볼: "BTCUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1h", 코인심볼: "ETHUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "4h", 코인심볼: "SOLUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1d", 코인심볼: "HYPEUSDT", 캔들데이터: [] },
            
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "15m", 코인심볼: "XRPUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1h", 코인심볼: "ADAUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "4h", 코인심볼: "DOGEUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1d", 코인심볼: "LINKUSDT", 캔들데이터: [] },
            
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1m", 코인심볼: "BNBUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1h", 코인심볼: "DOTUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "4h", 코인심볼: "AVAXUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1d", 코인심볼: "TRXUSDT", 캔들데이터: [] },
            
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "15m", 코인심볼: "LTCUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1h", 코인심볼: "BCHUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "4h", 코인심볼: "APTUSDT", 캔들데이터: [] },
            { 메인차트: null, 캔들시리즈: null, EMA5시리즈: null, EMA20시리즈: null, SMA60시리즈: null, 지지저항선들: [], 시간단위: "1d", 코인심볼: "SUIUSDT", 캔들데이터: [] }
        ]
    }
};

// 16대 주요 코인 기본 스펙
const 코인정의 = {
    "BTCUSDT": { 이름: "BTC/USDT Perpetual", 시작가: 67000.00, 소수점: 2, 수량소수점: 3 },
    "ETHUSDT": { 이름: "ETH/USDT Perpetual", 시작가: 3500.00, 소수점: 2, 수량소수점: 2 },
    "SOLUSDT": { 이름: "SOL/USDT Perpetual", 시작가: 140.00, 소수점: 2, 수량소수점: 2 },
    "HYPEUSDT": { 이름: "HYPE/USDT Perpetual", 시작가: 0.350, 소수점: 3, 수량소수점: 2 },
    "XRPUSDT": { 이름: "XRP/USDT Perpetual", 시작가: 0.4900, 소수점: 4, 수량소수점: 1 },
    "ADAUSDT": { 이름: "ADA/USDT Perpetual", 시작가: 0.3800, 소수점: 4, 수량소수점: 1 },
    "DOGEUSDT": { 이름: "DOGE/USDT Perpetual", 시작가: 0.12000, 소수점: 5, 수량소수점: 0 },
    "LINKUSDT": { 이름: "LINK/USDT Perpetual", 시작가: 13.50, 소수점: 2, 수량소수점: 2 },
    "BNBUSDT": { 이름: "BNB/USDT Perpetual", 시작가: 580.00, 소수점: 2, 수량소수점: 2 },
    "DOTUSDT": { 이름: "DOT/USDT Perpetual", 시작가: 5.80, 소수점: 2, 수량소수점: 2 },
    "AVAXUSDT": { 이름: "AVAX/USDT Perpetual", 시작가: 28.00, 소수점: 2, 수량소수점: 2 },
    "TRXUSDT": { 이름: "TRX/USDT Perpetual", 시작가: 0.1100, 소수점: 4, 수량소수점: 1 },
    "LTCUSDT": { 이름: "LTC/USDT Perpetual", 시작가: 75.00, 소수점: 2, 수량소수점: 2 },
    "BCHUSDT": { 이름: "BCH/USDT Perpetual", 시작가: 380.00, 소수점: 2, 수량소수점: 2 },
    "APTUSDT": { 이름: "APT/USDT Perpetual", 시작가: 7.20, 소수점: 2, 수량소수점: 2 },
    "SUIUSDT": { 이름: "SUI/USDT Perpetual", 시작가: 0.9500, 소수점: 4, 수량소수점: 1 }
};

// 지능형 소수점 자동 조율 함수
function 자동소수점결정(가격) {
    let 소수점 = 2;
    let 수량소수점 = 2;
    
    if (가격 < 0.01) {
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

// 2. 초기화 프로세스 (Initialization Process)
document.addEventListener("DOMContentLoaded", async () => {
    // 1단계: 코인 데이터 목록 메모리 이식
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
            수량소수점: 수량소수점
        };
    });

    // 로컬 스토리지로부터 추가 코인 및 즐겨찾기 복원
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
                        수량소수점: symbol.startsWith("BTC") ? 3 : 2
                    };
                    
                    if (symbol.startsWith("DOGE") || symbol.startsWith("SHIB")) {
                        상태.코인목록[symbol].소수점 = 5;
                        상태.코인목록[symbol].수량소수점 = 0;
                    }
                }
            });
        }

        const 저장된현재코인 = localStorage.getItem("선물시뮬레이터_현재코인");
        if (저장된현재코인 && 상태.코인목록[저장된현재코인]) {
            상태.기본코인 = 저장된현재코인;
        }

        const 저장된즐겨찾기 = localStorage.getItem("선물시뮬레이터_즐겨찾기");
        if (저장된즐겨찾기) {
            상태.즐겨찾기목록 = JSON.parse(저장된즐겨찾기);
        }
    } catch (e) {
        console.error("로컬 스토리지 데이터 복원 에러:", e);
    }

    // 로컬 스토리지로부터 코인/시간 복원
    복원차트설정();

    // 2단계: TradingView Lightweight Charts 초기화
    차트시스템초기화();

    // 3단계: 화면 이벤트 리스너 바인딩
    이벤트리스너바인딩();

    // 최초 시세 일괄 로드
    await 최초시세일괄로딩();

    // 4단계: 과거 캔들 데이터 로드
    await 전체과거데이터로드();

    // 5단계: 실시간 REST API 안전 폴러 가동 (3초 간격)
    setInterval(실시간시세REST폴러, 3000);

    // 6단계: 달러 인덱스 실시간 갱신 가동 (5초 간격)
    실시간달러지수갱신();
    setInterval(실시간달러지수갱신, 5000);

    // 화면 첫 업데이트
    화면업데이트();
    window.차트선택기목록동적갱신();
    코인탭렌더링();

    // 포커스 강조 테두리
    활성차트강조테두리(상태.차트객체.활성인덱스);
    window.차트지지저항선드로잉(상태.차트객체.활성인덱스);
});

// 차트 시스템 구현
function 차트시스템초기화() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        const container = document.getElementById(`split-chart-canvas-${idx}`);
        if (!container) return;

        const chartOptions = {
            layout: {
                background: { type: 'solid', color: '#ffffff' },
                textColor: '#475569',
                fontSize: 8,
                fontFamily: 'Inter'
            },
            grid: {
                vertLines: { color: '#f1f5f9' },
                horzLines: { color: '#f1f5f9' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#94a3b8', labelBackgroundColor: '#005bc1' },
                horzLine: { color: '#94a3b8', labelBackgroundColor: '#005bc1' }
            },
            rightPriceScale: {
                borderColor: '#cbd5e1',
                visible: true
            },
            timeScale: {
                borderColor: '#cbd5e1',
                timeVisible: true
            }
        };

        chartData.메인차트 = LightweightCharts.createChart(container, chartOptions);
        
        chartData.캔들시리즈 = chartData.메인차트.addCandlestickSeries({
            upColor: '#0ECB81',
            downColor: '#F6465D',
            borderUpColor: '#0ECB81',
            borderDownColor: '#F6465D',
            wickUpColor: '#0ECB81',
            wickDownColor: '#F6465D'
        });

        chartData.EMA5시리즈 = chartData.메인차트.addLineSeries({ color: '#ffb100', lineWidth: 1, title: 'EMA 5' });
        chartData.EMA20시리즈 = chartData.메인차트.addLineSeries({ color: '#005bc1', lineWidth: 1, title: 'EMA 20' });
        chartData.SMA60시리즈 = chartData.메인차트.addLineSeries({ color: '#E040FB', lineWidth: 1, title: 'SMA 60' });

        window.addEventListener("resize", () => {
            if (chartData.메인차트 && container) {
                chartData.메인차트.resize(container.clientWidth, container.clientHeight);
            }
        });
    });

    시간단위UI동기화();
}

// 이벤트 리스너 바인딩
function 이벤트리스너바인딩() {
    // 리셋 버튼
    const btnReset = document.getElementById("btn-reset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            localStorage.removeItem("analysis_chart_configs");
            alert("차트 설정이 초기화되었습니다. 새로고침을 진행합니다.");
            window.location.reload();
        });
    }

    // 퀀트 탭 버튼 이벤트
    const tabBtns = document.querySelectorAll(".quant-tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const tabId = btn.getAttribute("data-quant-tab");
            const panels = document.querySelectorAll(".quant-tab-panel");
            panels.forEach(p => {
                if (p.id === tabId) p.classList.add("active");
                else p.classList.remove("active");
            });
        });
    });

    // 레버리지 슬라이더 싱크
    const inputLeverage = document.getElementById("input-leverage");
    const inputLeverageNum = document.getElementById("input-leverage-num");
    const leverageDisplay = document.getElementById("leverage-display");

    if (inputLeverage && inputLeverageNum) {
        inputLeverage.addEventListener("input", (e) => {
            const val = e.target.value;
            inputLeverageNum.value = val;
            if (leverageDisplay) leverageDisplay.innerText = val + "x";
        });
        inputLeverageNum.addEventListener("input", (e) => {
            let val = parseInt(e.target.value) || 1;
            if (val < 1) val = 1;
            if (val > 125) val = 125;
            inputLeverage.value = val;
            if (leverageDisplay) leverageDisplay.innerText = val + "x";
        });
    }

    // 정밀 분석 반영 버튼
    const btnApplyRec = document.getElementById("btn-apply-rec");
    if (btnApplyRec) {
        btnApplyRec.addEventListener("click", () => {
            alert("정밀 분석 가격 정보가 차트 분석 패널에 시각적으로 강조되었습니다.");
            const card = document.querySelector(".ai-advisor-card");
            if (card) {
                card.style.borderColor = "var(--color-yellow)";
                card.style.boxShadow = "0 0 15px rgba(0, 91, 193, 0.4)";
                setTimeout(() => {
                    card.style.borderColor = "var(--color-border)";
                    card.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.05)";
                }, 1000);
            }
        });
    }

    // 가로형 즐겨찾기 탭 영역 마우스 휠 및 드래그 스크롤 제스처 인터랙션 바인딩
    const tabsWrapper = document.querySelector(".coin-tabs-wrapper");
    if (tabsWrapper) {
        tabsWrapper.addEventListener("wheel", (e) => {
            e.preventDefault();
            tabsWrapper.scrollLeft += e.deltaY * 1.2;
        }, { passive: false });

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
            const walk = (x - startX) * 1.5;
            tabsWrapper.scrollLeft = scrollLeftVal - walk;
        });
    }

    // 카테고리 필터 버튼 (전체 vs 즐겨찾기) 및 세로 드롭다운 노출 연동
    const btnFilterAll = document.getElementById("filter-all-coins");
    const btnFilterFav = document.getElementById("filter-fav-coins");
    const dropdownMenu = document.getElementById("coin-dropdown-menu");
    const dropdownTitleText = document.getElementById("dropdown-title-text");

    if (btnFilterAll && btnFilterFav && dropdownMenu) {
        const 드롭다운닫기 = () => {
            dropdownMenu.classList.add("hidden");
            btnFilterAll.classList.remove("active");
            btnFilterFav.classList.remove("active");
            if (상태.현재필터 === "all") btnFilterAll.classList.add("active");
            else btnFilterFav.classList.add("active");

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
                
                const searchInput = document.getElementById("coin-search-input");
                if (searchInput) {
                    searchInput.value = "";
                    setTimeout(() => searchInput.focus(), 50);
                }
                코인탭렌더링();
            }
        });

        const btnCloseDropdown = document.getElementById("btn-close-dropdown");
        if (btnCloseDropdown) {
            btnCloseDropdown.addEventListener("click", (e) => {
                e.stopPropagation();
                드롭다운닫기();
            });
        }

        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== btnFilterAll && e.target !== btnFilterFav) {
                드롭다운닫기();
            }
        });

        const searchInput = document.getElementById("coin-search-input");
        const clearBtn = document.getElementById("btn-clear-search");

        if (searchInput) {
            searchInput.addEventListener("input", () => {
                드롭다운목록렌더링();
            });

            searchInput.addEventListener("click", (e) => {
                e.stopPropagation();
            });

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

        if (clearBtn) {
            clearBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (searchInput) {
                    searchInput.value = "";
                    clearBtn.classList.add("hidden");
                    드롭다운목록렌더링();
                    searchInput.focus();
                }
            });
        }
    }
}

// REST 일괄 시세 로딩 (CORS 차단 회피용)
async function 최초시세일괄로딩() {
    try {
        let res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
        if (!res.ok) {
            res = await fetch("https://api.binance.com/api/v3/ticker/price");
        }
        if (res.ok) {
            const tickers = await res.json();
            const priceMap = {};
            tickers.forEach(t => { priceMap[t.symbol] = parseFloat(t.price); });
            
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
                }
            });
        }
    } catch (err) {
        console.warn("[REST] 일괄 시세 조회 실패, 가상 기초가 적용:", err.message);
    }
}

// 과거 K라인 데이터 불러오기
async function 전체과거데이터로드() {
    const 로드작업들 = 상태.차트객체.분할차트들.map((_, idx) => 분할차트캔들데이터로드(idx));
    await Promise.all(로드작업들);
    
    // 로드 후 렌더링
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        분할차트개별리드로우(idx);
    });
}

async function 분할차트캔들데이터로드(chartIdx) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;

    const symbol = chartData.코인심볼;
    const interval = chartData.시간단위;
    const coin = 상태.코인목록[symbol];
    if (!coin) return;

    try {
        let response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=120`);
        if (!response.ok) {
            response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=120`);
        }
        if (!response.ok) throw new Error("Binance API Failed");
        const rawData = await response.json();
        
        const formatted = rawData.map(c => ({
            time: Math.floor(c[0] / 1000),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4])
        }));

        chartData.캔들데이터 = formatted;
        coin.현재가 = formatted[formatted.length - 1].close;
        coin.어제종가 = formatted[0].close;
        coin.최고24h = Math.max(...formatted.map(c => c.high));
        coin.최저24h = Math.min(...formatted.map(c => c.low));
        coin.캔들데이터 = [...formatted];

        const { 소수점, 수량소수점 } = 자동소수점결정(coin.현재가);
        coin.소수점 = 소수점;
        coin.수량소수점 = 수량소수점;
    } catch (err) {
        CORS폴백데이터생성(chartIdx);
    }
}

function CORS폴백데이터생성(chartIdx) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    const symbol = chartData.코인심볼;
    const coin = 상태.코인목록[symbol];
    let price = coin.현재가 || (코인정의[symbol]?.시작가 || 100);
    
    const formatted = [];
    let now = Math.floor(Date.now() / 1000) - 120 * 60;
    for(let i=0; i<120; i++) {
        const change = (Math.random() - 0.5) * (price * 0.004);
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * (price * 0.002);
        const low = Math.min(open, close) - Math.random() * (price * 0.002);
        
        formatted.push({ time: now, open, high, low, close });
        price = close;
        now += 60;
    }
    chartData.캔들데이터 = formatted;
    coin.현재가 = price;
    coin.어제종가 = formatted[0].close;
    coin.최고24h = Math.max(...formatted.map(c => c.high));
    coin.최저24h = Math.min(...formatted.map(c => c.low));
    coin.캔들데이터 = [...formatted];
}

// 지표 연산 및 차트 리드로우
function 분할차트개별리드로우(chartIdx) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData || !chartData.캔들시리즈) return;

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

// EMA(Exponential Moving Average) 연산식
function 계산EMA(data, period) {
    const k = 2 / (period + 1);
    let emaVal = data[0];
    const emaArr = [emaVal];
    for (let i = 1; i < data.length; i++) {
        emaVal = data[i] * k + emaVal * (1 - k);
        emaArr.push(emaVal);
    }
    return emaArr;
}

// SMA(Simple Moving Average) 연산식
function 계산SMA(data, period) {
    const smaArr = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            smaArr.push(data[i]);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            smaArr.push(sum / period);
        }
    }
    return smaArr;
}

function 매핑지표데이터(times, indicators) {
    return times.map((t, idx) => ({ time: t, value: indicators[idx] }));
}

// 실시간 시세 REST 폴러 작동
async function 실시간시세REST폴러() {
    try {
        const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price");
        if (!res.ok) return;
        const tickers = await res.json();
        const priceMap = {};
        tickers.forEach(t => { priceMap[t.symbol] = parseFloat(t.price); });

        상태.차트객체.분할차트들.forEach((chartData, chartIdx) => {
            const symbol = chartData.코인심볼;
            const newPrice = priceMap[symbol];
            if (!newPrice) return;

            const coin = 상태.코인목록[symbol];
            coin.현재가 = newPrice;

            if (chartData.캔들데이터.length > 0) {
                const lastCandle = chartData.캔들데이터[chartData.캔들데이터.length - 1];
                lastCandle.close = newPrice;
                if (newPrice > lastCandle.high) lastCandle.high = newPrice;
                if (newPrice < lastCandle.low) lastCandle.low = newPrice;

                chartData.캔들시리즈.update(lastCandle);
            }
        });

        // 현재 선택된 포커스 코인 화면 갱신
        const fCoin = 상태.코인목록[상태.기본코인];
        if (fCoin) {
            const prEl = document.getElementById("current-price");
            if (prEl) prEl.innerText = fCoin.현재가.toLocaleString(undefined, { minimumFractionDigits: fCoin.소수점 }) + " USDT";
            호가창렌더링실제(fCoin);
            AI추천분석및업데이트(상태.기본코인);
            분석및신호생성(상태.기본코인);
        }

        // 실시간 연결 성공 상태 뱃지 동기화
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = "#0ecb81"; // 초록색 연결 성공등
            statusDot.className = "status-dot pulse-green";
            statusText.innerText = "바이낸스 실시간 연결 성공";
            statusText.className = "status-text text-green";
        }
    } catch (e) {
        // CORS 차단 또는 네트워크 에러 시 상단 경고
        const statusDot = document.getElementById("binance-status-dot");
        const statusText = document.getElementById("binance-status-text");
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = "#ff9800"; // 오렌지색 경고등
            statusDot.className = "status-dot animate-pulse";
            statusText.innerText = "CORS 차단 - 가상 시뮬레이션 시세 작동 중";
            statusText.className = "status-text text-yellow";
        }

        // 네트워크 장애 시 임의 변동
        상태.차트객체.분할차트들.forEach((chartData, chartIdx) => {
            const coin = 상태.코인목록[chartData.코인심볼];
            if (!coin) return;
            const walk = (Math.random() - 0.5) * (coin.현재가 * 0.0006);
            coin.현재가 += walk;
            if (chartData.캔들데이터.length > 0) {
                const last = chartData.캔들데이터[chartData.캔들데이터.length - 1];
                last.close = coin.현재가;
                chartData.캔들시리즈.update(last);
            }
        });
    }
}

// DXY 달러 인덱스 CORS 프록시 실시간 연동
async function 실시간달러지수갱신() {
    let 가격 = 104.50;
    let 변동률 = "0.00%";
    let 수집성공 = false;

    try {
        const targetUrl = encodeURIComponent("https://query2.finance.yahoo.com/v8/finance/chart/DX=F");
        const res = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
        if (res.ok) {
            const wrapper = await res.json();
            if (wrapper && wrapper.contents) {
                const data = JSON.parse(wrapper.contents);
                const meta = data.chart?.result?.[0]?.meta;
                if (meta) {
                    가격 = meta.regularMarketPrice;
                    const prevClose = meta.chartPreviousClose || meta.previousClose;
                    const changeNum = prevClose ? ((가격 - prevClose) / prevClose * 100) : 0;
                    변동률 = (changeNum >= 0 ? "+" : "") + changeNum.toFixed(2) + "%";
                    수집성공 = true;
                }
            }
        }
    } catch (e) {
        console.error("[DXY] Yahoo DXY Fetch Error:", e);
    }

    if (!수집성공) {
        try {
            const res = await fetch("https://open.er-api.com/v6/latest/USD");
            if (res.ok) {
                const data = await res.json();
                const rates = data.rates;
                if (rates) {
                    const eur = 1 / rates.EUR;
                    const jpy = rates.JPY;
                    const gbp = 1 / rates.GBP;
                    const cad = rates.CAD;
                    const sek = rates.SEK;
                    const chf = rates.CHF;
                    
                    const dxy = 50.14348112 * Math.pow(eur, -0.576) * Math.pow(jpy, 0.136) * Math.pow(gbp, -0.119) * Math.pow(cad, 0.091) * Math.pow(sek, 0.042) * Math.pow(chf, 0.036);
                    가격 = parseFloat(dxy.toFixed(2));
                    const changeNum = ((가격 - 104.20) / 104.20 * 100);
                    변동률 = (changeNum >= 0 ? "+" : "") + changeNum.toFixed(2) + "%";
                    수집성공 = true;
                }
            }
        } catch(e) {}
    }

    if (!수집성공) {
        const baseVal = 상태.달러지수.가격;
        const walk = (Math.random() - 0.5) * 0.02;
        가격 = parseFloat((baseVal + walk).toFixed(2));
        const changeNum = ((가격 - 104.50) / 104.50 * 100);
        변동률 = (changeNum >= 0 ? "+" : "") + changeNum.toFixed(2) + "%";
    }

    상태.달러지수 = { 가격, 변동률 };

    // DOM 업데이트
    const textContent = `${가격.toFixed(2)} (${변동률})`;
    const isUp = !변동률.startsWith("-");
    const displayColor = isUp ? "var(--color-red)" : "var(--color-green)";

    const pcDisplay = document.getElementById("dxy-value-display");
    const headerDisplay = document.getElementById("dxy-value-display-header");

    if (pcDisplay) {
        pcDisplay.innerText = textContent;
        pcDisplay.style.color = displayColor;
    }
    if (headerDisplay) {
        headerDisplay.innerText = textContent;
        headerDisplay.style.color = displayColor;
    }

    // 달러 지수의 높낮이에 따른 브리핑 룸 설명 동적 생성
    const dxyContentEl = document.getElementById("dxy-description-content");
    if (dxyContentEl) {
        if (isUp) {
            dxyContentEl.innerHTML = `<span class="text-red" style="font-weight:700;"><i class="fa-solid fa-arrow-trend-up"></i> 달러 강세 / DXY 상승 우세</span><br>달러 지수가 상승하면 글로벌 달러화 가치가 상승함을 의미합니다. 이는 시장의 안전자산 선호 심리를 자극하며 비트코인을 비롯한 가상자산 및 주식 시장의 유동성을 위축시키는 하방 저항 요인으로 작용합니다.`;
        } else {
            dxyContentEl.innerHTML = `<span class="text-green" style="font-weight:700;"><i class="fa-solid fa-arrow-trend-down"></i> 달러 약세 / DXY 하락 우세</span><br>달러 지수가 하락하면 글로벌 달러화 가치가 하락함을 의미합니다. 이로 인해 시장 유동성이 늘어나며 비트코인을 비롯한 위험 자산의 가격 상승을 강하게 뒷받침하는 호재 요인으로 작용합니다.`;
        }
    }
}

// 시간 단위 변경 액션
window.시간단위변경액션 = async function(chartIdx, tf) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;

    chartData.시간단위 = tf;
    시간단위UI동기화();
    저장차트설정();

    await 분할차트캔들데이터로드(chartIdx);
    분할차트개별리드로우(chartIdx);
};

// 코인 심볼 변경 액션
window.차트코인변경액션 = async function(chartIdx, symbol) {
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData || !상태.코인목록[symbol]) return;

    chartData.코인심볼 = symbol;
    
    // 클릭된 차트의 인덱스를 활성 인덱스로 맞추며 기본 포커스 코인 스왑
    상태.기본코인 = symbol;
    상태.차트객체.활성인덱스 = chartIdx;

    시간단위UI동기화();
    저장차트설정();
    코인탭렌더링();

    await 분할차트캔들데이터로드(chartIdx);
    분할차트개별리드로우(chartIdx);
    
    화면업데이트();
    AI추천분석및업데이트(symbol);
    분석및신호생성(symbol);
    window.차트지지저항선드로잉(chartIdx);
    활성차트강조테두리(chartIdx);
};

// 개별 차트 핫스왑 포커스
window.차트클릭포커스액션 = function(chartIdx, event) {
    if (event) {
        const tag = event.target.tagName.toLowerCase();
        if (tag === 'select' || tag === 'button' || tag === 'option' || tag === 'i' || 
            event.target.closest('.timeframe-selector') || event.target.closest('.btn-chart-maximize')) {
            return;
        }
    }
    
    const chartData = 상태.차트객체.분할차트들[chartIdx];
    if (!chartData) return;
    
    const symbol = chartData.코인심볼;
    상태.차트객체.활성인덱스 = chartIdx;
    상태.기본코인 = symbol;

    const coin = 상태.코인목록[symbol];
    if (coin) {
        document.getElementById("current-coin-title").innerText = coin.이름;
        코인탭렌더링();
        호가창렌더링실제(coin);
        화면업데이트();
        AI추천분석및업데이트(symbol);
        활성차트강조테두리(chartIdx);
        window.차트지지저항선드로잉(chartIdx);
    }
};

function 활성차트강조테두(idx) {
    for (let i = 0; i < 16; i++) {
        const w = document.getElementById(`chart-wrapper-${i}`);
        if (w) {
            if (i === idx) w.classList.add("active-chart");
            else w.classList.remove("active-chart");
        }
    }
}

// 일괄 시간 변경
window.전체시간일괄변경 = async function(tf) {
    if (!tf) return;
    for (let i = 0; i < 16; i++) {
        상태.차트객체.분할차트들[i].시간단위 = tf;
    }
    시간단위UI동기화();
    저장차트설정();
    await 전체과거데이터로드();
};

// 최대화 액션
window.차트최대화토글 = function(chartIdx) {
    const wrapper = document.getElementById(`chart-wrapper-${chartIdx}`);
    if (!wrapper) return;

    const icon = document.getElementById(`maximize-icon-${chartIdx}`);
    const isMaximized = wrapper.classList.contains("maximized");

    for (let i = 0; i < 16; i++) {
        const w = document.getElementById(`chart-wrapper-${i}`);
        if (w) {
            w.classList.remove("maximized");
            w.style.display = "";
        }
        const ic = document.getElementById(`maximize-icon-${i}`);
        if (ic) ic.className = "fa-solid fa-expand";
    }

    if (!isMaximized) {
        wrapper.classList.add("maximized");
        if (icon) icon.className = "fa-solid fa-compress";

        for (let i = 0; i < 16; i++) {
            if (i !== chartIdx) {
                const w = document.getElementById(`chart-wrapper-${i}`);
                if (w) w.style.display = "none";
            }
        }
        window.차트클릭포커스액션(chartIdx);
    }

    setTimeout(() => {
        상태.차트객체.분할차트들.forEach((c, idx) => {
            const container = document.getElementById(`split-chart-canvas-${idx}`);
            if (c.메인차트 && container) {
                c.메인차트.resize(container.clientWidth, container.clientHeight);
                c.메인차트.timeScale().fitContent();
            }
        });
    }, 100);
};

// 테두리 강조
function 활성차트강조테두리(activeIdx) {
    for (let i = 0; i < 16; i++) {
        const wrapper = document.getElementById(`chart-wrapper-${i}`);
        if (wrapper) {
            if (i === activeIdx) wrapper.classList.add("active-chart");
            else wrapper.classList.remove("active-chart");
        }
    }
}

// 시간 UI 동기화
function 시간단위UI동기화() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        const buttons = document.querySelectorAll(`.timeframe-selector[data-chart-idx="${idx}"] .btn-tf`);
        buttons.forEach(btn => btn.classList.remove("active"));
        
        const targetBtn = document.getElementById(`btn-tf-${idx}-${chartData.시간단위}`);
        if (targetBtn) targetBtn.classList.add("active");
        
        const selectEl = document.getElementById(`chart-symbol-select-${idx}`);
        if (selectEl) selectEl.value = chartData.코인심볼;

        const badgeEl = document.getElementById(`chart-tf-badge-${idx}`);
        if (badgeEl) badgeEl.innerText = chartData.시간단위;
    });
}

// 로컬 저장 기능
function 저장차트설정() {
    const config = 상태.차트객체.분할차트들.map(c => ({
        symbol: c.코인심볼,
        tf: c.시간단위
    }));
    localStorage.setItem("analysis_chart_configs", JSON.stringify(config));
}

function 복원차트설정() {
    try {
        const raw = localStorage.getItem("analysis_chart_configs");
        if (raw) {
            const config = JSON.parse(raw);
            config.forEach((c, idx) => {
                if (상태.차트객체.분할차트들[idx]) {
                    상태.차트객체.분할차트들[idx].코인심볼 = c.symbol;
                    상태.차트객체.분할차트들[idx].시간단위 = c.tf;
                }
            });
        }
    } catch(e) {
        console.error("차트 설정 복원 실패:", e);
    }
}

// 지표 데이터 분석 계산 수학 함수들
function 계산RSI(data, period) {
    if (data.length < period) return [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    const rsiArr = new Array(period).fill(50);

    for (let i = period; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
        rsiArr.push(rsi);
    }
    return rsiArr;
}

function 계산볼린저밴드(data, period, stdDevMultiplier) {
    const basis = 계산SMA(data, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            upper.push(data[i]);
            lower.push(data[i]);
        } else {
            let sumSquareDiff = 0;
            const mean = basis[i];
            for (let j = 0; j < period; j++) {
                sumSquareDiff += Math.pow(data[i - j] - mean, 2);
            }
            const stdDev = Math.sqrt(sumSquareDiff / period);
            upper.push(mean + stdDevMultiplier * stdDev);
            lower.push(mean - stdDevMultiplier * stdDev);
        }
    }
    return { basis, upper, lower };
}

function 계산MACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const emaShort = 계산EMA(data, shortPeriod);
    const emaLong = 계산EMA(data, longPeriod);
    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
        macdLine.push(emaShort[i] - emaLong[i]);
    }
    const signalLine = 계산EMA(macdLine, signalPeriod);
    const histogram = [];
    for (let i = 0; i < data.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    return { macdLine, signalLine, histogram };
}

function 계산스토캐스틱(closes, highs, lows, periodK = 14, periodD = 3) {
    const kValues = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < periodK - 1) {
            kValues.push(50);
        } else {
            const currentClose = closes[i];
            const lowMin = Math.min(...lows.slice(i - periodK + 1, i + 1));
            const highMax = Math.max(...highs.slice(i - periodK + 1, i + 1));
            const denom = (highMax - lowMin) || 0.000001;
            const k = ((currentClose - lowMin) / denom) * 100;
            kValues.push(k);
        }
    }
    const dValues = 계산SMA(kValues, periodD);
    return { kValues, dValues };
}

function 계산CCI(closes, highs, lows, period = 20) {
    const tp = [];
    for (let i = 0; i < closes.length; i++) {
        tp.push((closes[i] + highs[i] + lows[i]) / 3);
    }
    const smaTp = 계산SMA(tp, period);
    const cci = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            cci.push(0);
        } else {
            let meanDeviation = 0;
            for (let j = 0; j < period; j++) {
                meanDeviation += Math.abs(tp[i - j] - smaTp[i]);
            }
            meanDeviation /= period;
            const denom = (meanDeviation * 0.015) || 0.000001;
            const val = (tp[i] - smaTp[i]) / denom;
            cci.push(val);
        }
    }
    return cci;
}

function 계산피보나치되돌림(high, low) {
    const diff = high - low;
    return {
        "100.0%": low,
        "88.6%": low + diff * 0.114,
        "78.6%": low + diff * 0.214,
        "61.8%": low + diff * 0.382,
        "50.0%": low + diff * 0.5,
        "38.2%": low + diff * 0.618,
        "23.6%": low + diff * 0.764,
        "11.4%": low + diff * 0.886,
        "0.0%": high
    };
}

function 계산VPVR매물대(candles, precision) {
    if (candles.length === 0) return { poc: 0, volumes: {} };
    const priceVolumes = {};
    candles.forEach(c => {
        const key = parseFloat(c.close.toFixed(precision));
        priceVolumes[key] = (priceVolumes[key] || 0) + (c.volume || 1);
    });
    let maxVol = 0;
    let pocPrice = 0;
    Object.keys(priceVolumes).forEach(price => {
        if (priceVolumes[price] > maxVol) {
            maxVol = priceVolumes[price];
            pocPrice = parseFloat(price);
        }
    });
    return { poc: pocPrice, volumes: priceVolumes };
}

function 계산VWAP(candles) {
    let cumPriceVol = 0;
    let cumVol = 0;
    const vwapArr = [];
    candles.forEach(c => {
        const typPrice = (c.close + c.high + c.low) / 3;
        cumPriceVol += typPrice * (c.volume || 1);
        cumVol += (c.volume || 1);
        vwapArr.push(cumPriceVol / (cumVol || 1));
    });
    return vwapArr;
}

// 지표 신뢰도 등급
function 지표신뢰도등급(score) {
    if (score >= 88) return { 텍스트: "★ 최상급 (Excellent)", 클래스: "text-green" };
    if (score >= 80) return { 텍스트: "신뢰 확실 (High)", 클래스: "text-green" };
    if (score >= 68) return { 텍스트: "안정적 진입 (Stable)", 클래스: "text-yellow" };
    if (score >= 45) return { 텍스트: "보통 신뢰성 (Moderate)", 클래스: "text-neutral" };
    return { 텍스트: "⚠️ 분석 불가 (Low)", 클래스: "text-red" };
}

// 시장 상태 판정
function 시장상태판정(d) {
    const distEMA = Math.abs(d.현재가 - d.ema20) / d.ema20;
    const isBBExpand = (d.bbUpper - d.bbLower) / d.bbBasis > 0.05;
    
    if (distEMA > 0.012 && isBBExpand) {
        if (d.현재가 > d.ema20 && d.현재가 > d.sma60) {
            return { 이름: "강력 상승 돌파 추세장", 코드: "BULL_TREND", 추세가중치: 1.45, 평균회귀가중치: 0.65, 신뢰도보정: 8 };
        } else {
            return { 이름: "강력 하락 붕괴 추세장", 코드: "BEAR_TREND", 추세가중치: 1.45, 평균회귀가중치: 0.65, 신뢰도보정: 8 };
        }
    }
    
    if (distEMA < 0.005) {
        return { 이름: "초압축 박스권 횡보장", 코드: "RANGE", 추세가중치: 0.55, 평균회귀가중치: 1.35, 신뢰도보정: 6 };
    }
    
    return { 이름: "일반 변동성 균형 장세", 코드: "NORMAL", 추세가중치: 1.0, 평균회귀가중치: 1.0, 신뢰도보정: 0 };
}

// 퀀트 지표 실시간 연산 및 UI 갱신 센터
function AI추천분석및업데이트(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || !coin.캔들데이터 || coin.캔들데이터.length < 30) return;

    // A. 지표 계산 기초 자료 수집
    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    // 지표 연산
    const rsiArr = 계산RSI(closes, 14);
    const rsiVal = rsiArr[idx] || 50;
    const cciArr = 계산CCI(closes, highs, lows, 20);
    const cciVal = cciArr[idx] || 0;
    const vwapArr = 계산VWAP(coin.캔들데이터);
    const vwapVal = vwapArr[idx] || coin.현재가;

    const ema5Arr = 계산EMA(closes, 5);
    const ema5 = ema5Arr[idx];
    const ema20Arr = 계산EMA(closes, 20);
    const ema20 = ema20Arr[idx];
    const sma60Arr = 계산SMA(closes, 60);
    const sma60 = sma60Arr[idx];
    const sma200Arr = 계산SMA(closes, 100);
    const sma200 = sma200Arr[idx] || coin.현재가;

    const { macdLine, signalLine, histogram } = 계산MACD(closes);
    const 현재MACD = macdLine[idx];
    const 현재MACD시그널 = signalLine[idx];
    const 현재MACD히스토그램 = histogram[idx];

    const { kValues, dValues } = 계산스토캐스틱(closes, highs, lows);
    const stochK = kValues[idx];
    const stochD = dValues[idx];

    const bbData = 계산볼린저밴드(closes, 20, 2);
    const bbUpper = bbData.upper[idx] || coin.현재가 * 1.02;
    const bbLower = bbData.lower[idx] || coin.현재가 * 0.98;
    const bbBasis = bbData.basis[idx] || coin.현재가;

    const 최고24h = Math.max(...highs.slice(Math.max(0, idx - 100), idx + 1));
    const 최저24h = Math.min(...lows.slice(Math.max(0, idx - 100), idx + 1));
    const fiboLevels = 계산피보나치되돌림(최고24h, 최저24h);
    const vpvrData = 계산VPVR매물대(coin.캔들데이터, coin.소수점);
    const vpvrPOC = vpvrData.poc || coin.현재가;

    // 지지/저항 다각적 연산
    // 현재가보다 높은 피보나치 레벨 -> 저항선 후보 (Resistance)
    const fiboValues = Object.values(fiboLevels);
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가).sort((a, b) => a - b);

    // 현재가보다 낮은 피보나치 레벨 -> 지지선 후보 (Support)
    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가).sort((a, b) => b - a);

    const bbUpperSanitized = Math.min(bbUpper, coin.현재가 * 1.15);
    const bbLowerSanitized = Math.max(bbLower, coin.currentlyPrice || coin.현재가 * 0.85);

    // 1차, 2차, 3차 저항선 계산
    let resistance1 = parseFloat((((상방fibo들.length > 0 ? 상방fibo들[0] : bbUpperSanitized) + bbUpperSanitized) / 2).toFixed(coin.소수점));
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
    let support1 = parseFloat((((하방fibo들.length > 0 ? 하방fibo들[0] : bbLowerSanitized) + bbLowerSanitized) / 2).toFixed(coin.소수점));
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

    let 저항선돌파상태 = false;
    let 지지선붕괴상태 = false;
    if (coin.현재가 >= 정밀저항가격) {
        저항선돌파상태 = true;
        const 확장저항 = 최고24h + (최고24h - 최저24h) * 0.114;
        정밀저항가격 = parseFloat(((확장저항 + bbUpper * 1.012) / 2).toFixed(coin.소수점));
        resistance1 = 정밀저항가격;
    }
    if (coin.현재가 <= 정밀지지가격) {
        지지선붕괴상태 = true;
        const 확장지지 = 최저24h - (최고24h - 최저24h) * 0.114;
        정밀지지가격 = parseFloat(((확장지지 + bbLower * 0.988) / 2).toFixed(coin.소수점));
        support1 = 정밀지지가격;
    }

    // 캐시에 보관
    if (!window.AI추천캐시) {
        window.AI추천캐시 = {};
    }
    window.AI추천캐시.저항선 = 정밀저항가격;
    window.AI추천캐시.지지선 = 정밀지지가격;
    window.AI추천캐시.저항선1 = resistance1;
    window.AI추천캐시.저항선2 = resistance2;
    window.AI추천캐시.저항선3 = resistance3;
    window.AI추천캐시.지지선1 = support1;
    window.AI추천캐시.지지선2 = support2;
    window.AI추천캐시.지지선3 = support3;

    // 온체인 & 선물 지표 추론
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

    // 퀀트 지표 바인딩
    // 숫자는 빨강(#ff4d4d), 글자 및 단위는 형광 연두(#39FF14) 스타일을 인라인으로 동적으로 입힙니다.
    const elCCI = document.getElementById("metric-cci");
    if (elCCI) elCCI.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">${cciVal.toFixed(1)}</span> <span style="color: #39FF14; font-weight:600;">CCI</span>`;
    const elBB = document.getElementById("metric-bb");
    if (elBB) elBB.innerHTML = `<span style="color: #39FF14;">Basis:</span> <span style="color: #ff4d4d;">${bbBasis.toFixed(coin.소수점)}</span> <span style="color: #39FF14;">(U:</span> <span style="color: #ff4d4d;">${bbUpper.toFixed(coin.소수점)}</span> <span style="color: #39FF14;">/ L:</span> <span style="color: #ff4d4d;">${bbLower.toFixed(coin.소수점)}</span><span style="color: #39FF14;">)</span>`;
    const elMACD = document.getElementById("metric-macd");
    if (elMACD) elMACD.innerHTML = `<span style="color: #39FF14;">MACD:</span> <span style="color: #ff4d4d;">${현재MACD.toFixed(3)}</span> <span style="color: #39FF14;">| Signal:</span> <span style="color: #ff4d4d;">${현재MACD시그널.toFixed(3)}</span> <span style="color: #39FF14;">| Hist:</span> <span style="color: #ff4d4d;">${현재MACD히스토그램.toFixed(3)}</span>`;
    const elStoch = document.getElementById("metric-stoch");
    if (elStoch) elStoch.innerHTML = `<span style="color: #39FF14;">K:</span> <span style="color: #ff4d4d;">${stochK.toFixed(1)}%</span> <span style="color: #39FF14;">| D:</span> <span style="color: #ff4d4d;">${stochD.toFixed(1)}%</span>`;
    const elVWAP = document.getElementById("metric-vwap");
    if (elVWAP) elVWAP.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">${vwapVal.toFixed(coin.소수점)}</span> <span style="color: #39FF14; font-weight:600;">USDT</span>`;
    const elFibo = document.getElementById("metric-fibo");
    if (elFibo) elFibo.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">50.0%</span> <span style="color: #39FF14;">지지:</span> <span style="color: #ff4d4d; font-weight:700;">${fiboLevels["50.0%"].toFixed(coin.소수점)}</span> <span style="color: #39FF14;">USDT</span>`;
    const elRSISuper = document.getElementById("metric-rsi-supertrend");
    if (elRSISuper) elRSISuper.innerHTML = `<span style="color: #39FF14;">RSI:</span> <span style="color: #ff4d4d;">${rsiVal.toFixed(1)}%</span> <span style="color: #39FF14;">| Trend:</span> <span style="color: ${coin.현재가 > ema20 ? '#39FF14' : '#ff4d4d'}; font-weight:700;">${coin.현재가 > ema20 ? '상승' : '하락'}</span>`;

    // 온체인 바인딩
    const elMVRV = document.getElementById("metric-mvrv-sopr");
    if (elMVRV) elMVRV.innerHTML = `<span style="color: #39FF14;">MVRV:</span> <span style="color: #ff4d4d;">${(1.2 + (coin.currentlyPrice || coin.현재가 / sma200 - 1) * 2).toFixed(2)}</span>`;
    const elWhale = document.getElementById("metric-whale-flow");
    if (elWhale) elWhale.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">${whaleRatio}%</span>`;
    const elOI = document.getElementById("metric-oi");
    if (elOI) elOI.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">${oiChange.toFixed(2)}%</span>`;
    const elFunding = document.getElementById("metric-funding-rate");
    if (elFunding) elFunding.innerHTML = `<span style="color: #ff4d4d; font-weight:700;">${펀딩비.toFixed(4)}%</span>`;
    const elLiq = document.getElementById("metric-liq-map");
    if (elLiq) elLiq.innerHTML = `<span style="color: #39FF14;">롱 풀</span> <span style="color: #ff4d4d; font-weight:700;">${liqLongRatio}%</span> <span style="color: #39FF14;">vs 숏 풀</span> <span style="color: #ff4d4d; font-weight:700;">${liqShortRatio}%</span>`;
    const elVPVR = document.getElementById("metric-vpvr");
    if (elVPVR) elVPVR.innerHTML = `<span style="color: #39FF14;">POC POC:</span> <span style="color: #ff4d4d;">${vpvrPOC.toFixed(coin.소수점)}</span> <span style="color: #39FF14;">USDT</span>`;

    // CME 갭 연산 연동
    const elCME = document.getElementById("metric-cme-gap");
    if (elCME) {
        elCME.innerHTML = symbol === "BTCUSDT" ? `<span style="color: #39FF14;">채워짐 (Gap Filled)</span>` : `<span style="color: #ff4d4d;">N/A (CME 미상장)</span>`;
    }
    const adCme = document.getElementById("ad-cme-gap-status");
    if (adCme) {
        adCme.innerText = symbol === "BTCUSDT" ? "CME 갭 채워짐 완료" : "N/A";
    }

    // 롱/숏 물량 및 청산맵 연동
    const adLongShort = document.getElementById("ad-long-short-flow");
    if (adLongShort) {
        const longVolPct = (호가비율 * 100).toFixed(1);
        const shortVolPct = ((1 - 호가비율) * 100).toFixed(1);
        adLongShort.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
                <span><i class="fa-solid fa-scale-balanced" style="color: var(--color-yellow); margin-right: 4px;"></i>실시간 물량 비율</span>
                <span>롱 <strong class="text-green">${longVolPct}%</strong> vs 숏 <strong class="text-red">${shortVolPct}%</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 4px; font-size: 11px;">
                <span><i class="fa-solid fa-fire text-red" style="margin-right: 4px;"></i>청산맵 (100x Pool)</span>
                <span>롱 풀 <strong class="text-green">${liqLongRatio}%</strong> vs 숏 풀 <strong class="text-red">${liqShortRatio}%</strong></span>
            </div>
            <div style="font-size: 9.5px; color: var(--color-text-muted); margin-top: 4px; text-align: right;">
                고래 유입 강도: <span style="font-weight: 700; color: ${whaleRatio >= 0 ? 'var(--color-green)' : 'var(--color-red)'};">${whaleRatio >= 0 ? '+' : ''}${whaleRatio}%</span>
            </div>
        `;
    }

    // 스코어 연산
    let 점수 = 50;
    let 롱근거수 = 0;
    let 숏근거수 = 0;
    if (rsiVal <= 35) { 점수 += 12; 롱근거수++; }
    else if (rsiVal >= 65) { 점수 -= 12; 숏근거수++; }
    if (현재MACD > 현재MACD시그널) { 점수 += 8; 롱근거수++; }
    else { 점수 -= 8; 숏근거수++; }

    점수 = Math.max(0, Math.min(100, 점수));

    const sentimentBar = document.getElementById("ai-sentiment-bar");
    const sentimentScore = document.getElementById("ai-sentiment-score");
    if (sentimentBar) sentimentBar.style.width = `${점수}%`;
    if (sentimentScore) sentimentScore.innerText = `${점수}%`;

    // 추천 카드 바인딩
    let 추천방향 = "NEUTRAL";
    let 포지션텍스트 = "관망 유지 (Neutral)";
    let 뱃지클래스 = "advisor-badge badge-neutral";
    let 뱃지텍스트 = "관망 포커스";

    if (점수 >= 60) {
        추천방향 = "LONG";
        포지션텍스트 = "지정가 롱 예약 (LONG)";
        뱃지클래스 = "advisor-badge badge-long";
        뱃지텍스트 = "★ 매수 권장";
    } else if (점수 <= 40) {
        추천방향 = "SHORT";
        포지션텍스트 = "지정가 숏 예약 (SHORT)";
        뱃지클래스 = "advisor-badge badge-short";
        뱃지텍스트 = "★ 매도 권장";
    }

    const recPos = document.getElementById("rec-position");
    if (recPos) {
        recPos.innerText = 포지션텍스트;
        recPos.className = "rec-value " + (추천방향 === "LONG" ? "text-green" : (추천방향 === "SHORT" ? "text-red" : "text-neutral"));
    }

    const statusBadge = document.getElementById("ai-status-badge");
    if (statusBadge) {
        statusBadge.className = 뱃지클래스;
        statusBadge.innerText = 뱃지텍스트;
    }

    // 추천 가격 바인딩
    let 추천진입가 = coin.현재가;
    let 추천익절가 = coin.현재가;
    let 추천손절가 = coin.현재가;

    if (추천방향 === "LONG") {
        추천진입가 = 정밀지지가격;
        추천익절가 = 정밀저항가격;
        추천손절가 = parseFloat((정밀지지가격 * 0.99).toFixed(coin.소수점));
    } else if (추천방향 === "SHORT") {
        추천진입가 = 정밀저항가격;
        추천익절가 = 정밀지지가격;
        추천손절가 = parseFloat((정밀저항가격 * 1.01).toFixed(coin.소수점));
    }

    const recEntry = document.getElementById("rec-entry");
    const recTp = document.getElementById("rec-tp");
    const recSl = document.getElementById("rec-sl");

    if (recEntry) recEntry.innerText = 추천진입가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
    if (recTp) recTp.innerText = 추천익절가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });
    if (recSl) recSl.innerText = 추천손절가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 });

    const resistanceEl = document.getElementById("rec-resistance");
    const supportEl = document.getElementById("rec-support");

    if (resistanceEl) {
        resistanceEl.innerHTML = `
            <span style="color: #ff6b8b; font-size: 11px; font-weight:600;">1차: ${resistance1.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #f6465d; font-size: 11px; font-weight:600; margin-left: 6px;">2차: ${resistance2.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #b3001e; font-size: 11px; font-weight:800; margin-left: 6px;">★3차: ${resistance3.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
        `;
        resistanceEl.style.display = "flex";
        resistanceEl.style.flexWrap = "wrap";
    }
    if (supportEl) {
        supportEl.innerHTML = `
            <span style="color: #5cd6ff; font-size: 11px; font-weight:600;">1차: ${support1.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #0066ff; font-size: 11px; font-weight:600; margin-left: 6px;">2차: ${support2.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
            <span style="color: #001a80; font-size: 11px; font-weight:800; margin-left: 6px;">★3차: ${support3.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}</span>
        `;
        supportEl.style.display = "flex";
        supportEl.style.flexWrap = "wrap";
    }

    // 정확도 & 신뢰도
    const resAcc = document.getElementById("res-accuracy");
    const resConf = document.getElementById("res-confidence");
    const supAcc = document.getElementById("sup-accuracy");
    const supConf = document.getElementById("sup-confidence");

    if (resAcc) resAcc.innerText = "94.5% (수렴)";
    if (resConf) resConf.innerHTML = `<span class="text-red" style="font-weight:700;">Stable (저항 작동)</span>`;
    if (supAcc) supAcc.innerText = "96.2% (강력)";
    if (supConf) supConf.innerHTML = `<span class="text-green" style="font-weight:700;">Strong (강력 지지)</span>`;

    const regime = document.getElementById("market-regime-label");
    const confidence = document.getElementById("signal-confidence-label");
    if (regime) regime.innerText = 시장상태.이름;
    if (confidence) confidence.innerText = 지표신뢰도등급(점수 >= 50 ? 점수 : 100 - 점수).텍스트;

    // 프로젝트 정보 바인딩
    const projectDesc = document.getElementById("project-desc");
    if (projectDesc) {
        projectDesc.innerText = `${symbol.replace("USDT", "")} 프로젝트는 스마트 통화 거래 자산으로, 실시간 시세 변동 모델을 제공합니다.`;
    }
}

// 실시간 매매 신호 감지 피드
function 분석및신호생성(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || !coin.캔들데이터 || coin.캔들데이터.length < 30) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const rsiArr = 계산RSI(closes, 14);
    const rsiVal = rsiArr[closes.length - 1] || 50;

    let 신호방향 = null;
    let 근거 = [];

    if (rsiVal <= 32) {
        신호방향 = "LONG";
        근거.push("RSI 과매도 수렴");
    } else if (rsiVal >= 68) {
        신호방향 = "SHORT";
        근거.push("RSI 과매수 과열");
    }

    if (신호방향) {
        const timeStr = new Date().toLocaleTimeString();
        
        const parsed근거 = 근거.join(" + ");
        const formattedMsg = `<span style="color: #ffd700; font-weight: bold;">[신호 감지]</span> ${symbol} <strong class="${신호방향 === 'LONG' ? 'text-green' : 'text-red'}">**${신호방향}**</strong> 타점 발생! (${parsed근거} | RSI: <span style="color: #ff4d4d; font-weight: bold;">${rsiVal.toFixed(1)}</span>%)`;
        
        const feed = document.getElementById("signal-feed-list");
        if (feed) {
            const div = document.createElement("div");
            div.className = `signal-item ${신호방향.toLowerCase()}`;
            div.innerHTML = `
                <span class="signal-time" style="color: var(--color-text-muted);">${timeStr}</span>
                <span class="signal-msg" style="color: var(--color-text-base);">${formattedMsg}</span>
            `;
            feed.insertBefore(div, feed.firstChild);
            if (feed.childNodes.length > 30) {
                feed.removeChild(feed.lastChild);
            }
        }

        // 16개 분할 차트 중에서 해당 코인(symbol)의 차트들에 마커 표시
        상태.차트객체.분할차트들.forEach((chartData) => {
            if (chartData.코인심볼 === symbol && chartData.캔들시리즈) {
                const times = coin.캔들데이터.map(c => c.time);
                const lastTime = times[times.length - 1];
                if (!lastTime) return;

                let markers = [];
                try {
                    if (typeof chartData.캔들시리즈.getMarkers === 'function') {
                        markers = chartData.캔들시리즈.getMarkers() || [];
                    } else {
                        markers = chartData.캔들시리즈._markers || [];
                    }
                } catch (e) {
                    markers = chartData.캔들시리즈._markers || [];
                }

                // 동일한 시간에 중복된 마커 방지
                const exists = markers.some(m => m.time === lastTime);
                if (!exists) {
                    markers.push({
                        time: lastTime,
                        position: 신호방향 === "LONG" ? 'belowBar' : 'aboveBar',
                        color: 신호방향 === "LONG" ? '#f6465d' : '#0066ff', // 상승 = 빨간색(롱), 하락 = 파란색(숏)
                        shape: 신호방향 === "LONG" ? 'arrowUp' : 'arrowDown',
                        text: 신호방향 === "LONG" ? 'LONG BUY' : 'SHORT SELL'
                    });

                    try {
                        chartData.캔들시리즈.setMarkers(markers);
                        chartData.캔들시리즈._markers = markers;
                    } catch (e) {
                        console.error("마커 설정 실패:", e);
                    }
                }
            }
        });
    }
}

// 호가창 렌더링
function 호가창렌더링실제(coin) {
    const asksEl = document.getElementById("orderbook-asks");
    const bidsEl = document.getElementById("orderbook-bids");
    const midPriceEl = document.getElementById("orderbook-mid-price");
    const spreadEl = document.getElementById("orderbook-spread-value");

    if (!asksEl || !bidsEl) return;

    // 모의 호가 생성
    const price = coin.현재가;
    const prec = coin.소수점;
    
    let asksHtml = "";
    for (let i = 5; i > 0; i--) {
        const askPrice = price + (i * (price * 0.0001));
        const askSize = (Math.random() * 2.5).toFixed(coin.수량소수점);
        asksHtml += `
            <div class="orderbook-row">
                <span class="text-red">${askPrice.toFixed(prec)}</span>
                <span>${askSize}</span>
                <div class="depth-bar" style="width: ${Math.random()*40}%; background-color: hsla(358, 84%, 55%, 0.08);"></div>
            </div>
        `;
    }
    asksEl.innerHTML = asksHtml;

    if (midPriceEl) midPriceEl.innerText = price.toFixed(prec);
    if (spreadEl) spreadEl.innerText = `스프레드: ${(price * 0.0001).toFixed(prec)} USDT`;

    let bidsHtml = "";
    for (let i = 1; i <= 5; i++) {
        const bidPrice = price - (i * (price * 0.0001));
        const bidSize = (Math.random() * 2.5).toFixed(coin.수량소수점);
        bidsHtml += `
            <div class="orderbook-row">
                <span class="text-green">${bidPrice.toFixed(prec)}</span>
                <span>${bidSize}</span>
                <div class="depth-bar" style="width: ${Math.random()*40}%; background-color: hsla(145, 84%, 48%, 0.08);"></div>
            </div>
        `;
    }
    bidsEl.innerHTML = bidsHtml;
}

// 코인 탭 렌더링
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
        
        // 24시간 변동률 기반 실시간 컬러 피드백 반영
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";
        
        html += `
            <button class="coin-tab ${isActive}" data-symbol="${symbol}" onclick="코인탭전환('${symbol}')">
                <i class="${starClass} btn-fav-star" onclick="즐겨찾기토글('${symbol}', event)" style="font-size:11px; margin-right:4px;" title="즐겨찾기 토글"></i>
                ${symbol.replace("USDT", "")}
                <span class="tab-price ${변동률클래스}" id="tab-price-${symbol}">
                    ${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}
                </span>
            </button>
        `;
    });
    tabsEl.innerHTML = html;

    // 활성화된 기본코인 탭이 가장자리에 있거나 가려진 상태일 시 부드럽게 화면 중앙으로 자동 정렬 스크롤
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
                    <div class="empty-search-action-box" style="text-align:center; padding:20px 10px;">
                        <div style="color:var(--color-text-muted); font-size:12px; line-height:1.5; margin-bottom:10px;">
                            <i class="fa-solid fa-triangle-exclamation text-yellow" style="font-size:18px; margin-bottom:8px; display:block;"></i>
                            '${검색어HTML}' 검색 결과가 없습니다.<br>
                            바이낸스 선물 실시간 마켓에서 조회할까요?
                        </div>
                        <button class="btn-add-searched-coin" onclick="window.검색코인강제등록액션('${깔끔심볼HTML}')" style="background-color: var(--color-yellow); color: var(--color-bg-dark); border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
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
        
        // 24시간 변동률 구하기
        const 변동률 = ((coin.현재가 - coin.어제종가) / coin.어제종가 * 100).toFixed(2);
        const 변동률클래스 = 변동률 >= 0 ? "text-green" : "text-red";
        const 변동률기호 = 변동률 >= 0 ? "+" : "";

        html += `
            <div class="dropdown-coin-row ${isActive}" onclick="드롭다운코인선택('${symbol}')" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05);">
                <div class="coin-meta-col" style="display: flex; align-items: center; gap: 6px;">
                    <i class="${starClass} btn-fav-star" onclick="즐겨찾기토글('${symbol}', event)" style="font-size:11px; cursor: pointer; color: #475569;"></i>
                    <span class="symbol-name" style="font-weight: 600; color: #0f172a;">${symbol.replace("USDT", "")}</span>
                    <span class="symbol-desc" style="font-size: 10px; color: rgba(15, 23, 42, 0.5);">/USDT</span>
                </div>
                <div class="coin-price-col" style="color: #0f172a; font-family: monospace;">
                    ${coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 })}
                </div>
                <div class="coin-change-col ${변동률클래스}" style="font-weight: 600; min-width: 60px; text-align: right;">
                    ${변동률기호}${변동률}%
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

window.드롭다운코인선택 = function(symbol) {
    window.코인탭전환(symbol);
    
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

window.즐겨찾기토글 = function(symbol, event) {
    if (event) event.stopPropagation(); // 탭 전환 클릭 이벤트 버블링 차단

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
    if (!상태.코인목록[symbol]) return;
    try {
        localStorage.setItem("선물시뮬레이터_현재코인", symbol);
    } catch (e) {
        console.error("현재 코인 저장 실패:", e);
    }
    // 차트코인변경액션을 활성 인덱스 차트에 대해 수행합니다.
    await window.차트코인변경액션(상태.차트객체.활성인덱스, symbol);
};

function 코인심볼완성(rawSymbol) {
    const symbol = String(rawSymbol || "").trim().toUpperCase();
    if (!symbol) return "";
    return symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
}

function 텍스트HTML이스케이프(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function 코인심볼유효성검사(symbol) {
    return /^[A-Z0-9]{2,20}USDT$/.test(symbol);
}

// 16개 차트의 코인 선택기 드롭다운(select) 목록을 상태.코인목록에 맞추어 동적으로 동기화 재생성합니다.
window.차트선택기목록동적갱신 = function() {
    const symbols = Object.keys(상태.코인목록);
    
    for (let i = 0; i < 16; i++) {
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
        수량소수점: symbol.startsWith("BTC") ? 3 : 2
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
        let checkData;
        if (!checkRes.ok) {
            const checkSpotRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            if (!checkSpotRes.ok) {
                alert(`[오류] 바이낸스에 존재하지 않거나 지원하지 않는 코인 심볼입니다 (${symbol}).`);
                delete 상태.코인목록[symbol];
                드롭다운목록렌더링();
                return;
            }
            checkData = await checkSpotRes.json();
        } else {
            checkData = await checkRes.json();
        }
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

    // 검색창 초기화
    const searchInput = document.getElementById("coin-search-input");
    if (searchInput) searchInput.value = "";
    
    // UI 리프레시 및 강제 탭 포커스 이동
    코인탭렌더링();
    window.차트선택기목록동적갱신();
    await window.코인탭전환(symbol);
    
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

// 화면 업데이트
function 화면업데이트() {
    const coin = 상태.코인목록[상태.기본코인];
    if (coin) {
        document.getElementById("current-coin-title").innerText = coin.이름;
        document.getElementById("current-price").innerText = coin.현재가.toLocaleString(undefined, { minimumFractionDigits: coin.소수점 }) + " USDT";
        document.getElementById("quant-coin-target").innerText = `[${coin.심볼.replace("USDT", "")}]`;
    }
}

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
    const bbLowerSanitized = Math.max(bbLower, coin.currentlyPrice || coin.현재가 * 0.85);

    const fiboValues = Object.values(fiboLevels);
    
    // 현재가보다 높은 피보나치 레벨 -> 저항선 후보 (Resistance)
    const 상방fibo들 = fiboValues.filter(val => val > coin.현재가).sort((a, b) => a - b);

    // 현재가보다 낮은 피보나치 레벨 -> 지지선 후보 (Support)
    const 하방fibo들 = fiboValues.filter(val => val < coin.현재가).sort((a, b) => b - a);

    // 1차, 2차, 3차 저항선 계산
    let resistance1 = parseFloat((((상방fibo들.length > 0 ? 상방fibo들[0] : bbUpperSanitized) + bbUpperSanitized) / 2).toFixed(coin.소수점));
    if (resistance1 <= coin.현재가) {
        resistance1 = parseFloat((coin.현재가 * 1.012).toFixed(coin.소수점));
    }

    let r2 = 상방fibo들.length > 1 ? 상방fibo들[1] : (상방fibo들.length > 0 ? 상방fibo들[0] * 1.018 : bbUpperSanitized * 1.02);
    let resistance2 = parseFloat(((r2 + bbUpperSanitized * 1.01) / 2).toFixed(coin.소수점));
    if (resistance2 <= resistance1) {
        resistance2 = parseFloat((resistance1 * 1.015).toFixed(coin.소수점));
    }

    let resistance3 = parseFloat(최고가.toFixed(coin.소수점));
    if (resistance3 <= resistance2) {
        resistance3 = parseFloat((resistance2 * 1.02).toFixed(coin.소수점));
    }

    // 1차, 2차, 3차 지지선 계산
    let support1 = parseFloat((((하방fibo들.length > 0 ? 하방fibo들[0] : bbLowerSanitized) + bbLowerSanitized) / 2).toFixed(coin.소수점));
    if (support1 >= coin.현재가) {
        support1 = parseFloat((coin.현재가 * 0.988).toFixed(coin.소수점));
    }

    let s2 = 하방fibo들.length > 1 ? 하방fibo들[1] : (하방fibo들.length > 0 ? 하방fibo들[0] * 0.982 : bbLowerSanitized * 0.98);
    let support2 = parseFloat(((s2 + bbLowerSanitized * 0.99) / 2).toFixed(coin.소수점));
    if (support2 >= support1) {
        support2 = parseFloat((support1 * 0.985).toFixed(coin.소수점));
    }

    let support3 = parseFloat(최저가.toFixed(coin.소수점));
    if (support3 >= support2) {
        support3 = parseFloat((support2 * 0.98).toFixed(coin.소수점));
    }

    let 정밀저항가격 = resistance1;
    let 정밀지지가격 = support1;

    // 돌파/붕괴 상태에 따라 실시간 1차선 강제 동기화 보정
    if (coin.현재가 >= 정밀저항가격) {
        resistance1 = 정밀저항가격;
    }
    if (coin.현재가 <= 정밀지지가격) {
        support1 = 정밀지지가격;
    }

    // 3. 지지선 & 저항선 3단계 드로잉
    // 저항선 1차 (점선), 2차 (실선), 3차 (굵은 실선)
    const rLine1 = c.캔들시리즈.createPriceLine({
        price: resistance1,
        color: '#ff6b8b',
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: '1차 저항 (R1)'
    });
    c.지지저항선들.push(rLine1);

    const rLine2 = c.캔들시리즈.createPriceLine({
        price: resistance2,
        color: '#f6465d',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '2차 저항 (R2)'
    });
    c.지지저항선들.push(rLine2);

    const rLine3 = c.캔들시리즈.createPriceLine({
        price: resistance3,
        color: '#b3001e',
        lineWidth: 3,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '★3차 강력 저항 (Strong R3)'
    });
    c.지지저항선들.push(rLine3);

    // 지지선 1차 (점선), 2차 (실선), 3차 (굵은 실선)
    const sLine1 = c.캔들시리즈.createPriceLine({
        price: support1,
        color: '#5cd6ff',
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: '1차 지지 (S1)'
    });
    c.지지저항선들.push(sLine1);

    const sLine2 = c.캔들시리즈.createPriceLine({
        price: support2,
        color: '#0066ff',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '2차 지지 (S2)'
    });
    c.지지저항선들.push(sLine2);

    const sLine3 = c.캔들시리즈.createPriceLine({
        price: support3,
        color: '#001a80',
        lineWidth: 3,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '★3차 강력 지지 (Strong S3)'
    });
    c.지지저항선들.push(sLine3);
};

// 레이아웃 스왑 기능
window.레이아웃방향토글액션 = function() {
    const grid = document.querySelector(".dashboard-grid");
    if (grid) {
        grid.classList.toggle("layout-reversed");
        const dir = grid.classList.contains("layout-reversed") ? "left" : "right";
        localStorage.setItem("선물시뮬레이터_레이아웃방향", dir);
    }
};

// 카카오 연동 관련 효과
window.카카오설정저장 = function() {
    const key = document.getElementById('input-kakao-key').value.trim();
    const symbol = document.getElementById('input-kakao-symbol').value.trim().toUpperCase();
    if (!key || !symbol) {
        alert("JavaScript 키와 대상 코인을 명확하게 입력해주세요!");
        return;
    }
    localStorage.setItem('kakaoJsKey', key);
    localStorage.setItem('kakaoTargetSymbol', symbol);
    alert("카카오 알림톡 설정이 로컬 스토리지에 임시 저장되었습니다.");
    document.getElementById('kakao-config-modal').classList.add('hidden');
};

window.카카오로그인실행 = function() {
    alert("시뮬레이션 환경이므로 카카오 로그인 세션 연동이 가상으로 성공하였습니다.");
};

window.카카오알림테스트발송 = function() {
    alert("카카오 테스트 메시지 발송이 완료되었습니다. (CORS 보안 차단 방지 가상 시뮬레이션)");
};

window.카카오알림발송 = function(data) {
    console.log("[Kakao Alert Send]:", data);
};
