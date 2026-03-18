const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3002;

const DOWNLOAD_DIR = path.join(__dirname, 'PDFS_Baixados');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});

let isReady = false;

client.on('qr', async (qr) => {
    const filePath = path.join(__dirname, 'qr.png');
    await QRCode.toFile(filePath, qr);
    io.emit('status', { message: 'Aguardando QR Code...', type: 'warning' });
});

client.on('ready', () => {
    isReady = true;
    const filePath = path.join(__dirname, 'qr.png');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    io.emit('status', { message: 'WhatsApp Conectado!', type: 'success' });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>WhatsApp PDF Dashboard</title>
            <script src="/socket.io/socket.io.js"></script>
            <style>
                :root { --primary: #25d366; --dark: #075e54; --bg: #f0f2f5; --white: #ffffff; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); margin: 0; display: flex; height: 100vh; }
                .sidebar { width: 350px; background: var(--white); padding: 20px; box-shadow: 2px 0 10px rgba(0,0,0,0.05); z-index: 10; }
                .main { flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; }
                .card { background: var(--white); padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px; }
                h2 { color: var(--dark); margin-top: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
                input, button { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
                button { background: var(--primary); color: white; border: none; cursor: pointer; font-weight: 600; transition: 0.3s; }
                button:hover { background: #128c7e; transform: translateY(-2px); }
                button:disabled { background: #ccc; cursor: not-allowed; }
                .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; margin-bottom: 20px; display: inline-block; }
                .success { background: #dcf8c6; color: #075e54; }
                .warning { background: #fff3cd; color: #856404; }
                .searching { background: #cce5ff; color: #004085; }
                
                .pdf-item { display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid #eee; animation: slideIn 0.3s ease-out; }
                .pdf-icon { width: 40px; height: 40px; background: #ffebee; color: #d32f2f; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; }
                .pdf-info { flex: 1; }
                .pdf-name { font-weight: 600; color: #333; font-size: 0.9rem; }
                .pdf-meta { font-size: 0.75rem; color: #666; }
                
                @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--primary); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <h2>WhatsApp PDF Extrator</h2>
                <div id="appStatus" class="status-badge warning">Conectando...</div>
                
                <form id="searchForm">
                    <label>Nome do Grupo</label>
                    <input type="text" id="groupName" placeholder="Digite o nome do grupo" required>
                    <label>Data dos Arquivos</label>
                    <input type="date" id="searchDate" required>
                    <button type="submit" id="btnSearch">Buscar PDFs</button>
                </form>

                <div id="loading" style="display:none; text-align: center; margin-top: 20px;">
                    <div class="loader" style="display:inline-block"></div>
                    <p style="font-size: 0.8rem; color: #666;">Pesquisando no grupo...</p>
                </div>
            </div>

            <div class="main">
                <div class="card">
                    <h2>Arquivos Baixados <span id="fileCount" style="font-size: 0.8rem; background: #eee; padding: 2px 8px; border-radius: 10px;">0</span></h2>
                    <div id="pdfList">
                        <!-- PDFs will appear here -->
                        <p id="emptyMsg" style="color: #999; text-align: center; padding: 40px;">Nenhum arquivo baixado nesta sessão.</p>
                    </div>
                </div>
            </div>

            <script>
                const socket = io();
                const form = document.getElementById('searchForm');
                const pdfList = document.getElementById('pdfList');
                const appStatus = document.getElementById('appStatus');
                const btnSearch = document.getElementById('btnSearch');
                const loading = document.getElementById('loading');
                const emptyMsg = document.getElementById('emptyMsg');
                const fileCount = document.getElementById('fileCount');
                let count = 0;

                socket.on('status', (data) => {
                    appStatus.innerText = data.message;
                    appStatus.className = 'status-badge ' + data.type;
                });

                socket.on('pdf_downloaded', (data) => {
                    if(emptyMsg) emptyMsg.remove();
                    count++;
                    fileCount.innerText = count;
                    const item = document.createElement('div');
                    item.className = 'pdf-item';
                    item.innerHTML = \`
                        <div class="pdf-icon">PDF</div>
                        <div class="pdf-info">
                            <div class="pdf-name">\${data.name}</div>
                            <div class="pdf-meta">Tamanho: \${data.size} | Hora: \${new Date().toLocaleTimeString()}</div>
                        </div>
                    \`;
                    pdfList.prepend(item);
                });

                socket.on('search_end', (data) => {
                    loading.style.display = 'none';
                    btnSearch.disabled = false;
                    alert(data.message);
                });

                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const group = document.getElementById('groupName').value;
                    const date = document.getElementById('searchDate').value;
                    
                    loading.style.display = 'block';
                    btnSearch.disabled = true;

                    fetch('/fetch-pdfs', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ groupName: group, date: date })
                    });
                };
            </script>
        </body>
        </html>
    `);
});

app.post('/fetch-pdfs', async (req, res) => {
    const { groupName, date } = req.body;
    if (!isReady) return res.status(500).send('WhatsApp não pronto');

    try {
        const chats = await client.getChats();
        const group = chats.find(c => c.isGroup && c.name.toLowerCase().includes(groupName.toLowerCase()));

        if (!group) {
            io.emit('search_end', { message: 'Grupo não encontrado.' });
            return res.json({ error: 'Grupo não encontrado' });
        }

        const messages = await group.fetchMessages({ limit: 1000 });
        let downloadedCount = 0;

        for (const msg of messages) {
            const msgDate = new Date(msg.timestamp * 1000).toISOString().split('T')[0];
            if (msgDate === date && msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media && media.mimetype === 'application/pdf') {
                    const filename = media.filename || `pdf_${msg.timestamp}.pdf`;
                    const fullPath = path.join(DOWNLOAD_DIR, filename);
                    fs.writeFileSync(fullPath, media.data, { encoding: 'base64' });
                    
                    io.emit('pdf_downloaded', { 
                        name: filename, 
                        size: (media.data.length / 1024 / 1024).toFixed(2) + ' MB' 
                    });
                    downloadedCount++;
                }
            }
        }

        io.emit('search_end', { message: `Busca finalizada! ${downloadedCount} arquivos baixados.` });
        res.json({ success: true });
    } catch (err) {
        io.emit('search_end', { message: 'Erro: ' + err.message });
        res.status(500).json({ error: err.message });
    }
});

server.listen(port, () => console.log(`Dashboard: http://localhost:${port}`));
client.initialize();
