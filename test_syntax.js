const fs = require('fs');
const content = fs.readFileSync('d:\\Whatsapp Extrator PDF\\index.js', 'utf-8');
const scriptPart = content.match(/res\.send\(`([\s\S]*?)`\);/);
if (scriptPart) {
    console.log("HTML length:", scriptPart[1].length);
    try {
        // Try to see if there's any unescaped ${} that would cause a Node crash
        // but since node -c passed, it's not a Node syntax error.
        // It might be a Browser syntax error.
        const browserJS = scriptPart[1].match(/<script>([\s\S]*?)<\/script>/)[1];
        console.log("Browser JS found");
    } catch(e) {
        console.log("Error finding browser JS:", e.message);
    }
} else {
    console.log("res.send template literal NOT found");
}
