import { NextResponse } from 'next/server';

// 바이낸스 선물 API 연동 백엔드 라우트 핸들러
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';

    try {
        // 1. 실시간 펀딩비 및 미결제약정(OI) 조회
        // premiumIndex API를 통해 실시간 펀딩비(lastFundingRate) 조회 가능
        const premiumRes = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { cache: 'no-store' });
        const premiumData = await premiumRes.json();
        const fundingRate = parseFloat(premiumData.lastFundingRate || 0);

        // openInterest API를 통해 현재 실시간 미결제약정(OI) 조회
        const oiRes = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`, { cache: 'no-store' });
        const oiData = await oiRes.json();
        const currentOI = parseFloat(oiData.openInterest || 0);

        // 2. 직전 1시간 평균 OI 데이터 수집 (5분 단위, 12개 조회)
        const oiHistRes = await fetch(`https://fapi.binance.com/fapi/v1/openInterestHist?symbol=${symbol}&period=5m&limit=12`, { cache: 'no-store' });
        let averageOI_1h = currentOI; // 기본값
        if (oiHistRes.ok) {
            const oiHistData = await oiHistRes.json();
            if (Array.isArray(oiHistData) && oiHistData.length > 0) {
                const sum = oiHistData.reduce((acc, curr) => acc + parseFloat(curr.sumOpenInterest || 0), 0);
                averageOI_1h = sum / oiHistData.length;
            }
        }

        // OI 급증 여부 판별 (15% 이상 급증 여부)
        const oiIncreasePercent = averageOI_1h > 0 ? ((currentOI - averageOI_1h) / averageOI_1h) * 100 : 0;
        const isSqueezeWarning = oiIncreasePercent >= 15.0;

        // 3. VPVR(거래량 프로파일) 산출 (최근 30일간의 1시간봉 720개 조회)
        const klinesRes = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=720`, { cache: 'no-store' });
        let vpvrData = [];
        let supportPrice = 0;
        let resistancePrice = 0;
        let pocPrice = 0;

        if (klinesRes.ok) {
            const klines = await klinesRes.json();
            if (Array.isArray(klines) && klines.length > 0) {
                // 고가와 저가의 범위를 구함
                let minPrice = Infinity;
                let maxPrice = -Infinity;
                const parsedCandles = klines.map(k => {
                    const close = parseFloat(k[4]);
                    const volume = parseFloat(k[5]);
                    if (close < minPrice) minPrice = close;
                    if (close > maxPrice) maxPrice = close;
                    return { close, volume };
                });

                // 가격대를 30개의 매물 구간(Bin)으로 세분화
                const binCount = 30;
                const binSize = (maxPrice - minPrice) / binCount;
                const bins = Array.from({ length: binCount }, (_, i) => ({
                    low: minPrice + i * binSize,
                    high: minPrice + (i + 1) * binSize,
                    volume: 0
                }));

                // 각 캔들의 종가를 매핑하여 거래량 누적
                parsedCandles.forEach(candle => {
                    const binIdx = Math.min(
                        Math.floor((candle.close - minPrice) / binSize),
                        binCount - 1
                    );
                    if (binIdx >= 0 && binIdx < binCount) {
                        bins[binIdx].volume += candle.volume;
                    }
                });

                // 최대 거래량 구간(POC) 도출
                let maxVol = 0;
                let maxVolIdx = 0;
                bins.forEach((b, idx) => {
                    if (b.volume > maxVol) {
                        maxVol = b.volume;
                        maxVolIdx = idx;
                    }
                });
                pocPrice = (bins[maxVolIdx].low + bins[maxVolIdx].high) / 2;

                // POC 기준 상하단 영역에서 지지선과 저항선 도출
                // 저항선: POC 상단 중 가장 거래가 많이 몰린 구간
                let maxUpperVol = 0;
                let upperIdx = maxVolIdx;
                for (let i = maxVolIdx + 1; i < binCount; i++) {
                    if (bins[i].volume > maxUpperVol) {
                        maxUpperVol = bins[i].volume;
                        upperIdx = i;
                    }
                }
                resistancePrice = (bins[upperIdx].low + bins[upperIdx].high) / 2;

                // 지지선: POC 하단 중 가장 거래가 많이 몰린 구간
                let maxLowerVol = 0;
                let lowerIdx = maxVolIdx;
                for (let i = 0; i < maxVolIdx; i++) {
                    if (bins[i].volume > maxLowerVol) {
                        maxLowerVol = bins[i].volume;
                        lowerIdx = i;
                    }
                }
                supportPrice = (bins[lowerIdx].low + bins[lowerIdx].high) / 2;

                vpvrData = bins.map(b => ({
                    price: (b.low + b.high) / 2,
                    volume: b.volume
                }));
            }
        }

        // 4. 주요 거래소 지갑 온체인 유출입량 모의 데이터 매칭
        // 바이낸스, OKX, 코인베이스 등 주요 거래소의 실시간 유입/유출 추정 데이터를 취합
        const exchangeFlow = {
            binance: { inflow: 1250.45, outflow: 980.20, netFlow: 270.25 },
            okx: { inflow: 450.12, outflow: 620.45, netFlow: -170.33 },
            coinbase: { inflow: 890.30, outflow: 750.10, netFlow: 140.20 },
            totalNetFlow: 240.12 // 단위: BTC 또는 해당 코인 규모 상당
        };

        // 실시간 환율 API 호출 (USD to KRW)
        let exchangeRate = 1350.0; // 기본 고정 환율
        try {
            const exRes = await fetch('https://api.manana.kr/exchange/rate/KRW/USD.json', { next: { revalidate: 3600 } });
            if (exRes.ok) {
                const exData = await exRes.json();
                if (Array.isArray(exData) && exData[0]) {
                    exchangeRate = parseFloat(exData[0].rate || 1350.0);
                }
            }
        } catch (exErr) {
            console.error("환율 API 호출 실패, 기본값 사용:", exErr);
        }

        return NextResponse.json({
            symbol,
            fundingRate,
            currentOI,
            averageOI_1h,
            oiIncreasePercent,
            isSqueezeWarning,
            pocPrice,
            supportPrice,
            resistancePrice,
            vpvrData,
            exchangeFlow,
            exchangeRate
        });

    } catch (error) {
        console.error("바이낸스 데이터 백엔드 연동 에러:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
