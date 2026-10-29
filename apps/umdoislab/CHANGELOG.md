# Histórico

## 0.1.17

- Liga Fabricação ao mesmo cadastro de Produtos, sem lista independente.
- Separa parâmetros de Configuração e despesas de Operação; calcula custo por hora sem arredondamento antecipado.
- Adiciona formulário de produção com duração em horas/minutos/segundos acima de 24h, material, extras, embalagem e etiqueta.
- Mostra custo sem lucro e três preços calculados; aplicação ao catálogo exige revisão e opção explícita.
- Preserva fabricação ao editar o cadastro básico e protege revisão do produto e dos parâmetros.
- Permite etapa adicional para fórmulas de produtos compostos; não carrega dados comerciais automaticamente.
- Valida o motor contra resultados da planilha fornecida, sem publicar o arquivo ou valores comerciais.

## 0.1.16

- Mostra peso e volume conhecidos dos produtos no orçamento, considerando quantidades.
- Considera pesos informados de embalagens individuais, caixa e proteção, sem alterar preços.
- Salva peso e dimensões reais do pacote separadamente, com pendências para dados ausentes.
- Não deduz dimensões externas por soma de volumes e não consulta frete automaticamente.
- Mantém pacote opcional, bloqueio de finalizados e reabertura de orçamentos anteriores.
- Normaliza privacidade de produtos de cliente anteriores sem alterar seus preços.

## 0.1.15

- Cadastra e edita categorias persistentes com hierarquia, preservando produtos e preços na migração.
- Reserva Produtos de cliente à origem de cliente e usa dropdown nos formulários reais de produtos.
- Transfere a carga piloto para Configurações de Produtos → Importar dados.
- Reconhece JSON preparado e CSV WooCommerce; o CSV importa somente categorias, sempre com prévia e confirmação.
- Impede possíveis duplicatas de produtos por nome/SKU quando os vínculos externos diferem.
- Mantém complementação somente de campos vazios e preserva preços e registros arquivados.
- Informa que a importação de clientes aguarda amostra; não presume o formato do site.

## 0.1.14

- Padroniza listas compactas com Editar à direita e lápis acessível em telas estreitas.
- Busca clientes por empresa/contato e produtos por nome/SKU, priorizando código exato e combinando filtros.
- Pagina Clientes e Produtos; salva a preferência separada por área, com 10, 20, 30, 40, 50 ou Todos nas Configurações.
- Preserva preferências anteriores e cadastros; não altera preços nem orçamentos.
- Adiciona fechamento × acessível aos modais e corrige retorno do foco e descarte de cadastros sem alterações.
- Preserva bloqueio de finalizados/enviados e fechamento independente dos modais secundários.

## 0.1.13

- Mostra a lista de orçamentos separada do formulário e abre criação/edição em modal amplo, sem recarregar a página.
- Mantém cabeçalho/ações visíveis, preserva posição/filtro/página ao fechar e confirma descarte de alterações.
- Pagina a lista no servidor, com 10 por página como padrão e configuração de 10, 15, 20 ou Todos.
- Carrega o orçamento completo apenas ao abrir; mantém busca por título, cliente e número, inclusive com acentos.
- Para produtos de cliente, recolhe Loja de fábrica e Varejo no cadastro rápido sem apagar preços preenchidos.
- Determina automaticamente a categoria Produtos de cliente e oculta seu campo no cadastro/edição.
- Permite categoria em branco para próprios, sinalizando Categoria pendente e oferecendo filtros por origem e pendência.
- Normaliza categorias de cliente anteriores sem modificar preços; preserva cadastros e orçamentos na migração.
- Mantém a replicação da nova navegação nas outras áreas para depois da aprovação em Orçamentos.


- Oculta Selecionar cliente e Novo cliente quando há cliente selecionado no orçamento.
- Adiciona Trocar cliente para limpar somente a seleção atual e reabrir as opções de seleção/cadastro.
- Preserva produtos, quantidades, preços, embalagens, entrega e observações ao trocar cliente.
- Volta ao cartão de consulta após selecionar/cadastrar e gerencia foco por teclado.
- Mantém o bloqueio de troca em orçamentos finalizados/enviados até reabrir como rascunho.


## 0.1.12

- Adiciona situações Rascunho, Finalizado e Enviado, com marcação manual do envio do orçamento.
- Exige cliente, itens válidos, preços/quantidades/embalagens definidos e modalidade de entrega para finalizar.
- Permite transportadora com serviço e valor informados, retirada no local ou entrega por cortesia sem cobrança.
- Soma o frete informado ao total e mantém frete indefinido como pendência, sem assumir zero.
- Protege finalizados/enviados contra edição direta e permite reabrir como rascunho preservando versões anteriores no banco.


- Permite informar e editar título do orçamento e pesquisar a lista por título, cliente ou número.

- Troca a lista expansível do catálogo por painel suspenso sobre a página.
- Mantém filtro no topo, rolagem interna com altura limitada e confirmação no rodapé.
- Preserva seleção múltipla e preços ao filtrar ou fechar; só adiciona após confirmação.
- Fecha por Escape, clique externo e saída do foco, com retorno ao botão quando solicitado.
- Ajusta posição e largura para caber na tela sem expandir o formulário.
- Mantém Arquivar desativado em Clientes e Produtos até existir consulta/reativação dos arquivados.
- Valida o seletor no Chromium com cem produtos fictícios, inclusive largura móvel.


## 0.1.11

- Renomeia o campo para Nome da empresa e aceita empresa ou contato: ao menos um deve ser preenchido.
- Usa o contato na lista e no orçamento quando a empresa não estiver informada.
- Adiciona rua/logradouro, número, complemento, bairro, cidade e estado ao cadastro e ao modal do orçamento.
- Preserva endereço completo no snapshot do orçamento, inclusive para clientes sem empresa.
- Adiciona consulta opcional ao ViaCEP no navegador; mantém preenchimento manual e não envia nome, documento ou telefone.
- Consulta não altera número/complemento, não aplica respostas antigas e preserva campos editados durante a espera.
- Mantém compatibilidade com cadastros e rascunhos anteriores sem campos de endereço.


## 0.1.10

- Importa SKU e URL HTTPS da foto principal, exibindo-os no catálogo e no cadastro.
- Permite completar apenas SKU, descrição e foto vazios em produtos existentes, sem duplicar ou substituir preços e campos preenchidos.
- Separa informações do site em seção recolhível; autorizar divulgação abre os campos sem publicar nada.
- Adiciona clientes persistentes, com cadastro/edição em modal, consulta e arquivamento.
- Adiciona Orçamentos persistentes: cliente real, catálogo real, novo produto em modal, quantidade e embalagem por item, seleção de preço e rascunhos retomáveis.
- Usa automaticamente o único preço disponível; exige escolha quando há mais de um.
- Guarda snapshots de cliente, produtos e preços; mudanças no cadastro não reescrevem o orçamento salvo.
- Protege rascunhos e configurações contra sobrescrita de versões desatualizadas.
- Mostra quatro áreas na ordem Fabricação, Orçamentos, Clientes e Produtos, com Configurações próprias.
- Salva CEP de origem e anotações de planejamento da fabricação. Configurações específicas não definidas ficam sem opções inventadas.
- Fabricação, frete e envio permanecem pendentes. A demonstração antiga continua separada do fluxo real.


## 0.1.9

- Substitui Família por Categoria opcional no formulário de Produtos.
- Mantém os vínculos de família internos e os cadastros existentes.
- Preenche Categoria na preparação da carga piloto.
- Não altera produtos já importados nem sobrescreve suas edições ao repetir a carga.


## 0.1.8

- Adiciona área Produtos com SQLite: cadastro, edição e arquivamento.
- Exige nome, origem e pelo menos um dos preços: atacado, loja de fábrica ou varejo.
- Adiciona conferência e confirmação de importação JSON com transação e controle de duplicação por vínculo externo.
- Preserva preços editados e vínculos de produtos arquivados ao repetir a carga.
- Inclui preparador CSV para carga piloto, com separação de tamanhos e agrupamento compatível de cores.
- Não inclui dados comerciais na distribuição nem publica produtos no site.
- O wireframe do orçamento continua temporário e separado do catálogo persistente.


## 0.1.7

- Reorganiza a seleção como dropdown que abre com a lista completa e filtro opcional no topo.
- Mantém seleção múltipla e confirmação explícita para produtos existentes.
- Exige origem Próprio ou De cliente antes de cadastrar ou incluir produtos no orçamento.
- Remove A definir como opção válida de origem, sem escolher uma categoria automaticamente.
- Destaca e mostra o item recém-criado ao concluir Novo produto, com catálogo opcional e sem segunda seleção.
- Testa lista/filtro, Escape, confirmação, origem obrigatória e inclusão direta com e sem catálogo.

## 0.1.6

- Substitui inclusão imediata pelo seletor por busca, seleção múltipla e botão Adicionar selecionados.
- Mantém a lista oculta enquanto o catálogo simulado está vazio.
- Permite modificar a quantidade diretamente em cada item, sem abrir o cadastro do produto.
- Recalcula produtos e embalagens individuais ao alterar a quantidade, preservando o catálogo.
- Quantidades inválidas ficam sinalizadas como pendentes e não geram valores incorretos.
- Amplia o teste de navegador para seleção múltipla, busca e alterações de quantidade.

## 0.1.5

- Adiciona seleção de clientes existentes e cadastro em modal sem sair do orçamento.
- Ao salvar cliente, inclui na lista simulada e seleciona automaticamente no pedido.
- Exibe dados do cliente somente para consulta, com edição em ação separada.
- Preserva produtos, embalagens e observações ao cadastrar, editar ou trocar cliente.
- Valida nome/e-mail no modal, preservando os campos; confirma descarte de alterações.
- A lista continua temporária, sem gravação no banco ou validação fiscal.

## 0.1.4

- Produto de cliente sempre privado; opções de divulgação aparecem apenas para produto próprio.
- Trocar origem remove uma autorização anterior de divulgação.
- Embalagem individual passa para o item do orçamento, sem alterar o produto no catálogo.
- Permite informar tipo e acréscimo por unidade ou indicar que a embalagem já está incluída no preço.
- Mostra subtotais separados de produtos e embalagens; transporte permanece pendente.
- Separa cliente/empresa, contato, telefone, e-mail e CPF/CNPJ; documento pode ficar pendente no orçamento.
- Reforça a distinção entre embalagem individual e embalagem de transporte obrigatória para preparar frete.
- Mantém os dados do wireframe apenas em memória, sem alterar o banco.

## 0.1.3

- Adiciona wireframe navegável do cadastro de produto em modal dentro do orçamento.
- Preserva cliente, CEP e observações ao abrir/fechar o cadastro.
- Demonstra uso só no orçamento ou também no catálogo, em memória desta página.
- Separa origem (próprio/de cliente) e autorização de divulgação; privado por padrão.
- Exibe preço de venda informado, medidas da peça e pendências sem calcular fabricação ou consultar frete.
- Inclui verificação do fluxo em Chromium, desktop e celular.
- O wireframe não usa banco nem salva produtos reais; a anotação de teste permanece intacta.

## 0.1.2

- Separa o controle por Ingress do servidor de aplicação.
- Adiciona modo independente local, com endereço de loopback obrigatório.
- Permite configurar porta e armazenamento sem mudar o banco ou seu esquema.
- Resolve arquivos estáticos independentemente do diretório de execução.
- Documenta backup, restauração e preparação do repositório Home Assistant.
- Solicita backup frio no Supervisor para manter o SQLite consistente.
- Adiciona testes de processo, persistência, restauração e caminhos com prefixo.

## 0.1.1

- Renomeia a interface e o painel para Fabricação e Orçamentos.
- Mantém o identificador interno para atualização da instalação local existente.

## 0.1.0

- Primeira aplicação de validação: React, API e anotação persistida em SQLite.
