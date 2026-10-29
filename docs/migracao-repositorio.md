# Instalação lado a lado e retorno

1. Parar só o aplicativo local e fazer backup pelo HA incluindo esse aplicativo.
2. Guardar cópia fora da máquina; conservar a chave de recuperação, se aplicável.
3. Iniciar o local e conferir os dados. Não desinstalar nem remover sua pasta.
4. Adicionar o repositório público na loja e instalar a versão do repositório.
5. Conferir origem, versão, identificador e funcionamento da instalação nova.

O prefixo do identificador difere: o Supervisor cria outro volume. Não há
remapeamento automático de backup ou sincronização entre as duas instalações.
O volume pode conter cadastros, configurações e orçamentos reais. Não há migração
automática entre instalações local e de repositório. Uma nova instalação não
herda os dados da anterior; planejar backup e restauração validados antes de trocar.
Não chamar a digitação manual de uma anotação de migração integral dos dados.

Não remover o original. Para retornar, parar o novo e iniciar o local. Dados
novos não retornam automaticamente. Testar restauração separadamente antes de
afirmar que um backup é recuperável. Não alterar arquivos internos do Supervisor.

## Atualizações

Manter a URL do repositório. Publicar uma versão maior no manifesto e aguardar
ou solicitar atualização do catálogo da loja. O HA oferece a atualização;
o usuário escolhe instalar. Manter atualização automática desativada.

Fontes oficiais:
- https://developers.home-assistant.io/docs/apps/repository/
- https://developers.home-assistant.io/docs/apps/configuration/
- https://developers.home-assistant.io/docs/apps/presentation/#ingress
