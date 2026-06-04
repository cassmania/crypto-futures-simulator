const fs = require('fs');
const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        if (obj.step_index === 2231 && obj.type === "VIEW_FILE") {
            fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\step_2231_view.txt', obj.content, 'utf8');
            console.log("성공적으로 step_2231_view.txt를 생성했습니다. 크기: " + obj.content.length);
        }
    } catch (e) {}
});
