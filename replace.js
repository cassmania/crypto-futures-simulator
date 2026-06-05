const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
c = c.replace(/\bma7\b/g, 'ema5')
     .replace(/\bma25\b/g, 'ema20')
     .replace(/\bma99\b/g, 'sma60')
     .replace(/\bma200\b/g, 'sma200')
     .replace(/\bMA7/g, 'EMA5')
     .replace(/\bMA25/g, 'EMA20')
     .replace(/\bMA99/g, 'SMA60')
     .replace(/계산SMA\(([^,]+),\s*7\)/g, '계산EMA($1, 5)')
     .replace(/계산SMA\(([^,]+),\s*25\)/g, '계산EMA($1, 20)')
     .replace(/계산SMA\(([^,]+),\s*99\)/g, '계산SMA($1, 60)')
     .replace(/계산SMA\(([^,]+),\s*100\)/g, '계산SMA($1, 200)');
fs.writeFileSync('app.js', c, 'utf8');
