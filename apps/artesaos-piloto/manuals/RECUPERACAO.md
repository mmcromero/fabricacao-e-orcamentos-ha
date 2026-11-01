# Backup, restauração e recuperação — procedimento permanente

Referência 0.2.0-dev.11. Executar em instalação real apenas com autorização específica.
Backup contém dados privados e credenciais: armazenar fora da pasta servida por HTTP,
com permissão restrita e proteção de armazenamento/criptografia aprovada pelo operador.
Não publicar em Git, tickets ou pacote de distribuição. Guardar pacote/código da versão
correspondente, hash SHA-256, data e instalação de origem. HA e Debian nunca trocam dados.

## Home Assistant

Usar backup nativo com o add-on e opções incluídos; manifesto `backup: cold` solicita
parada para backup consistente. Conferir estado e conclusão no Supervisor. Guardar
separadamente pacote-fonte/identificador/origem do add-on para reconstrução. Restaurar
pelo mecanismo nativo em instalação compatível, primeiro isoladamente. Não restaurar
arquivo de pacote-fonte como se fosse backup HA. Ver HOME-ASSISTANT.md.

## Debian — backup frio com o helper entregue

Na raiz estável da instalação, com permissão de ler data/config e operar Docker:

```sh
python3 manage.py backup --output /CAMINHO-PRIVADO/backup-novo.tar.gz
sha256sum /CAMINHO-PRIVADO/backup-novo.tar.gz
```

Destino deve ser novo, fora da pasta da instalação. O helper para somente o serviço
`artesao` desse projeto, copia data/config/.env/release.json e reinicia se ele estava
rodando. Não faz cópia quente, não reemite código, não altera esquema nem apaga dados.
Códigos temporários são excluídos. Uma falha do comando não é backup aprovado: não
usar arquivo incompleto, conservar o erro sanitizado e confirmar retorno do serviço.
Credenciais OAuth/contatos cifrados dependem das chaves no data: copiar só SQLite
individual não basta. Não copiar volume entre HA/Debian para tentar recuperar acesso.

## Debian — restauração em pasta nova, sem sobrescrever

Parar e obter autorização antes de promover uma restauração real. Preservar a
instalação e eventuais operações posteriores ao backup. Na pasta do pacote:

```sh
sha256sum /CAMINHO-PRIVADO/backup-novo.tar.gz
python3 manage.py restore --archive /CAMINHO-PRIVADO/backup-novo.tar.gz --target /CAMINHO-PRIVADO/restauracao-nova
```

O destino **não pode existir**. O helper rejeita links, caminhos absolutos/`..`,
dispositivos, duplicatas e conteúdo inesperado antes de extrair. Arquivos ficam
privados, sem confiar em IDs de dono do tar. Não inicia serviço nem promove a cópia.
O operador deve conferir dono UID/GID esperado e permissões antes de montar o volume;
se a extração foi como root, corrigir dono apenas na nova cópia autorizada, não em
dados de outra instalação. Usar pacote/compose da versão correspondente.

Validar a cópia com um processo de teste isolado e URL/porta própria, sem expor dados
privados; conferir integridade de todos os SQLite e autenticação. SQLite deve ser
aberto pelo runtime compatível, sem editar SQL. Conferir que sessões, empresa/logo,
convites/chaves e registros comerciais foram preservados. Só promover após resultado
aprovado. Preparar diretório novo de códigos 0700 com dono do processo se necessário;
emitir recuperação pelo console quando autorizado, nunca reutilizar códigos antigos.

## Atualização interrompida, falha de processo e downgrade

Primeiro preservar /data, configurações e logs sem tokens/cookies. Não apagar banco,
WAL ou chave para “destravar”; não fazer `docker compose down -v`. Reinício tenta a
recuperação transacional SQLite. Migrations comuns usam checksums/transações e recusam
schema futuro/histórico alterado. Bancos de tenant podem migrar sob demanda ao abrir.
Se falhar, não insistir em código antigo contra schema novo. Guardar cópia consistente
e investigar com versão/commit e erro sanitizado. Código antigo só volta com backup
completo compatível e escolha explícita sobre operações posteriores ao backup.

## Recuperação de autenticação

HA: preservar Google e allowlist administrativa nas opções; verificar conta, audiência,
callback, cookies e origem HTTPS. Não aplicar setup/senha Debian. Debian: emitir
`recovery-code` pelo console e usar `/admin/recover`, conforme DEBIAN.md; sucesso
revoga sessões administrativas sem apagar usuários ou negócio. Configuração de rede
ou Google real só pode ser alterada em intervenção separada autorizada.

## Exercício periódico

A cada atualização: backup completo protegido, restauração em pasta/instalação nova,
integridade/FKs, sessão/configuração e operação comercial sintética, reinício e
registro dos resultados. A existência de um arquivo não comprova recuperação.
C2 valida dados sintéticos; restauração nativa do Supervisor e hardware real permanecem
pendentes da primeira homologação autorizada.
