const fs = require('fs');
const readline = require('readline');

async function scan() {
    const fileStream = fs.createReadStream('C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let index = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        
        // positions-table-body 와 btn-reset 가 들어있는 모든 원시 로그 캡처
        // 이번 턴의 복구용 임시 스크립트 파일명을 언급하는 것들은 제외
        if (line.includes('positions-table-body') && line.includes('btn-reset') && line.includes('app.js')) {
            if (!line.includes('recover_diff.js') && !line.includes('find_original_code.js') && !line.includes('dump_step.js') && !line.includes('simple_extract.js') && !line.includes('scan_6mb.js') && !line.includes('search_content_md.js')) {
                console.log(`Found candidate! Length: ${line.length}`);
                fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\raw_past_${index}.json`, line, 'utf8');
                
                // 단순 파싱 시도
                try {
                    const obj = JSON.parse(line);
                    let found = false;
                    
                    // tool_calls의 args 내에서 TargetContent 또는 ReplacementContent를 직접 떼어냄
                    if (obj.tool_calls) {
                        for (const tc of obj.tool_calls) {
                            if (tc.args) {
                                const targetContent = tc.args.TargetContent || tc.args.ReplacementContent || "";
                                if (targetContent.includes('positions-table-body') && targetContent.includes('btn-reset')) {
                                    fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code_past_${index}.js`, targetContent, 'utf8');
                                    console.log(`[SUCCESS] Extracted exact chunk to recovered_code_past_${index}.js`);
                                    found = true;
                                }
                            }
                        }
                    }
                    
                    // 만약 툴 콜이 아니라 툴 response의 output 등인 경우
                    if (!found && obj.tool_result) {
                        const tr = obj.tool_result;
                        if (tr.includes('positions-table-body') && tr.includes('btn-reset')) {
                            fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code_past_${index}.js`, tr, 'utf8');
                            console.log(`[SUCCESS] Extracted tool result to recovered_code_past_${index}.js`);
                            found = true;
                        }
                    }
                    
                    if (!found && obj.content) {
                        const cnt = obj.content;
                        if (cnt.includes('positions-table-body') && cnt.includes('btn-reset')) {
                            fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code_past_${index}.js`, cnt, 'utf8');
                            console.log(`[SUCCESS] Extracted content to recovered_code_past_${index}.js`);
                            found = true;
                        }
                    }
                } catch(e) {
                    console.log(`Failed to parse json for candidate: ${e.message}`);
                }
                
                index++;
            }
        }
    }
    
    console.log(`Scan completed. Found ${index} past candidates!`);
}

scan();
