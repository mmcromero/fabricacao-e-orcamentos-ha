# Uso — 0.1.12

## Orçamentos

A tela inicial é o fluxo persistente. Clique em Novo orçamento. Selecione um
cliente ou use Novo cliente em modal: o cadastro será salvo na lista real e
selecionado no pedido, sem sair da página. Nome da empresa e nome do contato são
campos separados: pelo menos um deve ser preenchido; os dois juntos são opcionais.
Sem empresa, o contato identifica o cliente nas listas.

Rua/logradouro, número, complemento, bairro, cidade e UF podem ser preenchidos
manualmente. Buscar endereço pelo CEP consulta o ViaCEP diretamente no navegador,
com apenas o CEP; não envia nome, documento ou telefone. Se a consulta falhar ou o
CEP não detalhar a rua/bairro, continue manualmente. Número e complemento não
são alterados pela consulta. Campos editados enquanto ela carrega são preservados.
Nenhum campo de endereço é obrigatório para salvar um cadastro ou rascunho.
Cadastros antigos sem esses campos continuam disponíveis, sem exclusão de dados.

 CPF/CNPJ e CEP podem ficar pendentes;
o endereço completo pode ser preenchido e salvo, mas validação fiscal, cotação de frete e envio ainda não existem.

Abra Selecionar produtos do catálogo para percorrer a lista, filtrar e selecionar
vários produtos. A lista abre em painel suspenso com altura limitada e rolagem
interna; o filtro e o botão de confirmar ficam fora da região que rola. Escape ou
clique externo fecham sem adicionar, preservando a seleção. Só entram ao confirmar
Adicionar selecionados. Um único preço
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
pendências. Os totais são parciais enquanto houver pendências; o frete manual definido entra
no total. Não há estimativa automática de caixa ou proteções de transporte. Cores podem
ser descritas nas observações, com quantidade total por item.

O título do orçamento é editável e aparece na lista. A busca encontra título,
cliente ou número. Rascunhos anteriores sem título continuam editáveis.

Clique em Salvar rascunho e aguarde a confirmação antes de sair. O orçamento aparece na lista com título e situação e pode ser reaberto. Não há salvamento automático. Os dados de cliente,
produto e preços usados ficam em snapshots; editar os cadastros não reescreve o
histórico salvo. Uma edição antiga em outra janela é rejeitada para evitar perda
da versão mais recente. ## Finalização e entrega

Salvar rascunho continua permitindo pendências. Finalizar orçamento exige cliente,
ao menos um produto, quantidade/preço e embalagem individual definidos. A forma
de entrega também precisa estar definida:

- Transportadora / serviço de envio: informar serviço e valor de frete manualmente.
  Valor vazio é pendência; zero só é aceito se informado explicitamente.
- Retirada no local: sem cobrança de frete, sem exigir consulta de transportadora.
- Entrega por cortesia: sem cobrança de frete.

O total soma produtos, embalagens cobradas e o frete informado. Não há consulta
ou cálculo automático de transportadora; medidas e embalagem externa ainda
precisarão de confirmação para calcular frete automaticamente ou fazer postagem.
CPF/CNPJ é dado para postagem e não bloqueia concluir orçamento para retirada.

Finalizado fica somente para consulta. Marcar como enviado pede confirmação de
que você já enviou o orçamento ao cliente: não envia mensagem e não representa
postagem ou entrega física. Para editar finalizado/enviado, use Reabrir como
rascunho. A versão anterior fica preservada em quote_versions, ainda sem tela de
histórico. Depois de alterar, finalize novamente e marque o novo envio manualmente.
Alterações concorrentes continuam protegidas por revisão.

PDF, envio de mensagens, postagem e cálculo de prazo de fabricação não estão
implementados.

## Clientes e Produtos

As páginas possuem lista e cadastro/edição em modal. O botão Arquivar está
desativado até existir a área de consulta e reativação dos arquivados. O mecanismo
interno preserva registros e snapshots, mas não é acionável por esses botões.
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
