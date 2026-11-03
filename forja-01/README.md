# dev.16 e UPD-CMD-01 disponíveis — Nível 1

[ZIP dev.16](https://raw.githubusercontent.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/Forja-01-0.2.0-dev.16.zip)
· [Kit permanente atualizado](Instalar-Atualizador-Forja-01.zip)
· [Correção da ferramenta existente](Correcao-Download-Forja-01.zip)
· [Checksums](SHA256SUMS) · [Índice atual](publicacao-atual.json).

Ferramenta já instalada: fechar comandos, extrair kit/correção em pasta separada,
copiar somente Forja01.ps1 e Baixar-Pacote.cmd (LEIA-ME opcional); preservar
forja-config.json, forja-admin.py, os dois CMDs/atalho e todas as pastas existentes.
Novo uso: kit permanente com configuração-modelo vazia, sem credenciais.

Baixar-Pacote.cmd identifica/baixa/valida ZIP oficial para Pacotes; não instala nem
executa diagnóstico/SSH. Depois, Verificar-Download.cmd é opcional. Atualizar-Forja-01.cmd
somente com autorização expressa de instalação. ZIPs anteriores são preservados em
Pacotes-Anteriores; Concluidos indica somente sucesso real de atualização.

Versão dev.16, fonte 5e676c9bd0319a0c751e2652b4e79306d5638d95. UX-Loading-01,
mesma autenticação/schema/regra comercial. Código/testes do app reaproveitados com
comparação de fonte. Pacote Debian compose-source: a imagem será construída pelo
atualizador existente no staging durante instalação autorizada, não está no ZIP.
N1: backup recomendado, sem certificação como pré-requisito de atualização comum.
Retorno por imagem anterior/recibo, sem restaurar/apagar dados automaticamente.
Publicação não é instalação nem homologação física; Windows/Android/Pi pendentes.

---

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
