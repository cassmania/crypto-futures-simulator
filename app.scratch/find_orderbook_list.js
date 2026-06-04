const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js', 'utf8');
const lines = content.split('\n');

console.log("=== SCAN FOR 업데이트호가목록 ===");
lines.forEach((line, idx) => {
    if (line.includes('업데이트호가목록')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
