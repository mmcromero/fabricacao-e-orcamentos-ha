# Catálogo persistente — piloto

Versão 0.1.9 — catálogo experimental. A tela `?view=produtos` grava no mesmo
arquivo SQLite da instalação, sem substituir a tabela de anotações. O orçamento
em `?view=produto` continua sendo uma demonstração temporária, sem ligação ao
catálogo real. Fabricação e Clientes ainda não possuem páginas persistentes.

## Regras

- Categoria opcional no formulário; família e vínculo entre versões ficam internos.
- Nome e origem obrigatórios, com escolha explícita da origem no formulário.
- Três preços de venda independentes: atacado, loja de fábrica e varejo.
  Pelo menos um preenchido. Valores monetários armazenados em centavos inteiros.
- Peso em gramas, dimensões em centímetros; podem ficar pendentes no cadastro.
- Produto de cliente obrigatoriamente privado. Autorização não publica no site.
- Arquivar remove da lista ativa, preservando os identificadores externos.
  Não há exclusão física nem histórico de orçamentos implementado nesta etapa.

## Preparar e carregar

`scripts/prepare-pilot.py entrada.csv saida.json --site-url https://sua-loja.example` prepara somente produtos
publicados na categoria `Headshop > Capas para Isqueiros`, incluindo suas
variações publicadas. O arquivo de saída deve ser novo. O script não acessa banco
nem site. Dados reais de entrada/saída não devem ser versionados ou distribuídos
junto do aplicativo.

Tamanhos e atributos que não são cores separam cadastros. Cores são agrupadas
somente se preço normal e medidas efetivas forem compatíveis; conflitos abortam a
preparação. Campos físicos ausentes herdam individualmente do produto-base.
Preço normal preenche varejo; promoções são ignoradas. Atacado e fábrica vazios.

Na tela Produtos, selecionar o JSON apenas confere; a gravação requer Confirmar
importação. A API valida o lote inteiro, limita tamanho e grava em transação.
Identificadores do site reconhecem cargas repetidas, inclusive produtos arquivados.
Repetir não sobrescreve edições. Mudanças de agrupamento exigem revisão e causam
conflito; não há atualização automática do catálogo nem integração com WooCommerce.
O arquivo JSON preparado é confiável somente após a conferência da sua origem;
a API valida o formato, não comprova a autenticidade de uma exportação do site.

O piloto conserva nome, família, descrição, preços, cores, medidas e identificadores
das variações. Não é um espelho completo do WooCommerce: imagens, estoque,
tributação e os demais campos aguardam a etapa de cadastro completo. Mantenha o
CSV original como fonte para essa etapa e para os demais campos. O vínculo do produto-base é preservado em sourceFamily.

Antes de atualizar uma instalação real, conclua um backup com o app parado e
verifique que a cópia está fora do Raspberry. Não copie SQLite aberto como backup.

## Verificações

- `npm run build` e `npm test`: tipos, API, regras e persistência.
- `python scripts/verify-products.py arquivo-piloto.json`: Chromium contra servidor
  descartável local na porta 8196; cria um cadastro de teste e importa o lote real.
  Nunca apontar esse teste para uma instalação com dados a preservar.
