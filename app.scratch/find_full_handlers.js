const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(logFile)) {
    console.log("Scanning 55f36f53 transcript for full handlers...");
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            const text = obj.content || obj.output || "";
            if (text.includes('function 업데이트호가목록')) {
                // Find index of it
                let start = text.indexOf('function 업데이트호가목록');
                if (start !== -1) {
                    console.log(`Found 업데이트호가목록 in transcript at line ${index}`);
                    let end = text.indexOf('function ', start + 30);
                    if (end === -1) end = start + 3000;
                    console.log(text.substring(start, end));
                }
            }
            if (text.includes('function 실시간캔들메시지파싱')) {
                let start = text.indexOf('function 실시간캔들메시지파싱');
                if (start !== -1) {
                    console.log(`Found 실시간캔들메시지파싱 in transcript at line ${index}`);
                    let end = text.indexOf('function ', start + 30);
                    if (end === -1) end = start + 3000;
                    console.log(text.substring(start, end));
                }
            }
        } catch(e) {}
    });
} else {
    console.log("55f36f53 log file not found!");
}
