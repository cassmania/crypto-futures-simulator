const fs = require('fs');

try {
    const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // index.html의 indicators/project가 끝나는 2182라인 다음의 중괄호 꼬임 해결
    // 'document.getElementById("project-levels").innerText = pInfo.지지저항;\n    }\n};' 패턴을 찾음
    const targetPattern = 'document.getElementById("project-levels").innerText = pInfo.지지저항;\r\n    }\r\n};';
    const targetPatternLF = 'document.getElementById("project-levels").innerText = pInfo.지지저항;\n    }\n};';
    
    let success = false;
    if (content.includes(targetPattern)) {
        content = content.replace(targetPattern, 'document.getElementById("project-levels").innerText = pInfo.지지저항;\n    }');
        success = true;
    } else if (content.includes(targetPatternLF)) {
        content = content.replace(targetPatternLF, 'document.getElementById("project-levels").innerText = pInfo.지지저항;\n    }');
        success = true;
    } else {
        // 좀 더 안전한 문자열 교체
        const oldStr = 'document.getElementById("project-levels").innerText = pInfo.지지저항;\n    }\n};';
        const startIdx = content.indexOf('document.getElementById("project-levels").innerText = pInfo.지지저항;');
        if (startIdx !== -1) {
            // startIdx 다음의 첫 '};' 를 지운다.
            const idxOfClose = content.indexOf('};', startIdx);
            if (idxOfClose !== -1 && idxOfClose - startIdx < 50) {
                const before = content.substring(0, idxOfClose);
                const after = content.substring(idxOfClose + 2);
                content = before + after;
                success = true;
            }
        }
    }

    if (success) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("[SUCCESS] app.js trailing unexpected close curly braces fully fixed!");
    } else {
        console.log("[FAIL] Could not locate trailing unexpected braces in app.js.");
    }
} catch (e) {
    console.error("Error fixing curly:", e.message);
}
