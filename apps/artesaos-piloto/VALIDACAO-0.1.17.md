# Validação — 0.1.17 experimental

Base preservada: Fabricação e Orçamentos 0.1.23 / f56f0e5707ad81f74f42c351171d4132f793cf9a. Evolui o pacote 0.1.16 sem incorporar nova base nem alterar o aplicativo principal.

## Verificações

- `npm run build`: TypeScript cliente/servidor, Vite e metadados aprovados.
- `npm test`: **63 testes aprovados**, sem falhas. Os novos cenários verificam 65 convites/contas sem teto de cinco, paginação 25/25/15, busca por e-mail/telefone, ausência de vencimento, revogação e reativação idempotente com outro código, rejeição do anterior e de alteração de dados em repetição da mesma solicitação, recuperação de legado sem inventar nome/data, conta existente consumindo convite sem duplicar usuário e cache de bancos com reabertura/preservação, ocupação temporária e recuperação após falha.
- O teste de opções foi atualizado: campos/variáveis antigos não criam nem renovam convites; a configuração de produção usa ausência de teto de contas. Valores antigos presentes no arquivo não geram erro no parser do aplicativo. Manifesto não contém os cinco pares.
- `python3 scripts/verify-pilot-browser.py` e `--legal`: Chromium com HTTPS/Google controlados. Fluxos anteriores, quatro abas, Salvar com código automático, e-mail/WhatsApp, revogação, formulário Ativar novamente, código diferente e sem vencimento, recusa do código anterior por outra conta Google, aceite do novo, retirada dos convites e entrada em Usuários cadastrados, busca/paginação de usuários, layout de 390 px. O modo legal usa documentos fictícios somente na fixture; a distribuição continua sem textos definitivos ativos.
- `node --import tsx scripts/verify-pilot-central-invitations-upgrade.mjs`: volume criado pelo código publicado 0.1.16 (acec80d), com sessão/empresa, convites ativos/expirados/revogados e contato cifrado. Atualização preserva dados/chave/código, converte somente os ativos em sem vencimento, mantém vínculo legado por e-mail, constrói índice derivado de telefone e permite nova ativação Google. Reinício preserva o estado e uma cópia completa parada é restaurada com o código original 0.1.16.
- Imagem amd64 construída pelo Dockerfile de produção, Node 24.19.0 e dependências/fontes embarcadas. `python3 scripts/verify-pilot-container.py --image artesao-digital:0.1.17-validation` verifica login/legal, APIs protegidas, opções antigas ignoradas, sete convites, ausência de vencimento, revogação/reativação com novo código, chave persistida após reinício e PDF compilado com fontes (14.392 bytes na fixture). Nenhum e-mail real é enviado.

## Migração e segurança

Acrescenta no_expiry ao controle de convites e phone_hash/previous_hash/replacement_hash aos metadados. Somente convites não usados, não revogados e ainda válidos no momento da migração passam a não vencer. Não altera código, conta Google ou contato deles. Expirados/revogados continuam inativos. Nova ativação preserva o registro anterior revogado, gera outro código e vincula a substituição atomicamente. Convites aceitos não revogam/recriam uma conta já existente.

Índice de telefone usa HMAC com chave derivada da chave existente; nome/telefone/código continuam cifrados com AES-256-GCM. O índice evita decifrar o cadastro inteiro em busca de duplicados. A listagem retorna no máximo 25 registros por página. O cache mantém até oito aplicações/bancos comerciais abertos e não encerra uma conta enquanto uma requisição a utiliza; reabre a conta com seu banco persistido. Ocupação simultânea temporária pode retornar 503, sem bloquear novos cadastros.

Sem vencimento, um código vazado permanece utilizável até consumo/revogação. Uso único, geração forte, administração restrita, origem/CSRF/contexto e rotação na reativação são preservados. Chave no mesmo volume não protege contra comprometimento de banco e chave juntos. Não há afirmação de conformidade jurídica.

Antes de atualizar a instalação, gerar cópia completa/protegida de volume/opções com o aplicativo parado, incluindo chaves. Para reverter, restaurar a cópia anterior completa com seu código correspondente; não usar apenas código antigo sobre o banco migrado. Ainda não há rotina de backup real configurada segundo o responsável.

## Opções do Home Assistant e limites reais

Foi conferido o código público atual do Supervisor (`supervisor/apps/options.py` no repositório home-assistant/supervisor): a validação ignora/remove campos desconhecidos e registra aviso com seu nome. O parser do aplicativo também ignora os campos antigos. Isso não é teste da versão específica do Supervisor da instalação pessoal, que ainda precisa de conferência real.

Não houve Google/SMTP/WhatsApp nativo/HA/ARM reais, configuração pessoal de rede ou teste de recuperação no hardware final. O modo Teste/audiência do Google continua tendo suas próprias restrições; o aplicativo não altera o console Google. Remover o teto de cinco não garante memória/armazenamento/concorrência ilimitados.

Dependências não mudaram desde 0.1.16. A última auditoria de produção registrou três alertas moderados na cadeia @fastify/static/glob/minimatch, sem altos/críticos e sem correção disponível indicada. Revisão jurídica, retenção/descarte, direitos/exportação/saída, fornecedores, incidentes e backup real continuam pendentes. Não é primeiro release estável.
