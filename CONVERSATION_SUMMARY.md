# 🤖 Resumo do Projeto: Extrator de PDFs WhatsApp (Pro)

Este arquivo serve como "ponte de memória" para que futuras conversas de IA saibam exatamente o estado atual do projeto na pasta `D:\teste pode apagar`.

---

## 🚀 Estado Atual (2026-03-19)

O projeto é um **extrator de arquivos PDF de grupos do WhatsApp** com um Dashboard interativo.

### 🛠️ Funcionalidades Implementadas:
1.  **Dashboard Automático:** Inicia um servidor Express na porta `3002`.
2.  **Modo Standby:** Robô otimizado (Puppeteer) para consumir mínima CPU/RAM enquanto não está processando.
3.  **Memória de Sessão:** O WhatsApp salva a conexão localmente; não é necessário ler QR Code toda vez.
4.  **Busca Multi-Data:** O usuário pode selecionar várias datas individuais no calendário (Flatpickr) para varredura simultânea.
5.  **Agendamentos Persistentes:** 
    -   Sistema de agendamento por dias da semana e horário exato.
    -   Salvo no arquivo `schedules.json` (sobrevive a reinicializações).
    -   Gerenciamento direto no dashboard (criar/excluir).
6.  **Histórico e Gestão de Arquivos:** 
    -   Lista todos os PDFs baixados ao abrir/atualizar a página.
    -   Nomes de arquivos únicos (evita sobrescrever PDFs de nomes iguais).
    -   Seleção individual ou em massa ("Selecionar Todos") para exclusão via Dashboard.

### 📁 Arquivos Chave:
-   `index.js`: Contém toda a lógica do Node.js/Socket.io/WhatsApp.
-   `PDFS_Baixados/`: Pasta onde os arquivos são armazenados fisicamente.
-   `schedules.json`: Banco de dados dos agendamentos programados.
-   `.gitignore`: Configurada para proteger a pasta de PDFs e credenciais.

### 📌 Comandos Úteis:
-   `npm start` ou `node index.js` para ligar.
-   `http://localhost:3002` para acessar o Dashboard.

---

## ⏭️ Próximas Melharas Sugeridas:
-   Filtro por palavra-chave no nome do arquivo (ex: baixar apenas "Boleto").
-   Exibir QR Code diretamente no Dashboard (atualmente é o arquivo `qr.png`).
-   Barra de progresso detalhada durante varreduras longas.

---
**Nota para a IA:** Leia o `index.js` para entender a estrutura de rotas e o motor do Puppeteer antes de sugerir mudanças. O Git já foi inicializado e comitado com as mudanças acima.
