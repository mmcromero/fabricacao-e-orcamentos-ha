# 0.1.14

- Acrescenta link fixo de Suporte técnico no rodapé autenticado, com formulário de abertura de chamado para dúvida de uso ou relato de erro. O suporte também fica disponível durante as boas-vindas.
- Inclui a aba Meus chamados nas configurações, com histórico da própria conta, filtros, paginação, mensagens e acompanhamento de status.
- Acrescenta Central de suporte na administração, com consulta de todas as contas, resposta e mudança de status: Em aberto, Em análise, Respondido, Aguardando resposta do cliente e Finalizado.
- Mantém o histórico das mensagens e mudanças de status; a resposta do usuário retorna o chamado a Em aberto e permite reabrir um chamado finalizado.
- Protege acesso por conta e permissão administrativa, sessão, contexto da aba e CSRF. Inclui revisão para alterações concorrentes, limites de envio e chaves de reenvio para evitar duplicações em falhas de rede.
- Armazena chamados no volume do piloto, sem envio automático de e-mail nem coleta automática de arquivos ou registros comerciais. Preserva a base 0.1.23.

# 0.1.13

- Oculta a opção de catálogo para produtos de cliente, limpa a marcação ao mudar a origem e corrige os registros antigos. O servidor também impede a inclusão por edição, importação ou ação em lote.
- Mantém custos e precificação sempre expostos nas configurações gerais. Multiplicadores vazios, inválidos ou abaixo do mínimo são corrigidos e persistidos: atacado 1,5; loja de fábrica 2,0; varejo 3,0. Valores acima do máximo continuam exigindo revisão explícita.
- Acrescenta boas-vindas obrigatórias, com checklist e retomada em próximos logins até a conclusão. Exige empresa/responsável/telefone/e-mail, ao menos um material válido, uma tarifa horária positiva, horas produtivas mensais positivas e uma despesa operacional positiva. Tarifas horárias não utilizadas recebem zero.
- Bloqueia operações comerciais no servidor enquanto a configuração inicial não estiver concluída, preservando acesso aos cadastros necessários e à saída da sessão. A conclusão fica registrada no banco individual de cada conta.
- Rateia despesas pelo tempo humano quando o tempo de máquina da etapa é zero, conforme solicitado. Quando há máquina, utiliza somente esse tempo para o rateio; tarifas de trabalho humano continuam somadas normalmente. Preços comerciais e orçamentos anteriores não são substituídos automaticamente.
- Preserva a base 0.1.23 e o comportamento do aplicativo principal.

# 0.1.12

- Reorganiza o menu em Produtos, Clientes, Orçamentos e Configurações, com ícones. A faixa de navegação ocupa a largura abaixo do cabeçalho verde e usa botão hambúrguer para abrir/fechar os itens no celular, com suporte a Escape e teclado.
- Define Produtos como entrada após primeiro login, novo login e acesso à raiz. A antiga página de Fabricação deixa de existir no piloto; links antigos abrem Produtos, cujo formulário mantém os dados de fabricação e preços calculados.
- Reúne configurações em uma página: dados da empresa e parâmetros comuns nas configurações gerais, fora das abas Produtos, Clientes e Orçamentos. As abas preservam o preenchimento ao alternar e aceitam navegação por teclado.
- Acrescenta cadastro opcional de empresa, responsável, telefone e e-mail por conta, com validação, persistência e proteção contra sobrescrita por outra janela. Não inclui estes dados na tela nem em arquivos de orçamento.
- Registra o uso futuro dos dados da empresa somente no documento final do orçamento em Ideias Futuras, sem execução automática.
- Mantém a base 0.1.23 e os dados existentes. O novo cadastro cria apenas uma tabela adicional no banco individual do piloto.

# 0.1.11

- Atualiza o aviso no login para orientar a manter uma cópia das informações e informar que o ambiente está em construção e pode apresentar instabilidades.

# 0.1.10

- Prioriza a apresentação do piloto gratuito por convite e o formulário de interesse na entrada; separa o login em uma seção própria abaixo, acessível pelo link “já tenho um convite/login”.
- Integra a navegação das áreas ao cabeçalho fixo, em uma única linha. Em telas estreitas, o menu tem rolagem horizontal e mantém o item atual acessível; o e-mail fica oculto para reservar espaço à navegação e ao botão Sair.
- Ajusta o espaço do conteúdo à altura real do cabeçalho e preserva autenticação, isolamento e a base 0.1.23.

# 0.1.9

- Aplica a identidade visual em todas as áreas do piloto, incluindo login, conclusão de acesso, administração, formulários e diálogos: Georgia nos títulos, Arial no conteúdo, fundo Linho e Verde Mata nos elementos principais.
- Usa a logo principal colorida nas telas de acesso e a horizontal negativa nos cabeçalhos autenticados, com proporção, espaço livre, contraste e alternativa textual preservados.
- Inclui as variantes e guias na exportação e prepara as duas logos no build. Preserva a base 0.1.23, autenticação e dados por usuário.
- Validação: compilação, 41 testes automatizados e navegador com provedor controlado, contas isoladas e telas estreitas. Google e instalação reais continuam dependentes de validação no ambiente final.

# 0.1.8

- Incorpora a base Fabricação e Orçamentos 0.1.23, preservando adaptações do Artesão Digital e atualizando versão/commit-base dos metadados.

- Alinha a logo do cabeçalho das áreas de usuário à margem do conteúdo e posiciona o e-mail à direita, antes de Sair.

- Centraliza a logo na tela de login sem alterar o alinhamento dos campos ou a posição da marca no cabeçalho autenticado.
- Preserva imagem original, proporção e alternativa textual quando a logo não carrega.

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
