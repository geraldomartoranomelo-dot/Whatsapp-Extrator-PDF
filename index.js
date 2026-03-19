const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    if (isReady) {
        socket.emit('status', { message: 'Pronto p/ Uso', type: 'success' });
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3002;

const DOWNLOAD_DIR = path.join(__dirname, 'PDFS_Baixados');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
        ]
    }
});

let isReady = false;
let activeSchedules = {}; // Agora é um objeto para gerenciar IDs
const SCHEDULES_FILE = path.join(__dirname, 'schedules.json');

function saveSchedules() {
    const dataToSave = {};
    for (const id in activeSchedules) {
        dataToSave[id] = {
            groupName: activeSchedules[id].groupName,
            desc: activeSchedules[id].desc,
            cronTime: activeSchedules[id].cronTime
        };
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(dataToSave));
}

function loadSchedules() {
    if (fs.existsSync(SCHEDULES_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SCHEDULES_FILE));
            for (const id in data) {
                const { groupName, desc, cronTime } = data[id];
                const job = cron.schedule(cronTime, async () => {
                    const today = new Date().toISOString().split('T')[0];
                    console.log(`[Cron ${id}] Executando rotina para ${groupName}`);
                    io.emit('search_start', { message: `Rodando agendamento (Automático): ${groupName}` });
                    await executeDownload(groupName, [today]);
                });
                activeSchedules[id] = { job, groupName, desc, cronTime };
            }
        } catch (e) {
            console.error('Erro carregando agendamentos salvos', e);
        }
    }
}

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

const executeDownload = async (groupName, targetDates) => {
    if (!isReady) return { success: false, message: 'WhatsApp não está pronto!' };

    try {
        const chats = await client.getChats();
        const group = chats.find(c => c.isGroup && c.name.toLowerCase().includes(groupName.toLowerCase()));

        if (!group) return { success: false, message: 'Grupo não encontrado.' };

        const datesArray = Array.isArray(targetDates) ? targetDates : [targetDates];
        io.emit('search_start', { message: `Pesquisando em ${group.name} | Datas: ${datesArray.join(', ')}` });

        const messages = await group.fetchMessages({ limit: 1000 });
        let downloadedCount = 0;

        for (const msg of messages) {
            const msgDate = new Date(msg.timestamp * 1000).toISOString().split('T')[0];
            if (datesArray.includes(msgDate) && msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media && media.mimetype === 'application/pdf') {
                    const baseName = media.filename ? media.filename.replace(/[/\\?%*:|"<>]/g, '') : `pdf.pdf`;
                    const filename = `${msg.timestamp}_${baseName}`;
                    const fullPath = path.join(DOWNLOAD_DIR, filename);
                    fs.writeFileSync(fullPath, media.data, { encoding: 'base64' });
                    
                    io.emit('pdf_downloaded', { 
                        name: filename, 
                        size: (media.data.length / 1024 / 1024).toFixed(2) + ' MB',
                        group: group.name
                    });
                    downloadedCount++;
                }
            }
        }
        return { success: true, count: downloadedCount, message: `Busca finalizada! ${downloadedCount} arquivos baixados.` };
    } catch (err) {
        return { success: false, message: err.message };
    }
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
                :root { --primary: #25d366; --dark: #075e54; --bg: #f8f9fa; --white: #ffffff; --border: #e0e0e0; }
                body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); margin: 0; display: flex; height: 100vh; color: #333; }
                
                .sidebar { width: 340px; background: var(--white); padding: 25px; border-right: 1px solid var(--border); box-shadow: 2px 0 10px rgba(0,0,0,0.02); display: flex; flex-direction: column; overflow-y: auto; }
                .main { flex: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; }
                h2 { color: var(--dark); font-size: 1.1rem; margin-top: 0; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; font-weight: 600; }
                
                .form-group { margin-bottom: 15px; }
                label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 5px; color: #555; }
                input, select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; box-sizing: border-box; background: #fafafa; }
                input:focus, select:focus { outline: none; border-color: var(--primary); background: #fff; }
                
                button { width: 100%; padding: 12px; margin-top: 5px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; font-weight: 600; transition: 0.2s; }
                button:hover { background: #128c7e; }
                button:disabled { background: #ccc; cursor: not-allowed; }
                .btn-secondary { background: #6c757d; }
                .btn-secondary:hover { background: #5a6268; }
                .btn-danger { background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s; }
                .btn-danger:hover { background: #dc2626; }

                /* Abas (Tabs) */
                .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 20px; gap: 10px;}
                .tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; font-weight: 600; color: #888; font-size: 0.85rem; transition: 0.2s; border-radius: 6px 6px 0 0; background: #e9ecef;}
                .tab.active { color: #fff; background: var(--primary); border-bottom-color: var(--primary); }
                .tab-content { display: none; }
                .tab-content.active { display: block; animation: fadeIn 0.3s; }

                /* Checkboxes Dias da Semana */
                .days-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
                .days-grid label { font-size: 0.8rem; font-weight: 500; display:flex; align-items:center; gap: 4px; cursor: pointer; background: #fff; border: 1px solid var(--border); padding: 5px; border-radius: 4px; user-select: none; }
                .days-grid label:hover { background: #f8f9fa; }

                .status-badge { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-bottom: 15px; display: inline-block; text-align: center; width: auto; align-self: flex-start;}
                .success { background: #dcf8c6; color: #075e54; }
                .warning { background: #fff3cd; color: #856404; }
                
                #loading { display: none; text-align: center; margin-top: 20px; font-size: 0.8rem; color: #666; background: #e3f2fd; padding: 10px; border-radius: 6px; }
                .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #ccc; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                .card { background: var(--white); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); position: relative; }
                .pdf-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; animation: fadeSlide 0.4s ease-out; }
                .pdf-item:last-child { border-bottom: none; }
                .pdf-checkbox { width: 18px; height: 18px; cursor: pointer; }
                .pdf-icon { width: 32px; height: 32px; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-weight: 700; font-size: 0.7rem; }
                .pdf-info { flex: 1; min-width: 0; }
                .pdf-name { font-weight: 600; color: #2d3748; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pdf-meta { font-size: 0.7rem; color: #718096; margin-top: 3px; }
                
                .schedule-item { background: #f8f9fa; border: 1px dashed #ced4da; padding: 10px 45px 10px 10px; font-size: 0.75rem; border-radius: 6px; margin-bottom: 10px; position: relative; }
                .schedule-item span { font-weight: bold; color: var(--dark); font-size: 0.8rem; }
                .schedule-item .btn-danger { padding: 5px 8px; font-size: 0.75rem; width: auto; position: absolute; right: 5px; top: 5px; }

                .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .selection-controls { display: flex; align-items: center; gap: 15px; background: #edf2f7; padding: 8px 15px; border-radius: 8px; }
                .selection-controls label { font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
                .btn-bulk-delete { padding: 6px 12px; font-size: 0.85rem; width: auto; margin-top: 0; }

                @keyframes fadeSlide { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <div style="display:flex; justify-content: space-between; align-items:center;">
                    <h2>Extrator Bot 🤖</h2>
                    <div id="appStatus" class="status-badge warning">Conectando...</div>
                </div>

                <div class="card" style="padding: 15px; margin-bottom: 20px; border: none; box-shadow: none; background: #fff; border: 1px solid var(--border);">
                    <div class="form-group">
                        <label>📌 Nome do Grupo</label>
                        <input type="text" id="groupName" placeholder="Ex: Financeiro S/A" required>
                    </div>

                    <div class="tabs">
                        <div class="tab active" onclick="switchTab('now')">⚡ Baixar Agora</div>
                        <div class="tab" onclick="switchTab('schedule')">⏰ Agendar Varredura</div>
                    </div>

                    <!-- TAB: BAIXAR AGORA -->
                    <div id="tab-now" class="tab-content active">
                        <div class="form-group">
                            <label>📅 Datas (Clique para Selecionar Várias)</label>
                            <input type="text" id="searchDates" placeholder="Selecionar Datas" required>
                        </div>
                        <button type="button" id="btnNow" onclick="executeNow()">Iniciar Busca</button>
                    </div>

                    <!-- TAB: AGENDAMENTO -->
                    <div id="tab-schedule" class="tab-content">
                        <div class="form-group">
                            <label>📅 Dias da Semana</label>
                            <div class="days-grid">
                                <label><input type="checkbox" id="scAll" value="*" onchange="toggleAllDays(this)"> Todos</label>
                                <label><input type="checkbox" class="sc-day" value="1"> Seg</label>
                                <label><input type="checkbox" class="sc-day" value="2"> Ter</label>
                                <label><input type="checkbox" class="sc-day" value="3"> Qua</label>
                                <label><input type="checkbox" class="sc-day" value="4"> Qui</label>
                                <label><input type="checkbox" class="sc-day" value="5"> Sex</label>
                                <label><input type="checkbox" class="sc-day" value="6"> Sáb</label>
                                <label><input type="checkbox" class="sc-day" value="0"> Dom</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>⏰ Horário (HH:mm)</label>
                            <input type="time" id="scTime" value="18:00" required>
                        </div>
                        <button type="button" class="btn-secondary" id="btnSchedule" onclick="executeSchedule()">+ Criar Agendamento</button>
                    </div>

                    <div id="loading"><span class="spinner"></span> <span id="loadingText">Processando...</span></div>
                </div>

                <div class="card" style="padding: 15px; flex: 1;">
                    <h2 style="font-size: 0.9rem;">⏰ Agendamentos Ativos</h2>
                    <div id="scheduleList">
                        <p id="emptySc" style="font-size: 0.75rem; color: #999;">Nenhum agendamento ativo.</p>
                    </div>
                </div>
            </div>

            <div class="main">
                <div class="main-header">
                    <h2>📥 PDFs Baixados Recentes <span id="fileCount" style="font-size: 0.75rem; background: #edf2f7; padding: 3px 8px; border-radius: 12px; margin-left: auto;">0 Arquivos</span></h2>
                    
                    <div class="selection-controls" id="selectionControls" style="display: none;">
                        <label><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"> Selecionar Todos</label>
                        <button class="btn-danger btn-bulk-delete" onclick="deleteSelected()">Excluir Selecionados</button>
                    </div>
                </div>

                <div class="card" style="flex: 1; overflow-y: auto;">
                    <div id="pdfList">
                        <p id="emptyMsg" style="color: #a0aec0; text-align: center; padding: 50px; font-size: 0.9rem;">Nenhum arquivo baixado nesta sessão.</p>
                    </div>
                </div>
            </div>

            <script>
                const socket = io();
                const appStatus = document.getElementById('appStatus');
                const loading = document.getElementById('loading');
                const emptyMsg = document.getElementById('emptyMsg');
                const emptySc = document.getElementById('emptySc');
                const fileCount = document.getElementById('fileCount');
                const scheduleList = document.getElementById('scheduleList');
                const selectionControls = document.getElementById('selectionControls');
                
                let count = 0;
                let numSchedules = 0;

                // Iniiciar Calendário Múltiplo c/ Flatpickr
                flatpickr("#searchDates", {
                    mode: "multiple",
                    dateFormat: "Y-m-d",
                    locale: "pt",
                    defaultDate: [new Date()]
                });

                const savedGroup = localStorage.getItem('extrator_group');
                if (savedGroup) document.getElementById('groupName').value = savedGroup;

                function switchTab(tab) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    
                    if(tab === 'now') {
                        document.querySelectorAll('.tab')[0].classList.add('active');
                        document.getElementById('tab-now').classList.add('active');
                    } else {
                        document.querySelectorAll('.tab')[1].classList.add('active');
                        document.getElementById('tab-schedule').classList.add('active');
                    }
                }

                function toggleAllDays(el) {
                    const checkboxes = document.querySelectorAll('.sc-day');
                    checkboxes.forEach(cb => {
                        cb.disabled = el.checked;
                        if(el.checked) cb.checked = false;
                    });
                }

                function toggleSelectAll(el) {
                    const checkboxes = document.querySelectorAll('.pdf-checkbox');
                    checkboxes.forEach(cb => cb.checked = el.checked);
                }

                async function deleteSelected() {
                    const selected = Array.from(document.querySelectorAll('.pdf-checkbox:checked')).map(cb => cb.value);
                    if (selected.length === 0) return alert('Selecione ao menos um arquivo para excluir.');
                    
                    if (!confirm(\`Deseja realmente excluir \${selected.length} arquivo(s)?\`)) return;
                    
                    try {
                        const res = await fetch('/delete-downloads', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filenames: selected })
                        });
                        
                        if (res.ok) {
                            alert('Arquivos excluídos com sucesso!');
                            location.reload(); // Recarregar para atualizar a lista
                        } else {
                            alert('Erro ao excluir arquivos.');
                        }
                    } catch (err) {
                        alert('Erro na comunicação com o servidor.');
                    }
                }

                async function executeNow() {
                    const group = document.getElementById('groupName').value;
                    const datesStr = document.getElementById('searchDates').value;
                    
                    if(!group) return alert('Por favor, informe o nome do grupo.');
                    if(!datesStr) return alert('Selecione ao menos uma data.');
                    
                    localStorage.setItem('extrator_group', group);
                    const dates = datesStr.split(', ');
                    
                    document.getElementById('btnNow').disabled = true;
                    loading.style.display = 'block';
                    document.getElementById('loadingText').innerText = 'Comunicando com WhatsApp...';
                    
                    await fetch('/fetch-pdfs', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ groupName: group, dates: dates })
                    });
                }

                async function executeSchedule() {
                    const group = document.getElementById('groupName').value;
                    const time = document.getElementById('scTime').value;
                    let days = [];
                    
                    if(document.getElementById('scAll').checked) {
                        days = ['*'];
                    } else {
                        const checkedDays = document.querySelectorAll('.sc-day:checked');
                        days = Array.from(checkedDays).map(cb => cb.value);
                    }
                    
                    if(!group) return alert('Por favor, informe o nome do grupo.');
                    if(days.length === 0) return alert('Selecione ao menos um dia da semana ou a opção "Todos".');
                    if(!time) return alert('Preencha o horário.');
                    
                    localStorage.setItem('extrator_group', group);
                    document.getElementById('btnSchedule').disabled = true;
                    loading.style.display = 'block';
                    document.getElementById('loadingText').innerText = 'Criando rotina...';
                    
                    await fetch('/schedule', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ groupName: group, days, time })
                    });
                }

                function appendScheduleDOM(data) {
                    if(document.getElementById('emptySc')) document.getElementById('emptySc').style.display = 'none';
                    numSchedules++;

                    const item = document.createElement('div');
                    item.className = 'schedule-item';
                    item.id = 'sc-' + data.id;
                    item.innerHTML = \`<span>\${data.group}</span><br>⏳ \${data.desc}
                    <button class="btn-danger" onclick="deleteSchedule('\${data.id}')">Excluir</button>\`;
                    scheduleList.appendChild(item);
                }

                async function loadSchedules() {
                    const res = await fetch('/schedules');
                    const list = await res.json();
                    if(list.length > 0) {
                        list.forEach(s => appendScheduleDOM(s));
                    }
                }
                
                async function loadDownloads() {
                    const res = await fetch('/downloads');
                    const files = await res.json();
                    if(files.length > 0) {
                        if(document.getElementById('emptyMsg')) document.getElementById('emptyMsg').remove();
                        selectionControls.style.display = 'flex';
                        count = files.length;
                        fileCount.innerText = count + " Arquivos";
                        const list = document.getElementById('pdfList');
                        
                        files.forEach(f => {
                            const item = document.createElement('div');
                            item.className = 'pdf-item';
                            item.innerHTML = \`
                                <input type="checkbox" class="pdf-checkbox" value="\${f.name}">
                                <div class="pdf-icon">PDF</div>
                                <div class="pdf-info">
                                    <div class="pdf-name">\${f.name}</div>
                                    <div class="pdf-meta">Tamanho: \${f.size} | Arquivo Local | \${f.dateStr}</div>
                                </div>
                            \`;
                            list.appendChild(item);
                        });
                    }
                }

                async function deleteSchedule(id) {
                    if(!confirm('Deseja cancelar e remover este agendamento?')) return;
                    await fetch('/schedule/' + id, { method: 'DELETE' });
                }

                // Call loads on boot
                loadSchedules();
                loadDownloads();

                socket.on('status', (data) => {
                    appStatus.innerText = data.message;
                    appStatus.className = 'status-badge ' + data.type;
                });

                socket.on('search_start', (data) => {
                    loading.style.display = 'block';
                    document.getElementById('loadingText').innerText = data.message;
                });

                socket.on('pdf_downloaded', (data) => {
                    if(document.getElementById('emptyMsg')) document.getElementById('emptyMsg').remove();
                    selectionControls.style.display = 'flex';
                    count++;
                    fileCount.innerText = count + " Arquivos";
                    
                    const item = document.createElement('div');
                    item.className = 'pdf-item';
                    item.innerHTML = \`
                        <input type="checkbox" class="pdf-checkbox" value="\${data.name}">
                        <div class="pdf-icon">PDF</div>
                        <div class="pdf-info">
                            <div class="pdf-name">\${data.name}</div>
                            <div class="pdf-meta">Tamanho: \${data.size} | Grupo: \${data.group} | \${new Date().toLocaleTimeString()}</div>
                        </div>
                    \`;
                    document.getElementById('pdfList').prepend(item);
                });

                socket.on('search_end', (data) => {
                    loading.style.display = 'none';
                    document.getElementById('btnNow').disabled = false;
                    alert(data.message);
                });

                socket.on('schedule_created', (data) => {
                    loading.style.display = 'none';
                    document.getElementById('btnSchedule').disabled = false;
                    appendScheduleDOM(data);
                    alert("Agendamento Registrado com sucesso!");
                });

                socket.on('schedule_deleted', (data) => {
                    const el = document.getElementById('sc-' + data.id);
                    if(el) el.remove();
                    numSchedules--;
                    if(numSchedules === 0 && document.getElementById('emptySc')) {
                        document.getElementById('emptySc').style.display = 'block';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.post('/fetch-pdfs', async (req, res) => {
    const { groupName, dates } = req.body;
    const result = await executeDownload(groupName, dates);
    if(result.success) {
        io.emit('search_end', { message: result.message });
        res.json({ success: true });
    } else {
        io.emit('search_end', { message: 'Erro: ' + result.message });
        res.status(500).json({ error: result.message });
    }
});

app.post('/schedule', (req, res) => {
    const { groupName, days, time } = req.body;
    if (!groupName || !days || !time) return res.status(400).json({ error: 'Faltam dados' });

    const [hour, min] = time.split(':');
    let cronTime = '';
    let diasStr = '';

    if (days.includes('*')) {
        cronTime = `${parseInt(min)} ${parseInt(hour)} * * *`;
        diasStr = 'Todos os dias';
    } else {
        cronTime = `${parseInt(min)} ${parseInt(hour)} * * ${days.join(',')}`;
        const mapDias = {'0':'Dom', '1':'Seg', '2':'Ter', '3':'Qua', '4':'Qui', '5':'Sex', '6':'Sáb'};
        diasStr = days.map(d => mapDias[d]).join(', ');
    }

    const desc = `Dias: ${diasStr} às ${time}`;
    const id = Date.now().toString();

    const job = cron.schedule(cronTime, async () => {
        const today = new Date().toISOString().split('T')[0];
        console.log(`[Cron ${id}] Executando rotina para ${groupName}`);
        io.emit('search_start', { message: `Rodando agendamento (Automático): ${groupName}` });
        await executeDownload(groupName, [today]);
    });

    activeSchedules[id] = { job, groupName, desc, cronTime };
    saveSchedules();
    
    io.emit('schedule_created', { id, group: groupName, desc });
    res.json({ success: true, id });
});

app.get('/schedules', (req, res) => {
    const list = Object.keys(activeSchedules).map(id => ({
        id,
        group: activeSchedules[id].groupName,
        desc: activeSchedules[id].desc
    }));
    res.json(list);
});

app.get('/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const fileData = files.filter(f => f.endsWith('.pdf')).map(file => {
            const stats = fs.statSync(path.join(DOWNLOAD_DIR, file));
            return {
                name: file,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                time: stats.mtime.getTime(),
                dateStr: stats.mtime.toLocaleTimeString()
            };
        });
        fileData.sort((a, b) => b.time - a.time);
        res.json(fileData);
    } catch (err) {
        res.status(500).json({error: 'Failed'});
    }
});

app.post('/delete-downloads', (req, res) => {
    const { filenames } = req.body;
    if (!filenames || !Array.isArray(filenames)) return res.status(400).json({ error: 'Lista de arquivos inválida' });

    let deleted = 0;
    let errors = 0;

    filenames.forEach(file => {
        const fullPath = path.join(DOWNLOAD_DIR, file);
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
                deleted++;
            } catch (err) {
                errors++;
            }
        }
    });

    res.json({ success: true, deleted, errors });
});

app.delete('/schedule/:id', (req, res) => {
    const id = req.params.id;
    if (activeSchedules[id]) {
        activeSchedules[id].job.stop();
        delete activeSchedules[id];
        saveSchedules();
        io.emit('schedule_deleted', { id });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Agendamento nao encontrado' });
    }
});

loadSchedules();
server.listen(port, () => console.log(`Dashboard: http://localhost:${port}`));
client.initialize();
