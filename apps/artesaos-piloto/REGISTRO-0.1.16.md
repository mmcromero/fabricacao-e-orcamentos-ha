# Registro de decisões — pacote experimental 0.1.16

O responsável pediu preparar as mudanças sem fechar o pacote, salvar o desenvolvimento e informar estimativa antes do fechamento. Depois autorizou expressamente **fechar e publicar**. Estimativa informada: 10 a 20 minutos. A autorização vale para este pacote; não promove outras ideias futuras.

## Escopo confirmado

1. Terceira aba administrativa Usuários cadastrados, preservando as duas existentes: Interessados no piloto e Chamados de suporte. Consulta das contas efetivamente ativadas, total, situação do acesso e Exibir dados cadastrais.
2. Controle de convites em uma quarta aba Convites. Nome, e-mail, WhatsApp e seleção de canal; contato obrigatório somente para o canal escolhido. Salvar gera código e mensagem automaticamente. Não há status ou confirmação manual de envio na interface.
3. Novos códigos vinculados à primeira conta Google verificada que os usar, independentemente do contato. Uso único e 24 horas preservados. Convites antigos mantêm o vínculo anterior por e-mail.
4. Convites aceitos saem da lista padrão e a conta aparece em Usuários cadastrados. O responsável confirmou que não se referia ao cadastro comercial de Clientes. Contatos de origem aparecem separados da identificação da empresa em Exibir dados.
5. WhatsApp abre a conversa com código/texto pronto; não integra API comercial. E-mail manual disponível; SMTP opcional preparado, sem provedor/credenciais reais configurados nesta sessão. O login Google não concede envio de e-mail.
6. Manutenção: principal independente pode ser parado e futuramente desinstalado após preservar seus dados. Nginx continua necessário à rota atual do piloto. Procedimento em MANUTENCAO.md.

## Incidente de acesso e recuperação

O usuário relatou `{"error":"Acesso permitido somente pelo Ingress."}`. A mensagem é emitida pelo adaptador do principal. Os logs do contêiner f6379561-artesaos-piloto mostraram servidor iniciado e IP mudando de 172.30.33.18 para .17 e .16.

O responsável confirmou que **reiniciar o NGINX Home Assistant SSL proxy restabeleceu o acesso**. O resultado é compatível com resolução antiga de hostname no proxy_pass estático, atingindo o IP anterior. A causa exata não foi comprovada por inspeção/captura da configuração real. Não foi removida a proteção do principal nem aplicado endereço DNS presumido.

## Dados e validação

Nome, telefone e código recuperável de novos convites são cifrados; hash continua usado para autenticação. Banco e chave pilot-invitations.key precisam da mesma cópia protegida. O limite de cinco contas e as permissões administrativas permanecem. Não há configuração real de backup existente segundo o responsável.

Validação consolidada em VALIDACAO-0.1.16.md. Inclui compilação, 57 testes, navegador com provedor controlado, migração real a partir do código 0.1.15 e restauração anterior, imagem/contêiner de produção com dados fictícios e reinício. Não comprova Google, SMTP, WhatsApp nativo, Supervisor ou hardware final reais.

O aplicativo principal, a base incorporada 0.1.23, dados e configurações pessoais foram preservados. Textos jurídicos definitivos continuam desativados. Detalhes em CONVITES.md; a entrega é experimental, não primeiro release estável.
