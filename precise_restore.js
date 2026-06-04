const fs = require('fs');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

console.log("Ultimate Multi-Log Assembler starting...");

const codeMap = new Map();

// 로그 파일들을 루프하며 VIEW_FILE에 찍힌 라인들을 최신 데이터 순으로 수집
logFiles.forEach((logPath, logIdx) => {
    if (!fs.existsSync(logPath)) {
        console.log(`Log not found: ${logPath}`);
        return;
    }
    console.log(`Scanning log: ${logPath}`);
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n');

    lines.forEach((line, stepIndex) => {
        if (!line.trim()) return;
        
        try {
            const obj = JSON.parse(line);
            
            if (obj.type === "VIEW_FILE" && obj.content) {
                const text = obj.content;
                if (!text.includes("app.js")) return;
                
                const matchHeader = text.match(/Showing lines (\d+) to (\d+)/);
                if (!matchHeader) return;
                
                const contentLines = text.split('\n');
                contentLines.forEach(l => {
                    const m = l.trim().match(/^(\d+):\s?(.*)$/);
                    if (m) {
                        const lineNum = parseInt(m[1]);
                        const code = m[2];
                        const trimmed = code.trim();
                        
                        // 🛡️ JSON 덤프 원천 차단 (JSON Dump Filter)
                        if (trimmed.includes('{"step_index"') || trimmed.includes('"step_index":') || trimmed.includes('{"name":') || trimmed.includes('{"args":')) {
                            return;
                        }
                        
                        // 🛡️ 135라인 미만에서 순수 JS 토큰이 아니면 마크다운/자연어로 취급하여 엄격하게 차단!
                        if (lineNum < 135) {
                            const isJsToken = 
                                trimmed.startsWith("const ") || 
                                trimmed.startsWith("let ") || 
                                trimmed.startsWith("var ") || 
                                trimmed.startsWith("function ") || 
                                trimmed.startsWith("window.") || 
                                trimmed.startsWith("document.") || 
                                trimmed.startsWith("//") || 
                                trimmed.startsWith("/*") || 
                                trimmed.startsWith("*/") || 
                                trimmed === "" || 
                                trimmed === "}" ||
                                trimmed === "};";
                                
                            if (!isJsToken) return;
                        }
                        
                        // 일반 마크다운 차단 (Markdown Filter)
                        const isMarkdown = 
                            trimmed.startsWith("#") || 
                            trimmed.startsWith("- [") || 
                            trimmed.startsWith("---") ||
                            trimmed.startsWith("|") ||
                            trimmed.startsWith("*") ||
                            trimmed.includes("##");
                            
                        if (!isMarkdown) {
                            // 더 높은 우선순위(최신 로그 파일 및 최신 스텝)의 라인으로 덮어씀
                            const score = logIdx * 1000000 + stepIndex;
                            const existing = codeMap.get(lineNum);
                            if (!existing || existing.score <= score) {
                                codeMap.set(lineNum, { code: code, score: score });
                            }
                        }
                    }
                });
            }
        } catch (e) {
            // 패스
        }
    });
});

console.log(`Total unique JS lines gathered: ${codeMap.size}`);

if (codeMap.size > 0) {
    const sortedLineNums = Array.from(codeMap.keys()).sort((a, b) => a - b);
    const lastLine = sortedLineNums[sortedLineNums.length - 1];
    
    const finalLines = [];
    let emptyCount = 0;
    for (let i = 1; i <= lastLine; i++) {
        if (codeMap.has(i)) {
            finalLines.push(codeMap.get(i).code);
        } else {
            finalLines.push(""); 
            emptyCount++;
        }
    }
    
    // 헤더 자동 복구
    if (finalLines[0].trim().startsWith("<") || finalLines[0].trim() === "") {
        finalLines[0] = "/* ----------------------------------------------------";
        finalLines[1] = "   BINANCE REAL-TIME LIVE TRADING ENGINE (app.js)";
        finalLines[2] = "---------------------------------------------------- */";
    }

    const jsContent = finalLines.join('\n');
    fs.writeFileSync(targetFile, jsContent, 'utf8');
    console.log(`[SUCCESS] Assembler reconstructed app.js! Size: ${jsContent.length} bytes, Lines: ${finalLines.length}, Empty Lines: ${emptyCount}`);
} else {
    console.log("[FAIL] Could not reconstruct app.js");
}
