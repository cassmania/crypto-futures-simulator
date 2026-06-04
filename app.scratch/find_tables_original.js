const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

async function run() {
    console.log("Searching logs specifically for replace_file_content / write_to_file calls containing table renderers...");
    
    const candidates = [];
    
    for (const logFile of logFiles) {
        if (!fs.existsSync(logFile)) continue;
        
        const fileStream = fs.createReadStream(logFile);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        let stepIdx = 0;
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                stepIdx = obj.step_index || stepIdx;
                
                // 툴 콜을 검사
                if (obj.tool_calls && obj.tool_calls.length > 0) {
                    obj.tool_calls.forEach(tc => {
                        if (tc.args) {
                            const args = tc.args;
                            const code = args.ReplacementContent || args.CodeContent || "";
                            if (code.includes("대기주문테이블렌더링") && !line.includes("find_tables_original")) {
                                candidates.push({
                                    step: stepIdx,
                                    tool: tc.name,
                                    logFile: path.basename(path.dirname(path.dirname(logFile))),
                                    length: code.length,
                                    code: code
                                });
                            }
                        }
                    });
                }
            } catch (e) {
                // 파싱 실패 무시
            }
        }
    }
    
    console.log(`Found ${candidates.length} tool call candidates!`);
    
    candidates.sort((a, b) => b.length - a.length); // 가장 본문이 길고 완벽한 것을 맨 위로
    
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
        const cand = candidates[i];
        console.log(`Candidate ${i}: Step ${cand.step} in log ${cand.logFile} (Length: ${cand.length}, Tool: ${cand.tool})`);
        
        const outPath = `C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\table_tool_cand_${cand.step}_len_${cand.length}.js`;
        fs.writeFileSync(outPath, cand.code, 'utf8');
        console.log(`  => Wrote full code to ${outPath}`);
    }
}

run();
