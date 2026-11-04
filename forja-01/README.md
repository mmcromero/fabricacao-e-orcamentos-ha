# dev.21 — OFF-01, consulta offline Produtos; Nível1

[Baixar ZIP dev.21](https://raw.githubusercontent.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/Forja-01-0.2.0-dev.21.zip)
· [Checksums](SHA256SUMS) · [Índice atual](publicacao-atual.json).

Fonte fe593b495e278cce3226439960561e6b582330a6. Preparação completa online de Produtos e fotos internas, consulta
somente leitura após reabrir a PWA sem rede. Preserva gerações anteriores em falhas.
Logout bloqueia sem apagar; mesma conta online recupera a cópia. Sem vendas/sync offline.
Conservar DATA_DIR inteiro, inclusive .offline-key, bancos e fotos. Sem schema novo.
Nível1: backup recomendado, sem nova certificação obrigatória. Browser/SO podem limpar
armazenamento local; sem garantia de conservação indefinida.

Kit existente: Baixar-Pacote.cmd → Verificar-Download.cmd opcional → Atualizar-Forja-01.cmd
somente após autorização separada. Publicação não instala nem reinicia servidores.
Rollback pelo mecanismo existente, preservando volumes. Código dev.20 não oferece
consulta offline e seu worker pode limpar assets públicos; não limpar IndexedDB/perfil.
256 testes automatizados e testes Chromium sintéticos aprovados; Android/Pi físicos pendentes.
