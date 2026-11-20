# Prompt para adaptação no Lovable

Quero criar uma versão do projeto “Praça Iguaçu 3 — Oficina Humano–IA” usando a interface existente deste repositório como especificação funcional.

**Arquitetura obrigatória:** UI web React/TypeScript + Three.js/R3F; motor de operações estruturado com create/update/delete, transações com revisão otimista, objetos paramétricos e registros de evidência; IA OpenRouter apenas via servidor/funções, nunca chave no cliente. Não use modelo de IA para mover um banco por simples arraste. Preserve manipulação 3D móvel, seleção, escala, rotação, máscara/referência e zoom por gesto.

**Condições do escopo:**
- Este é um editor para humanos e agentes de IA, não um site de chat. O chat só traduz pedidos em **planos de operações**, com prévia e confirmação explícita antes de alterar a cena.
- Não inventar medidas geográficas, câmeras, GPS ou profundidade; trabalhar em referencial local, marcar evidências e confiança.
- Fotos de usuário: importação privada, miniaturas, correlação por CPU via serviço externo e marcações manuais do mesmo ponto em imagens distintas.
- Mecanismo PicoGK é **worker externo opcional**; implementar somente contrato JSON inicialmente. Não afirmar que PicoGK executa no backend do Lovable.
- Renderizar com bom desempenho em Android, incluindo instancing, carregamento progressivo, LOD futuro e painel compacto.
- Proibir uploads públicos sem autenticação e restringir custos da OpenRouter.

**IMPORTANTE:** não substitua a arquitetura por imagens geradas ou modelos genéricos. Reaproveite a experiência visual. Para consumir a API Express do Replit fora de sua origem, primeiro implemente um proxy de mesma origem ou um fluxo CORS+CSRF e cookies seguros; este protótipo atualmente exige mesma origem. Alternativamente proponha migração detalhada de endpoints, armazenamento e autenticação.

**Critérios de teste:** ambiente abre no celular; objeto criado por toque pode ser selecionado, movido, girado e salvo; bloqueio é respeitado; foto correlacionada não recebe falsa escala; a IA retorna uma lista de ações revisável; nenhum segredo aparece no bundle.

**Não modificar automaticamente projetos Lovable existentes do usuário**, pois este módulo deve nascer isolado ou em branch/repositório próprio depois de autorização explícita.
