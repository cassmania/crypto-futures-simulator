const fs = require('fs');

const filePath = 'C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

// 'function 업데이트호가목록(container, list, coin, 가격클래스, isAsk) {' 함수의 끝을 닫는 '}\n}' 바로 다음부터
// '// 호가 클릭 시 가격 자동 입력' 바로 직전까지의 중복 가비지 블록을 감지합니다.

const searchStart = `            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    }
}`;

const searchEnd = `// 호가 클릭 시 가격 자동 입력
window.호가클릭 = function(price) {`;

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd, startIdx + searchStart.length);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx + searchStart.length);
    const after = content.substring(endIdx);
    
    fs.writeFileSync(filePath, before + '\n\n' + after, 'utf8');
    console.log('[SUCCESS] Successfully cleaned duplicate socket and parser blocks!');
} else {
    console.log('[FAIL] Could not locate patch boundary.');
}
