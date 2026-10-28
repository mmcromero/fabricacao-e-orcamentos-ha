# Arquitetura

Base única em TypeScript, React/Vite e Fastify, com SQLite via node:sqlite no
Node.js 24. Essa API do SQLite deve ser reavaliada antes da produção.
As regras comerciais ainda não existem. O controle Ingress fica separado no
adaptador do Home Assistant; não há chamadas ao Supervisor ou tokens do HA.

## Execução independente para testes

Com Node.js 24, na pasta apps/umdoislab:

```bash
npm ci
npm run build
APP_MODE=local HOST=127.0.0.1 PORT=8099 npm start
```

O modo local não tem login e só aceita HOST de loopback. Não expor na internet.
DATA_DIR configura o armazenamento; por padrão usa .local-data na pasta do
aplicativo. O caminho dos arquivos estáticos independe da pasta de execução.
O contêiner seleciona APP_MODE=home-assistant, porta 8099 e DATA_DIR=/data.
No HA, só o IP do gateway Ingress é aceito; cabeçalhos de IP não são confiados.

## Persistência e backup

O arquivo validation.sqlite contém só a tabela notes (id, text, updated_at).
Não há migração de esquema nesta versão. Para backup independente, parar o
serviço e copiar o DATA_DIR completo para uma pasta nova fora da aplicação.
Para restaurar, copiar o backup para outra pasta nova e iniciar a mesma versão
com DATA_DIR apontando para ela; conferir os dados antes de trocar o original.
O teste verify:runtime exercita cópia/restauração em dados temporários.

No HA, o manifesto solicita backup frio. Incluir o aplicativo no backup pelo
Supervisor, guardar cópia externa e chave de recuperação se houver criptografia.
Não presumir que a pasta de fontes contém o volume /data.

## Futuro comercial — não implementado

Empresas/usuários, login independente, permissões, isolamento no servidor,
assinaturas, credenciais segregadas, HTTPS, hospedagem, monitoramento e
backups/restauração precisam de projeto e testes próprios. Não foram escolhidos
provedor, pagamentos ou modelo multitenant. A identificação de quem usa o
produto será configurável quando o fluxo for definido, sem fixar empresa no código.
