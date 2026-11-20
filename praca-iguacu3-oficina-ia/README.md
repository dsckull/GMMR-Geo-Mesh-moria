# Praça Iguaçu 3 — Oficina Humano–IA (CPU-first)

**Versão:** 0.1.0, prova de conceito executável (não reconstrução final).  
**Objetivo:** plataforma web para humanos e agentes estruturarem, criarem e verificarem cenas urbanas, usando fotos e geometria procedural, sem GPU obrigatória.

## O que está implementado neste pacote

- Editor 3D web com câmera orbital por toque, seleção, translação, rotação e escala (React + Three.js).
- Objetos paramétricos demonstrativos: bancos, postes, árvores, alambrados, construções, escadas e blocos.
- Cena estruturada em JSON com revisão, unidades locais, identificadores, evidências, bloqueio e estado de validação.
- API transacional com revisão otimista, validação, gravação atômica e desfazer da última transação.
- Upload de fotos próprias, correlação em lotes, miniaturas e captura de EXIF quando existente; arquivos originais ficam privados no servidor.
- Correlação CPU por similaridade visual (dHash + histogramas). **Apenas triagem**.
- Correlação CPU por ORB + RANSAC (Python OpenCV opcional). Detecta provável sobreposição, **não** poses de câmera/metros.
- Marcações humanas de pontos correspondentes em duas imagens, armazenadas por foto e coordenadas normalizadas.
- OpenRouter para análise semântica de fotografias e propostas de operações de cena, com prévia e aprovação explícita.
- Contrato de trabalho PicoGK para exportar dimensões paramétricas em milímetros e executar futuramente num trabalhador externo.
- Testes do núcleo e validador de ações.

**Ainda não implementado:** trabalhador PicoGK ativo, conversão real STL→GLB, reconstrução SfM/Colmap, calibração métrica, encaixe de câmera, editor de terreno, sombreamento físico final, gerenciamento multiusuário, banco de dados durável ou colaboração CRDT. O projeto é um MVP experimental, não um sistema AAA+ finalizado.

## Rodar no Replit (mais direto)

1. Importe este código usando GitHub ou, quando disponível no seu fluxo, envie/extrai o ZIP para um projeto Node.js.
2. Execute `npm install`.
3. Cadastre nos **Secrets** `EDITOR_TOKEN` (senha forte) e `SESSION_SECRET` (chave aleatória forte). Jamais coloque segredos em arquivos enviados ao GitHub.
4. Opcional: cadastre `OPENROUTER_API_KEY` e defina `OPENROUTER_MODEL` e `OPENROUTER_VISION_MODEL` para modelos compatíveis com visão/JSON conforme necessidade.
5. Execute `npm run build && npm start`. O servidor serve frontend e API pela mesma porta (`PORT`, padrão 3000).
6. Abra o Preview e entre com `EDITOR_TOKEN`. Sem chave OpenRouter, edição e correlação por CPU permanecem disponíveis.
7. Para ORB no Replit que disponibilize Python: `python3 -m pip install -r scripts/requirements-cpu.txt` e defina `ORB_ENABLED=1` nos Secrets. Em hospedeiros que só executem Node, use o fallback e/ou execute o script localmente.

No desenvolvimento local, `npm run dev` abre Vite em `http://localhost:5173`, com proxy para a API na porta 3000.

**Persistência:** este MVP grava em `data/` no sistema de arquivos. Dependendo do plano/tipo de implantação do Replit, o disco da instância pode não ser durável. Exporte periodicamente JSON e, antes de uso público, mova cena, evidências e fotos para banco de dados e armazenamento persistentes.

## Alternativa Lovable

A integração oficial GitHub do Lovable sincroniza projetos criados nele com o GitHub; a importação direta de repositório preexistente não deve ser presumida como suportada. Para usar Lovable, crie um projeto de interface e use `docs/PROMPT_LOVABLE.md`. Mantenha a API Express e o worker CPU hospedados no Replit ou migre-os para funções/serviços equivalentes. `OPENROUTER_API_KEY` deve ficar somente no backend. A versão ZIP deste código é preparada prioritariamente para Node/Replit.

## Fluxo para correlacionar as fotos

1. Organize imagens próprias em grupos por setor e momento. Evite mesclar fotos sem sobreposição, panoramas de mesma posição e vídeos capturados em deslocamento como se fossem equivalentes.
2. Importe no painel Fotos e execute correlação. dHash/histograma encontra apenas *candidatos de semelhança visual*, não correspondências verificadas.
3. Ative ORB/RANSAC quando Python/OpenCV estiverem disponíveis. Inliers de homografia sinalizam possível sobreposição de regiões planas; não são poses 3D completas.
4. Abra duas fotos e marque o MESMO elemento fixo: canto da sede, base de poste, quina de degrau. Nomeie a referência. Repita várias vezes em múltiplas vistas.
5. Somente numa fase SfM futura, use esses vínculos para estimar geometria relativa e câmeras, seguido de calibração com medições independentes.
6. Nunca atribua metros a um objeto somente porque um modelo de IA sugeriu um valor. Separe sempre medido, verificado visualmente, estimado e não verificado.

Para usar o script diretamente:

```bash
python3 -m pip install -r scripts/requirements-cpu.txt
python3 scripts/correlate_cpu.py data/orb_manifest.json data/correlations.json
```

O manifesto `orb_manifest.json` é gerado automaticamente no primeiro uso com `ORB_ENABLED=1`.

## Arquitetura

```text
Humano (React + Three.js)       Agentes (OpenRouter / API estruturada)
          \                               /
           \        POST /api/...        /
              Motor transacional Node
               |           |          |
         scene JSON    fotos+marcas   PicoGK job JSON
          |             |                |
      Render local   CPU ORB/OpenCV    Worker futuro
               \                         /
                 Assets versionados (futuro)
```

**Nota PicoGK:** o NuGet oficial dá suporte a Windows x64 e macOS Apple Silicon; Linux depende de runtime compilado/customizado, não garantido. Assim a aplicação **não tenta executar PicoGK no Replit**. A exportação de trabalhos é ativa, a geração PicoGK continua pendente. O worker deverá ler `praca.picogk.job.v1`, gerar STL/VDB e converter para GLB com materiais numa etapa independente. Unidades: JSON interno da cena em metros locais (escala provisória); tarefas PicoGK exportam dimensões em mm.

## Rotas da API

| Método | Rota | Função |
|---|---|---|
| POST | `/api/login` | autenticação por senha e cookie httpOnly |
| GET | `/api/status` | estado de integrações (sem divulgar segredos) |
| GET | `/api/scene` | cena revisada em JSON |
| POST | `/api/scene/commit` | lote atômico, `baseRevision` obrigatório |
| POST | `/api/scene/undo` | reverte última transação confirmada |
| GET/POST | `/api/photos` | metadados e importação de imagens |
| POST | `/api/photos/correlate` | correspondências candidatas CPU |
| GET | `/api/correlations` | resultados da última correlação |
| GET/POST | `/api/landmarks` | referências manuais multivista |
| POST | `/api/ai/observe/:id` | análise visual semântica OpenRouter |
| POST | `/api/ai/plan` | proposta de operações, prévia apenas |
| GET | `/api/generators` | informa geradores ativos/planejados |
| POST | `/api/geometry/jobs` | exporta contrato de trabalho PicoGK |

## Segurança e limitações

- Modo produção requer senha configurada. Cookie `HttpOnly`, `SameSite=Strict`; verificação de Origin em mutações; limite simples de tentativas de login.
- Somente a API servidor acessa a chave OpenRouter. Não salve chaves em prompt, código ou GitHub.
- Fotos podem conter GPS, rostos ou informações pessoais: obtenha consentimento, controle acesso e considere remover EXIF/elementos sensíveis antes de enviar a provedores de IA.
- O endpoint de IA não executa código recebido e não persiste nada sem `scene/commit` explícito. Objetos bloqueados não podem ser alterados por agentes.
- Este MVP é de **um único operador e um único processo**. Para múltiplos usuários e múltiplas instâncias, usar armazenamento transacional real, RBAC, rate limits centralizados, política de retenção e logs de auditoria imutáveis.
- Fotografia pública e Street View possuem restrições de uso. Priorize fotos próprias/licenciadas. Não inclua capturas Google como ativos redistribuíveis sem permissão.
- `PicoGK job` é **contrato exportado** e não malha 3D. O editor renderiza geometrias básicas diretamente em Three.js.

## Próximos marcos

1. Importar imagens próprias e criar grafo de sobreposição por setores, com âncoras humanas.
2. Testar CPU ORB em imagens de campo, avaliar inliers falsos e custos reais.
3. Integrar pycolmap/COLMAP em execução opcional e assimétrica (um job com custo de CPU controlado), incorporar EXIF/câmeras e métricas de reprojeção.
4. Adicionar módulo PhotoMatch 2D/3D (câmera virtual, máscara e reprojeção) e salvar estimativas com incerteza.
5. Especificar e implementar worker PicoGK num ambiente compatível, testes de saída STL e conversão GLB.
6. Persistência durável, projetos multiusuário, isolamento por projeto, controle de acesso e trilha de eventos imutável.

Veja `docs/ARQUITETURA_MESTRE.md`, `docs/PROMPT_LOVABLE.md` e `docs/CONTRATO_PICOGK.md`.
