const fs = require('fs');
const code = fs.readFileSync('index.js', 'utf8');

// Encontra o bloco entre <script> e </script>
const scriptStart = code.indexOf('<script>');
const scriptEnd = code.indexOf('</script>');
const block = code.substring(scriptStart, scriptEnd + 9);

// Conta backticks
const backticks = [];
for (let i = 0; i < block.length; i++) {
    if (block[i] === '`') {
        backticks.push(i);
    }
}
console.log('Total backticks no bloco script:', backticks.length);

// Mostra contexto de cada backtick
backticks.forEach((pos, idx) => {
    const context = block.substring(Math.max(0, pos - 30), pos + 30);
    console.log(`Backtick #${idx + 1} at pos ${pos}:`, JSON.stringify(context));
});
