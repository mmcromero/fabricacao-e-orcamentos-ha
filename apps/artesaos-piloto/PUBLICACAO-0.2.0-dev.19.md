# dev.19 — Home Assistant autorizado como complemento da distribuição Debian

UX-FEEDBACK-001 + UX-LEGAL-001. Fonte 9cc36e95bb73019e7b6a97b7277fcc0c142c47f9.
A publicação inicial dev.19 foi somente Debian; depois o proprietário autorizou
expressamente preparar e publicar também o Home Assistant, que continua ativo como
contingência manual. Isso não autoriza instalar automaticamente no Raspberry Pi.

Build ARM64 da fonte e do add-on final aprovados; runtime, versão, labels, schemas,
ícones e checksums verificados. Reutilizados249 testes aprovados da mesma revisão
(223 app+8 helper+18 operações) e Chromium sintético desktop/mobile. Sem novo código
comercial, alteração de autenticação, dados, opções, portas ou /data. Slug preservado.
Apenas a versão muda no config.yaml em relação à dev.18. Sem sincronização de dados.

Na loja de apps/add-ons do Home Assistant, verificar atualizações/recarregar a loja
na mesma origem de repositório; selecionar Artesão Digital — Contingência dev.19.
Instalação/atualização é manual, não foi executada pelo Codex. Não remover/reinstalar
o add-on, não trocar slug/origem ou apagar /data. Backup recomendado conforme Nível1.
Rollback exige código/runtime anterior compatível e procedimento manual coordenado;
não restaurar nem apagar banco automaticamente. Execução Pi/Supervisor, Google real
e Android/PWA físicos não homologados por build ou publicação. Se houver erro502,
conferir estado/hostname da aplicação e logs do proxy conforme manuais existentes.
Runtime.tar.gz é componente da distribuição completa: não instalar isoladamente.
