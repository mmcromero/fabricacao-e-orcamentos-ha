# Uso — 0.1.18

## Orçamentos

A tela inicial é a lista de Orçamentos, separada do formulário. A lista usa dez
registros por página. Em Configurações da respectiva área, escolha 10, 20, 30, 40, 50 ou Todos. Clientes e Produtos também têm listas paginadas; cada preferência fica salva separadamente no banco. Uma preferência antiga de 15 orçamentos continua sendo respeitada até ser alterada.
A busca pesquisa título, cliente ou número no conjunto completo, não só na página.

Novo orçamento e Editar abrem o formulário em modal, sem recarregar a
página. Cabeçalho, fechamento e ações ficam visíveis enquanto o conteúdo rola.
No celular, o modal ocupa a tela. Fechar ou Escape retornam à mesma lista, página,
filtro e posição; se houver alterações não salvas, o descarte exige confirmação.
Salvar mantém o modal aberto. Finalizados/enviados continuam somente para consulta
até reabrir como rascunho. Cadastros de cliente e produto podem abrir por cima do
orçamento e fechar sem descartar o pedido. Essa estrutura será replicada nas
outras áreas somente depois da aprovação do usuário em Orçamentos.

Clique em Novo orçamento. Selecione um
cliente ou use Novo cliente em modal: o cadastro será salvo na lista real e
selecionado no pedido, sem sair da página. Com cliente selecionado, o seletor e
Novo cliente ficam ocultos. Trocar cliente retira apenas a seleção atual e mostra
novamente a lista e o cadastro. Não exclui o cliente nem altera os outros dados do
pedido; a nova seleção é gravada ao salvar o orçamento. Nome da empresa e nome do contato são
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
por produto antes da inclusão. Na área Orçamentos, os preços são os valores salvos no catálogo; cálculos de fabricação são feitos separadamente na área Fabricação.

Novo produto abre cadastro rápido em modal: nome, origem, ao menos um dos três
preços e medidas/peso opcionais. Quando houver mais de um preço, escolha o que será
usado no pedido. Ao concluir, já entra no orçamento. Salvar também no catálogo é
opcional; quando marcado, cria cadastro real. Informações extras do site ficam
para depois na área Produtos. Para origem De cliente, Atacado fica visível e Exibir
mais preços revela Loja de fábrica e Varejo. Recolher os campos não apaga valores;
a regra de escolher a modalidade continua valendo quando houver vários preços.

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

Na área Produtos há Categoria, três preços e dados físicos. Produtos de cliente
recebem automaticamente a categoria Produtos de cliente; o campo não aparece
para edição. Para produtos próprios, Categoria é opcional. Sem ela, o cadastro
fica marcado Categoria pendente. Os filtros separam próprios, personalizados de
cliente e categoria pendente. Essa organização não publica nem exporta catálogos;
produtos de cliente continuam privados. O vínculo financeiro e os snapshots dos
orçamentos permanecem preservados. SKU, descrição e URL
da foto ficam em Informações para o site, recolhidas por padrão e acessíveis por
botão. Autorizar divulgação abre a seção, sem exigir preenchimento nem publicar.
Produto de cliente permanece privado. A autorização não garante prontidão para o
site: os requisitos finais de publicação ainda serão definidos.

## Configurações por área

A navegação mostra Fabricação, Orçamentos, Clientes e Produtos. Cada página tem
Configurações e caminho de retorno. Orçamentos permite salvar CEP de origem para
integração futura; não consulta frete. Fabricação guarda anotações de capacidade,
dias, máquinas, fila e imprevistos, sem converter em prazos. Também separa Configuração e Operação para os cálculos de custo. Clientes e Produtos têm paginação persistente; Produtos inclui categorias e Importar dados. Dados não definidos ficam em branco.

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

## Listas e teclado

Clientes permite buscar por empresa ou contato; Produtos pesquisa nome e SKU juntos e prioriza um código exato. Os filtros de origem e categoria pendente combinam com a busca. Alterar busca/filtro retorna à primeira página. Editar abre o mesmo modal e preserva a posição e página ao fechar. Em telas estreitas o botão mostra um lápis com nome acessível Editar. O × dos modais tem nome acessível Fechar; Escape fecha somente o modal ativo. Alterações pendentes exigem confirmação antes de descartar. Finalizados/enviados permanecem bloqueados até Reabrir como rascunho.

Acessibilidade verificada em fluxos específicos de teclado e larguras móveis; isto não declara conformidade integral WCAG AA.

## Categorias e importação

Em Configurações de Produtos, cadastre caminhos como Pai > Subcategoria. A alteração de uma categoria atualiza seus descendentes e os produtos associados; os dados históricos dos orçamentos permanecem preservados. Produtos de cliente é reservada, automática e não editável. Produtos próprios podem ficar sem categoria.

Importar dados saiu da tela principal de Produtos. O conteúdo do arquivo determina o tipo: CSV WooCommerce importa somente categorias; JSON preparado importa produtos ou categorias. A prévia informa o tipo e as quantidades antes de gravar. Confirme somente após conferir. Importar categorias não importa produtos. Repetir a mesma carga não duplica categorias nem produtos reconhecidos. Possíveis duplicatas de nome/SKU com vínculos diferentes exigem conciliação. Não envie dados comerciais ao repositório.

## Pacote para cotação manual

Próximo dos totais, o orçamento mostra peso e volume conhecidos dos produtos pelas quantidades. A estimativa de peso soma apenas embalagens individuais, caixa e proteção informadas; dados ausentes aparecem como pendências. Informe zero para caixa/proteção inexistentes. O peso da embalagem não acrescenta cobrança ao orçamento.

Peso e dimensões reais do pacote fechado são campos separados e opcionais. Volume dos produtos não determina as dimensões externas da caixa; meça o pacote antes de cotar. CEP de origem vem das Configurações de Orçamentos e destino do cliente. Estes dados apoiam cotação manual no Melhor Envio; não há consulta nem postagem automática.

## Fabricação e cadastro único

Escolha o mesmo produto de Produtos ou use Novo produto com fabricação. O cadastro básico pode existir sem dados de produção. Identificação, código e categoria pertencem ao mesmo registro; dados de fabricação são opcionais. Produtos de cliente permanecem privados e com categoria automática.

Em Configurações de Fabricação, preencha preço do quilo de filamento, energia/desgaste por hora de máquina, hora humana, horas produtivas mensais e multiplicadores dos três preços. Operação reúne as despesas mensais: total dividido pelas horas produtivas. Campos operacionais vazios equivalem a zero; parâmetros de custo e multiplicadores ausentes mantêm o cálculo pendente.

O formulário aceita horas, minutos e segundos, inclusive mais de 24 horas, convertidos internamente sem arredondamento antecipado. Material é informado em gramas, separado do peso físico cadastrado para transporte. Extras, embalagem de fabricação e etiqueta entram no custo. Uma etapa adicional opcional permite reproduzir produtos compostos cuja fórmula soma um componente-base.

Custo sem lucro soma material, máquina (energia, desgaste e operação), trabalho humano, extras, embalagem e etiqueta. Atacado, Loja de fábrica e Varejo usam seus multiplicadores. “Preço loja” corresponde a Loja de fábrica e “preço site” a Varejo. Os preços antigos da planilha não são aplicados. A exibição monetária arredonda ao final.

Salvar fabricação em produto existente preserva seus preços. Para aplicar os três preços calculados, revise os resultados e marque a opção explícita; alterar dados de produção desmarca essa opção. Para criar um produto novo por este formulário é necessário ter cálculo completo e confirmar a aplicação dos preços. Revisões do produto e dos parâmetros são conferidas antes de gravar. Orçamentos já salvos preservam os preços históricos.

Embalagem de fabricação faz parte do custo. No orçamento, se a embalagem individual já estiver no preço de venda, marque Embalagem já incluída no preço para evitar cobrança adicional. Não há importação automática de planilha nem carga real executada.

## Conciliação da carga final

Configurações de Produtos → Importar dados também reconhece uma carga de fabricação preparada a partir da planilha. O aplicativo confere as linhas contra os produtos desta instalação, sem exigir enviar seu banco ou catálogo a terceiros. O arquivo preparado é comercial e deve permanecer privado. Arquivos Excel brutos não são interpretados diretamente pelo aplicativo.

Confira cada linha: vincular a um cadastro existente, criar um novo ou ignorar. Vínculos externos têm prioridade, seguidos de SKU e nome/categoria. Nomes iguais em categorias diferentes não são automaticamente o mesmo produto. Registros sem código exigem atenção. Produtos arquivados não são reativados.

O padrão preserva nomes, origem, preços e campos preenchidos dos produtos existentes. Pode completar dados vazios, inclusive fabricação e dados físicos quando conhecidos. Aplicar preços ou substituir fabricação exige escolha por linha; os dados atuais e os do arquivo podem ser conferidos. A categoria após a carga pode ser escolhida por dropdown. Parâmetros de Configuração/Operação são apresentados separadamente e só se aplicam se a opção específica for marcada; anotações de planejamento ficam preservadas.

Qualquer mudança de escolha exige Revisar vínculos e alterações. Confirmar carga revisada só fica disponível após uma prévia válida. Se outra janela alterar o catálogo ou os parâmetros, gere nova prévia: a confirmação antiga é recusada sem gravar dados. Uma confirmação válida grava o conjunto em uma transação. A repetição reconhece os vínculos existentes e evita novos cadastros duplicados. Orçamentos salvos preservam seus preços históricos.

Baixar catálogo para conferência exporta produtos ativos/arquivados, vínculos, preços, fabricação, categorias e parâmetros. Não inclui tabelas de clientes ou orçamentos. O arquivo não é uma carga importável e não substitui backup integral. Não o coloque em repositório público.

## Dimensões da unidade embalada

Em cada item com embalagem individual, peso e dimensões da unidade embalada são opcionais. O resumo mostra o volume mínimo conhecido para acondicionar, usando essas dimensões quando fornecidas e o volume do produto nos demais casos. Dados ausentes permanecem pendentes; esse volume não determina o tamanho externo da caixa. As medidas reais do pacote fechado continuam separadas.

## Verificações de acessibilidade

O script verify-accessibility.py executa axe-core em páginas, modais e conciliação com critérios automáticos WCAG A/AA em larguras de computador e celular. Use somente servidor descartável de loopback, Chromium e um arquivo local axe.min.js de instalação confiável. Relatórios são gravados fora do checkout por padrão. As verificações automáticas e os testes de teclado/foco não comprovam conformidade integral ou experiência com todos os leitores de tela.

## Cadastro contextual e preços individuais

Fabricação abre diretamente um novo produto com produção expandida. Produtos e o cadastro dentro do orçamento usam o mesmo formulário, com fabricação recolhida e acessível por botão. Dados de site começam recolhidos; foto e nome aparecem no cabeçalho quando informados. Nome, SKU, origem, categoria, preços e medidas continuam disponíveis. O cadastro iniciado num orçamento pode ficar somente naquele orçamento, sem gravar no catálogo.

Em cada faixa, o formulário compara o preço comercial em edição com o cálculo de fabricação em centavos. Tanto mudar os custos quanto editar um preço manual pode produzir divergência. Usar preço calculado atualiza apenas a faixa escolhida no formulário; a persistência ocorre ao salvar. As demais faixas permanecem como informadas. Cálculo pendente não oferece preço a aplicar. O servidor refaz os cálculos escolhidos e recusa parâmetros ou produto alterados em outra janela. Nenhum orçamento existente recebe preços novos automaticamente.

## Filtros, seleção e arquivamento

Na lista de Produtos, combine busca por nome/SKU, origem e categoria. Categoria pendente fica no filtro de categoria, junto às categorias cadastradas. A seleção pode ser individual, da página ou de todos os resultados filtrados. Uma mudança nos resultados limpa a seleção; mudar de página mantém as escolhas. Ações em lote mostram a quantidade afetada antes da confirmação e recusam seleção desatualizada sem alterações parciais. Autorizar divulgação não publica no site e não torna públicos produtos de cliente.

Arquivar retira da lista sem apagar o histórico. Produtos, clientes e orçamentos arquivados ficam ocultos por padrão; Ver arquivados permite restaurar um ou todos, com confirmação. Produtos/clientes arquivados não ficam disponíveis para novos orçamentos. Os dados já salvos em orçamentos permanecem preservados. Não há exclusão definitiva nesta versão.

A paginação e a orientação sobre quantidade por página ficam ocultas quando existe apenas uma página. Quando aparecem, Configurações abre a área correspondente. Suporte e diagnóstico fica no final das configurações de qualquer área.
