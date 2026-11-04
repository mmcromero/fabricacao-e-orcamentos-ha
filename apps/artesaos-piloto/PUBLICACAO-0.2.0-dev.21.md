# dev.21 — OFF-01

Fonte fe593b495e278cce3226439960561e6b582330a6. Add-on completo ARM64, nome/slug/portas/opções/autenticação e /data
preservados; sem migrações. Preparação de Produtos/fotos e leitura offline na PWA.
Forja principal; HA contingência manual, sem sincronização entre bancos. Conservar
/data/.offline-key e diretório inteiro de dados/fotos. Não limpar cópias do navegador.
Build ARM64 e runtime/metadados validados; 256 testes e Chromium com dados sintéticos.
Não instalado nem homologado no Raspberry Pi real. Atualização manual pelo Supervisor
somente após autorização própria. Rollback preserva /data; dev.20 não oferece consulta
offline. Não restaurar banco nem excluir volumes para retornar o código.
