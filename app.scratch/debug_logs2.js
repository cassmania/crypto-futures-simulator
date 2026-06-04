const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logFile)) {
    console.log("이전 로그 없음");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("Analyzing 55f36f53 logs to find complete app.js text states...");

const fileStates = [];

lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index || idx;
        
        // VIEW_FILE 로그 검사
        if (obj.type === "VIEW_FILE" && obj.content) {
            const text = obj.content;
            if (text.includes("app.js") && text.includes("Showing lines")) {
                const match = text.match(/Showing lines (\d+) to (\d+)/);
                if (match) {
                    const start = parseInt(match[1]);
                    const end = parseInt(match[2]);
                    const len = end - start + 1;
                    console.log(`[Step ${step}] VIEW_FILE app.js lines ${start} to ${end} (length: ${len} lines)`);
                }
            }
        }
        
        // replace_file_content 또는 write_to_file 호출 검사
        if (obj.tool_calls) {
            obj.tool_calls.forEach(tc => {
                if (tc.name === "write_to_file" && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes("app.js")) {
                    console.log(`[Step ${step}] write_to_file to app.js, CodeContent length: ${tc.args.CodeContent ? tc.args.CodeContent.length : 0}`);
                }
                if (tc.name === "replace_file_content" && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes("app.js")) {
                    console.log(`[Step ${step}] replace_file_content to app.js, ReplacementContent length: ${tc.args.ReplacementContent ? tc.args.ReplacementContent.length : 0}, lines ${tc.args.StartLine} to ${tc.args.EndLine}`);
                }
            });
        }
    } catch(e) {}
});
