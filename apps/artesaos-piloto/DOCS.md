# Artesãos — Piloto — Testes

Aplicativo experimental independente, baseado no núcleo Fabricação e Orçamentos 0.1.19. Não substitui, atualiza ou compartilha o volume do aplicativo principal. A imagem desta rodada foi construída/testada em amd64; aarch64 ainda depende da instalação real. Primeiro teste restrito ao responsável com duas contas Google próprias e dados fictícios; não convidar terceiros ainda.

## O que está implementado

Login Google OpenID Connect com Authorization Code, PKCE S256, state e nonce; verificação de assinatura, emissor, audiência, validade e e-mail verificado. Convites individuais vinculados ao e-mail, uso único e validade de 24 horas. Limite de cinco participantes. Sessões com token aleatório de 256 bits armazenado como hash, cookies Secure/HttpOnly/SameSite, oito horas absolutas e trinta minutos de inatividade. Alterações exigem origem exata e token CSRF; a página fica vinculada à conta para bloquear abas antigas após troca de usuário. Logout invalida a sessão no servidor; revogação invalida sessões e convites.

Cada usuário recebe um banco SQLite separado. O servidor escolhe esse banco pela sessão autenticada, nunca por um identificador de conta enviado pelo navegador. As APIs comuns, categorias, parâmetros, importação, exportação e arquivamento usam a mesma separação. O login do Home Assistant não autentica o piloto.

## Limites desta entrega

Testes automatizados com identidades/servidor OIDC controlados não comprovam login real no Google ou funcionamento no seu Home Assistant. Ainda exigem validação o Google real, a configuração do proxy, cookies no navegador real, Supervisor e imagem ARM. Não é uma certificação de segurança nem revisão independente.

HTTPS protege o trajeto navegador–Nginx. A rede interna Nginx–aplicativo usa HTTP, como o proxy atual do Home Assistant. SQLite e opções do aplicativo NÃO são criptografados em disco por esta versão. Permissões restritas não equivalem a criptografia. Backups padrão do HA podem incluir opções/credenciais; use a proteção de backups da instalação e armazenamento protegido. Criptografia em repouso e avaliação independente permanecem requisitos antes de usar dados sensíveis ou liberar artesãos. Não copie bancos, clientes ou credenciais da aplicação principal.

## Instalação manual separada

1. Na loja do HA, atualize o catálogo e instale **Artesãos — Piloto — Testes**. Não desinstale Fabricação e Orçamentos.
2. Mantenha a porta do host desabilitada. O Nginx acessará a porta interna 8099 pelo hostname mostrado na informação do novo aplicativo.
3. Não inicie sem configurar as opções abaixo. Ausência de Google ou URL válida faz o processo recusar a inicialização; não existe modo de autenticação simulada em produção.
4. Copie o **hostname real do novo aplicativo**. Não adivinhe prefixos nem reutilize o hostname da aplicação principal.

## Cliente Google

Crie um cliente OAuth de tipo aplicativo da Web no Google Cloud/Google Auth Platform. Mantenha a audiência em modo de teste e adicione somente suas duas contas de teste. Os nomes e rótulos da interface do Google podem variar.

Para uma URL pública `https://seu-dominio:porta/artesaos-piloto/`, cadastre exatamente:

- Origem JavaScript: `https://seu-dominio:porta`.
- URI de redirecionamento: `https://seu-dominio:porta/artesaos-piloto/auth/google/callback`.

Solicitamos somente openid e email; não acesso ao Gmail. Configure Client ID e Client Secret nas opções do aplicativo. Não cole o segredo em chat, Git, logs ou arquivos de configuração públicos.

## Opções

- `public_url`: endereço HTTPS completo, terminando em `/artesaos-piloto/`. Use sempre este mesmo endereço, inclusive em casa.
- `google_client_id` e `google_client_secret`: cliente Web configurado no Google.
- `test_email_1`, `test_invite_1`, `test_email_2`, `test_invite_2`: seus dois e-mails e códigos individuais aleatórios de no mínimo 32 caracteres. Gerar códigos com um gerenciador de senhas. Não usar a senha das contas Google.

A primeira inicialização registra os convites por hash com validade de 24 horas. Reiniciar não renova convites já usados ou expirados. Se necessário, use um novo código aleatório nas opções para criar outro convite. Uma conta já ativada entra novamente sem código. Se o e-mail Google não corresponder ao convite, a ativação é recusada.

A administração técnica também oferece `npm run pilot:admin -- invite EMAIL` e `npm run pilot:admin -- revoke EMAIL`, executados dentro do contêiner do piloto com o mesmo DATA_DIR. O primeiro mostra um código uma única vez; não o publique. Não há painel administrativo nesta revisão.

## Rota no NGINX Home Assistant SSL proxy

O aplicativo oficial suporta `customize.default` para incluir arquivos no servidor HTTPS existente. Não substituir o nginx.conf ou as rotas principais.

Depois de conhecer o hostname real do piloto, gere o fragmento com:

```sh
python3 generate-nginx.py --upstream-host HOSTNAME_REAL_DO_PILOTO --output nginx_proxy_default_artesaos.conf
```

O gerador exige um hostname válido e não sobrescreve arquivos. O resultado deve ir para `/share/nginx_proxy_default_artesaos.conf`, que corresponde ao padrão `nginx_proxy_default*.conf` já presente no proxy. O campo `customize.servers` continua inalterado. A rota preserva o prefixo, encaminha o Host com a porta externa e desativa logs de acesso do piloto para não registrar códigos OAuth.

Somente depois de o piloto estar configurado/iniciado e o hostname resolvido, valide `nginx -t` no contêiner do proxy, considerando o arquivo adicional, antes da ativação efetiva. Faça a alteração localmente, com cópia das opções anteriores e possibilidade de restaurá-las; não depender apenas do acesso remoto. Habilitar `customize.active` aplica os arquivos correspondentes existentes, portanto confira se há outros arquivos com esse padrão antes de habilitar. Nenhuma configuração é aplicada por esta distribuição.

## Primeiro teste

Abra o endereço HTTPS do piloto diretamente em uma aba, fora do iframe do Ingress. Digite o convite da primeira conta, entre pelo Google e crie somente registros fictícios. Use outro perfil/contexto do navegador para a segunda conta; confirme listas vazias e parâmetros separados. Teste criar/editar/arquivar, importar/exportar dados fictícios, sair e entrar novamente, tentativa com convite de outra conta, troca de conta mantendo aba antiga e revogação. Confirme que o Fabricação e Orçamentos original e seus dados permanecem intactos.

## Migração futura

O núcleo comum permanece independente do Home Assistant. A hospedagem temporária não aprova automaticamente o piloto para terceiros. A migração ao host dedicado exigirá seu pedido, URL/cliente Google ajustados e repetição dos testes de autenticação, isolamento, backup e proteção de dados.

## Evidência de desenvolvimento

A compilação e a suíte automatizada passaram, incluindo rejeição de assinatura/audiência/nonce/validade/e-mail incorretos; convites e estados de uso único; sessão expirada/revogada; origem/CSRF; aba de conta antiga; separação de produtos/clientes/orçamentos/parâmetros/exportação/arquivamento e reinício. O navegador exercitou cookies Secure, login e CRUD de duas contas em HTTPS local com certificado e provedor fictícios. A sintaxe do fragmento Nginx passou em contêiner descartável. A auditoria das dependências de produção não apontou vulnerabilidades conhecidas nesta rodada. Esses resultados não substituem o teste real no Google/HA nem uma avaliação independente.
