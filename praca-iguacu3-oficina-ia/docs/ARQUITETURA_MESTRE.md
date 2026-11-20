# Projeto mestre — Motor de autoria espacial humano–IA

**Status**: especificação v0.1 com protótipo parcial. **Alvo**: primeiro Praça Iguaçu 3; depois cenários urbanísticos em geral.

## Princípios não negociáveis

1. **Humano e IA usam o mesmo protocolo de operações**. O servidor não aceita que uma IA edite arquivos de cena diretamente. Ações são propostas, verificadas e aplicadas como transações.
2. **A cena é fonte de verdade, renderizações são derivadas**. Um GLB não substitui a descrição paramétrica do objeto e suas evidências.
3. **Evidência explícita**: medido != inferido; modelo de profundidade inferido não fornece medida certificada. Repositório deve preservar fotos próprias, hashes, pontos correspondentes, EXIF, calibração, hipóteses e revisão.
4. **CPU primeiro**: nenhuma GPU obrigatória para edição, correlação inicial e importação. Processos caros são opcionais, em lote e observáveis.
5. **Agentes não são indispensáveis**: operação humana por toque continua funcional sem OpenRouter.
6. **Extensibilidade por provedores**: builtin Three.js, OpenRouter, OpenCV/ORB, COLMAP/pycolmap (futuro), PicoGK (worker futuro), Blender (futuro).
7. **Segurança e reversibilidade**: travas por objeto, revisão otimista e rollback. No futuro, projetos multiusuário, RBAC e isolamento dos ativos.

## Camadas e contratos

### (A) Ingestão visual
- `Photo`: ID UUID, nome de origem, hash SHA-256 futuro, metadados de dispositivo, EXIF, momento da captura, licença, URL de miniatura, localização opcional, setor.
- `Landmark`: identificador e observações `{photoId, x, y}` normalizadas [0,1], classe semântica, status `pixel-correspondence-unverified`, contexto visual.
- Fotografias originais protegidas, miniaturas de trabalho, máscaras vinculadas por IDs, nunca embutidas em um único JSON volumoso.

### (B) Grafo de correlações
- **No protótipo**: dHash+histograma estabelece ranking de candidatos; ORB+RANSAC indica sobreposição planar aproximada; anotação manual conecta pontos fixos.
- **Etapa futura**: estimativa de matriz fundamental/essencial (quando intrínsecos permitirem); ligação de trilhas de características entre imagens; triangulação; bundle adjustment; pontos de controle; matriz de covariância aproximada.
- Nunca converter homografia 2D em pose 3D automática. Repetições em grade, vegetação, céu, grama, blur e vídeo com pouca paralaxe induzem falsos positivos.
- Associar imagens a setor, sequência, direção presumida e intervalo temporal quando metadados existirem. Selecionar pares pela união de score visual, temporais e validação manual, evitando explosão O(N²) em acervos grandes.

### (C) Modelo geométrico
- `Scene`: `schemaVersion`, `revision`, `coordinateSystem(unit=m,up=Y,reference=local)`, `objects`.
- `SceneObject`: `id`, `kind`, `name`, `position`, `rotation`, `scale`, `parameters`, `evidence[]`, `confidence`, `locked`.
- Separar `transform` local da georreferência global e do sistema de coordenadas de uma eventual nuvem de pontos.
- A base da praça será um terreno reconstruído por referências; *não* um plano automaticamente tomado como medição.
- Famílias: banco, poste, alambrado, portão, sede, quadra, academia, árvore, escada, calçada, lixeira, canteiro, céu/câmera/iluminação.
- Mapeamento para `GLB/GLTF` é um artefato derivado, não o estado de autoria.

### (D) Motor de operações
- `create`, `update`, `delete` são atômicos por lote e exigem `baseRevision` para impedir gravação sobre versão desatualizada.
- Validar IDs, tipos conhecidos, vetores finitos, limites de geometria, quantidade de ações e travas.
- Planejar proposta AI `preview -> human approval -> commit` com audit trail.
- Após MVP: diff por objeto, dependências, regras de colisão, snapshots com retenção e reversões por operação; testes concorrentes multi-instância.

### (E) Motor procedimental
- **Ativo**: geometria de demonstração em React Three Fiber com parâmetros editáveis (largura, altura, comprimento, número de postes), limites locais.
- **PicoGK**: adapter exporta `praca.picogk.job.v1`, entradas em milímetros para geometria local, sem transformações globais aplicadas ao objeto gerado.
- **Worker futuro**: C#/.NET 9 em SO oficialmente suportado; o binário retorna malha STL/VDB, stdout estruturado, logs, versão do algoritmo e hash do ativo. Conversão separada para GLB com materiais.
- **Importante**: nem PicoGK nem Open3D automaticamente reconhecem o significado de JSON arbitrário. Precisamos implementar um gerador específico para cada família.

### (F) Interface humana
- Viewport dominante, painel retrátil e catálogo, objetos com IDs, drag/rotate/scale por gesto, eixo travado, foto sobreposta a câmera calibrada (futuro), edição de máscaras (futuro), undo, exportação JSON.
- Alvos: responsividade percebida para ações simples, preview progressiva, geometria e fotos em camadas, cache e carregamento por setor, LOD e instanciamento de elementos repetitivos.
- As metas 30 FPS e P95 de toque <100ms são objetivos de teste, não garantias. Comparar Moto G24 com aparelho médio e desktop, com perfis 10/100/1000 objetos.

### (G) IA
- OpenRouter via servidor (`/api/ai/...`); nenhuma chave no navegador.
- `observe` fornece inventário semântico, âncoras candidatos e advertências. `plan` produz JSON de operações *propostas*, limitada a tipos e coordenadas locais.
- A IA não pode assinar medições, assumir escala fotográfica ou executar código arbitrário.
- Política de economia: chamadas sob demanda, imagens reduzidas, contexto limitado por setor, cache por hash da imagem no futuro, limites de custo por usuário/projeto e seleção de modelo.
- Interface de agentes futura compatível com MCP e autenticação por escopo de ferramenta; não expor endpoint público irrestrito.

## Pipeline de extração sem GPU obrigatório

```text
fotos próprias -> padronização EXIF -> deduplicação
   -> triagem dHash -> ORB/RANSAC -> grafo de candidatos
   -> revisão de pares + landmarks humanos
   -> [COLMAP/pycolmap opcional CPU, após testes]
   -> pontos/câmeras com resíduos e incertezas
   -> [calibração física necessária para escala métrica]
   -> objetos e terreno estimados -> contrato paramétrico
   -> Three.js no navegador ou PicoGK worker externo
   -> foto/3D sobrepostos -> validação humana -> versão aprovada
```

Nenhuma dessas etapas, isoladamente, garante precisão centimétrica. Estimativas devem manter método e erro residual. Uma correlação foto-foto não equivale a reconstrução 3D, e um modelo 3D não equivale à topografia verdadeira.

## Estratégia de implantação

### Replit (recomendado para PoC)
- Servidor Express Node 20+, frontend Vite/React, Python opcional para ORB.
- Um serviço HTTP, um processo. Secret `EDITOR_TOKEN`, `SESSION_SECRET`, `OPENROUTER_API_KEY`.
- Disco local temporário na PoC. Para uso contínuo: Postgres + armazenamento de objetos com URLs assinadas, filas de jobs, caches e backups.
- Replit não é alvo obrigatório para executar binário PicoGK nativo.

### Lovable
- Recomenda-se construir frontend pela interface Lovable usando `PROMPT_LOVABLE.md` e consumir backend externo.
- A API OpenRouter requer function/servidor. A dependência Python/ORB não deve ser presumida no runtime do frontend.
- Não pressupor importação oficial de um repositório existente pelo Git sync do Lovable.

### Linux/Termux
- Navegador do Android consome editor; não executar modelos grandes de visão no dispositivo.
- Script ORB CPU pode ser executado em máquinas compatíveis que tenham `opencv-python-headless` e RAM suficiente.
- Para PicoGK nativo, tratar compatibilidade Linux como pesquisa; a documentação oficial indica Windows x64 e macOS ARM64.

## Aceite por etapa (não cumulativo)

- P0: construir objetos, manipular e salvar sem IA, recuperação após recarga, teste de travas, latência toque.
- P1: importar 15–30 fotos próprias, identificar pares com ORB, anotar 3+ pontos homólogos, medir taxa de falsos positivos.
- P2: integrar estimativa de câmera em CPU, validar dados sintéticos e fotos com medidas reservadas, quantificar erro de reprojeção e de escala.
- P3: worker PicoGK real, consumir job, executar geometria, converter STL→GLB, verificar dimensão antes/depois da conversão.
- P4: ensaio em toda praça com georreferência parcial, comparações lado a lado, revisão humana e catálogo de ativos com origens.
- P5: segurança multiusuário, auditoria central, observabilidade de jobs, quotas de IA, backup e exportação interoperável.

## Estado na data de entrega

**Implementado no ZIP:** P0 parcial, início P1, contratos de P3. **Não implementado:** SfM, profundidade métrica, conversor real, mesh worker real, produção multiusuário e render fotográfica. Sem testes em Replit/Lovable real nesta entrega.
