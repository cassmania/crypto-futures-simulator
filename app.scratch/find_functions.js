const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js', 'utf8');
const lines = content.split('\n');

console.log("=== APP.JS FUNCTIONS SCAN ===");
lines.forEach((line, idx) => {
    if (line.includes('function ') && !line.trim().startsWith('//') && !line.trim().startsWith('/*')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
