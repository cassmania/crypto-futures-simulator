const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logFile)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("Scanning ALL tool calls in 55f36f53...");

lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index || idx;
        
        if (obj.tool_calls) {
            obj.tool_calls.forEach((tc) => {
                let argsSummary = "";
                if (tc.args) {
                    // 중요한 인자만 요약
                    const keys = Object.keys(tc.args);
                    argsSummary = keys.map(k => {
                        let val = String(tc.args[k]);
                        if (val.length > 50) val = val.substring(0, 47) + "...";
                        return `${k}: ${val}`;
                    }).join(', ');
                }
                console.log(`[Step ${step}] Tool: ${tc.name} -> Args: { ${argsSummary} }`);
            });
        }
    } catch (e) {
        // 무시
    }
});
