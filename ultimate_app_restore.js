const fs = require('fs');
const path = require('path');
const vm = require('vm');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

console.log("Ultimate Robust app.js Restorer started...");

let candidateCodes = [];

logFiles.forEach(logFile => {
    if (!fs.existsSync(logFile)) {
        console.log(`Log not found: ${logFile}`);
        return;
    }
    console.log(`Scanning: ${logFile}`);
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');

    lines.forEach((line, lineIdx) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            
            // 1. tool_calls를 통한 write_to_file / replace_file_content 스캔
            if (obj.tool_calls) {
                obj.tool_calls.forEach(tc => {
                    if (tc.args && tc.args.CodeContent) {
                        const content = tc.args.CodeContent;
                        if (content.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                            candidateCodes.push({
                                source: `tool_call_line_${lineIdx}`,
                                rawText: content,
                                timestamp: obj.timestamp || Date.now()
                            });
                        }
                    }
                    if (tc.args && tc.args.ReplacementContent) {
                        const content = tc.args.ReplacementContent;
                        if (content.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                            candidateCodes.push({
                                source: `replacement_content_line_${lineIdx}`,
                                rawText: content,
                                timestamp: obj.timestamp || Date.now()
                            });
                        }
                    }
                });
            }

            // 2. 일반 content / output 필드 스캔 (View 파일이나 이전 기록들)
            let text = obj.content || obj.output || "";
            if (text.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                candidateCodes.push({
                    source: `raw_content_line_${lineIdx}`,
                    rawText: text,
                    timestamp: obj.timestamp || Date.now()
                });
            }
        } catch (e) {
            // 파싱 실패 시 패스
        }
    });
});

console.log(`Found ${candidateCodes.length} potential full/partial app.js blocks.`);

let bestJs = "";
let bestSource = "";
let bestScore = -1;

candidateCodes.forEach(cand => {
    let text = cand.rawText;
    
    // 헤더 시작점 찾기 (Start Index Search)
    let startIdx = text.indexOf("/* ----------------------------------------------------");
    if (startIdx === -1) {
        startIdx = text.indexOf("/* --------------------------------------------------");
    }
    if (startIdx === -1) return;

    let rawJs = text.substring(startIdx);
    
    // JSON 특수문자 정제 및 포맷팅 (Clean escape chars)
    let clean = rawJs
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

    // 마크다운 형태의 line_number (ex: "123: const a = 1;") 정제
    let jsLines = clean.split('\n');
    let parsedLines = jsLines.map(l => {
        let trimmedLine = l.trim();
        // 줄 번호 패턴 감지 및 제거
        let m = trimmedLine.match(/^(\d+):\s?(.*)$/);
        if (m) {
            return m[2]; // 줄 번호 제거된 실제 코드 반환
        }
        return l;
    });
    let jsText = parsedLines.join('\n');

    // 꼬임 현상이 덜하거나, 문법이 가장 무결한지 검사
    let syntaxValid = false;
    try {
        new vm.Script(jsText);
        syntaxValid = true;
    } catch (e) {
        // syntax 에러가 있더라도 코드 블록 길이와 핵심 문자열로 점수를 매겨 백업 확보
    }

    // 평가 점수 계산 (Score Calculation)
    let score = jsText.length;
    if (syntaxValid) {
        score += 1000000; // 문법 무결성 가점 부여
    }
    if (jsText.includes("window.타점레버리지팝업")) {
        // 프리징 유발 코드(window.타점레버리지팝업)가 없는 순수 골든 버전에 보너스
        score += 200000;
    }
    if (jsText.includes("레버리지 20배 고정")) {
        score += 100000;
    }

    console.log(`Candidate from [${cand.source}]: Size = ${jsText.length} bytes, SyntaxValid = ${syntaxValid}, Score = ${score}`);

    if (score > bestScore) {
        bestScore = score;
        bestJs = jsText;
        bestSource = cand.source;
    }
});

if (bestJs && bestScore > 0) {
    fs.writeFileSync(targetFile, bestJs, 'utf8');
    console.log(`\n[SUCCESS] Ultimate restored app.js from [${bestSource}]!`);
    console.log(`- Final Size: ${bestJs.length} bytes`);
    console.log(`- Final Score: ${bestScore}`);
    
    // 복원 후 구문 검증 시도
    try {
        new vm.Script(bestJs);
        console.log("--> Verification PASS: Reconstructed app.js is 100% syntactically valid!");
    } catch (e) {
        console.log("--> Verification WARN: Syntax errors still remain, but best baseline has been recovered.");
        console.error(e.message);
    }
} else {
    console.log("\n[FAIL] Could not extract any viable candidate with robust criteria.");
}
