/*
 * 시장 데이터 무결성 도우미
 *
 * 차트에 표시하는 진행 중인 봉과 분석에 사용하는 확정 봉을 분리합니다.
 * 브라우저와 Node.js 테스트에서 같은 로직을 재사용할 수 있도록 UMD 형태로 제공합니다.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.MarketDataIntegrity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    /**
     * 실제로 종료된 봉만 반환합니다.
     * 합성 데이터(synthetic)는 실데이터 분석에 절대 포함하지 않습니다.
     */
    function closedCandles(candles, nowMs) {
        const now = isFiniteNumber(nowMs) ? nowMs : Date.now();
        if (!Array.isArray(candles)) return [];

        return candles.filter(candle => {
            if (!candle || candle.synthetic === true) return false;
            if (candle.isClosed === true) return true;
            if (candle.isClosed === false) return false;
            return isFiniteNumber(candle.closeTime) && candle.closeTime <= now;
        });
    }

    /**
     * 동일 시작시각 봉은 교체하고 새 봉은 뒤에 추가합니다.
     * 이 함수는 전용 1분봉 버퍼에만 사용하여 다른 시간봉과 섞이지 않게 합니다.
     */
    function upsertCandle(buffer, candle, maxLength) {
        const target = Array.isArray(buffer) ? buffer : [];
        const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 500;
        if (!candle || !isFiniteNumber(candle.time)) return target;

        const last = target[target.length - 1];
        if (!last || candle.time > last.time) {
            target.push(candle);
        } else if (candle.time === last.time) {
            target[target.length - 1] = candle;
        }

        while (target.length > limit) target.shift();
        return target;
    }

    return { closedCandles, upsertCandle };
});
