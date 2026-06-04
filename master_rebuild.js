const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

if (!fs.existsSync(logPath)) {
    console.log("로그 파일이 없습니다!");
    process.exit(1);
}

const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n');

// 1. 마지막 파일 수정 시점의 인덱스 찾기
let lastEditIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // app.js를 수정했던 툴 호출 확인
        if (obj.tool_calls) {
            let hasEdit = false;
            obj.tool_calls.forEach(tc => {
                if ((tc.name === "write_to_file" || tc.name === "replace_file_content" || tc.name === "multi_replace_file_content") && 
                    tc.args && tc.args.TargetFile && tc.args.TargetFile.includes("app.js")) {
                    hasEdit = true;
                }
            });
            if (hasEdit) {
                lastEditIndex = i;
                break;
            }
        }
    } catch (e) {}
}

console.log(`최종 파일 수정 로그 인덱스: ${lastEditIndex} / ${lines.length}`);

// 2. 그 최종 수정 인덱스 *이후*에 발생한 VIEW_FILE 로그들만 수집!
// 만약 최종 수정 이후 조회 로그가 아예 없거나 너무 작다면, 최종 수정 인덱스를 포함해 그 직후부터의 연속된 뷰 시퀀스를 잡음.
const codeMap = new Map();
let scannedViews = 0;

const startIndexToScan = lastEditIndex !== -1 ? lastEditIndex : 0;

for (let i = startIndexToScan; i < lines.length; i++) {
    const line = lines[i];
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
            
            scannedViews++;
            
            const contentLines = text.split('\n');
            contentLines.forEach(l => {
                const m = l.match(/^(\d+):\s?(.*)$/);
                if (m) {
                    const lineNum = parseInt(m[1]);
                    const code = m[2];
                    
                    // JSON 덤프 방어
                    if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                        return;
                    }
                    
                    // 최신 시점 뷰로 항상 덮어씀
                    codeMap.set(lineNum, code);
                }
            });
        }
    } catch (e) {}
}

console.log(`[1차 수집 완료] 최종 수정 이후 뷰 로그 수: ${scannedViews}, 수집된 라인 수: ${codeMap.size}`);

// 만약 최종 수정 이후의 뷰 로그가 너무 적어 유실된 부분이 많다면 (예: 2000라인 이하),
// 그냥 역순(최신순)으로 탐색하되, 각 줄 번호별로 "마지막 파일 수정" 시점 이후 또는 가장 최근에 뷰된 시점만 잡는 정교한 역순 병합 실행
if (codeMap.size < 4000) {
    console.log("최종 수정 이후 뷰 로그가 부족하여, 시스템 전체 로그 대상 '최신 뷰 블록 체인' 조립 모드로 스위칭합니다...");
    codeMap.clear();
    const seenLines = new Set();
    
    // 뒤에서부터(최신부터) 역순으로 뷰 로그 수집
    let lastScannedEditTime = null;
    let editCount = 0;
    
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        try {
            const obj = JSON.parse(line);
            
            // 만약 파일 수정을 만나면, 이 수정 이전의 뷰 로그들은 줄 번호 오차가 있을 수 있으므로 경고 누적
            if (obj.tool_calls) {
                let hasEdit = false;
                obj.tool_calls.forEach(tc => {
                    if ((tc.name === "write_to_file" || tc.name === "replace_file_content" || tc.name === "multi_replace_file_content") && 
                        tc.args && tc.args.TargetFile && tc.args.TargetFile.includes("app.js")) {
                        hasEdit = true;
                    }
                });
                if (hasEdit) {
                    editCount++;
                    // 최대 3번의 편집 블록까지만 역순 추적을 허용하여 줄 밀림을 최소화하고 무결성을 유지!
                    if (editCount > 2) {
                        console.log(`[조립 중단] 줄 밀림 한계 도달 (최근 2개 편집 블록 확보). 역순 조립을 중단합니다.`);
                        break;
                    }
                }
            }
            
            if (obj.type === "VIEW_FILE" && obj.content) {
                const text = obj.content;
                
                const filePathMatch = text.match(/File Path:\s*`file:\/\/\/(.*?)`/);
                if (!filePathMatch) continue;
                
                const filePath = filePathMatch[1];
                if (!filePath.endsWith('/app.js') && !filePath.endsWith('\\app.js')) {
                    continue;
                }
                
                const contentLines = text.split('\n');
                contentLines.forEach(l => {
                    const m = l.match(/^(\d+):\s?(.*)$/);
                    if (m) {
                        const lineNum = parseInt(m[1]);
                        const code = m[2];
                        
                        if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                            return;
                        }
                        
                        if (!seenLines.has(lineNum)) {
                            seenLines.add(lineNum);
                            codeMap.set(lineNum, code);
                        }
                    }
                });
            }
        } catch (e) {}
    }
}

console.log(`최종 조립 완료! 라인 수: ${codeMap.size}`);

if (codeMap.size > 0) {
    const sortedLineNums = Array.from(codeMap.keys()).sort((a, b) => a - b);
    const lastLine = sortedLineNums[sortedLineNums.length - 1];
    
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
    
    const jsContent = finalLines.join('\n');
    fs.writeFileSync(targetFile, jsContent, 'utf8');
    console.log(`[복구 완수] app.js가 완전히 정화되어 복원되었습니다! 크기: ${jsContent.length} 바이트, 총 라인: ${finalLines.length}, 빈 줄: ${emptyCount}`);
} else {
    console.log("[실패] 복원할 라인이 전혀 없습니다.");
}
