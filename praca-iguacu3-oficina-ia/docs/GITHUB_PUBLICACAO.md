# Publicar no GitHub quando a conexão de gravação for autorizada

**Status desta entrega:** a integração GitHub consultada não disponibilizou nenhuma instalação nem repositório, portanto NÃO foi criado arquivo remoto nem commit.

## Caminho 1 — Pelo Replit
1. Importe o ZIP para o Replit e confirme que o código inicia.
2. Conecte sua conta GitHub na seção Git/Repos do Replit.
3. Crie um repositório novo (por exemplo `praca-iguacu3-oficina-ia`) ou escolha repositório próprio com permissão de escrita.
4. Confirme que `node_modules`, `data/private`, `.env` e `data/*.json` estão no `.gitignore`.
5. Faça o commit inicial e publique no repositório com permissão explícita.

## Caminho 2 — Git local
```bash
git init
git add .
git commit -m "feat: scaffold oficina humano-IA CPU-first"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```
Substitua o endereço de exemplo pelo repositório REAL criado por você. Não inclua segredos.

## Como criar uma pasta dentro de repositório já existente

Coloque os arquivos extraídos dentro de `praca-iguacu3-oficina-ia/` no repositório. O Git não versiona pastas vazias, por isso o `README.md` dentro da pasta assegura sua existência.
