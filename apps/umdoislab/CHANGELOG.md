# Histórico

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
