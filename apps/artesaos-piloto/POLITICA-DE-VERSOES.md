# Regra de atualização e rastreabilidade do piloto

Sempre que for solicitado compilar um novo pacote do Artesãos — Piloto incorporando modificações do Fabricação e Orçamentos:

1. Identificar a versão/commit do principal autorizados pelo usuário. Publicação de uma nova versão do principal, por si só, não autoriza promoção automática.
2. Incorporar o código desse commit à branch do piloto, preservando autenticação, convites, isolamento, adaptador de execução e volume próprios. Não copiar banco, opções pessoais, credenciais ou dados comerciais.
3. Atualizar conscientemente `pilot/core-base.json` com versão e commit exatos. O commit deve fazer parte da história incorporada e sua versão de pacote deve corresponder à referência. O exportador verifica essas condições.
4. Incrementar a versão independente do piloto em `pilot/config.yaml`. As duas versões são diferentes e nunca devem ser confundidas.
5. Gerar metadados durante a compilação. A única origem dos valores do rodapé é o manifesto do piloto, o pacote-base e a referência incorporada. Não escrever versões manualmente em HTML ou usar a última versão remota como rótulo de código ainda não incorporado.
6. O build produz `pilot-build.json`, incluído na imagem em `/app/pilot-build.json`, e um módulo compilado com os mesmos valores. O arquivo contém versão do piloto, versão-base e commit-base, sem segredos. O rodapé exibe as duas versões; o hash fica para rastreabilidade técnica.
7. Executar build/testes e verificar primeiro login e novo login sem convite com redirecionamento automático e aplicação visível, incluindo proxy e isolamento entre contas. Depois de mudanças do núcleo, verificar também os fluxos afetados.
8. Exportar/publicar somente o aplicativo do piloto. Preservar arquivos do aplicativo principal e documentar a versão-base realmente usada, os testes e o que ainda depende da instalação real. Atualização no Home Assistant continua manual.

A compilação/exportação deve falhar se versões ou referência estiverem inconsistentes. Nenhum pacote deve declarar uma base que ainda não foi incorporada.
