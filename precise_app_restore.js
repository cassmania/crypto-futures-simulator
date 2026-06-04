const fs = require('fs');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

console.log("Starting precise app.js JSONL restore scanning multiple logs...");

let bestJs = "";

for (const logFile of logFiles) {
    if (!fs.existsSync(logFile)) {
        console.log(`Log file not found: ${logFile}`);
        continue;
    }
    console.log(`Scanning log file: ${logFile}`);
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');

    for (let i = lines.length - 1; i >= 0; i--) {
        let line = lines[i];
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            let text = obj.content || obj.output || "";
            if (obj.tool_calls) {
                obj.tool_calls.forEach(tc => {
                    if (tc.args && tc.args.CodeContent) {
                        text += tc.args.CodeContent;
                    }
                });
            }
            
            let startIdx = text.indexOf("/* ----------------------------------------------------");
            if (startIdx === -1) continue;
            let endIdx = text.indexOf("// 20. 코인별 레버리지 일괄 현황 맵 렌더링 헬퍼", startIdx);
            if (endIdx === -1) endIdx = text.indexOf("window.타점체결레버리지패널렌더링", startIdx);
            if (endIdx === -1) continue;
            
            let rawJs = text.substring(startIdx);
            // 간단한 정제 (Simple Cleaning)
            let clean = rawJs
                .replace(/\\r\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
                
            let jsLines = clean.split('\n');
            let parsedLines = jsLines.map(l => {
                let cleanLine = l.trim();
                let m = cleanLine.match(/^\d+:\s?(.*)$/);
                return m ? m[1] : l;
            });
            let jsText = parsedLines.join('\n');
            
            if (jsText.length > 80000 && jsText.length < 250000 && jsText.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                // 최근 퀀트 지표 렌더링 간소화 구문이 포함되지 않은 순수한 이전 버전을 매칭
                if (!jsText.includes("elCCI.innerText = cciVal.toFixed(2);") && !jsText.includes("elCCI.innerText = `${cciVal.toFixed(2)}`;")) {
                    bestJs = jsText;
                    break;
                }
            }
        } catch (e) {
            // 무시
        }
    }
    if (bestJs) break;
}

if (!bestJs) {
    console.log('[RETRY] Searching for any valid app.js without strict filters across all logs...');
    for (const logFile of logFiles) {
        if (!fs.existsSync(logFile)) continue;
        console.log(`Retry scanning log file: ${logFile}`);
        const logContent = fs.readFileSync(logFile, 'utf8');
        const lines = logContent.split('\n');

        for (let i = lines.length - 1; i >= 0; i--) {
            let line = lines[i];
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                let text = obj.content || obj.output || "";
                if (obj.tool_calls) {
                    obj.tool_calls.forEach(tc => {
                        if (tc.args && tc.args.CodeContent) {
                            text += tc.args.CodeContent;
                        }
                    });
                }
                let startIdx = text.indexOf("/* ----------------------------------------------------");
                if (startIdx === -1) continue;
                let rawJs = text.substring(startIdx);
                let clean = rawJs
                    .replace(/\\r\\n/g, '\n')
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                let jsLines = clean.split('\n');
                let parsedLines = jsLines.map(l => {
                    let cleanLine = l.trim();
                    let m = cleanLine.match(/^\d+:\s?(.*)$/);
                    return m ? m[1] : l;
                });
                let jsText = parsedLines.join('\n');
                if (jsText.length > 80000 && jsText.length < 250000 && jsText.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                    bestJs = jsText;
                    break;
                }
            } catch(e) {}
        }
        if (bestJs) break;
    }
}

if (bestJs) {
    fs.writeFileSync(targetFile, bestJs, 'utf8');
    console.log(`[SUCCESS] Precise app.js restored! Size: ${bestJs.length} bytes`);
} else {
    console.log('[FAIL] Could not find any valid app.js in all transcript.jsonl files');
}
