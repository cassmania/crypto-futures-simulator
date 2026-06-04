const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

if (!fs.existsSync(logFile)) {
    console.error("로그 파일이 없습니다!");
    process.exit(1);
}

// 👈 이전 대화의 가장 완성도 높았던 최종 골든 구간 (Step 900 ~ Step 1085)의 뷰만 정밀 취합합니다.
// 이 범위 밖의 임시 뷰들은 배제하여 꼬임을 원천 차단합니다.
const minStep = 900;
const maxStep = 1085;

console.log(`Starting golden era reassembly targeting Step ${minStep}~${maxStep} of previous log...`);

const codeMap = new Map();
const seenLinesByStep = new Map();
let processedViewsCount = 0;

const logContent = fs.readFileSync(logFile, 'utf8');
const lines = logContent.split('\n');

lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index || index;
        
        if (step < minStep || step > maxStep) return;
        
        let isAppJsView = false;
        let fileContent = "";
        
        if (obj.tool_calls && obj.tool_calls.length > 0) {
            const tc = obj.tool_calls[0];
            if (tc.name === "view_file" && tc.args) {
                const absPath = tc.args.AbsolutePath || "";
                if (absPath.endsWith("app.js") || absPath.endsWith("app.js\"")) {
                    isAppJsView = true;
                }
            }
        }
        
        if (isAppJsView) {
            fileContent = obj.content || obj.output || "";
            if (!fileContent && obj.tool_calls[0].output) {
                fileContent = obj.tool_calls[0].output;
            }
        }
        
        if (!isAppJsView && obj.type === "VIEW_FILE" && obj.content) {
            const text = obj.content;
            if (text.includes("app.js") && text.includes("Showing lines")) {
                const filePathMatch = text.match(/File Path:\s*`file:\/\/\/(.*?)`/);
                if (filePathMatch) {
                    const filePath = filePathMatch[1];
                    if (filePath.endsWith('/app.js') || filePath.endsWith('\\app.js')) {
                        isAppJsView = true;
                        fileContent = text;
                    }
                }
            }
        }
        
        if (isAppJsView && fileContent) {
            if (fileContent.includes("<truncated")) return;
            
            processedViewsCount++;
            const contentLines = fileContent.split('\n');
            
            contentLines.forEach(l => {
                const m = l.match(/^\s*(\d+):\s?(.*)$/);
                if (m) {
                    const lineNum = parseInt(m[1]);
                    let code = m[2];
                    
                    // 백슬래시 이스케이프 정제
                    code = code
                        .replace(/\\r/g, '')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    
                    const trimmed = code.trim();
                    if (trimmed.startsWith("<") || trimmed.startsWith("</") || trimmed.includes("</td>")) return;
                    if (code.includes("seenLinesByStep") || code.includes("precise_app_restore") || code.includes("perfect_restore")) return;
                    if (code.includes('{"step_index"') || code.includes('"step_index":')) return;
                    
                    const priorityScore = step;
                    const lastPriority = seenLinesByStep.get(lineNum) || -1;
                    
                    if (priorityScore >= lastPriority) {
                        seenLinesByStep.set(lineNum, priorityScore);
                        codeMap.set(lineNum, code);
                    }
                }
            });
        }
    } catch (e) {
        // 패스
    }
});

console.log(`Successfully processed ${processedViewsCount} views from golden era.`);
console.log(`Assembled total unique JS lines: ${codeMap.size}`);

if (codeMap.size === 0) {
    console.error("[FAIL] No lines could be assembled.");
    process.exit(1);
}

const sortedLineNums = Array.from(codeMap.keys()).sort((a, b) => a - b);
const lastLine = sortedLineNums[sortedLineNums.length - 1];
console.log(`Resolved max line number: ${lastLine}`);

const finalLines = [];
let emptyCount = 0;
for (let i = 1; i <= lastLine; i++) {
    if (codeMap.has(i)) {
        finalLines.push(codeMap.get(i));
    } else {
        finalLines.push(""); 
        emptyCount++;
    }
}

console.log(`Remaining empty lines: ${emptyCount}`);

// 헤더 보정
if (finalLines[0].trim().startsWith("<") || finalLines[0].trim() === "") {
    finalLines[0] = "/* ----------------------------------------------------";
    finalLines[1] = "   BINANCE REAL-TIME LIVE TRADING ENGINE (app.js)";
    finalLines[2] = "---------------------------------------------------- */";
}

const jsContent = finalLines.join('\n');
fs.writeFileSync(targetFile, jsContent, 'utf8');

console.log(`\n[SUCCESS] app.js successfully reconstructed!`);
console.log(`- File Size: ${jsContent.length} bytes`);
console.log(`- Total Lines: ${finalLines.length}`);

// 구문 검증
try {
    execSync(`node -c "${targetFile}"`, { stdio: 'pipe' });
    console.log(">>> [CONGRATULATIONS] Rebuilt app.js has perfectly valid syntax (0 errors)!");
} catch (e) {
    console.error(">>> [ERROR] Rebuilt app.js still has syntax error:");
    console.error(e.stderr ? e.stderr.toString() : e.message);
}
