# Artesão Digital 0.2.0-dev.14 — R1.1, distribuição aarch64

Fonte/runtime: b7b84f8f7a7779881d6b37d49442753188dafb5c, branch codex/artesao-digital-evolucao
no repositório mmcromero/fabricacao_e_orcamentos. Inclui R1.1 3471da1 e operações
por fase até 79679b9. Origem/slug artesaos_piloto, /data, opções e legado preservados.
Versão incrementada para o Supervisor reconhecer atualização da dev.13.

R1.1: cadastros consecutivos de interessados, alertas vazios e link redundante do
login administrativo Debian. Suporte, feedback inicial e atalho financeiro existentes
preservados. Nenhuma alteração comercial ou de schema: tenant11/control4/interest2/
support2/legal3; base 0.1.23 inalterada.

Validação desta fonte: build, 193 testes da aplicação, 8 do helper de distribuição e
18 de operações aprovados. Imagem ARM64 construída e metadados/runtime/checksums
conferidos. Imagem final pré-compilada construída sem execução ARM. Harness Debian
AMD64 sintético aprovado, incluindo autenticação e restauração fria; isso não
certifica ARM64. Testes Chromium da R1.1 são históricos, não repetidos nesta publicação.
Raspberry Pi/Supervisor reais, Google/SMTP/rede reais e execução ARM64 desta versão
não homologados. Não houve instalação ou atualização no equipamento.

## Atualização manual

Na loja Home Assistant da origem https://github.com/mmcromero/fabricacao-e-orcamentos-ha,
verificar/recarregar atualizações e selecionar Atualizar no add-on existente.
Não desinstalar, mudar origem/slug ou apagar /data. Nível 1: backup recomendado,
sem certificação obrigatória. Se não instalado, instalar manualmente dessa origem
apenas quando necessário, sem interferir nos serviços pessoais do Raspberry Pi.
Depois conferir versão, logs/healthcheck e login Google. Opções/rede/proxy seguem
configuração aprovada existente; esta publicação não os altera. A presença no Git
não comprova descoberta da atualização por um Supervisor real.

Retorno manual apenas com versão anterior e dados compatíveis; schemas desta versão
não mudaram. Não restaurar/apagar dados automaticamente. Recuperação de dados Forja↔HA
e prevenção de conflitos continuam pendentes, sem sincronização automática.

[Procedimento completo](manuals/HOME-ASSISTANT.md) · [Recuperação](manuals/RECUPERACAO.md)

Impacto na Central de Pendências: nenhum; fluxos de negócio preservados.
