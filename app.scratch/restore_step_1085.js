const fs = require('fs');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

if (!fs.existsSync(logFile)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

let foundCode = "";

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.step_index === 1085) {
            console.log("Step 1085 found!");
            if (obj.tool_calls && obj.tool_calls.length > 0) {
                const tc = obj.tool_calls[0];
                if (tc.name === "write_to_file" && tc.args && tc.args.CodeContent) {
                    foundCode = tc.args.CodeContent;
                    console.log(`Code size: ${foundCode.length} bytes`);
                    break;
                }
            }
        }
    } catch (e) {
        // 패스
    }
}

if (foundCode) {
    fs.writeFileSync(targetFile, foundCode, 'utf8');
    console.log("[SUCCESS] Successfully restored app.js from Step 1085!");
} else {
    console.log("[FAIL] Could not find CodeContent in Step 1085.");
}
