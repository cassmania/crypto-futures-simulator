/**
 * 코인분석스킬 V4.1 보고서 모듈.
 * 주문·자동매매에는 관여하지 않고 확정봉과 실제 조회 데이터만 화면에 표시합니다.
 */
(function (root) {
    "use strict";

    const cache = { fx: null, fxAt: 0, dominance: null, dominanceAt: 0 };
    const finite = value => typeof value === "number" && Number.isFinite(value);
    const sma = (values, period) => values.length >= period
        ? values.slice(-period).reduce((sum, value) => sum + value, 0) / period : null;
    const emaSeries = (values, period) => {
        if (!values.length) return [];
        const multiplier = 2 / (period + 1), result = [values[0]];
        for (let i = 1; i < values.length; i++) result.push(values[i] * multiplier + result[i - 1] * (1 - multiplier));
        return result;
    };
    function rsi(values, period = 14) {
        if (values.length <= period) return null;
        let gain = 0, loss = 0;
        for (let i = 1; i <= period; i++) {
            const diff = values[i] - values[i - 1];
            gain += Math.max(diff, 0); loss += Math.max(-diff, 0);
        }
        gain /= period; loss /= period;
        for (let i = period + 1; i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            gain = (gain * (period - 1) + Math.max(diff, 0)) / period;
            loss = (loss * (period - 1) + Math.max(-diff, 0)) / period;
        }
        return loss ? 100 - 100 / (1 + gain / loss) : 100;
    }
    function cci(candles, period = 20) {
        if (candles.length < period) return null;
        const typical = candles.map(c => (c.high + c.low + c.close) / 3);
        const recent = typical.slice(-period), average = sma(typical, period);
        const deviation = recent.reduce((sum, value) => sum + Math.abs(value - average), 0) / period;
        return deviation ? (recent.at(-1) - average) / (0.015 * deviation) : 0;
    }
    function macd(values) {
        if (values.length < 35) return null;
        const fast = emaSeries(values, 12), slow = emaSeries(values, 26);
        const line = fast.map((value, index) => value - slow[index]);
        const signal = emaSeries(line, 9);
        return { line: line.at(-1), signal: signal.at(-1), histogram: line.at(-1) - signal.at(-1) };
    }
    function stochastic(candles, period = 14, smoothK = 3, smoothD = 3) {
        if (candles.length < period + smoothK + smoothD - 2) return null;
        const raw = [];
        for (let i = period - 1; i < candles.length; i++) {
            const window = candles.slice(i - period + 1, i + 1);
            const high = Math.max(...window.map(c => c.high)), low = Math.min(...window.map(c => c.low));
            raw.push(high === low ? 50 : (candles[i].close - low) / (high - low) * 100);
        }
        const kSeries = [];
        for (let i = smoothK - 1; i < raw.length; i++) kSeries.push(sma(raw.slice(0, i + 1), smoothK));
        return { k: kSeries.at(-1), d: sma(kSeries, smoothD) };
    }
    function anchoredVwap(candles) {
        let priceVolume = 0, volume = 0;
        candles.forEach(c => { priceVolume += ((c.high + c.low + c.close) / 3) * c.volume; volume += c.volume; });
        return volume ? priceVolume / volume : null;
    }
    function volumeProfile(candles, bins = 40) {
        if (candles.length < 20) return null;
        const low = Math.min(...candles.map(c => c.low)), high = Math.max(...candles.map(c => c.high));
        if (!(high > low)) return null;
        const step = (high - low) / bins, volumes = Array(bins).fill(0);
        candles.forEach(c => {
            const start = Math.max(0, Math.floor((c.low - low) / step));
            const end = Math.min(bins - 1, Math.floor((c.high - low) / step));
            const share = c.volume / Math.max(1, end - start + 1);
            for (let i = start; i <= end; i++) volumes[i] += share;
        });
        const total = volumes.reduce((sum, value) => sum + value, 0);
        if (!(total > 0)) return null;
        const order = volumes.map((_, index) => index).sort((a, b) => volumes[b] - volumes[a]);
        const area = []; let accumulated = 0;
        for (const index of order) { area.push(index); accumulated += volumes[index]; if (accumulated >= total * 0.7) break; }
        return { poc: low + step * (order[0] + 0.5), val: low + step * Math.min(...area), vah: low + step * (Math.max(...area) + 1) };
    }
    function calculate(candlesByTf) {
        const frames = {};
        Object.entries(candlesByTf || {}).forEach(([timeframe, source]) => {
            const candles = Array.isArray(source) ? source.slice(-200) : [];
            const closes = candles.map(c => c.close), macdValue = macd(closes);
            frames[timeframe] = {
                bars: candles.length, lastConfirmed: candles.at(-1)?.closeTime || null,
                sma20: sma(closes, 20), sma60: sma(closes, 60), sma120: sma(closes, 120), sma200: sma(closes, 200),
                rsi14: rsi(closes, 14), cci20: cci(candles, 20), macd: macdValue,
                stochastic: stochastic(candles, 14, 3, 3), anchoredVwap: anchoredVwap(candles),
                profile: volumeProfile(candles.slice(-180), 40)
            };
        });
        return { version: "4.1.0", frames };
    }
    async function fetchContext() {
        const now = Date.now();
        if (now - cache.fxAt > 300000) {
            try {
                const response = await fetch("https://api.upbit.com/v1/ticker?markets=KRW-USDT");
                const data = await response.json(), value = +data?.[0]?.trade_price;
                if (finite(value) && value > 0) { cache.fx = value; cache.fxAt = now; }
            } catch (_) { /* 실패값을 생성하지 않습니다. */ }
        }
        if (now - cache.dominanceAt > 300000) {
            try {
                const response = await fetch("https://api.coingecko.com/api/v3/global");
                const data = await response.json(), value = +data?.data?.market_cap_percentage?.usdt;
                if (finite(value) && value > 0) { cache.dominance = value; cache.dominanceAt = now; }
            } catch (_) { /* 실패값을 생성하지 않습니다. */ }
        }
        return cache;
    }
    function rr(entry, stop, target) {
        const risk = Math.abs(entry - stop), reward = Math.abs(target - entry);
        return risk > 0 ? reward / risk : null;
    }
    async function render(input) {
        const box = document.getElementById("v41-report");
        if (!box || !input?.symbol || !(input.price > 0)) return;
        const result = calculate(input.candlesByTf), context = await fetchContext();
        const primaryTf = result.frames["4h"]?.bars >= 120 ? "4h" : (result.frames["1h"] ? "1h" : Object.keys(result.frames)[0]);
        const frame = result.frames[primaryTf] || {}, levels = input.levels || {};
        const digits = Number.isInteger(input.decimals) ? input.decimals : 2;
        const price = value => finite(value) ? `${value.toLocaleString("en-US", {minimumFractionDigits:digits,maximumFractionDigits:digits})} USDT${context.fx ? ` (${Math.round(value*context.fx).toLocaleString("ko-KR")}원)` : ""}` : "현재 실시간 데이터 확인 불가";
        const ma = [frame.sma20,frame.sma60,frame.sma120,frame.sma200];
        const maText = ma.every(finite) ? (frame.sma20>frame.sma60&&frame.sma60>frame.sma120&&frame.sma120>frame.sma200?"정배열":frame.sma20<frame.sma60&&frame.sma60<frame.sma120&&frame.sma120<frame.sma200?"역배열":"혼조") : "장기 표본 부족";
        const profile = frame.profile ? `POC ${price(frame.profile.poc)} · VAH ${price(frame.profile.vah)} · VAL ${price(frame.profile.val)} · 최근 180개 확정봉 OHLC 범위 균등분배 근사` : "현재 실시간 데이터 확인 불가";
        const derivatives = input.derivatives || {};
        const funding = finite(derivatives.fundingRatePct) ? `${derivatives.fundingRatePct >= 0 ? "+" : ""}${derivatives.fundingRatePct.toFixed(4)}%` : "현재 실시간 데이터 확인 불가";
        const oi = finite(derivatives.openInterest) ? `${derivatives.openInterest.toLocaleString("en-US")} ${input.symbol.replace("USDT", "")} 계약수량 · 명목가 약 ${(derivatives.openInterest*input.price).toLocaleString("en-US",{maximumFractionDigits:0})} USDT` : "현재 실시간 데이터 확인 불가";
        const long = levels.직상 && levels.직하 ? {entry:levels.직상.price,stop:levels.직하.price,target:levels.resistance?.[1]?.price} : null;
        const short = levels.직하 && levels.직상 ? {entry:levels.직하.price,stop:levels.직상.price,target:levels.support?.[1]?.price} : null;
        const strategy = (label, setup) => {
            if (!setup || !finite(setup.target)) return `${label}: 레벨 부족으로 관망`;
            const ratio = rr(setup.entry, setup.stop, setup.target);
            if (!finite(ratio) || ratio < 1.5) return `${label}: 예상 R/R ${finite(ratio)?ratio.toFixed(2):"산출 불가"}로 최소 1.5 미달 · 관망`;
            return `${label}: ${price(setup.entry)} 확정봉 발동 · TP ${price(setup.target)} · SL ${price(setup.stop)} · R/R ${ratio.toFixed(2)}`;
        };
        const closeTime = frame.lastConfirmed ? new Date(frame.lastConfirmed).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}) : "확인 불가";
        box.innerHTML = `<div class="v41-title">코인분석스킬 V4.1 · ${input.symbol}</div>
          <div class="v41-meta">Binance USDT-M 무기한 · 현재가 ${price(input.price)} · 기준 ${new Date().toLocaleString("ko-KR")} · 마지막 ${primaryTf.toUpperCase()} 확정봉 ${closeTime}<br>환율 ${context.fx?`Upbit KRW-USDT ${context.fx.toLocaleString("ko-KR")}원 · ${new Date(context.fxAt).toLocaleString("ko-KR")}`:"KRW 환산 확인 불가"}</div>
          <div class="v41-part"><b>PART 0 · 데이터 기준 및 USDT.D</b><br>확정봉만 계산 · Binance 공식 공개 API · ${context.dominance?`USDT.D ${context.dominance.toFixed(3)}% · CoinGecko /api/v3/global · ${new Date(context.dominanceAt).toLocaleString("ko-KR")}`:"USDT.D 현재 데이터 확인 불가"}<br><span>USDT.D는 단독 매매 신호가 아닌 위험선호 보조 필터</span></div>
          <div class="v41-part"><b>PART 1 · 기술적 분석</b><br>SMA20/60/120/200 ${maText}<br>RSI(14) ${finite(frame.rsi14)?frame.rsi14.toFixed(1):"표본 부족"} · CCI(20) ${finite(frame.cci20)?frame.cci20.toFixed(1):"표본 부족"} · MACD ${frame.macd?frame.macd.histogram.toFixed(digits):"표본 부족"} · Stochastic(14,3,3) ${frame.stochastic?`%K ${frame.stochastic.k.toFixed(1)} / %D ${frame.stochastic.d.toFixed(1)}`:"표본 부족"}<br>근사 VPVR ${profile}<br>앵커 VWAP ${price(frame.anchoredVwap)} · 조회 구간 시작봉 앵커</div>
          <div class="v41-part"><b>PART 2 · 선물 및 군중 심리</b><br>펀딩비 ${funding}<br>OI ${oi}<br><span>OI 1H 변화율·CVD·청산맵: 현재 실시간 데이터 확인 불가</span></div>
          <div class="v41-part"><b>PART 3 · 온체인 및 고래</b><br><span>거래소 순유입·고래 지갑·MVRV·SOPR: 현재 실시간 데이터 확인 불가</span></div>
          <div class="v41-part"><b>PART 4 · 토큰노믹스 및 뉴스</b><br><span>언락·기관 동향·프로젝트 이벤트·개별 뉴스: 현재 실시간 데이터 확인 불가 · 웹 조사 미수행</span></div>
          <div class="v41-part"><b>PART 5 · 실행 전략 및 위험관리</b><br>${strategy("롱",long)}<br>${strategy("숏",short)}<br>포지션 위험액 = 계좌 평가액 × 0.5~1% · 포지션 크기 = 위험액 ÷ |진입가-손절가| · 레버리지는 손절폭과 청산가로 역산(고정 배수 권장 안 함)<br><span>수수료·슬리피지·펀딩비 미반영 · 조건 충족 전 관망 · 투자 권유가 아닙니다.</span></div>`;
    }

    root.V41SimulatorAnalysis = { VERSION: "4.1.0", calculate, rsi, cci, macd, stochastic, anchoredVwap, volumeProfile, rr, render };
    if (typeof module !== "undefined" && module.exports) module.exports = root.V41SimulatorAnalysis;
})(typeof globalThis !== "undefined" ? globalThis : this);
