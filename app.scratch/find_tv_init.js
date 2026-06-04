const fs = require('fs');

const logFile = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    
    let found = false;
    for (let index = 0; index < lines.length; index++) {
        let line = lines[index];
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const text = obj.content || obj.output || '';
            const step = obj.step_index || index;
            
            // 퀀트 작업 전(step 2000 이전)에 view_file 등으로 차트시스템초기화 전체가 출력되었던 로그 매칭
            if (text.includes('function 차트시스템초기화') && text.includes('MA99시리즈') && step < 2000 && text.length > 3000 && !text.includes('diff_block')) {
                console.log(`[FOUND CLEAN ERA] step: ${step}, text size: ${text.length}`);
                const startIdx = text.indexOf('function 차트시스템초기화');
                if (startIdx !== -1) {
                    // 라인 번호 접두사 제거
                    let rawLines = text.substring(startIdx, startIdx + 8000).split('\n');
                    let cleanedLines = rawLines.map(rl => {
                        let m = rl.trim().match(/^\d+:\s?(.*)$/);
                        return m ? m[1] : rl;
                    });
                    
                    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\chart_init_complete.txt', cleanedLines.join('\n'), 'utf8');
                    console.log("[SUCCESS] Saved pure golden chart_init_complete.txt!");
                    found = true;
                    break;
                }
            }
        } catch(e) {}
    }
    if (!found) {
        console.log("No golden era block found, checking other logs...");
    }
} else {
    console.log("Log file not found!");
}
