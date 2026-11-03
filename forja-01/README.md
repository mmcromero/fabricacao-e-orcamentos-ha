# Ferramenta de atualização Forja 01 — Windows

Este diretório público distribui somente a ferramenta e os metadados necessários
às atualizações Debian. É separado dos add-ons; não instala nem atualiza Home Assistant.
O código de desenvolvimento e a documentação interna permanecem no repositório privado.

- [Kit inicial](Instalar-Atualizador-Forja-01.zip) — somente para instalar a ferramenta.
- [Checksums do kit](SHA256SUMS).
- [Correção do download 404](Correcao-Download-Forja-01.zip) — para quem já tem o kit.

**Já instalado:** extrair a correção, substituir somente Forja01.ps1 e acrescentar
Verificar-Download.cmd na pasta existente. Preservar forja-config.json, wrapper,
atalho e todas as pastas. Executar primeiro **Verificar-Download.cmd**, que NÃO acessa
o servidor e deve confirmar download/integridade. Não requer login GitHub ou token.

**Primeiro uso:** extrair kit num local permanente, preencher sshHost/sshUser em
forja-config.json e criar atalho para Atualizar-Forja-01.cmd. Configurar OpenSSH,
chave/agent e rota autorizada de acesso separadamente. Dados de acesso não são públicos.
Colocar o ZIP da aplicação entregue pelo responsável em Pacotes, sem extraí-lo.

O lançador consulta publicacoes/VERSAO.json nesta origem pública, exige correspondência
exata com o manifesto do ZIP e confere hashes/nível. Falhas bloqueiam antes de SSH.
O documento publicado deve ser cópia exata do aprovado no desenvolvimento.
Um retorno 200 no ambiente Codex não substitui o diagnóstico no Windows real.
Não criar metadados locais para ignorar uma falha nem inferir nível anterior/padrão.

Atualização real exige autorização e, quando necessário, senha sudo no terminal.
Não armazena senha; não configura NOPASSWD/grupo docker/SSH. Cancelamento preserva
pacote pendente. Sucesso confirmado move para Concluidos. Ferramenta não apaga dados,
não migra schemas nem executa retorno automático. Recibos existentes em .operations
servem ao procedimento de retorno por imagem, com autorização e compatibilidade.

## dev.15 disponível — Nível 1

[ZIP Windows](Forja-01-0.2.0-dev.15.zip) · [Fonte Debian](artesao-digital-debian-0.2.0-dev.15.tar.gz)
· [Metadados](publicacoes/0.2.0-dev.15.json) · [Checksums](SHA256SUMS).
Fonte cc50f483c2f77dfcb5ee2353caf051bb405aa9b5, PWA-01 online. Colocar somente ZIP
em Pacotes e verificar download. Atualização real exige autorização; manter atalho,
SSH/sudo/configuração existentes. Conferir healthy/commit/login/PWA após instalar.
Retorno explícito por imagem anterior/recibo, sem apagar bancos. Publicação não é
instalação nem homologação física.
