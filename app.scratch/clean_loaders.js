const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
if (!fs.existsSync(filePath)) {
    console.error("app.js 파일이 없습니다!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. 교환할 영역의 시작 인덱스 계산 (DOMContentLoaded가 닫히는 }); 바로 직후)
const domStart = content.indexOf('document.addEventListener("DOMContentLoaded"');
if (domStart === -1) {
    console.error("[FAIL] Could not find DOMContentLoaded start in app.js");
    process.exit(1);
}

const domEnd = content.indexOf('});', domStart);
if (domEnd === -1) {
    console.error("[FAIL] Could not find DOMContentLoaded end in app.js");
    process.exit(1);
}

const startIdx = domEnd + 3; // }); 이후 줄바꿈 등을 포함해 시작
console.log(`Found startIdx at ${startIdx} (just after DOMContentLoaded listener)`);

// 2. 교환할 영역의 끝 인덱스 계산 (실시간 파싱 함수 시작 전까지)
const endKeywords = [
    '// 7. 실시간 수신 웹소켓 데이터 파싱 (WebSocket Message Handlers)',
    '// 7. 실시간 수신 웹소켓 데이터 파싱',
    'function 실시간캔들메시지파싱',
    '// Kline 실시간 수신 핸들러'
];

let endIdx = -1;
for (const kw of endKeywords) {
    endIdx = content.indexOf(kw);
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

const pristineLoaders = `

// 2. 코인 데이터 초기 정의 및 복원 함수 (Coin Initializer & State Recovery)
function 초기코인데이터정의() {
    // A. 기본 정의 코인 이식 (Default Specifications)
    Object.keys(코인스펙).forEach(symbol => {
        상태.코인목록[symbol] = {
            심볼: symbol,
            이름: 코인스펙[symbol].이름,
            현재가: 코인스펙[symbol].시작가,
            어제종가: 코인스펙[symbol].시작가 * 0.98,
            최고24h: 코인스펙[symbol].시작가 * 1.02,
            최저24h: 코인스펙[symbol].시작가 * 0.97,
            캔들데이터: [],
            호가매도: [], 
            호가매수: [], 
            소수점: 코인스펙[symbol].소수점,
            수량소수점: 코인스펙[symbol].수량소수점,
            자동매매활성화: false
        };
    });

    // B. localStorage 저장된 알트코인 목록 복원
    try {
        const 저장된목록 = localStorage.getItem("선물시뮬레이터_추가코인");
        if (저장된목록) {
            const 코인들 = JSON.parse(저장된목록);
            코인들.forEach(symbol => {
                if (!상태.코인목록[symbol]) {
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
                    } else {
                        상태.코인목록[symbol].소수점 = 3;
                        상태.코인목록[symbol].수량소수점 = 2;
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
}

// 3. 차트 시스템 구현 (TradingView Charts 8-Split Grid System Core)
function 차트시스템초기화() {
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

    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        const container = document.getElementById(\`split-chart-canvas-\${idx}\`);
        if (!container) return;

        // 기존 차트 인스턴스 파괴
        if (chartData.메인차트) {
            try {
                chartData.메인차트.remove();
            } catch (e) {
                console.error("이전 차트 제거 에러:", e);
            }
        }

        // 차트 생성
        chartData.메인차트 = LightweightCharts.createChart(container, chartOptions);

        // 캔들 시리즈 추가
        chartData.캔들시리즈 = chartData.메인차트.addCandlestickSeries({
            upColor: '#f6465d',     // 상승 = 빨간색 (한국 기준)
            downColor: '#0066ff',   // 하락 = 파란색 (한국 기준)
            borderUpColor: '#f6465d',
            borderDownColor: '#0066ff',
            wickUpColor: '#f6465d',
            wickDownColor: '#0066ff'
        });

        // 이동평균선(MA) 시리즈 추가
        chartData.MA7시리즈 = chartData.메인차트.addLineSeries({ color: '#F0B90B', lineWidth: 1, title: 'MA(7)' });
        chartData.MA25시리즈 = chartData.메인차트.addLineSeries({ color: '#03A9F4', lineWidth: 1, title: 'MA(25)' });
        chartData.MA99시리즈 = chartData.메인차트.addLineSeries({ color: '#E040FB', lineWidth: 1, title: 'MA(99)' });

        // 화면 크기 반응형 리스너 부착
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
        const buttons = document.querySelectorAll(\`.timeframe-selector[data-chart-idx="\${idx}"] .btn-tf\`);
        buttons.forEach(btn => btn.classList.remove("active"));
        
        // 현재 상태에 부합하는 시간 단위 버튼 활성화
        const targetBtn = document.getElementById(\`btn-tf-\${idx}-\${chartData.시간단위}\`);
        if (targetBtn) {
            targetBtn.classList.add("active");
        }
        
        // 헤더 타이틀 갱신
        const titleEl = document.getElementById(\`chart-title-\${idx}\`);
        if (titleEl) {
            const tfName = {
                "1m": "1분봉 (1m)",
                "1h": "1시간봉 (1h)",
                "4h": "4시간봉 (4h)",
                "8h": "8시간봉 (8h)",
                "12h": "12시간봉 (12h)",
                "1d": "일봉 (1d)",
                "1w": "주봉 (1w)"
            }[chartData.시간단위];
            titleEl.innerHTML = \`<i class="fa-solid fa-chart-line text-yellow" style="margin-right:6px;"></i>차트 \${idx+1}: \${tfName}\`;
        }
    });
}

// 4. 바이낸스 REST API 연동 및 데이터 파싱 (Historical Data Loader)
async function 최초과거데이터로드() {
    await 전체분할차트데이터로드();
}

// 8개 차트 개별 코인 및 시간 설정 로컬스토리지 저장
function 차트설정저장() {
    const 코인설정 = 상태.차트객체.분할차트들.map(c => c.코인심볼);
    const 시간설정 = 상태.차트객체.분할차트들.map(c => c.시간단위);
    try {
        localStorage.setItem("선물시뮬레이터_차트코인설정", JSON.stringify(코인설정));
        localStorage.setItem("선물시뮬레이터_차트시간설정", JSON.stringify(시간설정));
    } catch (e) {
        console.error("차트 설정 저장 에러:", e);
    }
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
async function 탭전환시분할차트데이터로드(symbol) {
    // 1. 이미 8개 차트 중 해당 코인을 띄우고 있는 차트가 있는지 지능적으로 색인
    let targetChartIdx = 상태.차트객체.분할차트들.findIndex(c => c.코인심볼 === symbol);
    
    if (targetChartIdx !== -1) {
        // 이미 해당 코인을 띄우고 있는 차트가 있다면, 그 차트로 포커스(활성차트) 인덱스 변경
        상태.차트객체.활성인덱스 = targetChartIdx;
        window.활성차트강조테두리(targetChartIdx);
    } else {
        // 어디에도 해당 코인이 없다면, 현재 포커스된 차트(활성인덱스)의 코인을 해당 코인으로 교체
        const activeIdx = 상태.차트객체.활성인덱스 || 0;
        const chartData = 상태.차트객체.분할차트들[activeIdx];
        if (chartData) {
            chartData.코인심볼 = symbol;
            
            // 상단 select 드롭다운 선택값도 연동 변경
            const selectEl = document.getElementById(\`chart-symbol-select-\${activeIdx}\`);
            if (selectEl) {
                selectEl.value = symbol;
            }
            
            // 해당 차트의 데이터를 새로 가져옴
            await 분할차트캔들데이터로드(activeIdx);
            
            // 해당 차트 개별 렌더링
            const times = chartData.캔들데이터.map(c => c.time);
            const closes = chartData.캔들데이터.map(c => c.close);
            
            chartData.캔들시리즈.setData(chartData.캔들데이터);
            
            const ma7 = 계산SMA(closes, 7);
            const ma25 = 계산SMA(closes, 25);
            const ma99 = 계산SMA(closes, 99);
            
            chartData.MA7시리즈.setData(매핑지표데이터(times, ma7));
            chartData.MA25시리즈.setData(매핑지표데이터(times, ma25));
            chartData.MA99시리즈.setData(매핑지표데이터(times, ma99));
            
            chartData.메인차트.timeScale().fitContent();
            
            window.활성차트강조테두리(activeIdx);
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
        const response = await fetch(\`https://fapi.binance.com/fapi/v1/klines?symbol=\${symbol}&interval=\${interval}&limit=150\`);
        if (!response.ok) throw new Error(\`\${interval} API 호출 실패\`);

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
    } catch (e) {
        console.error(\`\${symbol} \${interval} 분할차트 데이터 로드 에러:\`, e);
    }
}

function 분할차트들렌더링() {
    상태.차트객체.분할차트들.forEach((chartData, idx) => {
        if (!chartData.메인차트 || !chartData.캔들시리즈 || chartData.캔들데이터.length === 0) return;

        const times = chartData.캔들데이터.map(c => c.time);
        const closes = chartData.캔들데이터.map(c => c.close);

        // 캔들 데이터 셋
        chartData.캔들시리즈.setData(chartData.캔들데이터);

        // 보조 지표(MA) 연산 및 셋
        const ma7 = 계산SMA(closes, 7);
        const ma25 = 계산SMA(closes, 25);
        const ma99 = 계산SMA(closes, 99);

        chartData.MA7시리즈.setData(매핑지표데이터(times, ma7));
        chartData.MA25시리즈.setData(매핑지표데이터(times, ma25));
        chartData.MA99시리즈.setData(매핑지표데이터(times, ma99));

        // 차트 스케일 자동 맞춤
        chartData.메인차트.timeScale().fitContent();
    });
}

function 매핑지표데이터(times, values) {
    return times.map((t, idx) => ({
        time: t,
        value: isNaN(values[idx]) ? 0 : values[idx]
    })).filter(item => item.value !== 0);
}

`;

const finalContent = beforePart + pristineLoaders + afterPart;
fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('[SUCCESS] app.js의 차트와 초기화 로더 영역이 완벽하게 전면 갱신되었습니다!');
