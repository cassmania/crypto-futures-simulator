const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted.json', 'utf8');
    const obj = JSON.parse(raw);
    
    // tool_calls의 args 안의 ReplacementChunks를 찾음
    if (obj.tool_calls && obj.tool_calls.length > 0) {
        const toolCall = obj.tool_calls[0];
        if (toolCall.args) {
            console.log("Tool name:", toolCall.name);
            const args = toolCall.args;
            
            // 만약 ReplacementChunks가 string이면 parse하고, array면 그대로 사용
            let chunks = args.ReplacementChunks;
            if (typeof chunks === 'string') {
                chunks = JSON.parse(chunks);
            }
            
            if (chunks && chunks.length > 0) {
                console.log(`Found ${chunks.length} chunks!`);
                chunks.forEach((chunk, index) => {
                    console.log(`Chunk ${index} TargetContent length:`, chunk.TargetContent.length);
                    console.log(`Chunk ${index} ReplacementContent length:`, chunk.ReplacementContent.length);
                    
                    fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\chunk_${index}_target.txt`, chunk.TargetContent, 'utf8');
                    fs.writeFileSync(`C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\chunk_${index}_replacement.txt`, chunk.ReplacementContent, 'utf8');
                });
            } else {
                console.log("No chunks found in args:", args);
            }
        }
    } else {
        console.log("No tool_calls in obj");
    }
} catch (e) {
    console.error("Extraction failed:", e.message);
}
