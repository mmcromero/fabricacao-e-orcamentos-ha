# Publicação 0.2.0-dev.23 — PIX-QR-PDV-001
- Data (UTC): 2026-11-09T17:28:33Z
- Origem: mmcromero/fabricacao_e_orcamentos, branch task/PIX-QR-PDV-001-publicacao-ha, commit 0d95c81e05cc6f49cf4a2e4866b0034c4217adeb
- Conteúdo: QR Pix com o valor da venda no PDV (tela Vendas).
- Validações do commit de origem: build, testes da aplicação, ferramentas de distribuição e operações, todas aprovadas pelo release-evidence.py.
- Imagem linux/arm64 construída em emulação QEMU no GitHub Actions.
- Limitações: sem execução em Raspberry Pi/Supervisor; QR sem teste em Android nem em bancos reais; dados do recebedor Pix ficam no navegador (localStorage), por aparelho.
- Publicar no Git não comprova instalação. Atualizar só com autorização do proprietário, na mesma origem e slug, preservando /data.
