const fs = require('fs');

try {
    const raw = fs.readFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\found_init.json', 'utf8');
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
    
    // Unescape the string properly
    let unescaped = text;
    try {
        // If it is double-escaped or just JSON-escaped, we can parse it as a JSON string
        unescaped = JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
    } catch (e) {
        // Fallback simple replacement
        unescaped = text
            .replace(/\\r\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
    
    fs.writeFileSync('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch\\found_init_clean.txt', unescaped, 'utf8');
    console.log('[SUCCESS] Cleaned init text length:', unescaped.length);
} catch (e) {
    console.error('[ERROR] Failed to clean init:', e.message);
}
