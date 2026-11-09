# Publicação 0.2.0-dev.22 — PIX-QR-PDV-001
- Data (UTC): 2026-11-09T03:12:13Z
- Origem: mmcromero/fabricacao_e_orcamentos, branch task/PIX-QR-PDV-001-publicacao-ha, commit dc7cd1e3fc03249359b4ea6c48029aacb3d715a4
- Conteúdo: QR Pix com o valor da venda no PDV (tela Vendas).
- Validações do commit de origem: build, testes da aplicação, ferramentas de distribuição e operações, todas aprovadas pelo release-evidence.py.
- Imagem linux/arm64 construída em emulação QEMU no GitHub Actions.
- Limitações: sem execução em Raspberry Pi/Supervisor; QR sem teste em Android nem em bancos reais; dados do recebedor Pix ficam no navegador (localStorage), por aparelho.
- Publicar no Git não comprova instalação. Atualizar só com autorização do proprietário, na mesma origem e slug, preservando /data.
