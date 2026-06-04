const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\index.html', 'utf8');
const lines = content.split('\n');

console.log("=== HTML QUANT PANEL SCAN ===");
let inside = false;
let count = 0;
lines.forEach((line, idx) => {
    if (line.includes('id="quant-indicators"') || line.includes('quant-tab-panel')) {
        inside = true;
    }
    if (inside) {
        console.log(`${idx + 1}: ${line.trim()}`);
        count++;
        if (count > 60) {
            inside = false;
        }
    }
});
