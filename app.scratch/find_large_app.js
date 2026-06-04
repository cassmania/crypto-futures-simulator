const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

async function run() {
    console.log("Searching logs for any tool call with long code segments...");
    
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
                
                if (obj.tool_calls && obj.tool_calls.length > 0) {
                    obj.tool_calls.forEach(tc => {
                        if (tc.args) {
                            const args = tc.args;
                            const code = args.ReplacementContent || args.CodeContent || "";
                            if (code.length > 3000) { // 3000자 이상
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
            } catch (e) {}
        }
    }
    
    console.log(`Found ${candidates.length} long tool call candidates!`);
    
    candidates.sort((a, b) => b.length - a.length);
    
    for (let i = 0; i < Math.min(10, candidates.length); i++) {
        const cand = candidates[i];
        console.log(`Long Candidate ${i}: Step ${cand.step} in log ${cand.logFile} (Length: ${cand.length}, Tool: ${cand.tool})`);
        
        const outPath = `C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\long_tool_cand_${cand.step}_len_${cand.length}.js`;
        fs.writeFileSync(outPath, cand.code, 'utf8');
        console.log(`  => Wrote code to ${outPath}`);
    }
}

run();
