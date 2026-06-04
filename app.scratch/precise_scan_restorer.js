const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
const logs = [
    {
        path: 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
        priority: 1,
        maxStep: 999999
    },
    {
        path: 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl',
        priority: 2,
        maxStep: 2360 // 퀀트 지표 수정 이전의 골든 시점
    }
];

console.log("Starting precise 2-conversation smart reassembly...");

const codeMap = new Map();
const seenLinesByStep = new Map();
let processedViewsCount = 0;

logs.forEach((log) => {
    if (!fs.existsSync(log.path)) {
        console.log(`로그 파일 미존재: ${log.path}`);
        return;
    }
    
    console.log(`스캔 중: ${path.basename(path.dirname(path.dirname(log.path)))} (우선순위: ${log.priority}, 최대스텝: ${log.maxStep})`);
    
    const content = fs.readFileSync(log.path, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            const step = obj.step_index || idx;
            
            // 지정 스텝 상한 필터
            if (step > log.maxStep) return;
            
            let isAppJsView = false;
            let fileContent = "";
            
            // 1. TOOL 호출 검증
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
            
            // 2. VIEW_FILE 직접 구조 확인
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
                // 잘린 캐싱 배제
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
                        
                        // 이스케이프 정제
                        code = code
                            .replace(/\\r/g, '')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                        
                        const trimmed = code.trim();
                        
                        // HTML 태그가 섞여 드는 에러 차단
                        if (trimmed.startsWith("<") || trimmed.startsWith("</") || trimmed.includes("</td>") || trimmed.includes("</div>")) {
                            return;
                        }
                        // 헬퍼 스크립트 배제
                        if (code.includes("precise_app_restore") || code.includes("perfect_restore") || code.includes("seenLinesByStep")) {
                            return;
                        }
                        if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                            return;
                        }
                        if (code.includes("window.타점레버리지팝업")) {
                            return;
                        }
                        
                        const priorityScore = log.priority * 1000000 + step;
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

console.log(`\nSuccessfully processed ${processedViewsCount} views.`);
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
if (finalLines[0] && (finalLines[0].trim().startsWith("<") || finalLines[0].trim() === "")) {
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
