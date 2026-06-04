const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain';
const targetFile = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';

console.log('Reconstructing app.js to the state at Step 2360 (Leverage Preservation Golden Era)...');
const codeMap = new Map();
const seenLinesByStep = new Map();

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === '.system_generated') {
                const logsDir = path.join(fullPath, 'logs');
                if (fs.existsSync(logsDir)) {
                    const transcriptPath = path.join(logsDir, 'transcript.jsonl');
                    if (fs.existsSync(transcriptPath)) {
                        processTranscript(transcriptPath);
                    }
                }
            } else {
                scanDir(fullPath);
            }
        }
    });
}

function processTranscript(filePath) {
    console.log('Processing transcript:', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let folderPriority = 1;
    let isCurrentFolder = false;
    if (filePath.includes('55f36f53')) {
        folderPriority = 10;
    } else if (filePath.includes('f747d36c')) {
        folderPriority = 100;
        isCurrentFolder = true;
    }
    
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        try {
            const obj = JSON.parse(line);
            const step = obj.step_index || index;
            
            // 만약 현재 대화방이고 스텝이 2360보다 크다면, 퀀트 지표 수정으로 인해 코드가 꼬이기 시작한 시점이므로 완전히 배제!
            if (isCurrentFolder && step > 2360) {
                return;
            }
            
            let isAppJsView = false;
            let fileContent = '';
            
            if (obj.tool_calls && obj.tool_calls.length > 0) {
                const tc = obj.tool_calls[0];
                if (tc.name === 'view_file' && tc.args) {
                    const absPath = tc.args.AbsolutePath || '';
                    if (absPath.endsWith('/app.js') || absPath.endsWith('\\app.js') || absPath.endsWith('app.js"') || absPath.endsWith('app.js')) {
                        if (!absPath.includes('restore') && !absPath.includes('fix') && !absPath.includes('rebuilder') && !absPath.includes('scan') && !absPath.includes('rebuild')) {
                            isAppJsView = true;
                        }
                    }
                }
            }
            
            if (isAppJsView) {
                fileContent = obj.content || obj.output || '';
                if (!fileContent && obj.tool_calls[0].output) {
                    fileContent = obj.tool_calls[0].output;
                }
            }
            
            if (!isAppJsView && obj.type === 'VIEW_FILE' && obj.content) {
                const text = obj.content;
                if (text.includes('app.js') && text.includes('Showing lines')) {
                    const filePathMatch = text.match(/File Path:\s*`file:\/\/\/(.*?)`/);
                    if (filePathMatch) {
                        const fp = filePathMatch[1];
                        if (fp.endsWith('/app.js') || fp.endsWith('\\app.js')) {
                            isAppJsView = true;
                            fileContent = text;
                        }
                    }
                }
            }
            
            if (isAppJsView && fileContent) {
                if (fileContent.includes('<truncated 1390 bytes>') || fileContent.includes('<truncated 2645 bytes>')) {
                    return;
                }
                
                const contentLines = fileContent.split('\n');
                contentLines.forEach(l => {
                    const m = l.match(/^\s*(\d+):\s?(.*)$/);
                    if (m) {
                        const lineNum = parseInt(m[1]);
                        let code = m[2];
                        
                        code = code
                            .replace(/\\r/g, '')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                            
                        const trimmed = code.trim();
                        if (trimmed.startsWith('<') || trimmed.startsWith('</') || trimmed.includes('</td>') || trimmed.includes('</div>')) {
                            return;
                        }
                        if (code.includes('precise_app_restore') || code.includes('perfect_restore') || code.includes('seenLinesByStep')) {
                            return;
                        }
                        if (code.includes('{"step_index"') || code.includes('"step_index":')) {
                            return;
                        }
                        if (code.includes('window.타점레버리지팝업')) {
                            return;
                        }
                        
                        const priorityScore = folderPriority * 100000 + step;
                        const lastPriority = seenLinesByStep.get(lineNum) || -1;
                        
                        if (priorityScore >= lastPriority) {
                            seenLinesByStep.set(lineNum, priorityScore);
                            codeMap.set(lineNum, code);
                        }
                    }
                });
            }
        } catch (e) {}
    });
}

scanDir(brainDir);
console.log('\nMerged unique lines count:', codeMap.size);

if (codeMap.size > 0) {
    const sortedLineNums = Array.from(codeMap.keys()).sort((a, b) => a - b);
    const lastLine = sortedLineNums[sortedLineNums.length - 1];
    console.log('Max line number found:', lastLine);
    
    const finalLines = [];
    let emptyCount = 0;
    for (let i = 1; i <= lastLine; i++) {
        if (codeMap.has(i)) {
            finalLines.push(codeMap.get(i));
        } else {
            finalLines.push('');
            emptyCount++;
        }
    }
    console.log('Remaining empty lines:', emptyCount);
    
    // Header check
    if (finalLines[0] && (finalLines[0].trim().startsWith('<') || finalLines[0].trim() === "")) {
        finalLines[0] = "/* ----------------------------------------------------";
        finalLines[1] = "   BINANCE REAL-TIME LIVE TRADING ENGINE (app.js)";
        finalLines[2] = "---------------------------------------------------- */";
    }
    
    const jsContent = finalLines.join('\n');
    fs.writeFileSync(targetFile, jsContent, 'utf8');
    console.log('SUCCESS! Wrote strictly merged app.js up to Step 2360');
} else {
    console.log('FAILED! No lines found');
}
