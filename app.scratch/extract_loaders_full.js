const fs = require('fs');

const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\loaders_restored.txt';

if (!fs.existsSync(logPath)) {
    console.log("로그 파일이 없습니다.");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
                if (tc.args && tc.args.TargetFile && tc.args.TargetFile.toLowerCase().includes('app.js')) {
                    const repl = tc.args.ReplacementContent || tc.args.CodeContent || '';
                    if (repl.includes('function 탭전환시분할차트데이터로드') && repl.includes('function 분할차트캔들데이터로드') && !repl.includes('extract_loaders_full')) {
                        console.log(`Found complete loaders match at step ${obj.step_index}`);
                        
                        let clean = repl
                            .replace(/\\r\\n/g, '\n')
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                        
                        fs.writeFileSync(targetFile, clean, 'utf8');
                        console.log("Successfully wrote full source code to", targetFile);
                        process.exit(0);
                    }
                }
            }
        }
    } catch(e) {}
}

console.log("코드를 찾지 못했습니다.");
