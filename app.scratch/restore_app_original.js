const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\diff_block.json', 'utf8');
    const obj = JSON.parse(raw);
    
    // 이 obj는 transcript.jsonl의 한 라인
    // obj.tool_calls[0].args 에 TargetContent와 ReplacementContent 가 있음.
    // 하지만 이 tool call은 내가 방금 실행한 replace_file_content (구문 오류를 낸 수정)일 것이다.
    // 그렇다면:
    // args.TargetContent는 '수정 전의 올바른 1985~2280라인의 코드' 이고,
    // args.ReplacementContent는 '구문 에러가 난 깨진 코드' 이다!
    // 와!!!! 진짜 유레카다!!
    // args.TargetContent야말로 우리가 그토록 찾아헤매던 '손상되기 전의 완벽하고 아름다운 app.js 원본 코드'이다!
    
    if (obj.tool_calls && obj.tool_calls.length > 0) {
        const toolCall = obj.tool_calls[0];
        if (toolCall.args) {
            const args = toolCall.args;
            const targetContent = args.TargetContent;
            
            if (targetContent) {
                fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\recovered_target_original.js', targetContent, 'utf8');
                console.log("[SUCCESS] Successfully recovered the original app.js code to app.scratch/recovered_target_original.js!");
                
                // 이제 app.js의 손상된 부분을 이 원래 코드로 돌려놔야 한다!
                // 손상된 app.js의 1985라인부터 끝까지를 살펴보고 복구하자.
            } else {
                console.log("No TargetContent in args");
            }
        } else {
            console.log("No args in toolCall");
        }
    } else {
        console.log("No tool_calls in obj");
    }
} catch (e) {
    console.error("Restoration script failed:", e.message);
}
