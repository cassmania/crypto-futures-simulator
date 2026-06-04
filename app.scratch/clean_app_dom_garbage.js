const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
const content = fs.readFileSync(filePath, 'utf8');

const normalizedContent = content.replace(/\r\n/g, '\n');
const lines = normalizedContent.split('\n');

const startIdx = 971; // 'btnShort.classList.remove("active");'
const endIdx = 1248;   // 'document.querySelectorAll(".quant-tab-btn").forEach(btn => { ... });' 의 닫는 괄호 }

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
console.log("[SUCCESS] Successfully wiped away the DOMContentLoaded duplicate garbage block!");
