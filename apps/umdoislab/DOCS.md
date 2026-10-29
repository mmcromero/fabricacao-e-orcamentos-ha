# Uso — 0.1.10

## Orçamentos

A tela inicial é o fluxo persistente. Clique em Novo orçamento. Selecione um
cliente ou use Novo cliente em modal: o cadastro será salvo na lista real e
selecionado no pedido, sem sair da página. CPF/CNPJ e CEP podem ficar pendentes;
validação fiscal, endereço completo de envio e frete ainda não existem.

Abra Selecionar produtos do catálogo para percorrer a lista, filtrar e selecionar
vários produtos. Só entram ao confirmar Adicionar selecionados. Um único preço
cadastrado é escolhido automaticamente; havendo vários, escolha a modalidade
por produto antes da inclusão. Preços são de venda, informados; não há fórmulas do
Excel, cálculo de custos ou margem nesta etapa.

Novo produto abre cadastro rápido em modal: nome, origem, ao menos um dos três
preços e medidas/peso opcionais. Quando houver mais de um preço, escolha o que será
usado no pedido. Ao concluir, já entra no orçamento. Salvar também no catálogo é
opcional; quando marcado, cria cadastro real. Informações extras do site ficam
para depois na área Produtos.

A quantidade é editável na linha. Embalagem individual vale por item do pedido,
não altera o produto, e seu acréscimo é cobrado por unidade. Se estiver incluída no
preço de venda, não é cobrada novamente. Tipo/valor/quantidade ausentes são
pendências. Os totais são parciais, sem caixa de transporte ou frete. Cores podem
ser descritas nas observações, com quantidade total por item.

Clique em Salvar rascunho e aguarde a confirmação antes de sair. O rascunho aparece
na lista e pode ser reaberto. Não há salvamento automático. Os dados de cliente,
produto e preços usados ficam em snapshots; editar os cadastros não reescreve o
histórico salvo. Uma edição antiga em outra janela é rejeitada para evitar perda
da versão mais recente. Ainda não há emissão final, cotação de frete, postagem,
PDF, envio de mensagens ou cálculo de prazo de fabricação.

## Clientes e Produtos

As páginas possuem lista e cadastro/edição em modal. Arquivar retira da lista ativa
sem apagar fisicamente o registro; dados já copiados a orçamentos são preservados.
Não há sincronização automática com WooCommerce nem importação de clientes nesta
versão. Os cadastros de clientes começam vazios, sem exemplos reais ou fictícios.

Na área Produtos há Categoria, três preços e dados físicos. SKU, descrição e URL
da foto ficam em Informações para o site, recolhidas por padrão e acessíveis por
botão. Autorizar divulgação abre a seção, sem exigir preenchimento nem publicar.
Produto de cliente permanece privado. A autorização não garante prontidão para o
site: os requisitos finais de publicação ainda serão definidos.

## Configurações por área

A navegação mostra Fabricação, Orçamentos, Clientes e Produtos. Cada página tem
Configurações e caminho de retorno. Orçamentos permite salvar CEP de origem para
integração futura; não consulta frete. Fabricação guarda anotações de capacidade,
dias, máquinas, fila e imprevistos, sem converter em prazos ou cálculos. Dados não
definidos ficam em branco. Clientes e Produtos não possuem opções específicas
inventadas; suas telas estão preparadas para decisões futuras.

## Instalação, diagnóstico e backup

As atualizações preservam o banco da mesma instalação. Faça um backup atual do
aplicativo no HA e guarde cópia externa antes de instalar. Não reinstale nem apague
os produtos para completar SKU/fotos; use a carga complementar descrita em PILOTO.md.

O diagnóstico e a anotação inicial continuam em `?view=diagnostico`. A demonstração
antiga em `?view=produto` é separada: seus dados continuam temporários. Para dados
reais, use Orçamentos, Clientes e Produtos na navegação principal.

A execução independente exige Node.js 24: npm ci, npm run build e APP_MODE=local
npm start. Sem login, restringe acesso a loopback; não expor na internet. No HA,
Ingress fornece o ponto de entrada e o banco fica no volume de dados do aplicativo.
