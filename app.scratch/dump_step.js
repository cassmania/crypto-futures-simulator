const fs = require('fs');
const readline = require('readline');

async function dumpStep() {
    const fileStream = fs.createReadStream('C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let index = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        
        // 이 turn의 내 스크립트 작성 단계(recover_diff, find_original_code, simple_extract)를 제외
        if (line.includes('app.js') && line.includes('positions-table-body') && line.includes('btn-reset')) {
            if (!line.includes('recover_diff.js') && !line.includes('find_original_code.js') && !line.includes('dump_step.js') && !line.includes('simple_extract.js')) {
                console.log(`Found past candidate line ${index} (length: ${line.length})!`);
                fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\raw_past_${index}.json`, line, 'utf8');
                
                // 이스케이프 해제 시도
                try {
                    const obj = JSON.parse(line);
                    let content = "";
                    if (obj.tool_calls && obj.tool_calls[0] && obj.tool_calls[0].args) {
                        content = obj.tool_calls[0].args.TargetContent || obj.tool_calls[0].args.ReplacementContent || "";
                    }
                    if (!content && obj.content) {
                        content = obj.content;
                    }
                    if (content) {
                        const unescaped = content
                            .replace(/\\r\\n/g, '\n')
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                        fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code_past_${index}.js`, unescaped, 'utf8');
                        console.log(`Extracted to app.scratch/recovered_code_past_${index}.js`);
                    }
                } catch(e) {
                    console.log(`Failed to parse json for candidate ${index}: ${e.message}`);
                }
                
                index++;
            }
        }
    }
}

dumpStep();
