const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js', 'utf8');
const lines = content.split('\n');

console.log("=== SCAN FOR 계산MACD and 계산VWAP ===");
lines.forEach((line, idx) => {
    if (line.includes('계산MACD') || line.includes('계산VWAP')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
