# 0.1.7

- Acrescenta aviso de piloto por convite e formulário de interesse com nome/e-mail obrigatórios e WhatsApp opcional; registrar não cria conta nem libera acesso.
- Adiciona login administrativo separado pelo Google e lista explícita `admin_emails`, negando acesso por padrão. Sessões administrativas são separadas e não consomem vagas de usuário.
- Inclui consulta restrita e paginada de interessados, responsiva, com validação de autorização no servidor e proteção contra sessão de outra conta.
- Protege o formulário com validação, origem, token de uso único, limites de tentativas e deduplicação sem revelar contatos existentes.
- Cifra o conteúdo dos contatos novos por AES-256-GCM, com arquivo de chave restrito e retenção de noventa dias. A chave no mesmo volume não protege contra comprometimento de banco e chave juntos; backups e demais bancos ainda exigem proteção própria.
- Inclui a logo original fornecida pelo usuário no cabeçalho, com alternativa textual em caso de ausência/falha e acessibilidade; não implementa upload ou gestão completa de usuários.

# 0.1.6

- Amplia as opções do Home Assistant para cinco pares de e-mail e convite inicial, mantendo compatibilidade com os dois existentes e o limite de cinco contas.
- Carrega os campos 3, 4 e 5 tanto do arquivo de opções quanto das variáveis de ambiente da execução independente.
- Preserva a vinculação por e-mail, uso único, validade, revogação e isolamento dos convites; pares inteiramente vazios são ignorados.
- Orienta a escolha entre OAuth em Teste com e-mails autorizados e publicação no Google antes de liberar os primeiros participantes.

# 0.1.5

- Corrige Sair após expiração ou ausência de sessão: encerra o fluxo e limpa os cookies restantes, sem exigir uma sessão ainda ativa.
- Mantém validação de origem em todas as saídas e exige CSRF/contexto da aba quando a sessão ainda é válida. Uma aba antiga não pode encerrar outra sessão ativa.
- Exibe aviso ao falhar a conexão/saída e permite tentar novamente, sem deixar o botão sem resposta.
- Inclui a correção de cache da 0.1.4 para instalações que ainda estão na 0.1.3. Mantém a base em 0.1.19.
- Confere login, recarga comum, troca de contas, saída com cookies expirados e falha de rede no navegador com Nginx/cache HA simulados. Validação real continua manual.

# 0.1.4

- Corrige tela sem conteúdo após login quando o cache do Home Assistant interfere no carregamento dos módulos da interface.
- Isola o carregamento no caminho do Artesão Digital com um service worker sem cache, sem remover o worker ou os arquivos de cache do Home Assistant. Remove somente entradas antigas do caminho do piloto.
- Aguarda a preparação do navegador antes de entrar com Google e carregar a interface; apresenta mensagem se essa preparação falhar.
- Valida primeiro acesso, novo login, troca de contas no mesmo navegador e preservação do cache externo pelo proxy Nginx. Google real e instalação continuam sujeitos à conferência manual.

# Histórico do Artesão Digital — Testes

## 0.1.3

- Serve os arquivos compilados públicos da interface sem depender do cookie de sessão, evitando redirecionamento de JavaScript para HTML de login e tela vazia.
- Mantém documentos com contexto de usuário e todas as APIs de dados protegidos por sessão; origem, CSRF e isolamento não mudam.
- Acrescenta regressão para JavaScript sem cookie com MIME correto e navegação pelo Nginx com recursos carregados anonimamente.

## 0.1.2

- Adota Artesão Digital como nome visível no aplicativo, telas de login e instalação de testes.
- Abre Orçamentos automaticamente após login e ao acessar o login com sessão válida.
- Mantém as duas versões em rodapé fixo visível, com espaço reservado para não cobrir controles.
- Usa faixa verde fixa no topo, com nome à esquerda, e-mail centralizado e Sair à direita, adaptada a telas estreitas.
- Preserva slug, volume, contas, convites e URL de retorno Google existentes.
- Inclui Abrir interface Web na página do aplicativo do HA, apontando ao login HTTPS pela porta já existente8443.
- Acrescenta testes de rodapé dentro do viewport e marca da implantação nas áreas principais.

## 0.1.1

- Exibe no rodapé a versão do piloto e a versão-base do Fabricação e Orçamentos, obtidas dos metadados de compilação.

- Conclui o login em uma página própria, remove parâmetros OAuth do histórico e confirma a sessão antes de abrir Produtos automaticamente.
- Usa a mesma entrada para primeiro acesso e novo login sem convite, mantendo os dados e as contas já ativadas.
- Mostra orientação explícita quando a sessão não pode ser reconhecida, sem retornar silenciosamente à tela de convite.
- Testa Produtos efetivamente renderizado após login, além da barra da conta, sem abrir links manuais.
- Exercita duas contas, logout/novo login, sessão inicialmente indisponível e sessão ausente através de Nginx HTTPS com backend HTTP, usando provedor controlado.
- Preserva porta externa na rota sem barra final no gerador Nginx.

## 0.1.0

- Primeira versão experimental com Google OpenID Connect, convites individuais, sessões protegidas e banco separado por conta.
- Instalação separada no Home Assistant; uso somente com dados fictícios enquanto a validação e as proteções pendentes não forem concluídas.
