# 🤖 Resumo do Projeto: Extrator de PDFs WhatsApp (Pro)

Este arquivo serve como "ponte de memória" para que futuras conversas de IA saibam exatamente o estado atual do projeto.

---

## 📜 DIRETRIZES OBRIGATÓRIAS (Regras da Casa)

1.  **Modificações Estritas:** Somente alterar o código **diretamente solicitado**. NUNCA refatorar ou mexer em outras partes sem permissão explícita.
2.  **Objetividade:** Respostas sempre curtas, precisas e em Português do Brasil.
3.  **Não 'Limpar' o Código:** Não apagar comentários ou mudar estilo de escrita de partes não solicitadas.

---


## 🚀 Estado Atual (2026-03-19)

O projeto é um **extrator de arquivos PDF de grupos do WhatsApp** com um Dashboard interativo.

### 🛠️ Funcionalidades Implementadas:
1.  **Dashboard Automático:** Servidor Express na porta `3002`.
2.  **Autolimpeza:** O arquivo `1 - INICIAR SISTEMA.bat` fecha processos `node.exe` antigos antes de iniciar o novo (evita cache de código).
3.  **Memória de Sessão:** Persistência de login via `LocalAuth`.
4.  **Busca Multi-Data:** Seleção de várias datas para varredura manual rápida.
5.  **Agendamentos Híbridos (V3):** 
    -   **Recorrente:** Por dias da semana com nomes legíveis (Seg, Ter, etc.).
    -   **Fixos:** Por datas específicas em um calendário dedicado na aba Agendar.
    -   Persistente no arquivo `schedules.json`.
6.  **Gestão de PDFs:** Listagem, contagem e exclusão direta pelo dashboard.
7.  **UX Corrigida:** Barra de progresso com auto-hide após conclusão (sem alertas bloqueantes).

### 📁 Arquivos Chave:
-   `index.js`: Motor do sistema (Express, Socket.io, Puppeteer).
-   `PDFS_Baixados/`: Pasta de armazenamento dos arquivos.
-   `schedules.json`: Banco de dados dos agendamentos.
-   `1 - INICIAR SISTEMA.bat`: Inicializador inteligente.

### 📌 Git e GitHub:
-   Repositório: `geraldomartoranomelo-dot/Whatsapp-Extrator-PDF`
-   Branch principal: `main` (Sincronizado com as melhorias de hoje).

---

## ⏭️ Próximos Passos Sugeridos:
-   Filtro por palavra-chave no nome do arquivo.
-   Exibir QR Code diretamente no Dashboard HTML.

---
**Nota para a IA:** O Git foi atualizado com as funções de `cronTimes` (plural). Puxar do GitHub ao iniciar nova thread.
