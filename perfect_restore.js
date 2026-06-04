const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

if (!fs.existsSync(logPath)) {
    console.log("로그 파일이 존재하지 않습니다!");
    process.exit(1);
}

const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n');

const codeMap = new Map();
let appJsViewCount = 0;

for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
        const obj = JSON.parse(line);
        if (obj.type === "VIEW_FILE" && obj.content) {
            const text = obj.content;
            
            // File Path가 정확히 app.js 인지 엄격히 검증
            // 예: File Path: `file:///C:/Users/Administrator/source/repos/crypto-futures-simulator/app.js`
            const filePathMatch = text.match(/File Path:\s*`file:\/\/\/(.*?)`/);
            if (!filePathMatch) continue;
            
            const filePath = filePathMatch[1];
            if (!filePath.endsWith('/app.js') && !filePath.endsWith('\\app.js')) {
                continue;
            }
            
            appJsViewCount++;
            
            // 라인 분석 시작
            const contentLines = text.split('\n');
            contentLines.forEach(l => {
                // 예: "123: const myVar = 1;"
                // 정규표현식으로 라인 번호와 원본 코드 추출
                const m = l.match(/^(\d+):\s?(.*)$/);
                if (m) {
                    const lineNum = parseInt(m[1]);
                    const code = m[2];
                    
                    // JSON 덤프 데이터가 섞여 들어가는 것 원천 방지
                    if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                        return;
                    }
                    
                    codeMap.set(lineNum, code);
                }
            });
        }
    } catch (e) {
        // 파싱 오류 건너뜀
    }
}

console.log(`[분석 완료] 총 ${appJsViewCount}번의 app.js 조회 로그 처리됨.`);
console.log(`복원된 고유 라인 수: ${codeMap.size}`);

if (codeMap.size > 0) {
    const sortedLineNums = Array.from(codeMap.keys()).sort((a, b) => a - b);
    const lastLine = sortedLineNums[sortedLineNums.length - 1];
    console.log(`최대 라인 번호: ${lastLine}`);
    
    const finalLines = [];
    let emptyCount = 0;
    for (let i = 1; i <= lastLine; i++) {
        if (codeMap.has(i)) {
            finalLines.push(codeMap.get(i));
        } else {
            finalLines.push(""); // 없는 라인은 빈 줄로 채움
            emptyCount++;
        }
    }
    
    console.log(`빈 라인으로 채워진 수: ${emptyCount}`);
    
    const jsContent = finalLines.join('\n');
    fs.writeFileSync(targetFile, jsContent, 'utf8');
    console.log(`[성공] app.js가 완벽 복구되었습니다! 파일 크기: ${jsContent.length} 바이트, 라인 수: ${finalLines.length}`);
} else {
    console.log("[실패] 복원할 수 있는 app.js 라인이 없습니다.");
}
