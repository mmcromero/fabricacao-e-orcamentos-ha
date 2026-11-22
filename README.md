# Artesão Digital

> **AMBIENTE COMPARTILHADO — FONTE CENTRAL (19/11/2026):** antes de perguntar sobre Raspberry Pi, Home Assistant, apps instalados, repositórios da loja, ARM64 ou homologação, consulte o [inventário operacional central](https://github.com/mmcromero/hassio-addons/blob/main/docs/HOME-ASSISTANT-RASPBERRY-INVENTARIO-CENTRAL.md). Não copie a lista de apps para outros projetos; confirme no Supervisor apenas dados voláteis ou decisões críticas. Essa referência não autoriza remover, reiniciar, atualizar ou instalar apps.


Repositório de distribuição de complementos do Home Assistant.
URL mantida: https://github.com/mmcromero/fabricacao-e-orcamentos-ha

**Produto ativo: Artesão Digital — Testes.** Versão experimental publicada: **0.2.0-dev.13 (aarch64)**.
Preparada para atualização da 0.1.17, ainda sem homologação no Pi real.
Não desinstale o aplicativo existente nem crie outra instalação para atualizá-lo.
Identidade preservada: `f6379561_artesaos_piloto`; pasta `apps/artesaos-piloto`.

**Fabricação e Orçamentos — Validação** é legado/descontinuado, sem previsão de
manutenção evolutiva. Seu complemento continua preservado, com seus dados próprios.
Esta mudança de identidade não remove aplicativos nem transfere dados.

As fontes de desenvolvimento ficam na branch codex/artesao-digital-evolucao de
https://github.com/mmcromero/fabricacao_e_orcamentos . Os manuais atualizados e os
recibos C3 acompanham a preparação dessa versão. O pacote Debian é independente;
este repositório e este procedimento tratam da distribuição Home Assistant.

[Atualização no Raspberry Pi](apps/artesaos-piloto/manuals/C3-RASPBERRY-PI-ATUALIZACAO.md) · [Backup e recuperação](apps/artesaos-piloto/manuals/C3-RASPBERRY-BACKUP.md)

Publicação não autoriza atualização real. Não faça downgrade sobre banco migrado.

## Evolução 0.2.0-dev.13

Suporte corrigido, documentos/aceites dinâmicos, Pix voluntário, visitantes por sessão,
manual PDF versionado e classificação/captação de clientes.
[Administração de documentos, Pix e manual](apps/artesaos-piloto/manuals/ADMINISTRACAO-DINAMICA.md).
[Validação e limites desta versão](apps/artesaos-piloto/PUBLICACAO-0.2.0-dev.13.md).

## Estabilização e convites

Pix com telefone BR, confirmação/erro local e persistência; rodapé simplificado;
interessados convertidos em convites rastreáveis sem duplicação.
[Instruções desta versão](apps/artesaos-piloto/manuals/ESTABILIZACAO-CONVITES.md).


## Padrão para revisão de interfaces

Consulte [UX-STD-001 v0.1 — Organização de telas com prioridade para celular](docs/ux/UX-STD-001_v0.1.md) antes de criar ou revisar telas. A referência reúne agrupamento por tarefa, abas, detalhes sob demanda e critérios de aceite. O [AGENTS.md](AGENTS.md) registra sua aplicação ao escopo de interfaces. Disponibilidade documental não comprova aplicação às telas existentes.
