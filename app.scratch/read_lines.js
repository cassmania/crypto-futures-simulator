const fs = require('fs');

try {
    const content = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\index.html', 'utf8');
    const lines = content.split('\n');
    
    console.log("index.html Lines 770 to 815:");
    for (let i = 769; i < Math.min(lines.length, 815); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} catch (e) {
    console.error("Failed:", e.message);
}
