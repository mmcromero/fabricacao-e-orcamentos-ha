# Verificações

Na base de desenvolvimento, passaram build TypeScript/Vite, testes da API,
configuração, filtro Ingress, execução HTTP independente, persistência após
reinício e backup/restauração com dados temporários. A imagem foi construída
e testada em amd64. Um proxy de teste verificou os caminhos com prefixo; isso
não comprova autenticação nem instalação pelo Supervisor.

A versão inicial teve execução ARM e persistência confirmadas por um usuário.
A versão desta distribuição ainda requer instalação ARM e Ingress reais.
Não há fluxos comerciais para testar. Backup/restauração pelo Supervisor,
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
