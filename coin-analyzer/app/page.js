'use client';

import { useEffect, useState, useRef } from 'react';

// Next.js & Tailwind CSS 기반 실시간 퀀트 코인 분석 대시보드
export default function Home() {
    const [symbol, setSymbol] = useState('BTCUSDT');
    const [marketData, setMarketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showWarning, setShowWarning] = useState(false);
    const [priceInput, setPriceInput] = useState('BTCUSDT');
    const containerRef = useRef(null);

    // 1. 실시간 펀딩비, 미결제약정(OI), VPVR 데이터 폴링
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/binance-data?symbol=${symbol}`);
                if (!res.ok) throw new Error('API fetch failed');
                const data = await res.json();
                
                if (isMounted) {
                    setMarketData(data);
                    setLoading(false);

                    // OI가 15% 이상 급증했을 때 스퀴즈 경보 팝업 활성화
                    if (data.isSqueezeWarning) {
                        setShowWarning(true);
                    }
                }
            } catch (err) {
                console.error("데이터 로딩 실패:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 4000); // 4초마다 갱신

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [symbol]);

    // 2. TradingView Advanced Chart 위젯 연동 및 보조 지표 통합
    useEffect(() => {
        const scriptId = 'tradingview-widget-script';
        let script = document.getElementById(scriptId);

        const initWidget = () => {
            if (typeof window !== 'undefined' && window.TradingView && containerRef.current) {
                containerRef.current.innerHTML = ''; // 이전 차트 초기화
                new window.TradingView.widget({
                    width: '100%',
                    height: 500,
                    symbol: `BINANCE:${symbol}P`,
                    interval: '60',
                    timezone: 'Asia/Seoul',
                    theme: 'dark',
                    style: '1',
                    locale: 'kr',
                    toolbar_bg: '#0f172a',
                    enable_publishing: false,
                    hide_side_toolbar: false,
                    allow_symbol_change: true,
                    container_id: containerRef.current.id,
                    // 사용자 요청 지표 (MA, RSI, CCI, MACD) 기본 로드 설정
                    studies: [
                        {
                            name: "Moving Average Simple",
                            inputs: { length: 20 }
                        },
                        {
                            name: "Moving Average Simple",
                            inputs: { length: 60 }
                        },
                        {
                            name: "Moving Average Simple",
                            inputs: { length: 120 }
                        },
                        {
                            name: "Moving Average Simple",
                            inputs: { length: 200 }
                        },
                        "RSI@tv-basicstudies",
                        "CCI@tv-basicstudies",
                        "MACD@tv-basicstudies"
                    ],
                    studies_overrides: {
                        "volume.volume.color.0": "rgba(239, 68, 68, 0.5)",
                        "volume.volume.color.1": "rgba(16, 185, 129, 0.5)",
                    }
                });
            }
        };

        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://s3.tradingview.com/tv.js';
            script.type = 'text/javascript';
            script.async = true;
            script.onload = initWidget;
            document.head.appendChild(script);
        } else {
            // 스크립트가 이미 로드된 경우
            if (window.TradingView) {
                initWidget();
            } else {
                script.addEventListener('load', initWidget);
            }
        }

        return () => {
            if (script) {
                script.removeEventListener('load', initWidget);
            }
        };
    }, [symbol]);

    // 3. 코인 검색 핸들러
    const handleSearch = (e) => {
        e.preventDefault();
        const formatted = priceInput.toUpperCase().trim();
        if (formatted) {
            setSymbol(formatted);
            setLoading(true);
        }
    };

    // 실시간 원화 가격 계산 및 표시 도우미
    const getKrwPrice = (usdtPrice) => {
        if (!marketData || !marketData.exchangeRate) return '계산 중...';
        const krw = usdtPrice * marketData.exchangeRate;
        return `${Math.round(krw).toLocaleString()} KRW`;
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 selection:bg-purple-600 selection:text-white">
            {/* 상단 헤더 영역 */}
            <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">QUANT ADVANCED COIN ANALYZER</h1>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Antigravity Premium Analytics</p>
                    </div>
                </div>

                {/* 심볼 검색 바 */}
                <form onSubmit={handleSearch} className="flex gap-2">
                    <input 
                        type="text" 
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="Ex) BTCUSDT, ETHUSDT"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-200 transition"
                    />
                    <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-5 py-2 rounded-lg shadow-lg shadow-purple-600/30 active:scale-95 transition-all">
                        조회
                    </button>
                </form>
            </header>

            {/* 대형 스퀴즈 경고 팝업 모달 */}
            {showWarning && marketData && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-300">
                    <div className="bg-gradient-to-b from-red-950/50 to-slate-900 border-2 border-red-500/40 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-red-500/10 text-center animate-bounce">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 text-red-500">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <h3 className="text-xl font-black text-red-400 mb-2">🔥 롱/숏 스퀴즈 위험 경보 🔥</h3>
                        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                            현재 <span className="font-bold text-white">{symbol}</span>의 미결제약정(OI)이 직전 1시간 평균 대비 <span className="font-bold text-red-400">{marketData.oiIncreasePercent.toFixed(1)}%</span> 급증했습니다. 급격한 청산 유도 무빙에 유의하세요.
                        </p>
                        <button 
                            onClick={() => setShowWarning(false)}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/30"
                        >
                            위험 인지 및 닫기
                        </button>
                    </div>
                </div>
            )}

            {/* 대시보드 본문 레이아웃 */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* 좌측: 실시간 차트 및 가격 안내 */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        {/* 차트 헤더 정보 */}
                        <div className="p-6 bg-slate-900/60 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <span className="text-xs font-black text-purple-400 uppercase tracking-widest">LIVE INTERACTIVE CHART</span>
                                <h2 className="text-2xl font-black text-white tracking-tight">{symbol} Futures Chart</h2>
                            </div>
                            
                            {/* USDT 기준 가격과 원화(KRW) 표시 */}
                            {marketData && (
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 font-semibold">실시간 원화 환산가 (환율: {marketData.exchangeRate}원)</div>
                                    <div className="text-lg font-black text-emerald-400 animate-pulse">
                                        ({getKrwPrice(marketData.pocPrice)})
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TradingView 위젯 컨테이너 */}
                        <div id="tradingview-candlestick-container" ref={containerRef} className="w-full bg-slate-950 min-h-[500px]" />
                    </div>

                    {/* VPVR 매물대 시각화 차트 가로선 안내 패널 */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            Volume Profile (VPVR) 30일 가격 집중도
                        </h3>
                        {marketData && marketData.vpvrData ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-2">
                                    <span>가격대 (Bin Price)</span>
                                    <span>비율 / 거래 집중 누적량</span>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {marketData.vpvrData.map((bar, idx) => {
                                        const maxVol = Math.max(...marketData.vpvrData.map(d => d.volume));
                                        const percentage = maxVol > 0 ? (bar.volume / maxVol) * 100 : 0;
                                        const isPoc = Math.abs(bar.price - marketData.pocPrice) < (marketData.pocPrice * 0.01);
                                        return (
                                            <div key={idx} className="flex items-center gap-4">
                                                <span className={`text-xs font-semibold w-24 ${isPoc ? 'text-yellow-400 font-black' : 'text-slate-300'}`}>
                                                    {bar.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                                                </span>
                                                <div className="flex-1 bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                                                    <div 
                                                        style={{ width: `${percentage}%` }}
                                                        className={`h-full rounded-full transition-all duration-500 ${isPoc ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-purple-600 to-indigo-500'}`}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-slate-400 w-12 text-right">
                                                    {percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-sm">VPVR 연산 대기 중...</div>
                        )}
                    </div>
                </div>

                {/* 우측: 퀀트 사이드바 (OI, 펀딩비, 매물대 지지/저항선, 지갑 흐름) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* 실시간 퀀트 지표 카드 */}
                    <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-black text-white mb-6 border-b border-slate-800 pb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            Real-time Quant Metrics
                        </h3>
                        
                        {loading ? (
                            <div className="text-center py-10">
                                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <span className="text-sm text-slate-400">바이낸스 선물 엔진 연결 중...</span>
                            </div>
                        ) : marketData ? (
                            <div className="space-y-6">
                                {/* 실시간 펀딩비 */}
                                <div>
                                    <div className="text-xs text-slate-400 font-semibold mb-1">실시간 펀딩비 (Funding Rate)</div>
                                    <div className="text-2xl font-black tracking-tight text-white">
                                        {(marketData.fundingRate * 100).toFixed(4)}%
                                    </div>
                                </div>

                                {/* 미결제약정 */}
                                <div>
                                    <div className="text-xs text-slate-400 font-semibold mb-1">미결제약정 (Open Interest)</div>
                                    <div className="text-2xl font-black tracking-tight text-white">
                                        {marketData.currentOI.toLocaleString()} <span className="text-xs text-slate-400 font-normal">Cont</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        1시간 평균 대비:{' '}
                                        <span className={`font-black ${marketData.oiIncreasePercent >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {marketData.oiIncreasePercent >= 0 ? '+' : ''}
                                            {marketData.oiIncreasePercent.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                {/* VPVR 자동 산출 지지/저항선 */}
                                <div className="border-t border-slate-800 pt-4 space-y-4">
                                    <div>
                                        <div className="text-xs text-red-400 font-black mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                            강력 저항선 (Resistance Level)
                                        </div>
                                        <div className="text-xl font-black text-slate-200">
                                            {marketData.resistancePrice.toLocaleString()} USDT
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            ({getKrwPrice(marketData.resistancePrice)})
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-emerald-400 font-black mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                            강력 지지선 (Support Level)
                                        </div>
                                        <div className="text-xl font-black text-slate-200">
                                            {marketData.supportPrice.toLocaleString()} USDT
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            ({getKrwPrice(marketData.supportPrice)})
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* 주요 거래소 지갑 흐름 매칭 카드 */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                            Exchange Inflow / Outflow
                        </h3>
                        {marketData && marketData.exchangeFlow ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 text-xs text-slate-400 border-b border-slate-800 pb-2 font-bold">
                                    <span>거래소</span>
                                    <span className="text-right text-emerald-400">입금량</span>
                                    <span className="text-right text-red-400">출금량</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 text-xs">
                                        <span className="font-semibold text-slate-300">Binance</span>
                                        <span className="text-right text-emerald-400 font-medium">+{marketData.exchangeFlow.binance.inflow}</span>
                                        <span className="text-right text-red-400 font-medium">-{marketData.exchangeFlow.binance.outflow}</span>
                                    </div>
                                    <div className="grid grid-cols-3 text-xs">
                                        <span className="font-semibold text-slate-300">OKX</span>
                                        <span className="text-right text-emerald-400 font-medium">+{marketData.exchangeFlow.okx.inflow}</span>
                                        <span className="text-right text-red-400 font-medium">-{marketData.exchangeFlow.okx.outflow}</span>
                                    </div>
                                    <div className="grid grid-cols-3 text-xs">
                                        <span className="font-semibold text-slate-300">Coinbase</span>
                                        <span className="text-right text-emerald-400 font-medium">+{marketData.exchangeFlow.coinbase.inflow}</span>
                                        <span className="text-right text-red-400 font-medium">-{marketData.exchangeFlow.coinbase.outflow}</span>
                                    </div>
                                </div>
                                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-400">순 입출금 (Netflow)</span>
                                    <span className={`font-black ${marketData.exchangeFlow.totalNetFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {marketData.exchangeFlow.totalNetFlow >= 0 ? '+' : ''}
                                        {marketData.exchangeFlow.totalNetFlow} BTC
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-sm">지갑 흐름 집계 중...</div>
                        )}
                    </div>
                </div>

            </div>
        </main>
    );
}
