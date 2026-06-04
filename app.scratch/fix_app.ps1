# PowerShell string replace script with explicit UTF-8 load/save
$filePath = "C:\Users\Administrator\source\repos\crypto-futures-simulator\app.js"

# Read using UTF-8 to prevent character corruption
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Define exact literal target. No regex is used, so characters like $, {, } are safe.
# Replace both CRLF and LF variations to be absolutely sure.
$targetLF = "    const d = new Date();`n    const pad = (n) => n.toString().padStart(2, `"0`");`n    return `$`{pad(d.getHours())}`:`$`{pad(d.getMinutes())}`:`$`{pad(d.getSeconds())}`;`n`n    const elMACD = document.getElementById(`"metric-macd`");"
$targetCRLF = "    const d = new Date();`r`n    const pad = (n) => n.toString().padStart(2, `"0`");`r`n    return `$`{pad(d.getHours())}`:`$`{pad(d.getMinutes())}`:`$`{pad(d.getSeconds())}`;`r`n`r`n    const elMACD = document.getElementById(`"metric-macd`");"

$replacement = @"
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `\${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}`;
}

function 재생효과음(audioId) {
    const audio = document.getElementById(audioId);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {
            console.log("오디오 재생 실패:", e.message);
        });
    }
}

// 전역에 AI 추천 정보를 캐싱해둘 임시 변수
const AI추천캐시 = {
    방향: "LONG",
    진입가: 0,
    익절가: 0,
    손절가: 0
};

// AI 실시간 지표 분석 및 추천 타점 업데이트 함수 (초정밀 퀀트 V2 & 다요소 스코어 엔진)
function AI추천분석및업데이트(symbol) {
    const coin = 상태.코인목록[symbol];
    if (!coin || coin.캔들데이터.length < 30) return;

    const closes = coin.캔들데이터.map(c => c.close);
    const highs = coin.캔들데이터.map(c => c.high);
    const lows = coin.캔들데이터.map(c => c.low);
    const idx = closes.length - 1;

    // 1. 퀀트 보조지표 계산 (Advanced Indicators Calculations)
    const rsiVal = 계산RSI(closes, 14)[idx] || 50;
    const macdData = 계산MACD(closes, 12, 26, 9);
    const 현재MACD = macdData.macd[idx] || 0;
    const 현재MACD시그널 = macdData.signal[idx] || 0;
    const 현재MACD히스토그램 = macdData.histogram[idx] || 0;

    const ma7 = 계산SMA(closes, 7)[idx] || coin.현재가;
    const ma25 = 계산SMA(closes, 25)[idx] || coin.현재가;
    const ma99 = 계산SMA(closes, 99)[idx] || coin.현재가;
    const ma200 = 계산SMA(closes, 200)[idx] || coin.현재가; // 200MA 장기 추세 필터

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

    // 슈퍼트렌드 모방 연산 (RSI 및 ATR 기반 모멘텀 추적 모델)
    const 슈퍼트렌드롱 = coin.현재가 > ma25 && rsiVal > 48;
    const 슈퍼트렌드텍스트 = 슈퍼트렌드롱 ? "롱 (LONG / Bullish)" : "숏 (SHORT / Bearish)";
    const 슈퍼트렌드클래스 = 슈퍼트렌드롱 ? "text-green" : "text-red";

    // 2. 퀀트 보조지표 DOM 연동 바인딩 (Tab 1)
    const elCCI = document.getElementById("metric-cci");
    if (elCCI) {
        elCCI.innerText = cciVal.toFixed(2);
        elCCI.className = "metric-val " + (cciVal > 100 ? "text-red" : (cciVal < -100 ? "text-red" : "text-neutral"));
    }
    const elBB = document.getElementById("metric-bb");
    if (elBB) {
        const bbWidth = ((bbUpper - bbLower) / bbBasis * 100).toFixed(2);
        elBB.innerText = `상: \${bbUpper.toFixed(coin.소수점)} | 하: \${bbLower.toFixed(coin.소수점)} (폭: \${bbWidth}%)`;
    }

    const elMACD = document.getElementById("metric-macd");
"@

# Try replacing CRLF version first, then LF version
if ($content.Contains($targetCRLF)) {
    $content = $content.Replace($targetCRLF, $replacement)
    [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Success: Patched CRLF version!"
} elseif ($content.Contains($targetLF)) {
    $content = $content.Replace($targetLF, $replacement)
    [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Success: Patched LF version!"
} else {
    Write-Host "Error: Literal target string was not found in app.js!"
}
