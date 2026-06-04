const fs = require('fs');
const path = require('path');

const search = (dir) => {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                search(fullPath);
            }
        } else if (file.endsWith('.js') || file.endsWith('.txt')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('분할차트들렌더링')) {
                const lines = content.split('\n');
                lines.forEach((l, i) => {
                    if (l.includes('분할차트들렌더링') && (l.includes('function') || l.includes('=>'))) {
                        console.log(`${fullPath}:${i + 1}: ${l.trim()}`);
                        let printed = 0;
                        for (let j = i; j < lines.length && printed < 40; j++, printed++) {
                            console.log('  ' + lines[j]);
                        }
                    }
                });
            }
        }
    });
};

search('.');
