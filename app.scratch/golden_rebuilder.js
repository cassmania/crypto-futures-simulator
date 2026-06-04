const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logFiles = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

const scratchDir = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch';
if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
}

console.log("Analyzing logs to find perfect golden full-text files...");

let candidateId = 0;
const candidates = [];

logFiles.forEach((logPath) => {
    if (!fs.existsSync(logPath)) {
        console.log(`Log file not found: ${logPath}`);
        return;
    }
    
    console.log(`Parsing ${path.basename(path.dirname(path.dirname(logPath)))}...`);
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIdx) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            
            // 1. write_to_file 도구 호출에서 CodeContent 추출
            if (obj.tool_calls) {
                obj.tool_calls.forEach((tc) => {
                    if (tc.name === "write_to_file" && tc.args && tc.args.CodeContent) {
                        const code = tc.args.CodeContent;
                        const target = tc.args.TargetFile || "";
                        if (target.endsWith("app.js") && code.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                            candidates.push({
                                source: 'write_to_file',
                                log: path.basename(path.dirname(path.dirname(logPath))),
                                step: obj.step_index || lineIdx,
                                code: code
                            });
                        }
                    }
                });
            }
            
            // 2. 만약 content/output 에 완전한 파일 내용이 포함되어 있다면 추출
            const text = obj.content || obj.output || "";
            if (text.includes("/* ----------------------------------------------------") && text.includes("BINANCE REAL-TIME LIVE TRADING ENGINE")) {
                // markdown 코드 블록 추출 시도
                let codeContent = text;
                const mdMatch = text.match(/```javascript([\s\S]*?)```/) || text.match(/```js([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/);
                if (mdMatch) {
                    codeContent = mdMatch[1];
                }
                
                if (codeContent.length > 50000 && !codeContent.includes('{"step_index"')) {
                    candidates.push({
                        source: 'markdown_block',
                        log: path.basename(path.dirname(path.dirname(logPath))),
                        step: obj.step_index || lineIdx,
                        code: codeContent
                    });
                }
            }
        } catch (e) {
            // 무시
        }
    });
});

console.log(`Found ${candidates.length} candidate full-text codes. Checking syntax...`);

const validCandidates = [];

candidates.forEach((cand, idx) => {
    const tempFile = path.join(scratchDir, `cand_${idx}.js`);
    fs.writeFileSync(tempFile, cand.code, 'utf8');
    
    let syntaxOk = false;
    let errorMsg = "";
    try {
        execSync(`node -c "${tempFile}"`, { stdio: 'pipe' });
        syntaxOk = true;
    } catch (e) {
        errorMsg = e.stderr ? e.stderr.toString() : e.message;
    }
    
    // 특정 키워드들 확인 (레버리지 20배 바인딩 관련 로직이 있는지)
    const hasLeverageFix = cand.code.includes("레버리지: 20") || cand.code.includes("레버리지 20배");
    const hasQuantUnification = cand.code.includes("퀀트지표") || cand.code.includes("Quant");
    
    console.log(`Cand #${idx} [Step: ${cand.step} in ${cand.log}]: Syntax: ${syntaxOk ? 'OK' : 'FAIL'}, LeverageFix: ${hasLeverageFix}, Quant: ${hasQuantUnification}, Size: ${cand.code.length} bytes`);
    
    if (syntaxOk) {
        validCandidates.push({
            id: idx,
            log: cand.log,
            step: cand.step,
            hasLeverageFix,
            hasQuantUnification,
            size: cand.code.length,
            file: tempFile,
            code: cand.code
        });
    } else {
        // 문법 에러가 있더라도 간단히 주석 등으로 깨진 것이라면 제거 시도 가능
        // 임시 파일은 나중에 지움
    }
});

console.log(`\nValid candidates summary:`);
validCandidates.forEach(v => {
    console.log(`- ID: ${v.id}, Log: ${v.log}, Step: ${v.step}, Size: ${v.size} bytes, LeverageFix: ${v.hasLeverageFix}, Quant: ${v.hasQuantUnification}`);
});

if (validCandidates.length > 0) {
    // 사용자가 말한 골든 버전은 레버리지 고정이 구현되어 있는 "+87 -9" 버전이면서
    // 퀀트 지표 무리하게 수정해서 망가지기 전 상태임.
    // 보통 이전 conversation의 후반부에 온전히 잘 기동하던 상태일 것.
    // LeverageFix가 true인 것 중에서 최신(가장 나중 스텝) 후보를 선택해보자.
    const target = validCandidates
        .filter(v => v.hasLeverageFix)
        .sort((a, b) => {
            if (a.log !== b.log) {
                // 이전 로그(55f36f53...)가 먼저, 현재 로그(f747d...)가 나중
                return a.log.startsWith("f74") ? 1 : -1;
            }
            return b.step - a.step; // 역순 (가장 최신)
        })[0];
        
    if (target) {
        console.log(`\n>>> RECOMMENDED GOLDEN FILE: Cand #${target.id} (Log: ${target.log}, Step: ${target.step})`);
        // app.js로 복원
        const dest = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
        fs.writeFileSync(dest, target.code, 'utf8');
        console.log(`[SUCCESS] Copied Cand #${target.id} into app.js!`);
    } else {
        console.log("\nNo candidate with LeverageFix found. Copying the largest valid candidate...");
        const largest = validCandidates.sort((a, b) => b.size - a.size)[0];
        const dest = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
        fs.writeFileSync(dest, largest.code, 'utf8');
        console.log(`[SUCCESS] Copied largest Cand #${largest.id} into app.js!`);
    }
} else {
    console.log("[FAIL] No syntax-valid full-text candidates found!");
}
