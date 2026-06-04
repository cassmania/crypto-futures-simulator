const fs = require('fs');

try {
    const filePath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\conversations\\f747d36c-726a-4e79-ab58-4ed242124998.pb';
    if (fs.existsSync(filePath)) {
        console.log("Reading pb as binary buffer...");
        const buffer = fs.readFileSync(filePath);
        console.log("File loaded. Scanning bytes for 'positions-table-body'...");
        
        const target = Buffer.from('positions-table-body', 'utf8');
        let pos = -1;
        let index = 0;
        
        while ((pos = buffer.indexOf(target, pos + 1)) !== -1) {
            console.log(`Found 'positions-table-body' binary match at byte offset ${pos}`);
            
            // 앞뒤로 8000바이트 덤프
            const start = Math.max(0, pos - 4000);
            const end = Math.min(buffer.length, pos + 12000);
            const slice = buffer.slice(start, end);
            
            // 이 slice 내부에서 'btn-reset' 바이트도 포함하는지 검사
            const btnReset = Buffer.from('btn-reset', 'utf8');
            if (slice.indexOf(btnReset) !== -1) {
                // 바이너리 디코딩 (utf8이 아닐 수 있으니 에러 문자는 무시하는 ascii/utf8 복합 디코딩)
                const text = slice.toString('utf8');
                
                // 역슬래시 및 이스케이프 정규화
                const unescaped = text
                    .replace(/\\r\\n/g, '\n')
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                
                fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\binary_recovered_${index}.txt`, unescaped, 'utf8');
                console.log(`[SUCCESS] Wrote unescaped segment ${index} to binary_recovered_${index}.txt`);
                index++;
                if (index > 5) break;
            }
        }
        
        if (index === 0) {
            console.log("Could not find suitable byte sequences in pb.");
        }
    } else {
        console.log(".pb does not exist");
    }
} catch (e) {
    console.error("Binary scanning failed:", e.message);
}
