# 🤖 Resumo do Projeto: Extrator de PDFs WhatsApp (Pro)

Este arquivo serve como "ponte de memória" para que futuras conversas de IA saibam exatamente o estado atual do projeto.

---

## 📜 DIRETRIZES OBRIGATÓRIAS (Regras da Casa)

1.  **Modificações Estritas:** Somente alterar o código **diretamente solicitado**. NUNCA refatorar ou mexer em outras partes sem permissão explícita.
2.  **Objetividade:** Respostas sempre curtas, precisas e em Português do Brasil.
3.  **Não 'Limpar' o Código:** Não apagar comentários ou mudar estilo de escrita de partes não solicitadas.

---


## 🚀 Estado Atual (2026-04-23)

O projeto é um **extrator de arquivos PDF de grupos do WhatsApp** com um Dashboard interativo.

### 🛠️ Funcionalidades Implementadas:
1.  **Dashboard Automático:** Servidor Express na porta `3002` com HTML servido via Node.js (livre de erros de sintaxe de template literals).
2.  **Autolimpeza:** O arquivo `1 - INICIAR SISTEMA.bat` fecha processos `node.exe` antigos antes de iniciar o novo (evita cache de código).
3.  **Memória de Sessão:** Persistência de login via `LocalAuth`.
4.  **Busca Multi-Data com Shift:** Seleção de várias datas para varredura com suporte avançado a `Shift + Clique` (estilo Windows) para preencher períodos inteiros automaticamente.
5.  **Agendamentos Híbridos (V3):** 
    -   **Recorrente:** Por dias da semana com nomes legíveis (Seg, Ter, etc.).
    -   **Fixos:** Por datas específicas em um calendário dedicado na aba Agendar.
    -   Persistente no arquivo `schedules.json`.
6.  **Gestão de PDFs:** Listagem, contagem e exclusão robusta (ignora arquivos bloqueados sem quebrar o servidor) com botão para **"Converter para Markdown"** em tempo real no painel.
7.  **UX Corrigida:** Barra de progresso com auto-hide após conclusão e auto-limpeza do checkbox "Selecionar Todos" ao excluir PDFs.
8.  **Auto-Exclusão de Agendamentos:** Após executar, o agendamento é removido automaticamente da lista e do `schedules.json`.
9.  **Busca de Múltiplos Grupos Ultra-Flexível:** O campo aceita vários grupos. O motor ignora espaços, emojis, formatações ocultas do WhatsApp e funciona até com "Grupos de Avisos de Comunidade".
10. **Motor de Busca à Prova de Falhas (IndexedDB):** Bypassa completamente os métodos falhos do WhatsApp Web, extraindo o histórico e mídias diretamente do banco de dados interno do navegador (IndexedDB - model-storage).
11. **Conversor Python Inteligente:** Script otimizado para não travar no console ao imprimir arquivos com caracteres Unicode/Chineses/Emojis (`utf-8`). Converte página por página usando `fitz.open()` + `pymupdf4llm.to_markdown(doc, pages=[p])`.
12. **Tema Escuro:** Interface completa no estilo Dark Mode do WhatsApp Web (tons `#111b21`, `#202c33`, `#00a884`).
13. **Barra de Progresso por Página:** A conversão para Markdown reporta progresso página a página com porcentagem de 0% a 100%. Python roda com `-u` (unbuffered) para atualização em tempo real via Socket.io.
14. **Botão PARAR Conversão:** O botão "PARAR BUSCA" também mata o processo Python de conversão (`activePythonProcess.kill()`).
15. **Limpeza Automática de Cache:** Ao iniciar, o sistema apaga automaticamente as pastas `Cache`, `Service Worker`, `Code Cache`, `GPUCache` dentro de `.wwebjs_auth/session/Default/`, economizando ~1.5 GB. A sessão de login (IndexedDB) é preservada.
16. **Botão Limpar Tudo:** Botão vermelho no topo do sidebar que apaga todos os `.pdf` e `.md` das pastas `PDFS_Baixados/`, `extrator/Entrada/` e `extrator/Saida/` de uma vez, com confirmação.

### 📁 Arquivos Chave:
-   `index.js`: Motor do sistema (Express, Socket.io, Puppeteer). HTML/CSS/JS do Dashboard embutido.
-   `extrator/conversor.py`: Conversor de PDF para Markdown (página por página com `pymupdf4llm`).
-   `PDFS_Baixados/`: Pasta de armazenamento dos PDFs baixados.
-   `extrator/Entrada/`: PDFs copiados para conversão.
-   `extrator/Saida/`: Arquivos `.md` gerados.
-   `schedules.json`: Banco de dados dos agendamentos.
-   `1 - INICIAR SISTEMA.bat`: Inicializador inteligente (mata processos node antigos).
-   `.gitignore`: Exclui PDFs, cache e sessão do repositório.

### 📌 Git e GitHub:
-   Repositório: `geraldomartoranomelo-dot/Whatsapp-Extrator-PDF`
-   Branch principal: `main` (Sincronizado em 2026-04-23).

---

## ⏭️ Próximos Passos Sugeridos:
-   Filtro por palavra-chave no nome do arquivo.
-   Exibir QR Code diretamente no Dashboard HTML.

---
**Nota para a IA:** Última atualização: 2026-04-23 03:23h. PDFs NÃO devem ser commitados. O HTML do Dashboard está embutido no `index.js` dentro de `app.get('/', (req, res) => res.send(...))`. Cuidado com escape de `\\n` e regex dentro do template literal — código do backend (rotas `/convert`, `/clear-all`, `/stop-search`) fica FORA do template literal. O conversor Python usa `fitz.open()` + loop de páginas para progresso granular.
