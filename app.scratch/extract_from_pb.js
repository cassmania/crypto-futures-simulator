const fs = require('fs');

try {
    const filePath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\conversations\\f747d36c-726a-4e79-ab58-4ed242124998.pb';
    if (fs.existsSync(filePath)) {
        console.log("f747d36c-726a-4e79-ab58-4ed242124998.pb exists! Size:", fs.statSync(filePath).size);
        const data = fs.readFileSync(filePath, 'utf8');
        
        // positions-table-body 검색
        let index = 0;
        let pos = -1;
        
        // 이 pb 파일 안에서 진짜 Javascript 코드 블럭의 특징을 지닌 부분을 발굴
        // (예: function 주문비용재연산, positions-table-body, btn-reset가 모두 포함된 가장 큰 이스케이프 해제 가능 블록)
        while ((pos = data.indexOf('positions-table-body', pos + 1)) !== -1) {
            console.log(`Found 'positions-table-body' in pb at index ${pos}`);
            
            // 앞뒤로 넓게 슬라이싱 (15000바이트씩)
            const start = Math.max(0, pos - 5000);
            const end = Math.min(data.length, pos + 15000);
            const slice = data.substring(start, end);
            
            // 이 slice 내부에 'btn-reset'와 'function 주문비용재연산' 혹은 'Estimated Margin' 등이 들어있는지 필터
            if (slice.includes('btn-reset') && (slice.includes('function') || slice.includes('estimated-margin'))) {
                // 이스케이프 정규화
                const unescaped = slice
                    .replace(/\\r\\n/g, '\n')
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                
                // unescaped 텍스트에서 진짜 JS 코드의 시작('{')과 끝('}')을 탐색하여 추출
                // 'function 활성포지션테이블렌더링' 같은 키워드가 있는 곳부터 복원
                fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\pb_recovered_${index}.txt`, unescaped, 'utf8');
                console.log(`[SUCCESS] Wrote unescaped segment ${index} to pb_recovered_${index}.txt`);
                index++;
                if (index > 10) break; // 최대 10개만 추출
            }
        }
        
        if (index === 0) {
            console.log("Could not find any suitable functional slice containing 'btn-reset' and 'positions-table-body' in the pb file.");
        }
    } else {
        console.log(".pb file does not exist at:", filePath);
    }
} catch (e) {
    console.error("Extraction from pb failed:", e.message);
}
