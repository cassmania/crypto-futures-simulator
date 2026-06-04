const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
const content = fs.readFileSync(filePath, 'utf8');

const normalizedContent = content.replace(/\r\n/g, '\n');
const lines = normalizedContent.split('\n');

const startIdx = 1032; // '// 12. 테이블 렌더링 인터페이스 (Table Renders)'
const endIdx = 1288;   // '익절가: 0,\n    손절가: 0\n};' 의 닫는 괄호 }

const keptLines = [];
lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (lineNum >= startIdx && lineNum <= endIdx) {
        // 생략
    } else {
        keptLines.push(line);
    }
});

fs.writeFileSync(filePath, keptLines.join('\n'), 'utf8');
console.log("[SUCCESS] Reconstructed tables duplicate blocks cleaned cleanly!");
