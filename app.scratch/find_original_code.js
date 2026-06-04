const fs = require('fs');
const readline = require('readline');

async function findOriginal() {
    const fileStream = fs.createReadStream('C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const candidates = [];
    let stepIdx = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            stepIdx = obj.step_index || stepIdx;
            
            // line 전체 텍스트에서 'function 실시간캔들메시지파싱' 이 들어있고, 스크립트 자체가 아닐 경우만 수집
            if (line.includes('function 실시간캔들메시지파싱') && line.includes('app.js') && !line.includes('readline') && !line.includes('findOriginal')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        } catch (e) {
            if (line.includes('function 실시간캔들메시지파싱') && line.includes('app.js') && !line.includes('readline') && !line.includes('findOriginal')) {
                candidates.push({
                    step: stepIdx,
                    length: line.length,
                    raw: line
                });
            }
        }
    }

    console.log(`Found ${candidates.length} candidates!`);
    
    // 가장 최근 것부터 차례대로 파싱 시도하여 코드 조각 추출
    candidates.sort((a, b) => b.step - a.step);
    
    let success = false;
    for (const cand of candidates) {
        console.log(`Analyzing candidate at Step ${cand.step} (length: ${cand.length})...`);
        const raw = cand.raw;
        
        // 'positions-table-body' 가 포함된 문자열을 포함하여 이스케이프된 JS 코드 블록을 찾아냄
        // 이 라인은 툴 콜이거나 툴 리스폰스임.
        // 툴 콜의 args나 툴 리스폰스의 content/tool_result/output 등에서 텍스트를 정교하게 떼어냄
        const patterns = [
            '\\"ReplacementContent\\":\\"',
            '\\"TargetContent\\":\\"',
            '"ReplacementContent":"',
            '"TargetContent":"'
        ];
        
        for (const pattern of patterns) {
            let startIdx = raw.indexOf(pattern);
            if (startIdx !== -1) {
                startIdx += pattern.length;
                let endIdx = startIdx;
                while (endIdx < raw.length) {
                    if (raw[endIdx] === '"' && raw[endIdx - 1] !== '\\') {
                        break;
                    }
                    endIdx++;
                }
                
                const val = raw.substring(startIdx, endIdx);
                // " function 실시간캔들메시지파싱 "이 포함되어 있는지 검증
                if (val.includes('function 실시간캔들메시지파싱')) {
                    // 이스케이프 해제 시도
                    try {
                        let jsonStr = '"' + val + '"';
                        let unescaped = JSON.parse(jsonStr);
                        // 혹시 2중으로 이스케이프 되었을 경우
                        if (unescaped.includes('\\n')) {
                            unescaped = unescaped
                                .replace(/\\r\\n/g, '\n')
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\');
                        }
                        
                        fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_chunk_step_${cand.step}.js`, unescaped, 'utf8');
                        console.log(`[SUCCESS] Extracted original functional chunk to app.scratch/recovered_chunk_step_${cand.step}.js!`);
                        success = true;
                    } catch (err) {
                        // raw 문자열 정규화
                        const normalized = val
                            .replace(/\\r\\n/g, '\n')
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                        fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_chunk_step_${cand.step}.js`, normalized, 'utf8');
                        console.log(`[PARTIAL SUCCESS] Wrote raw normalized chunk for Step ${cand.step}`);
                        success = true;
                    }
                }
            }
        }
        if (success) break;
    }

    if (!success) {
        console.log("Failed to extract functional chunk from candidates.");
    }
}

findOriginal();
