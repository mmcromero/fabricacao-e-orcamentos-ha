# dev.20 — IMG-PROD-001

Fonte8e00241e47fcfb965bda6a7804a3d8abcf122a88. Fotos internas por arquivo em produtos
(incluindo formulário compartilhado) e consignados. Novas URLs externas recusadas;
legado do próprio registro preservado. PNG/JPEG/WebP até8MiB/24MP preparados no
navegador, PNG até1024px/lado/500KiB validado no servidor. Sem dependências novas.

Dados privados em /data/tenants/<tenant>/product-photos, incluindo .owner e PNGs por
hash. Conservar junto aos bancos; não ficam na imagem. Nenhum arquivo anterior é
apagado ao substituir. Sem migração, cache comercial ou sincronização offline.
Build+227app+8helper+18operações e Chromium1280/390 aprovados; ARM64 e imagem final
construídos, versão/runtime/labels/checksums verificados. Não é teste físico no Pi.

Atualização manual na mesma origem/slug pela loja de apps/add-ons; não desinstalar
ou recriar volume. Nível1, backup recomendado. Nenhuma instalação automática.
Rollbackdev.19 preserva dados mas não entende referências internas novas: fotos
não aparecem e edição pode falhar. Não apagar/converter arquivos/registros para
contornar. Coordenar retorno/correção com infraestrutura. Ver manuals/ATUALIZACOES.md.
Homologar fotos reais Android/PWA, login, qualidade visual e persistência após
reinício autorizado. Sem acesso ao Forja/HA/Google reais pelo Codex nesta publicação.
