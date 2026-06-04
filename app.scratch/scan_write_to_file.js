const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logFile)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("Scanning all write_to_file and replace_file_content calls for app.js in 55f36f53...");

lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index || idx;
        
        if (obj.tool_calls) {
            obj.tool_calls.forEach((tc) => {
                if ((tc.name === "write_to_file" || tc.name === "replace_file_content") && tc.args) {
                    const target = tc.args.TargetFile || "";
                    if (target.endsWith("app.js")) {
                        const codeLen = tc.args.CodeContent ? tc.args.CodeContent.length : 0;
                        const targetContentLen = tc.args.TargetContent ? tc.args.TargetContent.length : 0;
                        const replacementContentLen = tc.args.ReplacementContent ? tc.args.ReplacementContent.length : 0;
                        
                        console.log(`[Step ${step}] Tool: ${tc.name} -> Target: ${path.basename(target)}, CodeLen: ${codeLen}, TargetContentLen: ${targetContentLen}, ReplacementContentLen: ${replacementContentLen}`);
                    }
                }
            });
        }
    } catch (e) {
        // 무시
    }
});
