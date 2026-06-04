const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted.json', 'utf8');
    
    // 이스케이프 패턴을 다차원적으로 검출
    const possibleKeys = [
        '\\"ReplacementContent\\":\\"',
        '\\\"ReplacementContent\\\":\\\"',
        '"ReplacementContent":"',
        'ReplacementContent'
    ];
    
    let foundKey = null;
    let startIndex = -1;
    for (const key of possibleKeys) {
        startIndex = raw.indexOf(key);
        if (startIndex !== -1) {
            foundKey = key;
            break;
        }
    }
    
    if (startIndex !== -1 && foundKey) {
        console.log(`Found key pattern: ${foundKey} at index ${startIndex}`);
        
        // "ReplacementContent" 키 이름 뒤의 콜론과 값의 시작 위치를 찾음
        const afterKey = raw.substring(startIndex);
        // 콜론 뒤에 시작하는 큰따옴표의 위치
        const colonIdx = afterKey.indexOf(':');
        let quoteIdx = -1;
        for (let i = colonIdx + 1; i < afterKey.length; i++) {
            if (afterKey[i] === '"') {
                quoteIdx = i;
                break;
            }
        }
        
        if (quoteIdx !== -1) {
            const valStart = startIndex + quoteIdx + 1;
            // 닫는 큰따옴표를 찾음 (단, 바로 앞에 홀수 개의 백슬래시가 없는 경우여야 함)
            let valEnd = valStart;
            while (valEnd < raw.length) {
                if (raw[valEnd] === '"') {
                    // 백슬래시 개수 카운트
                    let bsCount = 0;
                    let k = valEnd - 1;
                    while (k >= valStart && raw[k] === '\\') {
                        bsCount++;
                        k--;
                    }
                    if (bsCount % 2 === 0) {
                        break;
                    }
                }
                valEnd++;
            }
            
            const escapedVal = raw.substring(valStart, valEnd);
            console.log(`Extracted escaped length: ${escapedVal.length}`);
            
            // 이스케이프된 문자열을 파싱하기 위해 JSON.parse 구조 생성
            // 겹이중 백슬래시를 치환
            let jsonString = '"' + escapedVal + '"';
            // 만약 \\" 형태 등으로 백슬래시가 여러 겹 씌워져 있다면 정규화
            try {
                const unescaped = JSON.parse(jsonString);
                fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code.js', unescaped, 'utf8');
                console.log("Successfully extracted original code to app.scratch/recovered_code.js!");
            } catch (err) {
                // 2차 정규화 시도
                console.log("Standard JSON.parse failed, trying to normalize slashes...");
                // 백슬래시 개수를 줄임
                jsonString = '"' + escapedVal.replace(/\\\\/g, '\\').replace(/\\"/g, '"') + '"';
                try {
                    // 만약 줄바꿈이 raw하게 들어가 있다면 \n 형태로 치환
                    const normalized = escapedVal
                        .replace(/\\r\\n/g, '\n')
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_code.js', normalized, 'utf8');
                    console.log("Wrote normalized raw text to app.scratch/recovered_code.js!");
                } catch (err2) {
                    console.error("All unescape methods failed:", err2.message);
                }
            }
        }
    } else {
        console.log("Could not find any ReplacementContent key pattern");
    }
} catch (e) {
    console.error("Simple extraction failed:", e.message);
}
