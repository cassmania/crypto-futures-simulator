const fs = require('fs');
const path = require('path');

const files = ['found_tv_1.json', 'found_tv_2.json', 'found_tv_3.json'];

files.forEach(f => {
    const fullPath = path.join('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch', f);
    if (!fs.existsSync(fullPath)) return;
    
    try {
        const obj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
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
        
        const outName = f.replace('.json', '_clean.txt');
        fs.writeFileSync(path.join('C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.scratch', outName), unescaped, 'utf8');
        console.log(`[SUCCESS] Cleaned ${f} to ${outName}. Size: ${unescaped.length}`);
    } catch(e) {
        console.error(`Error cleaning ${f}:`, e.message);
    }
});
