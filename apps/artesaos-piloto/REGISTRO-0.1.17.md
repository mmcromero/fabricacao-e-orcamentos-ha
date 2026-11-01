# Decisões e autorização — pacote experimental 0.1.17

Depois da publicação 0.1.16, o responsável solicitou centralizar todo o gerenciamento de convites na administração, retirar os cinco pares e-mail/código das opções e remover a trava fixa de cinco contas. Autorizou implementar, fechar e publicar o próximo pacote sem nova confirmação. Estimativa informada: 20 a 35 minutos.

Acrescentou a remoção do prazo de validade dos convites para evitar reenvios após 24 horas. Foi explicado que um código ainda ativo pode ser usado no futuro por quem o obtiver; o responsável confirmou a decisão com revogação administrativa. Pediu também Ativar novamente e aprovou gerar um código novo nessa ação, mantendo o anterior inválido e preparando nova mensagem.

Escopo fechado: administração como origem de convites, sem teto fixo de cinco, sem vencimento automático nos novos/atuais ativos, revogação e reativação com rotação de código, preservação de usuários/dados/contatos e busca/paginação para crescer. Expirados ou revogados anteriores não são reativados automaticamente. As restrições de audiência do Google e recursos do hardware continuam independentes.

Foi necessário limitar as instâncias/bancos comerciais abertos simultaneamente, com reabertura sob demanda, para não manter um banco/aplicação em memória por toda conta que já tenha entrado. Isso não limita o total de cadastros; ocupação simultânea pode gerar resposta temporária de tentativa posterior.

Nenhuma infraestrutura pessoal foi alterada. Não foram configurados SMTP real, API WhatsApp, Google, Nginx ou backup nesta sessão. Preserva base 0.1.23 e aplicativo principal. O pacote permanece experimental, com textos jurídicos definitivos desativados. Validações em VALIDACAO-0.1.17.md.
