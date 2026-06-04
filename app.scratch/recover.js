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
    let stepIndex = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            stepIndex = obj.step_index || stepIndex;
            
            // app.js 가 언급되었고, 1985라인의 btn-reset 코드가 온전히 들어있는 라인
            if (line.includes('app.js') && line.includes('btn-reset') && line.includes('estimates-margin') === false) {
                if (line.length > maxLen) {
                    maxLen = line.length;
                    bestLine = {
                        step: stepIndex,
                        content: line
                    };
                }
            }
        } catch (e) {
            // JSON 파싱 에러인 경우도 문자열 검색
            if (line.includes('app.js') && line.includes('btn-reset') && line.includes('estimates-margin') === false) {
                if (line.length > maxLen) {
                    maxLen = line.length;
                    bestLine = {
                        step: stepIndex,
                        content: line
                    };
                }
            }
        }
    }

    if (bestLine) {
        console.log(`Found app.js backup candidate at Step ${bestLine.step} (length: ${bestLine.content.length})!`);
        fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted.json', bestLine.content, 'utf8');
    } else {
        console.log('Could not find suitable app.js candidate in transcript.jsonl with relaxed rules');
    }
}

recover();
