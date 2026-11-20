# Comandos de implantação Replit (Node)

```bash
npm install
npm test
npm run build
npm start
```

Secrets obrigatórios em publicação: `EDITOR_TOKEN` (senha), `SESSION_SECRET` (outro segredo longo). Secrets opcionais: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_VISION_MODEL`, `ORB_ENABLED=1`.

Para visão computacional CPU opcional, se Python disponível:

```bash
python3 -m pip install -r scripts/requirements-cpu.txt
```

**Replit Secrets, não `.env` em GitHub.** Nunca publique o diretório `data/`, porque contém fotos originais, GPS e histórico. No primeiro acesso use a senha `EDITOR_TOKEN`.

Para GitHub: conecte uma instalação com acesso de gravação ao repositório desejado; crie uma pasta `praca-iguacu3-humano-ia/` ou um repositório dedicado e envie os arquivos extraídos do ZIP. Um diretório Git vazio não existe no Git: crie ao menos um `README.md` dentro dele.
