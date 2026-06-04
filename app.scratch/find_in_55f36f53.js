const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(logFile)) {
    console.log("Scanning 55f36f53 transcript...");
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            const text = obj.content || obj.output || "";
            if (text.includes('function 분할차트들렌더링') || text.includes('분할차트들렌더링() {')) {
                console.log(`Found in transcript at line ${index}`);
                const tLines = text.split('\n');
                tLines.forEach((tl, ti) => {
                    if (tl.includes('분할차트들렌더링') && (tl.includes('function') || tl.includes('=>'))) {
                        for (let j = ti; j < ti + 40 && j < tLines.length; j++) {
                            console.log('  ' + tLines[j]);
                        }
                    }
                });
            }
        } catch(e) {}
    });
} else {
    console.log("55f36f53 log file not found!");
}
