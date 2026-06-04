const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js', 'utf8');
const lines = content.split('\n');

console.log("=== METRIC UPDATES IN APP.JS ===");
lines.forEach((line, idx) => {
    if (line.includes('metric-cci') || line.includes('metric-bb') || line.includes('metric-macd') || line.includes('metric-stoch') || line.includes('metric-vwap') || line.includes('metric-fibo') || line.includes('metric-rsi')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
