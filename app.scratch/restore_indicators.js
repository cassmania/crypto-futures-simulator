const fs = require('fs');

const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\index.html';
let content = fs.readFileSync(targetFile, 'utf8');

const targetStart = '<div id="quant-indicators"';
const targetEnd = '<!-- 2. 온체인 및 선물 군중심리 패널 -->';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `<div id="quant-indicators" class="quant-tab-panel active">
                                    <!-- 🛡️ Antigravity AI 실시간 팩트체크 요약 보드 (Quant Radar Panel) -->
                                    <div class="quant-factcheck-widget" style="background: rgba(240, 185, 11, 0.05); border: 1px dashed rgba(240, 185, 11, 0.3); border-radius: 6px; padding: 10px; margin-bottom: 14px;">
                                        <div style="font-size: 11px; font-weight: 700; color: var(--color-yellow); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                            <i class="fa-solid fa-radar fa-spin-slow"></i> Antigravity AI 퀀트 실시간 팩트체크 위젯
                                        </div>
                                        <div id="quant-radar-facts" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
                                            <span class="fact-badge info" style="background: rgba(132, 142, 156, 0.15); color: #848e9c; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">스캐닝 중...</span>
                                        </div>
                                        <!-- 💡 초보자용 3초 한눈에 퀀트 브리핑 (초보자 마법 가이드) -->
                                        <div id="quant-easy-brief" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(240, 185, 11, 0.2); font-size: 11px; line-height: 1.6; color: #badc58;">
                                            <i class="fa-solid fa-magic text-yellow" style="margin-right: 4px;"></i> <strong>초보자 3초 매매 가이드:</strong> 실시간 지표를 초고속 스캔하여 비유식 쉬운 해설을 연산하고 있습니다... 💡
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>CCI (20) 모멘텀 <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-cci" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">🚨 CCI (단기 과열 경보기)</div>
                                            <div class="tooltip-desc">
                                                돈이 코인으로 급격히 몰리거나 빠져나가는 속도를 보여주는 스캘핑 경보기입니다.<br>
                                                - <strong>100 이상 (과열)</strong>: 단기적으로 돈이 너무 급하게 쏠려 곧 꺾일 위험이 높습니다.<br>
                                                - <strong>-100 이하 (침체)</strong>: 단기적으로 투매가 나와 저평가된 상태입니다.
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>볼린저 밴드 (BB) <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-bb" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">🚧 볼린저 밴드 (가격의 펜스)</div>
                                            <div class="tooltip-desc">
                                                가격이 이 밴드(안전바) 안에서 움직일 확률이 95%입니다.<br>
                                                - <strong>상한선 도달</strong>: 안전 펜스 최상단을 뚫었으므로 조만간 반락할 위험이 있습니다.<br>
                                                - <strong>하한선 도달</strong>: 안전 펜스 최하단을 딛고 단기 반등할 가능성이 큽니다.
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>MACD (12, 26, 9) <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-macd" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">🚂 MACD (추세 기차 엔진)</div>
                                            <div class="tooltip-desc">
                                                상승 또는 하락의 힘이 강해지고 있는지 보여주는 방향타 지표입니다.<br>
                                                - <strong>골든크로스 (롱)</strong>: 초록선이 주황선을 뚫고 올라 상승 기차 엔진 시동!<br>
                                                - <strong>데드크로스 (숏)</strong>: 초록선이 주황선 아래로 추락해 하락 압력 증가!
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>스토캐스틱 (Stochastic) <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-stoch" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">🌊 스토캐스틱 (단기 파도 타기)</div>
                                            <div class="tooltip-desc">
                                                단기 가격 파동의 천장과 바닥을 초고속 포착하는 <strong>스캘퍼의 나침반</strong>입니다.<br>
                                                - <strong>20% 이하 (초침체)</strong>: 파동이 다 떨어졌으므로 K선이 D선을 상방 크로스할 때 단기 매수 기회!<br>
                                                - <strong>80% 이상 (초과열)</strong>: 단기 꼭대기 영역이므로 매수 자제 요망.
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>VWAP (실시간 가중평균) <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-vwap" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">💼 VWAP (세력/고래들의 평균 단가)</div>
                                            <div class="tooltip-desc">
                                                오늘 거래량을 가중하여 연산한 시장의 지배적인 '세력 본전' 단가입니다.<br>
                                                - <strong>현재가 < VWAP (아래)</strong>: 세력 본전 가격보다 싼 매력적인 할인 구간!<br>
                                                - <strong>현재가 > VWAP (위)</strong>: 시장 평균 단가보다 다소 비싸게 거래 중.
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>피보나치 되돌림 구간 <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-fibo" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">📐 피보나치 되돌림 (황금 지지선)</div>
                                            <div class="tooltip-desc">
                                                과거 고점과 저점 대비 황금비율 지지선을 찾아냅니다.<br>
                                                - <strong>0.786 / 0.618 골든존</strong>: 급락하던 시세가 강력하게 반등할 확률이 가장 높은 황금의 바닥 지지 라인입니다.<br>
                                                - <strong style="color: var(--color-yellow);">💡 초보자 비밀 노트</strong>: "어? 지지선이 334인데 현재가가 305면 지지선이 잘못된 건가요?" <strong>아닙니다!</strong> 현재 가격이 이전 파동의 78.6% 강력한 반등 라인 위에 있거나, 이미 무너졌을 때 발생합니다. AI 자동매매는 이 괴리를 1ms 만에 감지하고 안전하게 지지가격을 조율하여 리스크를 칼같이 방어하므로 걱정할 필요 없습니다!
                                            </div>
                                        </div>
                                    </div>
                                    <div class="quant-metric-row quant-tooltip-trigger" style="position: relative;">
                                        <span>RSI (14) + 슈퍼트렌드 <i class="fa-regular fa-circle-question help-icon" style="color: var(--color-yellow); font-size: 11px; cursor: pointer; margin-left: 2px;"></i></span>
                                        <span id="metric-rsi-supertrend" class="metric-val">--</span>
                                        <!-- 툴팁 내용 -->
                                        <div class="quant-tooltip">
                                            <div class="tooltip-title">🌡️ RSI + 슈퍼트렌드 (시장 온도계)</div>
                                            <div class="tooltip-desc">
                                                RSI는 시장의 실시간 과열 지수이며, 슈퍼트렌드는 상승/하락 추세 지속 여부입니다.<br>
                                                - <strong>RSI 30 이하 침체</strong>: 시장의 공포 국면이며 바닥 매수의 적기입니다.<br>
                                                - <strong>RSI 70 이상 과열</strong>: 극도의 탐욕 국면이며 단기 조정 위험이 높습니다.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                `;
    
    const beforeStr = content.substring(0, startIndex);
    const afterStr = content.substring(endIndex);
    fs.writeFileSync(targetFile, beforeStr + replacement + afterStr, 'utf8');
    console.log('[SUCCESS] index.html indicators panel restored and upgraded cleanly!');
} else {
    console.log('[FAIL] Could not locate start/end tags');
}
