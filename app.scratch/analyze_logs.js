const fs = require('fs');
const path = require('path');

const 로그파일들 = [
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl',
    'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl'
];

console.log("=== app.js 관련 도구 호출 분석 스크립트 ===");

로그파일들.forEach((로그경로) => {
    if (!fs.existsSync(로그경로)) return;
    
    console.log(`\n🔍 분석 로그: ${path.basename(path.dirname(path.dirname(로그경로)))}`);
    const 내용 = fs.readFileSync(로그경로, 'utf8');
    const 라인들 = 내용.split('\n');
    
    let 매칭수 = 0;
    
    for (let i = 0; i < 라인들.length; i++) {
        const 라인 = 라인들[i];
        if (!라인.trim()) continue;
        
        try {
            const 객체 = JSON.parse(라인);
            const 스텝 = 객체.step_index || i;
            
            if (객체.tool_calls) {
                객체.tool_calls.forEach((tc) => {
                    const 인자 = tc.args || {};
                    const 인자문자열 = JSON.stringify(인자);
                    
                    if (인자문자열.toLowerCase().includes("app.js")) {
                        매칭수++;
                        if (매칭수 > 40) return; // 상위 40개만 출력
                        
                        const 인자키들 = Object.keys(인자);
                        console.log(`[Step ${스텝}] Tool: ${tc.name}`);
                        console.log(`  - Args Keys: ${인자키들.join(', ')}`);
                        if (인자.TargetFile) console.log(`  - TargetFile: ${인자.TargetFile}`);
                        if (인자.TargetContent) console.log(`  - TargetContent Len: ${인자.TargetContent.length}`);
                        if (인자.ReplacementContent) console.log(`  - ReplacementContent Len: ${인자.ReplacementContent.length}`);
                        if (인자.CodeContent) console.log(`  - CodeContent Len: ${typeof 인자.CodeContent === 'string' ? 인자.CodeContent.length : 'Not String'}`);
                    }
                });
            }
        } catch (e) {}
    }
    console.log(`  => 총 app.js 관련 도구 호출 발견 수: ${매칭수}개`);
});
