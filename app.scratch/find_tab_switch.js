const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js', 'utf8');
const lines = content.split('\n');

console.log("=== SCAN FOR window.코인탭전환 ===");
lines.forEach((line, idx) => {
    if (line.includes('window.코인탭전환')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
