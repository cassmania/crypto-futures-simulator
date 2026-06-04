const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

if (!fs.existsSync(logPath)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n').reverse(); // 👈 역순(최신순)으로 정렬!

const codeMap = new Map();
const seenLines = new Set();
let scannedViewsCount = 0;

for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
        const obj = JSON.parse(line);
        if (obj.type === "VIEW_FILE" && obj.content) {
            const text = obj.content;
            
            // File Path 검증
            const filePathMatch = text.match(/File Path:\s*`file:\/\/\/(.*?)`/);
            if (!filePathMatch) continue;
            
            const filePath = filePathMatch[1];
            if (!filePath.endsWith('/app.js') && !filePath.endsWith('\\app.js')) {
                continue;
            }
            
            scannedViewsCount++;
            
            const contentLines = text.split('\n');
            contentLines.forEach(l => {
                const m = l.match(/^(\d+):\s?(.*)$/);
                if (m) {
                    const lineNum = parseInt(m[1]);
                    const code = m[2];
                    
                    // JSON 덤프 데이터 원천 차단
                    if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                        return;
                    }
                    
                    // 👈 이미 더 최신 시점(앞서 처리된 시점)에서 이 라인을 썼다면 패스!
                    if (!seenLines.has(lineNum)) {
                        seenLines.add(lineNum);
                        codeMap.set(lineNum, code);
                    }
                }
            });
        }
    } catch (e) {
        // 무시
    }
}

console.log(`[역방향 스캔 완료] 최신 조회 로그 ${scannedViewsCount}개 분석됨.`);
console.log(`추출된 유니크 라인 수: ${codeMap.size}`);

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
            finalLines.push(""); 
            emptyCount++;
        }
    }
    
    console.log(`빈 라인으로 채워진 수: ${emptyCount}`);
    
    const jsContent = finalLines.join('\n');
    fs.writeFileSync(targetFile, jsContent, 'utf8');
    console.log(`[성공] 최신 정합성이 반영된 app.js 복원 완료! 파일 크기: ${jsContent.length} 바이트, 라인 수: ${finalLines.length}`);
} else {
    console.log("[실패] 복원할 수 있는 라인이 없습니다.");
}
