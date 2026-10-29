# Carga piloto — 0.1.10

O piloto inclui somente produtos publicados na categoria selecionada do CSV,
com preços normais em varejo, atacado/fábrica vazios, origem própria e autorização
de divulgação. Isso não publica no site. Tamanhos e atributos diferentes de cor
separam cadastros; cores são agrupadas somente com preço e medidas compatíveis.
Conflitos abortam a preparação. Herança das medidas da base ocorre por campo.

Execute `scripts/prepare-pilot.py entrada.csv saida.json --site-url https://sua-loja.example`.
A categoria padrão é `Headshop > Capas para Isqueiros`. O script não acessa site
nem banco e exige arquivo de saída novo. Não versionar CSV, JSON ou bancos reais.

O SKU vem da variação, quando presente, ou do produto-base. Conflitos de SKU no
grupo ou na carga interrompem a preparação. O código não é a identidade usada
para evitar duplicação: os identificadores externos são preservados separadamente.
A descrição vem da base; campos ausentes no CSV não são inventados. O preparador
seleciona a foto principal HTTPS da base. Galeria e foto por cor ficam para depois.
As fotos são carregadas pelo navegador a partir do site, sem download para o
servidor do aplicativo. Se o site impedir ou deixar de servir a imagem, será
exibido um aviso; a disponibilidade real exige conferência na instalação.

## Produtos já importados

Não apague nem importe como novos. Antes de selecionar o arquivo novo, marque
**Completar SKU, descrições e fotos vazias dos produtos existentes**. A conferência
informa quantos cadastros serão completados, sem gravar. Confirme só depois de
conferir. Isso preenche apenas esses campos vazios: preços, categoria, nomes,
descrições/fotos/SKUs já preenchidos e produtos arquivados são preservados.

Sem essa opção, produtos reconhecidos são ignorados. A carga inteira é validada
antes de uma transação. Mudanças no agrupamento das variações geram conflito e
exigem revisão. Repetir a carga não duplica nem sobrescreve edições.

O catálogo não é um espelho completo do WooCommerce: imagens adicionais, estoque,
tributação e demais campos aguardam o cadastro completo. Mantenha o CSV original.
A API valida formato e regras locais, não autentica a procedência do arquivo.

## Verificações

`npm run build`, `npm test` e `npm run verify:runtime` verificam tipos, API,
persistência, conflito de versões e backup/restauração fria com dados fictícios.
O Chromium verifica fluxo persistente de ponta a ponta. Os scripts
`verify-products.py arquivo-antigo.json arquivo-complementar.json` e
`verify-workflow.py arquivo-complementar.json` usam servidor descartável na porta
local 8196. Nunca executar esses scripts em uma instalação com dados a preservar.
As imagens são simuladas no teste; isso não comprova a disponibilidade do site.

Esta versão ainda requer validação no Raspberry e no Ingress real. Não houve
nova construção Docker/ARM para esta revisão no ambiente de desenvolvimento.
