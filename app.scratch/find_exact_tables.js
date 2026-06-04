const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

async function run() {
    console.log("Searching logs for genuine original JS blocks containing AI activation modal or widgets control...");
    
    let bestText = "";
    let bestStep = 0;
    
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
            if (line.includes("index.html")) continue;
            if (line.includes("best_")) continue;
            if (line.includes("find_")) continue;
            if (line.includes("findOriginal")) continue;
            
            // `window.AI자동매매가동승인모달열기` 또는 `독립 위젯 팝아웃`이 들어있는 경우
            if (line.includes("window.AI자동매매가동승인모달열기") || line.includes("독립 위젯 팝아웃")) {
                try {
                    const obj = JSON.parse(line);
                    stepIdx = obj.step_index || stepIdx;
                    
                    const candidates = [];
                    if (obj.content) candidates.push(obj.content);
                    if (obj.output) candidates.push(obj.output);
                    if (obj.tool_calls) {
                        obj.tool_calls.forEach(tc => {
                            if (tc.output) candidates.push(tc.output);
                            if (tc.args) {
                                for (const k of Object.keys(tc.args)) {
                                    if (typeof tc.args[k] === 'string') candidates.push(tc.args[k]);
                                }
                            }
                        });
                    }
                    
                    candidates.forEach(cand => {
                        if ((cand.includes("window.AI자동매매가동승인모달열기") || cand.includes("독립 위젯 팝아웃")) && !cand.includes("find_exact_tables")) {
                            if (cand.length > bestText.length) {
                                bestText = cand;
                                bestStep = stepIdx;
                            }
                        }
                    });
                } catch (e) {
                    if (line.length > bestText.length) {
                        bestText = line;
                        bestStep = stepIdx;
                    }
                }
            }
        }
    }
    
    if (bestText) {
        console.log(`[FOUND] Successfully found best genuine JS block at Step ${bestStep} (Length: ${bestText.length})`);
        
        try {
            if (bestText.startsWith('{') || bestText.startsWith('[')) {
                const obj = JSON.parse(bestText);
                let content = obj.content || obj.output || "";
                if (obj.tool_calls && obj.tool_calls[0]) {
                    const tc = obj.tool_calls[0];
                    content = tc.output || (tc.args ? tc.args.ReplacementContent || tc.args.CodeContent : "");
                }
                if (content) bestText = content;
            }
        } catch (err) {}
        
        const cleanedLines = bestText.split('\n').map(l => {
            const m = l.match(/^\s*(\d+):\s?(.*)$/);
            return m ? m[2] : l;
        }).join('\n');
        
        const outPath = `C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\best_modals_restored.js`;
        fs.writeFileSync(outPath, cleanedLines, 'utf8');
        console.log(`Saved genuine modals and widgets block to ${outPath}`);
    } else {
        console.log("Could not find any genuine JS block containing modals or widgets in logs.");
    }
}

run();
