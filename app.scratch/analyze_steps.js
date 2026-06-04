const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logFile)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log(`Total log lines: ${lines.length}`);

lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index || idx;
        const type = obj.type || "";
        const source = obj.source || "";
        
        let toolName = "";
        let toolAction = "";
        let details = "";
        
        if (obj.tool_calls && obj.tool_calls.length > 0) {
            const tc = obj.tool_calls[0];
            toolName = tc.name;
            toolAction = tc.toolAction || "";
            if (tc.args) {
                details = tc.args.TargetFile || tc.args.CommandLine || tc.args.AbsolutePath || "";
            }
        }
        
        // 유저 입력이 있는 경우
        if (type === "USER_INPUT" || (source === "USER_EXPLICIT" && obj.content)) {
            console.log(`[Step ${step}] USER: ${obj.content.substring(0, 80).replace(/\n/g, ' ')}`);
        } else if (toolName) {
            console.log(`  [Step ${step}] Tool: ${toolName} (${toolAction}) -> ${details}`);
        } else if (obj.content && source === "MODEL") {
            // 모델의 텍스트 응답 중 요약
            console.log(`  [Step ${step}] MODEL text response (${obj.content.length} chars)`);
        }
    } catch (e) {
        // 무시
    }
});
