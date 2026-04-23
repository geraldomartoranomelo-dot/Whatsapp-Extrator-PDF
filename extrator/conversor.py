import os
import sys
import pymupdf4llm
from pathlib import Path

# Força o terminal a aceitar caracteres UTF-8 (emojis, etc.) sem dar erro no print
sys.stdout.reconfigure(encoding='utf-8')
# Configuração das pastas
PASTA_ATUAL = Path(__file__).parent.resolve()
PASTA_ENTRADA = PASTA_ATUAL / 'Entrada'
PASTA_SAIDA = PASTA_ATUAL / 'Saida'

def converter_pdfs():
    print("Iniciando conversão de PDFs (Modo Texto Puro - Otimizado para IA)...")
    
    # 1. Verifica se a pasta Entrada tem arquivos
    arquivos_pdf = list(PASTA_ENTRADA.glob('*.pdf'))
    
    if not arquivos_pdf:
        print(f"Nenhum arquivo PDF encontrado na pasta: {PASTA_ENTRADA}")
        return

    # Garante que a pasta de Saida existe antes de começar
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)

    print(f"Encontrados {len(arquivos_pdf)} arquivos PDF. Iniciando...")

    # 2. Itera sobre cada arquivo PDF
    for i, caminho_pdf in enumerate(arquivos_pdf, 1):
        # Renomeia o arquivo PDF para remover espaços problemáticos antes de converter
        if " " in caminho_pdf.name:
            novo_nome = caminho_pdf.name.strip().replace(" ", "_")
            caminho_pdf = caminho_pdf.rename(caminho_pdf.parent / novo_nome)
            
        nome_arquivo = caminho_pdf.name
        print(f"[{i}/{len(arquivos_pdf)}] Convertendo texto: {nome_arquivo}...")
        
        try:
            # Define o nome do arquivo de saída
            nome_base = caminho_pdf.stem.strip()
            nome_saida_md = nome_base + '.md'
            caminho_saida_md = PASTA_SAIDA / nome_saida_md
            
            # --- MODO TEXTO PURO (COM OCR) ---
            # Extrai apenas o texto no formato Markdown estruturado (tabelas, listas, headers)
            # Ignora completamente a extração visual de imagens (`write_images` é False)
            # Mas ainda LÊ o texto dentro das imagens usando o Tesseract
            os.environ["TESSDATA_PREFIX"] = r"C:\Program Files\Tesseract-OCR\tessdata"
            md_texto = pymupdf4llm.to_markdown(
                str(caminho_pdf),
                write_images=False,
                force_text=False # Permite fallback para o OCR extrair as palavras da foto
            )
            
            # Salva o arquivo MD principal focado em leitura de IA
            with open(caminho_saida_md, 'w', encoding='utf-8') as f_out:
                f_out.write(md_texto)
                
            tamanho_kb = caminho_saida_md.stat().st_size / 1024
            print(f"  -> Sucesso! Arquivo leve gerado: {nome_saida_md} ({tamanho_kb:.1f} KB)")
            
        except Exception as e:
            print(f"  -> ERRO ao converter {nome_arquivo}: {e}")

    print("\nProcesso Finalizado!")
    print(f"Verifique a pasta: {PASTA_SAIDA}")

if __name__ == "__main__":
    converter_pdfs()
