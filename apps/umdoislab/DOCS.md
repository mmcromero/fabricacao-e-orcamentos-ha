# Uso

## Wireframe do cadastro de produto

Na tela inicial, use **Abrir wireframe: produto no orçamento**. A demonstração
permite adicionar/editar produto em modal, preservar dados do orçamento e
simular catálogo, origem e privacidade. Produtos novos começam privados.
Recarregar a página descarta os dados da demonstração; ela não acessa o banco.
O preço de venda é informado; fabricação, frete e publicação no site não foram
implementados. O subtotal considera os valores informados e pode estar incompleto.

Na revisão atual, as embalagens individuais são escolhas por item do orçamento,
separadas do produto no catálogo e da embalagem de transporte. Os valores de
embalagem são informados pelo usuário e acrescentados por unidade utilizada;
quando já incluídos no preço de venda, não são cobrados novamente. O subtotal
considera produtos e embalagens informados e não inclui transporte pendente.
Tipo, peso e compatibilidade de embalagens ainda precisam ser detalhados.
CPF/CNPJ pode ficar pendente para preparar o envio; o protótipo não o valida.
Produto de cliente é sempre privado; apenas produto próprio pode receber
autorização de divulgação futura. Nenhuma publicação no site é feita.

Teste de navegador opcional: com Python Playwright e Chromium instalados,
iniciar a aplicação em modo local e executar scripts/verify-wireframe.py.
O script usa dados de demonstração e informa explicitamente se o fluxo passou.

Inicie o aplicativo e abra a interface web pelo Home Assistant. Confira API
e SQLite, salve uma anotação sem dados pessoais e reinicie somente o aplicativo.
A anotação deve permanecer. O banco é armazenado em `/data/validation.sqlite`.

Esta versão é experimental e não contém Orçamentos ou Fabricação.
Não exige configuração, tokens, portas externas ou permissões administrativas.

## Execução fora do Home Assistant

Com Node.js 24: executar npm ci, npm run build e APP_MODE=local npm start na
pasta do aplicativo. Esse modo não tem login e fica restrito a loopback.
PORT e DATA_DIR podem ser configurados; não expor na internet.
Para diagnóstico, backups e restauração, consultar docs/arquitetura.md na raiz
do repositório. Não há migração de esquema nesta versão.

## Instalação pelo repositório

Consultar docs/migracao-repositorio.md antes de trocar a instalação local.
A instalação pelo repositório recebe outro volume: os dados locais não são
transferidos automaticamente. Não desinstalar o aplicativo antigo.
O manifesto solicita backup frio ao Supervisor. A opção de atualização
automática deve permanecer desativada. O usuário decide quando instalar cada
nova versão oferecida pelo Home Assistant.
