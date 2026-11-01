# Atualizações futuras — contrato de distribuição e continuidade

Home Assistant é principal para homologação. Debian acompanha versão/código/schema
sem depender de um notebook preparado. Falta de validação física Debian deve ser
registrada, não bloquear automaticamente correções quando os testes pertinentes e
segurança forem atendidos. Não compartilhar volumes, credenciais ou contas entre eles.

## Para desenvolvimento de cada versão

1. Ler AGENTS.md/continuidade, verificar branch/diffs/HEAD/remoto efetivo e autorização.
2. Preservar regras comerciais e autenticação de cada adaptador. Alterações de schema
   são comuns, aditivas/migradas e testadas; não editar migrações históricas/checksums.
3. Atualizar artesao-release.json e pilot/config.yaml para a mesma versão. Base principal
   só muda por incorporação autorizada, preservando core-base.json e rastreabilidade.
4. Atualizar estes quatro manuais, limitações, relatório e critérios de compatibilidade.
5. Testar código, produzir ambos os pacotes de um commit limpo usando
   `python3 scripts/prepare-distributions.py --output DIRETORIO-NOVO`.
   Opcional `--image-archive CAMINHO/image.tar` inclui imagem Docker amd64 previamente
   construída/tagueada da mesma fonte. O exportador não constrói nem instala serviços.
6. Validar SHA256SUMS, manifestos, hash do código comum, instalação/upgrade/backup/restore,
   login/permissões, integridade, reinício e UI nos pacotes. Informar simulado versus
   real; não usar compatibilidade física não testada como alegação de sucesso.
7. Commit/checkpoint/push na branch autorizada, comparar `git ls-remote` com HEAD;
   publicar artefatos revisáveis com versão/commit/checksums. Push não é implantação.

## Operador HA

Seguir HOME-ASSISTANT.md: mesma origem/slug, backup frio protegido, conservar pacote
anterior, atualizar sem desinstalar/zerar dados, validar Google/tenant e operações.
Supervisor real e proxy exigem autorização específica. Não fazer merge na principal
como parte de teste experimental nem transferir credenciais de outro aplicativo.

## Operador Debian

Somente em atualização real autorizada:

1. Guardar novo pacote em pasta de preparação diferente; verificar hash e manifestos.
2. Na instalação atual, criar backup frio em arquivo novo e comprovar restauração.
   Guardar pacote anterior e anotar operações feitas depois do backup.
3. Parar serviço com `docker compose stop artesao`. Carregar nova image.tar. Confirmar
   imagem/versão esperadas, sem reutilizar tag de outra fonte inadvertidamente.
4. Atualizar **somente arquivos imutáveis do pacote** (app/, manuals/, compose.yaml,
   manage.py, release.json, SHA256SUMS e imagem) na pasta estável. Preservar data/,
   config/, private-codes/ e .env. Não executar initialize de novo. UID/GID/porta da
   instalação permanecem. Atualizar modelos como referência, sem sobrescrever opções.
5. `python3 manage.py verify`, `docker compose config --quiet`,
   `docker compose up -d --no-build`, `docker compose ps` e logs sanitizados.
6. Conferir versão, admin local, Google comum, duas contas isoladas, dados/configuração,
   migrações dos tenants, cenário funcional e desktop/celular. Guardar backup anterior.

Se a atualização recusar schema/checksum, parar e preservar dados. Não editar banco
ou trocar versão até “passar”. Usar RECUPERACAO.md para restauração compatível em pasta
nova; downgrade direto sobre schema novo não é permitido. Uma troca de diretório de
versão sem preservar projeto/volumes pode criar instalação vazia: não confundir com
perda de dados nem apagar a anterior. Imagens/volumes não são removidos automaticamente.

## Pendências permanentes de homologação

- Instalação/atualização/backup nativo Supervisor, Google/TLS/cookies reais no HA.
- Samsung/Debian físico, arquitetura/recursos/espaço/desempenho e início no boot.
- DuckDNS/CGNAT/HTTPS/renovação, proxy/firewall e acesso de rede isolada/celular.
- ARM/aarch64 e dispositivos/compartilhamento reais, quando aplicável.

A autorização C1/C2 prepara e testa em isolamento. Ao concluir, parar e aguardar
permissão específica para a primeira instalação real no Home Assistant.

Para C3/Raspberry Pi 4, usar o roteiro específico C3-RASPBERRY-PI-ATUALIZACAO.md: confirmar identidade/origem, não converter instalação e não confundir imagem de diagnóstico com backup/importação da UI.
