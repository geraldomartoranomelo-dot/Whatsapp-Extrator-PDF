const fs = require('fs');
const code = fs.readFileSync('index.js', 'utf8');

const sendStart = code.indexOf("res.send(`");
const sendEnd = code.indexOf("    `);", sendStart);
const templateContent = code.substring(sendStart + 10, sendEnd);

let html;
try {
    html = eval('`' + templateContent + '`');
} catch(e) {
    console.log("ERRO ao processar template:", e.message);
    process.exit(1);
}

// Pega o ULTIMO bloco <script>...</script> (o do frontend)
const lastScriptStart = html.lastIndexOf('<script>') + 8;
const lastScriptEnd = html.lastIndexOf('</script>');
const jsCode = html.substring(lastScriptStart, lastScriptEnd);

console.log("Primeiras 3 linhas do JS:");
jsCode.split('\n').slice(0, 3).forEach((l, i) => console.log(`  ${i+1}: ${l}`));

try {
    new Function(jsCode);
    console.log("\n✅ JS OK - sem erros de sintaxe!");
} catch(e) {
    console.log("\n❌ ERRO NO JS:", e.message);
}
