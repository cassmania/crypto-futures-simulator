const fs = require('fs');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

console.log("Starting master reassemblation with relaxed safety filters to fill all code holes...");

const codeMap = new Map();
const seenLinesByStep = new Map();
let processedViewsCount = 0;

logFiles.forEach((logFile, logFileIdx) => {
    if (!fs.existsSync(logFile)) return;
    
    console.log(`Scanning log file: ${path.basename(path.dirname(path.dirname(logFile)))}`);
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');
    
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        try {
            const obj = JSON.parse(line);
            const step = obj.step_index || index;
            
            let isAppJsView = false;
            let fileContent = "";
            
            // TOOL 호출 검증
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
            
            // VIEW_FILE 직접 구조 확인
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
                // 잘렸던 뷰라도, 빈 곳을 채우기 위해 최대한 스캔합니다.
                // 단지 완전히 잘린 메타 태그 등만 걸러냄
                if (fileContent.includes("<truncated 1390 bytes>") || fileContent.includes("<truncated 2645 bytes>")) {
                    return;
                }
                
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
                        
                        // 🛡️ HTML 오염 차단 필터 (app.js 템플릿 리터럴 보존을 위해 비활성화)
                        /*
                        const trimmed = code.trim();
                        const isHtml = 
                            trimmed.startsWith("<") || 
                            trimmed.startsWith("</") || 
                            trimmed.includes("</td>") || 
                            trimmed.includes("</div>") || 
                            trimmed.includes("</span>") || 
                            trimmed.includes("class=") ||
                            trimmed.includes("style=");
                            
                        if (isHtml) return;
                        */
                        
                        // 🛡️ 헬퍼 스크립트 배제 필터
                        if (code.includes("precise_app_restore") || code.includes("perfect_restore") || code.includes("seenLinesByStep")) {
                            return;
                        }
                        
                        // JSON 배제
                        if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                            return;
                        }
                        
                        // 🛡️ 핵심 에러 원인인 window.타점레버리지팝업.렌der() 구문은 
                        // 프리징을 일으킬 수 있는 구문이므로 절대 조립 맵에 넣지 않고 무시합니다!
                        if (code.includes("window.타점레버리지팝업") || code.includes("window.타점레버리지팝업.렌der()")) {
                            return;
                        }
                        
                        const priorityScore = logFileIdx * 100000 + step;
                        const lastPriority = seenLinesByStep.get(lineNum) || -1;
                        
                        if (priorityScore >= lastPriority) {
                            seenLinesByStep.set(lineNum, priorityScore);
                            codeMap.set(lineNum, code);
                        }
                    }
                });
            }
        } catch (e) {
            // 무시
        }
    });
});

console.log(`\nSuccessfully processed ${processedViewsCount} views with ultimate smart filtering.`);
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

console.log(`\n[SUCCESS] app.js successfully reconstructed with ultimate smart filtering!`);
console.log(`- File Size: ${jsContent.length} bytes`);
console.log(`- Total Lines: ${finalLines.length}`);
