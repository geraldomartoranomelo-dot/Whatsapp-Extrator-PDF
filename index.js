const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3002;

// Envia o status imediato quando alguém abre a página
io.on('connection', (socket) => {
    if (isReady) {
        socket.emit('status', { message: 'Conectado!', type: 'success' });
    } else {
        socket.emit('status', { message: 'Aguardando conexão...', type: 'warning' });
    }
});

app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'PDFS_Baixados');
const SCHEDULES_FILE = path.join(__dirname, 'schedules.json');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

let isReady = false;
let activeSchedules = {};

function saveSchedules() {
    const data = Object.keys(activeSchedules).map(id => ({
        id,
        groupName: activeSchedules[id].groupName,
        days: activeSchedules[id].days,
        dates: activeSchedules[id].dates,
        time: activeSchedules[id].time,
        desc: activeSchedules[id].desc,
        cronTimes: activeSchedules[id].cronTimes
    }));
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2));
}

function removeSchedule(id) {
    if (activeSchedules[id]) { 
        activeSchedules[id].jobs.forEach(j => j.stop()); 
        delete activeSchedules[id]; 
        saveSchedules(); 
        io.emit('schedule_deleted', id);
    }
}

function loadSchedules() {
    if (fs.existsSync(SCHEDULES_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SCHEDULES_FILE));
            if (Array.isArray(data)) {
                data.forEach(s => {
                    const jobs = s.cronTimes.map(ct => cron.schedule(ct, async () => {
                        console.log(`[Cron] Iniciando execução para: ${s.groupName}`);
                        const r = await executeDownload(s.groupName, [new Date().toISOString().split('T')[0]]);
                        io.emit('search_end', { message: r.message });
                        console.log(`[Cron] Concluído. Removendo agendamento: ${s.id}`);
                        removeSchedule(s.id);
                    }));
                    activeSchedules[s.id] = { jobs, ...s };
                });
            }
        } catch (e) {
            console.error('Erro ao carregar agendamentos:', e.message);
            fs.writeFileSync(SCHEDULES_FILE, '[]');
        }
    } else {
        fs.writeFileSync(SCHEDULES_FILE, '[]');
    }
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR Code recebido no terminal.');
    qrcode.generate(qr, { small: true });
    io.emit('status', { message: 'Escaneie o QR Code no terminal', type: 'warning' });
});

client.on('ready', () => {
    console.log('WhatsApp Conectado!');
    isReady = true;
    io.emit('status', { message: 'WhatsApp Conectado!', type: 'success' });
});

let shouldStopSearch = false;

const executeDownload = async (groupNames, targetDates) => {
    if (!isReady) return { success: false, message: 'WhatsApp não conectado.' };
    shouldStopSearch = false;
    const groups = Array.isArray(groupNames) ? groupNames : [groupNames];
    const datesArray = Array.isArray(targetDates) ? targetDates : [targetDates];
    let totalDownloaded = 0;
    try {
        const chats = await client.getChats();
        for (const groupName of groups) {
            if (shouldStopSearch) break;
            const group = chats.find(c => c.isGroup && c.name.toLowerCase().includes(groupName.trim().toLowerCase()));
            if (!group) { io.emit('search_start', { message: `Grupo "${groupName}" não encontrado, pulando...` }); continue; }

            io.emit('search_start', { message: `Varrendo "${group.name}"...` });
            const messages = await group.fetchMessages({ limit: 1000 });
            const total = messages.length;
            let downloadedCount = 0;
            let processed = 0;

            for (const msg of messages) {
                if (shouldStopSearch) break;
                processed++;
                if (processed % 10 === 0 || processed === total) {
                    io.emit('search_progress', { 
                        percent: Math.round((processed / total) * 100),
                        current: processed,
                        total: total
                    });
                }
                const msgDate = new Date(msg.timestamp * 1000).toISOString().split('T')[0];
                if (datesArray.includes(msgDate) && msg.hasMedia) {
                    const media = await msg.downloadMedia();
                    if (media && media.mimetype === 'application/pdf') {
                        const baseName = media.filename ? media.filename.replace(/[/\\?%*:|"<>]/g, '') : `documento.pdf`;
                        const filename = `${msg.timestamp}_${baseName}`;
                        fs.writeFileSync(path.join(DOWNLOAD_DIR, filename), media.data, { encoding: 'base64' });
                        io.emit('pdf_downloaded', { 
                            name: filename, 
                            size: (media.data.length * 0.75 / 1024 / 1024).toFixed(2) + ' MB'
                        });
                        downloadedCount++;
                    }
                }
            }
            totalDownloaded += downloadedCount;
        }
        return { success: true, count: totalDownloaded, message: `Busca finalizada: ${totalDownloaded} PDFs obtidos.` };
    } catch (err) { return { success: false, message: err.message }; }
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>WhatsApp Extrator Pro</title>
            <script src="/socket.io/socket.io.js"></script>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
            <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
            <script src="https://npmcdn.com/flatpickr/dist/l10n/pt.js"></script>
            <style>
                :root { --primary: #25d366; --dark: #075e54; --bg: #f5f7f9; --white: #ffffff; --border: #e0e0e0; }
                body { font-family: 'Segoe UI', sans-serif; background: var(--bg); margin: 0; display: flex; height: 100vh; overflow: hidden; color: #333; }
                .sidebar { width: 350px; background: var(--white); border-right: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; overflow-y: auto; }
                .main { flex: 1; padding: 30px; display: flex; flex-direction: column; overflow: hidden; }
                .card { background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px rgba(0,0,0,0.02); margin-bottom: 25px; }
                h2 { color: var(--dark); font-size: 1.1rem; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-weight: 700; }
                label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: #555; }
                input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; box-sizing: border-box; margin-bottom: 15px; font-size: 0.9rem; }
                button { width: 100%; padding: 13px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
                button:hover { background: #128c7e; transform: translateY(-1px); }
                .btn-danger { background: #ef4444; }
                .btn-danger:hover { background: #dc2626; }
                .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
                .tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; background: #eaedf0; border-radius: 8px; font-size: 0.85rem; font-weight: 600; transition: 0.2s; }
                .tab.active { background: var(--primary); color: white; }
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                .days-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
                .days-grid label { font-size: 0.75rem; display: flex; align-items: center; gap: 5px; background: #fff; border: 1px solid #ddd; padding: 6px; border-radius: 6px; cursor: pointer; user-select: none; font-weight: normal; }
                .status-badge { padding: 8px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; margin-bottom: 25px; display: inline-block; }
                .success { background: #dcf8c6; color: #075e54; }
                .warning { background: #fff3cd; color: #856404; }
                #loading { display: none; background: #e3f2fd; padding: 20px; border-radius: 10px; text-align: center; margin-top: 15px; }
                .progress { height: 12px; background: #cfd8dc; border-radius: 6px; overflow: hidden; margin: 15px 0; }
                #bar { height: 100%; width: 0%; background: var(--primary); transition: 0.4s ease; }
                #pdfList { flex: 1; overflow-y: auto; background: white; border-radius: 12px; border: 1px solid var(--border); }
                .pdf-item { display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid #f0f0f0; transition: 0.2s; }
                .pdf-item:hover { background: #f8fafb; }
                .pdf-icon { width: 44px; height: 44px; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 800; font-size: 0.8rem; min-width: 44px; }
                .pdf-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 4px; }
                .pdf-name { font-weight: 600; font-size: 0.95rem; color: #1a202c; }
                .pdf-meta { font-size: 0.8rem; color: #718096; }
                .schedule-item { background: #fdfdfd; padding: 15px; border-radius: 10px; border: 1px dashed #cbd5e0; margin-bottom: 12px; position: relative; }
                .schedule-item b { font-size: 0.9rem; color: #2d3748; }
                .schedule-item span { font-size: 0.8rem; color: #718096; display: block; margin-top: 5px; }
                .delete-sch { position: absolute; right: 10px; top: 15px; color: #e53e3e; cursor: pointer; border: none; background: none; font-size: 1.3rem; line-height: 1; }
                .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .selection-grp { display: flex; align-items: center; gap: 15px; background: #edf2f7; padding: 10px 18px; border-radius: 10px; }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <div id="appStatus" class="status-badge warning">Iniciando...</div>
                <div class="card">
                    <h2>Extração ⚙️</h2>
                    <label>📌 Nome do Grupo</label>
                    <input type="text" id="groupName" placeholder="Ex: Financeiro, Compras, RH (separe por vírgula)">
                    <p style="font-size:0.75rem; color:#888; margin: -8px 0 15px 2px;">💡 Para múltiplos grupos, separe por vírgula. Ex: <i>Compras JT, Financeiro</i></p>
                    
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab('now')">Baixar Agora</div>
                        <div class="tab" onclick="switchTab('sch')">Agendar</div>
                    </div>

                    <div id="tab-now" class="tab-content active">
                        <label>📅 Datas (Selecione uma ou mais)</label>
                        <input type="text" id="targetDates" placeholder="Clique para escolher">
                        <button onclick="executeNow()">Iniciar Varredura</button>
                    </div>

                    <div id="tab-sch" class="tab-content">
                        <div class="days-grid">
                            <label><input type="checkbox" id="scAll" onchange="toggleAllDays(this)">Tudo</label>
                            <label><input type="checkbox" class="sc-day" value="1">Seg</label>
                            <label><input type="checkbox" class="sc-day" value="2">Ter</label>
                            <label><input type="checkbox" class="sc-day" value="3">Qua</label>
                            <label><input type="checkbox" class="sc-day" value="4">Qui</label>
                            <label><input type="checkbox" class="sc-day" value="5">Sex</label>
                            <label><input type="checkbox" class="sc-day" value="6">Sáb</label>
                            <label><input type="checkbox" class="sc-day" value="0">Dom</label>
                        </div>
                        <label>📅 Ou Datas Fixas (Opcional)</label>
                        <input type="text" id="scDates" placeholder="Selecione datas específicas">
                        <label>⏰ Horário da Varredura</label>
                        <input type="time" id="scTime" value="18:00">
                        <button onclick="executeSchedule()">+ Criar Agendamento</button>
                    </div>

                    <div id="loading">
                        <div id="loadingText" style="font-size: 0.9rem; font-weight: 700; color: #1976d2;">Preparando...</div>
                        <div class="progress"><div id="bar"></div></div>
                        <button class="btn-danger" style="padding: 10px; font-size: 0.85rem;" onclick="stopSearch()">⛔ PARAR BUSCA</button>
                    </div>
                </div>

                <h2>Agendamentos Ativos</h2>
                <div id="scheduleList"></div>
            </div>

            <div class="main">
                <div class="controls">
                    <h2>PDFs Encontrados <span id="fileCount" style="background:#e2e8f0; padding:4px 12px; border-radius:20px; font-size:0.9rem;">0</span></h2>
                    <div class="selection-grp">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 600;"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"> Selecionar Todos</label>
                        <button onclick="deleteSelected()" class="btn-danger" style="width: auto; padding: 8px 18px; font-size: 0.85rem;">Excluir Seleção</button>
                    </div>
                </div>
                <div id="pdfList"></div>
            </div>

            <script>
                const socket = io();
                const pdfList = document.getElementById('pdfList');
                const fileCountText = document.getElementById('fileCount');
                const loadingArea = document.getElementById('loading');
                const progressBar = document.getElementById('bar');
                const statusLabel = document.getElementById('loadingText');
                const schedulesArea = document.getElementById('scheduleList');

                flatpickr("#targetDates", { mode: "multiple", dateFormat: "Y-m-d", locale: "pt", defaultDate: [new Date()] });
                flatpickr("#scDates", { mode: "multiple", dateFormat: "Y-m-d", locale: "pt" });

                const savedGroup = localStorage.getItem('extrator_group_v2');
                if (savedGroup) document.getElementById('groupName').value = savedGroup;

                function switchTab(t) {
                    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
                    if(t === 'now') { 
                        document.querySelectorAll('.tab')[0].classList.add('active'); 
                        document.getElementById('tab-now').classList.add('active'); 
                    } else { 
                        document.querySelectorAll('.tab')[1].classList.add('active'); 
                        document.getElementById('tab-sch').classList.add('active'); 
                    }
                }

                function toggleAllDays(el) { 
                    document.querySelectorAll('.sc-day').forEach(cb => { cb.disabled = el.checked; if(el.checked) cb.checked = false; }); 
                }
                
                function toggleSelectAll(el) { 
                    document.querySelectorAll('.pdf-cb').forEach(cb => cb.checked = el.checked); 
                }

                async function stopSearch() { 
                    fetch('/stop-search', { method: 'POST' }); 
                    loadingArea.style.display = 'none'; 
                }

                async function executeNow() {
                    const g = document.getElementById('groupName').value;
                    const d = document.getElementById('targetDates').value;
                    if(!g || !d) return alert('Por favor, preencha o grupo e as datas.');
                    localStorage.setItem('extrator_group_v2', g);
                    loadingArea.style.display = 'block';
                    progressBar.style.width = '0%';
                    statusLabel.innerText = 'Iniciando busca no WhatsApp...';
                    const groups = g.split(',').map(x => x.trim()).filter(x => x);
                    await fetch('/fetch-pdfs', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupName: groups, dates: d.split(', ') }) });
                }

                async function executeSchedule() {
                    const g = document.getElementById('groupName').value;
                    const h = document.getElementById('scTime').value;
                    const d = document.getElementById('scDates').value;
                    let days = document.getElementById('scAll').checked ? ['*'] : Array.from(document.querySelectorAll('.sc-day:checked')).map(cb => cb.value);
                    if(!g || !h) return alert('Por favor, preencha o grupo e o horário.');
                    if(days.length === 0 && !d) return alert('Selecione dias da semana ou datas específicas.');
                    localStorage.setItem('extrator_group_v2', g);
                    const groups = g.split(',').map(x => x.trim()).filter(x => x);
                    await fetch('/schedule', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupName: groups, days, time: h, dates: d ? d.split(', ') : [] }) });
                    loadSchedulesList();
                }

                function addPDF(f, isPrepend = true) {
                    if(document.getElementById('emptyMsg')) document.getElementById('emptyMsg').remove();
                    const row = document.createElement('div');
                    row.className = 'pdf-item';
                    
                    // Estrutura interna concatenada para evitar problemas de escape de backticks
                    row.innerHTML = '<input type="checkbox" class="pdf-cb" style="width:20px; height:20px; min-width:20px;">' +
                                     '<div class="pdf-icon" style="margin: 0 10px;">PDF</div>' +
                                     '<div class="pdf-info">' +
                                        '<div class="pdf-name" style="color:#333; font-weight:bold;"></div>' +
                                        '<div class="pdf-meta" style="color:#666; font-size:0.8rem;"></div>' +
                                     '</div>';
                    
                    row.querySelector('.pdf-cb').value = f.name;
                    row.querySelector('.pdf-name').innerText = f.name;
                    row.querySelector('.pdf-meta').innerText = 'Tamanho: ' + f.size;
                    
                    if(isPrepend) pdfList.prepend(row); else pdfList.appendChild(row);
                    updateCount();
                }

                function updateCount() { 
                    fileCountText.innerText = document.querySelectorAll('.pdf-item').length; 
                }

                socket.on('pdf_downloaded', f => addPDF(f));
                
                socket.on('search_progress', p => { 
                    progressBar.style.width = p.percent + '%';
                    statusLabel.innerText = p.percent === 100 ? 'Finalizando extração...' : 'Lendo mensagens: ' + p.current + ' de ' + p.total;
                });

                socket.on('search_start', m => { 
                    loadingArea.style.display = 'block'; 
                    statusLabel.innerText = m.message; 
                });

                socket.on('search_end', m => { 
                    statusLabel.innerText = m.message;
                    setTimeout(() => {
                        loadingArea.style.display = 'none'; 
                        progressBar.style.width = '0%';
                    }, 2500);
                });

                socket.on('status', s => { 
                    const el = document.getElementById('appStatus'); 
                    el.innerText = s.message; 
                    el.className = 'status-badge ' + (s.type === 'success' ? 'success' : 'warning'); 
                });

                async function loadDownloads() {
                    const r = await fetch('/downloads');
                    const files = await r.json();
                    pdfList.innerHTML = files.length ? '' : '<p id="emptyMsg" style="text-align:center; color:#adb5bd; padding:60px;">Nenhum PDF encontrado ainda.</p>';
                    files.forEach(x => addPDF(x, false));
                }

                async function loadSchedulesList() {
                    const r = await fetch('/schedules');
                    const ss = await r.json();
                    schedulesArea.innerHTML = ss.length ? '' : '<p style="font-size:0.85rem; color:#999; text-align:center;">Sem varreduras agendadas.</p>';
                    ss.forEach(s => {
                        const item = document.createElement('div');
                        item.className = 'schedule-item';
                        item.innerHTML = '<b>' + s.groupName + '</b><span>' + s.desc + '</span><button class="delete-sch" onclick="deleteSchedule(\\'' + s.id + '\\')">×</button>';
                        schedulesArea.appendChild(item);
                    });
                }

                socket.on('schedule_deleted', id => {
                    const schList = document.getElementById('scheduleList');
                    loadSchedulesList(); // Recarrega a lista visual
                });

                async function deleteSchedule(id) { 
                    if(!confirm('Deseja excluir este agendamento?')) return; 
                    await fetch('/schedule/' + id, { method: 'DELETE' }); 
                }

                async function deleteSelected() {
                    const selected = Array.from(document.querySelectorAll('.pdf-cb:checked')).map(x => x.value);
                    if(!selected.length) return alert('Selecione arquivos primeiro.');
                    if(!confirm('Excluir ' + selected.length + ' arquivos?')) return;
                    await fetch('/delete-downloads', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ filenames: selected }) });
                    loadDownloads();
                }

                loadDownloads();
                loadSchedulesList();
            </script>
        </body>
        </html>
    `);
});

app.get('/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.pdf')).map(f => {
            const s = fs.statSync(path.join(DOWNLOAD_DIR, f));
            return { name: f, size: (s.size/1024/1024).toFixed(2) + ' MB' };
        });
        res.json(files);
    } catch(e) { res.json([]); }
});

app.get('/schedules', (req, res) => {
    res.json(Object.keys(activeSchedules).map(id => ({ id, groupName: activeSchedules[id].groupName, desc: activeSchedules[id].desc })));
});

app.post('/schedule', (req, res) => {
    const { groupName, days, time, dates } = req.body;
    const id = Date.now().toString();
    const [h, m] = time.split(':');
    const cronTimes = [];
    let descParts = [];

    if (days && days.length > 0) {
        const ct = days.includes('*') ? `${m} ${h} * * *` : `${m} ${h} * * ${days.join(',')}`;
        cronTimes.push(ct);
        const dayNames = { "1": "Seg", "2": "Ter", "3": "Qua", "4": "Qui", "5": "Sex", "6": "Sáb", "0": "Dom", "*": "Todos" };
        descParts.push('Repete: ' + (days.includes('*') ? 'Diário' : days.map(d => dayNames[d]).join(', ')));
    }

    if (dates && dates.length > 0) {
        dates.forEach(dStr => {
            const [y, mm, dd] = dStr.split('-');
            cronTimes.push(`${m} ${h} ${parseInt(dd)} ${parseInt(mm)} *`);
        });
        descParts.push('Datas: ' + dates.join(', '));
    }

    const jobs = cronTimes.map(ct => cron.schedule(ct, async () => {
        console.log(`[Cron] Iniciando execução para: ${groupName}`);
        const r = await executeDownload(groupName, [new Date().toISOString().split('T')[0]]);
        io.emit('search_end', { message: r.message });
        console.log(`[Cron] Concluído. Removendo agendamento: ${id}`);
        removeSchedule(id);
    }));
    const desc = descParts.join(' | ') + ` às ${time}`;
    activeSchedules[id] = { jobs, groupName, days, dates, time, desc, cronTimes };
    saveSchedules();
    res.json({ success: true });
});

app.delete('/schedule/:id', (req, res) => {
    removeSchedule(req.params.id);
    res.json({ success: true });
});

app.post('/fetch-pdfs', async (req, res) => {
    const r = await executeDownload(req.body.groupName, req.body.dates);
    io.emit('search_end', { message: r.message });
    res.json(r);
});

app.post('/stop-search', (req, res) => { shouldStopSearch = true; res.json({ success: true }); });
app.post('/delete-downloads', (req, res) => {
    req.body.filenames.forEach(f => { const p = path.join(DOWNLOAD_DIR, f); if(fs.existsSync(p)) fs.unlinkSync(p); });
    res.json({ success: true });
});

server.listen(port, () => { console.log(`Dashboard rodando em: http://localhost:${port}`); });
loadSchedules();
client.initialize();
