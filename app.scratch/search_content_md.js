const fs = require('fs');

try {
    const filePath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\steps\\1800\\content.md';
    if (fs.existsSync(filePath)) {
        console.log("content.md exists! Searching...");
        const content = fs.readFileSync(filePath, 'utf8');
        
        // btn-reset 검색
        let index = 0;
        let pos = -1;
        while ((pos = content.indexOf('btn-reset', pos + 1)) !== -1) {
            console.log(`Found 'btn-reset' at index ${pos}`);
            // 앞뒤로 500자 잘라서 확인
            const snippet = content.substring(Math.max(0, pos - 200), Math.min(content.length, pos + 500));
            console.log(`--- Snippet ${index} ---`);
            console.log(snippet);
            console.log("------------------------");
            index++;
            if (index > 5) break;
        }
    } else {
        console.log("content.md does not exist");
    }
} catch (e) {
    console.error("Failed:", e.message);
}
