const fs = require('fs');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

logFiles.forEach((logPath) => {
    if (!fs.existsSync(logPath)) {
        console.log(`로그 파일 없음: ${logPath}`);
        return;
    }
    
    console.log(`=========================================`);
    console.log(`스캔 중: ${logPath}`);
    console.log(`=========================================`);
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            const step = obj.step_index || idx;
            
            // 모든 tool_calls 분석
            if (obj.tool_calls) {
                obj.tool_calls.forEach((tc, tcIdx) => {
                    const name = tc.name || tc.method || "";
                    const args = tc.args || tc.arguments || tc.params || {};
                    const targetFile = args.TargetFile || args.targetFile || args.path || args.Target || "";
                    
                    if (targetFile.includes("app.js")) {
                        console.log(`[Step ${step}] Tool: ${name}, TargetFile: ${targetFile}`);
                        console.log(`  - Keys: ${Object.keys(args).join(', ')}`);
                        if (args.CodeContent) {
                            console.log(`  - CodeContent length: ${args.CodeContent.length}`);
                            const outPath = `C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted_${step}.js`;
                            fs.writeFileSync(outPath, args.CodeContent, 'utf8');
                            console.log(`  - Saved to extracted_${step}.js`);
                        }
                    }
                });
            }
            
            // toolCall 이라는 다른 필드로 기록되어 있을 수도 있으니 확인
            if (obj.toolCall) {
                const tc = obj.toolCall;
                const name = tc.name || tc.method || "";
                const args = tc.args || tc.arguments || {};
                const targetFile = args.TargetFile || args.targetFile || "";
                if (targetFile.includes("app.js")) {
                    console.log(`[Step ${step}] ToolCall: ${name}, TargetFile: ${targetFile}`);
                    console.log(`  - Keys: ${Object.keys(args).join(', ')}`);
                }
            }
            
            // 또는 type이 TOOL_CALL인 경우
            if (obj.type === "TOOL_CALL") {
                console.log(`[Step ${step}] TOOL_CALL type found`);
            }
        } catch (e) {
            // 파싱 에러
        }
    });
});
