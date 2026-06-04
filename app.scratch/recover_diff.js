const fs = require('fs');
const readline = require('readline');

async function recover() {
    const fileStream = fs.createReadStream('C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let bestLine = null;
    let maxLen = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        if (line.includes('app.js') && line.includes('Unexpected token') === false && !line.includes('recover_diff.js')) {
            if (line.length > maxLen) {
                maxLen = line.length;
                bestLine = line;
            }
        }
    }

    if (bestLine) {
        console.log(`Found a big candidate line! Length: ${bestLine.length}`);
        fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\diff_block.json', bestLine, 'utf8');
        
        try {
            const obj = JSON.parse(bestLine);
            fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\diff_text.txt', JSON.stringify(obj, null, 2), 'utf8');
            console.log("Successfully wrote parsed JSON indentation to diff_text.txt");
        } catch (e) {
            fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\diff_text.txt', bestLine, 'utf8');
            console.log("Wrote raw line to diff_text.txt");
        }
    } else {
        console.log("Could not find any suitable big line.");
    }
}

recover();
