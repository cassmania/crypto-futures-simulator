/* 보조지표 패널 — trading-chart 엔진(indicator_engine.js)을 선택된 분할 차트 하나에 적용한다.
   11개 지표 전략을 그 차트 봉으로 백테스트(워크포워드)해 국면별 최적 지표를 자동 적용하고,
   선·매매 타점·진입/손절/목표선을 차트에, 오실레이터와 요약을 패널에 그린다. 선물이라 롱·숏 양방향. */
(function () {
    "use strict";
    if (!window.Engine || !window.LightweightCharts) return;

    const COL = { buy: "#12a150", sell: "#d64545", accent: "#c96442", blue: "#5b8ff9", violet: "#8b6fd6",
        teal: "#2aa198", gray: "#74706a", line: "#e3dfd3" };
    const OPT = { mode: "both", fee: 0.0005 };  // 바이낸스 선물 테이커 수수료
    const $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    let 선택 = "auto";
    try { 선택 = localStorage.getItem("선물시뮬레이터_보조지표") || "auto"; } catch {}
    let 활성idx = -1, 그린차트 = null, 오실 = null, 오실시리즈 = [], 범위해제 = null;

    function 오실차트() {
        if (오실) return 오실;
        const host = $("ind-osc");
        if (!host) return null;
        오실 = LightweightCharts.createChart(host, {
            width: host.clientWidth || 300, height: host.clientHeight || 120,
            layout: { background: { type: "solid", color: "#fbfaf6" }, textColor: "#74706a", fontSize: 11 },
            grid: { vertLines: { color: "#efede5" }, horzLines: { color: "#efede5" } },
            rightPriceScale: { borderColor: "#e3dfd3" },
            timeScale: { borderColor: "#e3dfd3", visible: false },
            handleScroll: false, handleScale: false
        });
        new ResizeObserver(() => 오실.applyOptions({ width: host.clientWidth, height: host.clientHeight })).observe(host);
        return 오실;
    }

    // 신호 엔진이 setMarkers로 자기 마커만 다시 넣어도 보조지표 마커가 지워지지 않게 합친다.
    function 마커병합(series) {
        if (series._indPatched) return;
        const 원본 = series.setMarkers.bind(series);
        series.setMarkers = m => 원본([...(m || []), ...(series._indMarkers || [])].sort((a, b) => a.time - b.time));
        series._indPatched = true;
    }

    function 지우기(c) {
        if (!c) return;
        (c._indSeries || []).forEach(s => { try { c.메인차트.removeSeries(s); } catch {} });
        (c._indLines || []).forEach(l => { try { c.캔들시리즈.removePriceLine(l); } catch {} });
        c._indSeries = []; c._indLines = [];
        if (c.캔들시리즈) { c.캔들시리즈._indMarkers = []; try { c.캔들시리즈.setMarkers(c.캔들시리즈._markers || []); } catch {} }
    }

    function 통계문구(st) {
        if (!st || !st.trades) return "검증 거래 없음";
        return "승률 " + (st.winRate * 100).toFixed(0) + "% · PF " + st.pf.toFixed(2) + " · 수익 "
            + (st.ret >= 0 ? "+" : "") + (st.ret * 100).toFixed(1) + "% · " + st.trades + "회";
    }
    function 신뢰도(st) {
        if (!st || st.trades < 5) return ["표본 부족", "lo"];
        if (st.pf >= 1.5 && st.lb >= 0.4 && st.ret > 0) return ["신뢰도 높음", "hi"];
        if (st.pf >= 1.1 && st.ret > 0) return ["신뢰도 보통", "mid"];
        return ["신뢰도 낮음", "lo"];
    }

    function 그리기(idx) {
        const 차트들 = typeof 상태 !== "undefined" && 상태.차트객체 && 상태.차트객체.분할차트들;
        const c = 차트들 && 차트들[idx];
        if (그린차트 && 그린차트 !== c) 지우기(그린차트);
        활성idx = idx;
        const card = $("ind-card"), head = $("ind-osc-head"), sel = $("ind-sel"), target = $("ind-target");
        if (!c || !c.메인차트 || !c.캔들시리즈) return;
        지우기(c);
        그린차트 = c;
        if (target) target.textContent = "· " + c.코인심볼.replace("USDT", "") + " " + c.시간단위;

        const bars = (c.캔들데이터 || []).filter(b => !b.synthetic).map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
        const osc = 오실차트();
        오실시리즈.forEach(s => { try { osc.removeSeries(s); } catch {} });
        오실시리즈 = [];
        if (bars.length < 120) {
            if (card) card.innerHTML = '<span class="ind-dim">보조지표 백테스트는 120봉 이상 필요 — 이 차트는 ' + bars.length + "봉</span>";
            if (head) head.textContent = "";
            return;
        }
        let a;
        try { a = Engine.analyze(bars, OPT); }
        catch (e) { if (card) card.innerHTML = '<span class="ind-dim">보조지표 계산 실패</span>'; return; }

        if (sel && sel.options.length < 2) {
            sel.innerHTML = '<option value="auto">자동 (국면별 최적)</option>'
                + Engine.STRATEGIES.map(s => '<option value="' + s.id + '">' + esc(s.name) + "</option>").join("");
        }
        const row = 선택 !== "auto" ? a.rows.find(r => r.id === 선택) : null;
        if (sel) sel.value = row ? 선택 : "auto";
        const v = row
            ? { auto: false, id: row.id, trades: row.trades, open: row.open, pending: row.pending, stats: row.oos }
            : { auto: true, id: a.chosen || a.rows[0].id, trades: a.adaptive.trades, open: a.adaptive.open, pending: a.adaptive.pending, stats: a.adaptive.stats };
        const strat = Engine.STRAT_BY_ID[v.id], built = a.prep.built[v.id];

        const data = arr => bars.map((b, i) => { const x = arr[i]; return x == null || !isFinite(x) ? { time: b.time } : { time: b.time, value: x }; });
        const line = (onOsc, arr, color, opts) => {
            const host = onOsc ? osc : c.메인차트;
            const s = host.addLineSeries(Object.assign({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, opts || {}));
            s.setData(data(arr));
            (onOsc ? 오실시리즈 : c._indSeries).push(s);
        };

        built.overlay.forEach(o => {
            if (o.type === "line") line(false, o.data, COL[o.color] || o.color);
            else if (o.type === "st") {
                line(false, o.data.line.map((x, i) => o.data.dir[i] === 1 ? x : null), COL.buy);
                line(false, o.data.line.map((x, i) => o.data.dir[i] === -1 ? x : null), COL.sell);
            } else if (o.type === "bb") {
                line(false, o.data.upper, COL.violet, { lineWidth: 1 });
                line(false, o.data.mid, COL.accent, { lineWidth: 1, lineStyle: 2 });
                line(false, o.data.lower, COL.violet, { lineWidth: 1 });
            } else if (o.type === "band") {
                line(false, o.upper, COL.teal, { lineWidth: 1 }); line(false, o.lower, COL.teal, { lineWidth: 1 });
            } else if (o.type === "dots") {
                line(false, o.data, COL.accent, { lineWidth: 1, lineStyle: 1 });
            }
        });

        const g = built.osc;
        let title = "";
        const guide = (val, color) => line(true, bars.map(() => val), color || COL.line, { lineWidth: 1, lineStyle: 2 });
        if (g.type === "rsi") { guide(70, COL.sell); guide(30, COL.buy); guide(50); line(true, g.data, COL.accent, { lastValueVisible: true }); title = "RSI 14"; }
        else if (g.type === "macd") {
            const h = osc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
            h.setData(bars.map((b, i) => { const x = g.data.hist[i]; return x == null ? { time: b.time } : { time: b.time, value: x, color: x >= 0 ? "rgba(18,161,80,.5)" : "rgba(214,69,69,.5)" }; }));
            오실시리즈.push(h);
            line(true, g.data.line, COL.accent, { lastValueVisible: true }); line(true, g.data.signal, COL.blue, { lineWidth: 1 });
            title = "MACD 12/26/9";
        } else if (g.type === "stoch") { guide(80, COL.sell); guide(20, COL.buy); line(true, g.data.K, COL.accent, { lastValueVisible: true }); line(true, g.data.D, COL.blue, { lineWidth: 1 }); title = "스토캐스틱 14/3/3"; }
        else if (g.type === "cci") { guide(100, COL.sell); guide(-100, COL.buy); guide(0); line(true, g.data, COL.accent, { lastValueVisible: true }); title = "CCI 20"; }
        if (head) head.textContent = title;

        if (범위해제) 범위해제();
        const ts = c.메인차트.timeScale(), 맞추기 = r => { if (r) osc.timeScale().setVisibleLogicalRange(r); };
        ts.subscribeVisibleLogicalRangeChange(맞추기);
        범위해제 = () => { try { ts.unsubscribeVisibleLogicalRangeChange(맞추기); } catch {} };
        맞추기(ts.getVisibleLogicalRange());

        const 방향 = d => d === 1 ? "롱" : "숏";
        const ms = [];
        v.trades.forEach(t => {
            const eb = bars[t.entryIdx], xb = bars[t.exitIdx];
            if (!eb || !xb) return;
            ms.push({ time: eb.time, position: t.dir === 1 ? "belowBar" : "aboveBar", shape: t.dir === 1 ? "arrowUp" : "arrowDown",
                color: t.dir === 1 ? COL.buy : COL.sell, text: 방향(t.dir) });
            ms.push({ time: xb.time, position: t.dir === 1 ? "aboveBar" : "belowBar", shape: "circle", color: t.reason === "stop" ? COL.gray : COL.accent,
                text: (t.reason === "stop" ? "손절 " : "청산 ") + (t.pnl >= 0 ? "+" : "") + (t.pnl * 100).toFixed(1) + "%" });
        });
        if (v.open && bars[v.open.idx]) ms.push({ time: bars[v.open.idx].time, position: v.open.dir === 1 ? "belowBar" : "aboveBar",
            shape: v.open.dir === 1 ? "arrowUp" : "arrowDown", color: v.open.dir === 1 ? COL.buy : COL.sell, text: 방향(v.open.dir) + " 보유" });
        if (v.pending) ms.push({ time: bars[bars.length - 1].time, position: "aboveBar", shape: "circle", color: COL.accent,
            text: v.pending.type === "exit" ? "청산 대기" : 방향(v.pending.dir) + " 대기" });
        마커병합(c.캔들시리즈);
        c.캔들시리즈._indMarkers = ms;
        c.캔들시리즈.setMarkers(c.캔들시리즈._markers || []);

        let lv = null;
        const atr = a.context.atr || 0;
        if (v.open) {
            const risk = Math.abs(v.open.entry - v.open.stop), d = v.open.dir;
            lv = { entry: v.open.entry, stop: v.open.stop, tp1: v.open.entry + d * risk * 1.5, tp2: v.open.entry + d * risk * 3 };
        } else if (v.pending && v.pending.type === "enter") {
            const e = bars[bars.length - 1].close, d = v.pending.dir, r = 2.5 * atr;
            lv = { entry: e, stop: e - d * r, tp1: e + d * r * 1.5, tp2: e + d * r * 3 };
        }
        const pl = (price, color, t, style, width) => {
            if (isFinite(price)) c._indLines.push(c.캔들시리즈.createPriceLine({ price, color, lineWidth: width || 1, lineStyle: style, axisLabelVisible: true, title: t }));
        };
        if (lv) { pl(lv.entry, COL.accent, "지표 진입", 0, 2); pl(lv.stop, COL.gray, "지표 손절", 1); pl(lv.tp1, COL.accent, "1차 목표", 1); pl(lv.tp2, COL.accent, "2차 목표", 1); }

        if (card) {
            const [cl, cc] = 신뢰도(v.stats), x = a.context, f = n => n == null ? "—" : n.toFixed(1);
            const 상태문구 = v.open
                ? "<b>" + 방향(v.open.dir) + " 보유</b> · 진입 " + v.open.entry.toLocaleString() + " · 평가 " + (v.open.unreal >= 0 ? "+" : "") + (v.open.unreal * 100).toFixed(2) + "%"
                : v.pending ? "<b>" + (v.pending.type === "exit" ? "청산 신호" : 방향(v.pending.dir) + " 신호") + "</b> · 다음 봉 시가 체결 가정"
                : '<b class="ind-dim">관망</b>';
            card.innerHTML =
                '<div class="ind-cell"><span class="ind-k">현재 국면</span><b>' + esc(Engine.REGIME_NAME[a.regime] || "—") + '</b><span class="ind-dim">ADX ' + f(x.adx) + " · +DI " + f(x.pdi) + " / −DI " + f(x.mdi) + "</span></div>"
                + '<div class="ind-cell"><span class="ind-k">' + (v.auto ? "자동 적용 지표" : "선택 지표") + "</span><b>" + esc(strat.name) + '</b><span class="ind-dim">' + esc(strat.kind + " · " + strat.desc) + "</span></div>"
                + '<div class="ind-cell"><span class="ind-k">워크포워드 검증</span><b>' + 통계문구(v.stats) + '</b><span><span class="ind-pill ' + cc + '">' + cl + "</span></span></div>"
                + '<div class="ind-cell"><span class="ind-k">지표 상태</span><span>' + 상태문구 + '</span><span class="ind-dim">봉 마감 신호 · 다음 봉 시가 체결 · 수수료 0.05% · 2.5×ATR 손절 · 롱/숏</span></div>';
        }
    }

    window.보조지표그리기 = 그리기;

    const 원본강조 = window.활성차트강조테두리;
    if (원본강조) window.활성차트강조테두리 = function (i) { 원본강조.apply(this, arguments); 그리기(i); };

    const 원본로드 = window.분할차트캔들데이터로드;
    if (원본로드) window.분할차트캔들데이터로드 = async function (i) {
        const r = await 원본로드.apply(this, arguments);
        if (i === 활성idx) 그리기(i);
        return r;
    };

    document.addEventListener("change", e => {
        if (e.target && e.target.id === "ind-sel") {
            선택 = e.target.value;
            try { localStorage.setItem("선물시뮬레이터_보조지표", 선택); } catch {}
            if (활성idx >= 0) 그리기(활성idx);
        }
    });

    // 첫 활성 차트는 app.js 초기화 중에 이미 강조됐을 수 있으니 데이터가 차면 한 번 그린다.
    const 첫그리기 = setInterval(() => {
        const 차트들 = typeof 상태 !== "undefined" && 상태.차트객체 && 상태.차트객체.분할차트들;
        if (!차트들) return;
        let i = 차트들.findIndex((_, k) => { const w = $("chart-wrapper-" + k); return w && w.classList.contains("active-chart"); });
        if (i < 0) i = 0;
        if (차트들[i] && 차트들[i].캔들데이터 && 차트들[i].캔들데이터.length) { clearInterval(첫그리기); if (활성idx < 0) 그리기(i); }
    }, 1000);
})();
