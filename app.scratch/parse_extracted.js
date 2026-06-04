const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted.json', 'utf8');
    const obj = JSON.parse(raw);
    
    // JSON 구조에서 content나 tool_calls 등을 탐색
    console.log("Keys in JSON:", Object.keys(obj));
    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\parsed_extracted.txt', JSON.stringify(obj, null, 2), 'utf8');
    
    // 만약 content 또는 tool_calls의 output 등에서 app.js 텍스트가 있다면 추출
    let foundText = "";
    if (obj.content) {
        foundText += obj.content + "\n";
    }
    if (obj.tool_calls) {
        foundText += JSON.stringify(obj.tool_calls) + "\n";
    }
    if (obj.output) {
        foundText += obj.output + "\n";
    }
    
    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\extracted_text.txt', foundText, 'utf8');
    console.log("Successfully parsed extracted.json and wrote to app.scratch/extracted_text.txt");
} catch (e) {
    console.error("Parsing failed:", e.message);
}
