const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain';

function scanTranscripts(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanTranscripts(fullPath);
        } else if (file === 'transcript.jsonl') {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (!line.trim()) return;
                try {
                    const obj = JSON.parse(line);
                    const text = obj.content || obj.output || "";
                    if (text.includes('function 분할차트들렌더링') || text.includes('분할차트들렌더링 = function') || text.includes('분할차트들렌더링() {')) {
                        console.log(`Found in transcript: ${fullPath} at line ${index}`);
                        // Extract lines containing it
                        const tLines = text.split('\n');
                        tLines.forEach((tl, ti) => {
                            if (tl.includes('분할차트들렌더링')) {
                                for (let j = ti; j < ti + 30 && j < tLines.length; j++) {
                                    console.log('  ' + tLines[j]);
                                }
                            }
                        });
                    }
                } catch(e) {}
            });
        }
    });
}

scanTranscripts(brainDir);
