# Home Assistant — instalação, atualização e homologação

Versão de referência: **0.2.0-dev.11**. Para o Raspberry Pi 4 já instalado em 0.1.17, seguir [C3 atualização](C3-RASPBERRY-PI-ATUALIZACAO.md) e [backup específico](C3-RASPBERRY-BACKUP.md). Ambiente principal de instalação/testes/homologação.
Este manual acompanha os pacotes futuros. C1/C2 não autorizam executar estes passos
na instalação real: aguardar autorização específica para a primeira homologação.

## Pacote e requisitos

`artesao-digital-home-assistant-0.2.0-dev.11.tar.gz` contém a pasta `artesaos_piloto`,
Dockerfile, código e lockfile, config.yaml e manuais. Não contém banco, usuário,
senha, client secret, convite ou dados comerciais. É pacote-fonte de add-on local;
o Supervisor construirá a imagem. Não é arquivo de backup para restaurar no HA.
Base Node 24.19.0 Bookworm. C3 acrescenta pacote aarch64 pré-compilado e testes
ARM64 em emulação Cortex-A72; Supervisor/Pi reais permanecem pendentes. Home Assistant OS/Supervised com
loja de aplicativos e acesso autorizado à pasta de add-ons locais são necessários.
Home Assistant Container/Core sem Supervisor não instala esse formato.

Antes de qualquer alteração real, registrar versão do HA/Supervisor, arquitetura,
origem/slug do add-on instalado, URL, hostname interno e configurações do proxy;
verificar espaço livre por inspeção não destrutiva e fazer backup completo protegido.
Não formatar nem testar estresse de disco. Não mudar o aplicativo principal de
Fabricação e Orçamentos; Artesão Digital mantém seus próprios dados.

## Integridade e instalação nova autorizada

1. Guardar o pacote e seu SHA256SUMS em local confiável. Na pasta do download:
   `sha256sum --ignore-missing -c SHA256SUMS`. Extrair em pasta de preparação; conferir
   a lista com `tar -tzf artesao-digital-home-assistant-0.2.0-dev.11.tar.gz`.
2. Copiar a pasta `artesaos_piloto` para `/addons/artesaos_piloto` da instalação HA,
   somente quando autorizada e se não houver instalação/pasta a preservar. Se já
   existir, seguir atualização abaixo; não substituir diretório/dados por suposição.
3. Loja de aplicativos → verificar atualizações/recarregar → aplicativos locais →
   **Artesão Digital — Testes** → instalar. Não iniciar antes de preencher opções.
4. Informar `public_url` HTTPS terminando exatamente em `/artesaos-piloto/`,
   `google_client_id`, `google_client_secret` e `admin_emails` com os administradores
   Google autorizados. SMTP é opcional e independente. Não publicar esses valores
   no Git ou logs. Não configurar o modo Debian nem Primeiro Acesso no HA.
5. Deixar a porta do host 8099 desabilitada. Usar o hostname interno real do add-on
   mostrado pelo HA para o proxy HTTPS existente. Não usar IP interno numérico que
   pode mudar ao reiniciar. Não expor SQLite, /data ou portas de diagnóstico.
6. Preservar a configuração Nginx atual. `generate-nginx.py --upstream-host HOSTNAME
   --output ARQUIVO-NOVO.conf` gera uma proposta sem sobrescrever: revisar e validar
   `nginx -t` antes de aplicar em etapa real autorizada. Não alterar rede/proxy agora.
7. Iniciar e conferir logs sem segredos, login comum, administração e rodapé da versão.
   Habilitar início automático no HA somente após a homologação autorizada.

## Google, administração e permissões

Callback exato: `https://SEU-ENDERECO/artesaos-piloto/auth/google/callback`.
Manter as URLs/credenciais atuais do HA na atualização. Conta administrativa continua
Google + allowlist `admin_emails`; usuários comuns continuam Google + convite e tenant
próprio. `/artesaos-piloto/admin/login` é o acesso administrativo. Não existe senha
padrão nem setup local no HA. Convites são geridos pela administração, não nas opções.
Termos/onboarding continuam conforme a configuração existente. Restrições de público
em teste do Google são independentes dos convites do aplicativo.

## Atualização de instalação existente

1. Confirmar **mesma origem/repositório/pasta e slug**. Instalar como outra origem
   pode criar outro identificador e volume: não equivale a atualizar. Não desinstalar
   para atualizar nem converter automaticamente add-on de repositório em add-on local.
   Se a origem real diferir, registrar e definir a rota de atualização antes de agir.
2. Fazer backup frio nativo do HA incluindo o Artesão Digital e suas opções; guardar
   pacote anterior, identificador, versão e acesso de recuperação local. Não depender
   apenas de acesso remoto para uma alteração do proxy. Conferir cópia protegida.
3. Atualizar somente os arquivos do pacote na **mesma origem**, sem tocar em /data,
   opções, bancos, chaves ou demais add-ons. Usar Atualizar/Recompilar do Supervisor,
   de acordo com a origem; não forçar instalação limpa.
4. Migrations executam no primeiro acesso/início dos bancos correspondentes, por
   tenant e scope. Bancos de tenants não abertos podem migrar sob demanda. Não editar
   SQLite. Se schema/checksum incompatível, inicialização é recusada; parar e investigar.
5. Validar os critérios abaixo e manter backup anterior até aprovação. Erro de
   atualização não autoriza apagar dados ou reinstalar. Ver RECUPERACAO.md.

## Backup, restauração e falhas

`backup: cold` no manifesto permite backup nativo com parada do add-on. Usar o fluxo
oficial do HA, incluindo opções e dados completos; proteger backup por conter segredos.
Também guardar pacote-fonte anterior. Não copiar somente validation.sqlite de um
usuário: controle, sessões, contatos cifrados, chave de cifra, anexos/logo, legal,
suporte, interesses e tenants são necessários. Não fazer cópia quente parcial.

Restauração em instalação real exige nova autorização, versão compatível e backup
verificado. Usar restauração nativa do HA na origem correta; nunca restaurar volume
HA no Debian. Não executar downgrade sobre schema já atualizado. Um backup anterior
não contém operações feitas depois dele. Testar restauração isoladamente antes.

Após falha/reinício: conservar dados e logs sanitizados; verificar status, versão,
espaço livre e hostname. Mensagem “Acesso permitido somente pelo Ingress” pode indicar
proxy apontando ao processo errado; não remover proteção. Conferir destino/hostname.
Reinício do proxy, quando necessário, pertence a uma intervenção real autorizada.

## Checklist para primeira homologação real — ainda pendente

- Arquitetura/Supervisor, instalação pela origem correta e preservação das opções.
- HTTPS/cookies e Google reais; admin permitido e bloqueio de não administrador.
- Primeiro e segundo login comum, isolamento de duas contas, sessões/logout.
- Produto/material/compra/fabricação, orçamento/PDF/pedido, reserva/entrega, pagamentos,
  venda/sessão/consignação, Central e embalagem/preparo (usar dados de homologação).
- Desktop e celular, backup frio/restauração, reinício do HA e recuperação do proxy.

C2 testa processos/contêineres e identidades controladas; não simula o Supervisor
inteiro nem certifica a instalação física. Debian não precisa estar pronto para
aprovar correções ou novas versões no HA.
