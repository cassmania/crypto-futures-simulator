const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\found_tv_0.json', 'utf8');
    const obj = JSON.parse(raw);
    
    let text = '';
    if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
            if (tc.args) {
                text += tc.args.ReplacementContent || '';
            }
        });
    } else if (obj.content) {
        text = obj.content;
    }
    
    let unescaped = text;
    try {
        unescaped = JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
    } catch (e) {
        unescaped = text
            .replace(/\\r\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
    
    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\found_tv_clean.txt', unescaped, 'utf8');
    console.log('[SUCCESS] Cleaned tv text length:', unescaped.length);
} catch (e) {
    console.error('[ERROR] Failed to clean tv:', e.message);
}
