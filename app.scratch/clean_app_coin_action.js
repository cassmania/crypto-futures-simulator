const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
const content = fs.readFileSync(filePath, 'utf8');

const normalizedContent = content.replace(/\r\n/g, '\n');
const lines = normalizedContent.split('\n');

const startIdx = 853; // 1-indexed 라인 854 ('async function 코인추가액션() {')
const endIdx = 937;   // 1-indexed 라인 938 ('window.AI자동매매버튼상태동기화();\n};')

const keptLines = [];
lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (lineNum >= startIdx && lineNum <= endIdx) {
        if (lineNum === startIdx) {
            keptLines.push('// [Antigravity AI 브리핑] 중복되고 깨진 코인추가액션 및 코인탭전환 2차 가비지 블록을 완벽하게 소탕하였습니다.');
        }
    } else {
        keptLines.push(line);
    }
});

fs.writeFileSync(filePath, keptLines.join('\n'), 'utf8');
console.log("[SUCCESS] Successfully stripped duplicate action/switch garbage blocks!");
