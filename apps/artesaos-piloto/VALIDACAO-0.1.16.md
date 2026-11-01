# Validação — 0.1.16 experimental

Data no fuso do responsável: 31/10/2026. Desenvolvimento derivado da 0.1.15; base incorporada preservada em Fabricação e Orçamentos 0.1.23 / f56f0e5707ad81f74f42c351171d4132f793cf9a. Não incorpora nova base nem altera a distribuição do principal.

## Evidências locais

- `npm run build`: compilação TypeScript cliente/servidor, Vite e metadados 0.1.16/base 0.1.23 aprovados.
- `npm test`: **57 testes aprovados**, sem falhas. Sete novos testes desde 0.1.15 cobrem usuários administrativos e seis cenários de convites: idempotência/cifra/primeiro Google/saída da lista, permissões/legados/vagas, SMTP opcional/duplicação/falhas, WhatsApp sem e-mail/vagas distintas, configuração TLS/chave/reinício e adaptador SMTP com transporte controlado.
- `python3 scripts/verify-pilot-browser.py`: Chromium, HTTPS e provedor Google fictício. Quatro abas na ordem definida, usuários e detalhes em celular, Salvar com código automático, mensagem para e-mail e WhatsApp, ausência de confirmação manual, conta Google diferente do contato, convite aceito removido e conta listada em Usuários cadastrados. Contato de origem aparece em Exibir dados mesmo antes de preencher a empresa. Fluxos anteriores de produtos/configurações/suporte/admin/login/logout/isolamento/PDF continuam aprovados.
- `python3 scripts/verify-pilot-browser.py --legal`: mesmos fluxos, com documentos fictícios ativados apenas na fixture descartável. Aceite precede boas-vindas/uso; documentos definitivos seguem desativados na distribuição.
- `node --import tsx scripts/verify-pilot-invitation-upgrade.mjs`: cria o volume pelo código publicado 0.1.15 (e4760f1), migra para a atual, preserva sessão/empresa/convite legado vinculado ao e-mail, ativa convite novo com outra conta Google, recupera código cifrado após reinício e restaura a cópia completa parada com o código original 0.1.15.
- `node --import tsx scripts/verify-pilot-documents-upgrade.mjs`: ensaio anterior 0.1.14→atual também aprovado, com dados textuais do orçamento preservados e restauração completa. As fixtures não são backup da instalação pessoal.
- Imagem de produção construída em amd64 pelo Dockerfile do piloto, com Node 24.19.0, dependências de produção e fontes incluídas. `python3 scripts/verify-pilot-container.py --image artesao-digital:0.1.16-validation` confirmou inicialização independente do principal, login/legal públicos, APIs protegidas, usuários/convites administrativos, código gerado/cifrado persistido após reinício e geração de PDF pelo JavaScript compilado/fontes embarcadas (14.392 bytes na fixture).

O teste do contêiner usa porta de host aleatória e volta a consultá-la após reinício: o Docker local pode mudar esse mapeamento. O primeiro ensaio apontou falha no endereço antigo; com atualização do endereço de teste, a persistência e o reinício passaram. Não houve perda de dados do aplicativo nem mudança para contornar autenticação.

## SMTP e WhatsApp

Nenhum e-mail nem WhatsApp real foi enviado. SMTP foi exercitado com interface/transporte controlados, incluindo TLS obrigatório, portas 465/587, remetente, texto/código, bloqueio de leitura de arquivos/URLs, deduplicação e falha sem vazamento de erro do provedor. Sem configuração completa, SMTP fica desativado. Ainda é necessário configurar credenciais no servidor e validar com o provedor escolhido.

WhatsApp foi conferido como link wa.me com telefone correto, texto/código preenchidos. Não foi acionado envio real nem testado o aplicativo nativo em telefone físico. Não há API WhatsApp Business.

## Migração, backup e segurança

Adiciona binding_mode e accepted_user_id ao controle de convites e tabelas de metadados/idempotência técnica de e-mail, além de pilot-invitations.key. A regra antiga por e-mail permanece nos convites existentes; somente novos convites administrativos permitem a primeira conta Google. Aceite e conta são gravados atomicamente, e o código usado não ativa outra conta.

Nome, telefone e código recuperável são cifrados com AES-256-GCM e chave local restrita. E-mails permanecem no controle existente. Não há exportação pública de códigos, e os detalhes cadastrais do usuário não incluem o código. Chave e banco no mesmo volume não protegem contra comprometimento de ambos.

Antes da atualização real, produzir cópia completa/protegida com o aplicativo parado, incluindo banco/chaves/opções. Ainda não existe rotina de backup configurada na instalação. Para reverter, restaurar a cópia completa com o código correspondente; não executar apenas binário antigo sobre banco atualizado.

`npm audit --omit=dev`: **3 alertas moderados**, nenhum alto/crítico; cadeia @fastify/static → glob/minimatch, já observada na versão anterior e sem correção disponível indicada pelo npm. Nodemailer 10.3.1 foi acrescentado para SMTP opcional. Reavaliar a cadeia antes de ampliar o piloto; não declarar certificação de segurança.

## Operação e pendências reais

O responsável confirmou que reiniciar o Nginx restaurou o acesso após a mensagem de Ingress e mudança de IP interno. Isso apoia a hipótese de resolução antiga no proxy; não houve inspeção direta da rede pessoal. Não remover a proteção do principal nem alterar automaticamente o resolvedor. Orientação em MANUTENCAO.md.

Google real, Home Assistant/Supervisor, ARM, celular físico, SMTP/provedor efetivo, backup/recuperação da instalação e recursos do servidor continuam pendentes de validação. A revisão jurídica/operacional, retenção/descarte, direitos/exportação/saída, incidentes e inventário de fornecedores continuam pendentes. Textos definitivos não foram ativados. Não é release estável.
