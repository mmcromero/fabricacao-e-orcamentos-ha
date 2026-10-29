# Verificações

Na base de desenvolvimento, passaram build TypeScript/Vite, testes da API,
configuração, filtro Ingress, execução HTTP independente, persistência após
reinício e backup/restauração com dados temporários. Uma imagem anterior foi construída
e testada em amd64; isso não comprova a imagem desta versão. Um proxy de teste verificou os caminhos com prefixo; isso
não comprova autenticação nem instalação pelo Supervisor.

A versão inicial teve execução ARM e persistência confirmadas por um usuário.
A versão desta distribuição ainda requer instalação ARM e Ingress reais.
O wireframe do produto também foi exercitado em Chromium (desktop e celular),
incluindo validação, preservação dos campos do orçamento, catálogo opcional,
privacidade e ausência de chamadas à API. Sua persistência é apenas em memória.
O catálogo persistente foi verificado em banco descartável e no Chromium, incluindo
validação, edição, conferência/importação e repetição sem duplicações. Orçamentos usam o catálogo e clientes persistentes, com snapshots e controle de versão.
O fluxo completo foi exercitado no Chromium, e reinício e restauração fria passaram
com clientes, configurações e rascunhos fictícios. Esta versão não teve nova construção Docker
ou execução ARM neste ambiente. Backup/restauração pelo Supervisor,
descoberta do repositório público, transferência dos dados e atualização entre
versões ainda precisam de verificação no destino.

Reproduzir na pasta apps/umdoislab, com Node.js 24:

```bash
npm ci
npm run build
npm test
npm run verify:runtime
```

Testes HTTP precisam de permissão para abrir sockets de loopback. Usam dados
temporários. Não apontar DATA_DIR para instalação em uso para testar.

Após instalar no HA: conferir API/SQLite ok, arquitetura arm64 no Raspberry,
salvar anotação, reiniciar só o aplicativo e conferir texto/data. Medir consumo
com o identificador confirmado pelo Supervisor. Não expor o modo local sem login.
