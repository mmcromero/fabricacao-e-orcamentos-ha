# Artesão Digital — Testes

Aplicativo experimental independente, baseado no núcleo Fabricação e Orçamentos 0.1.23. Não substitui, atualiza ou compartilha o volume do aplicativo principal. A imagem desta rodada foi construída/testada em amd64; aarch64 ainda depende da instalação real. Primeiro teste restrito ao responsável com duas contas Google próprias e dados fictícios; não convidar terceiros ainda.

## O que está implementado

Login Google OpenID Connect com Authorization Code, PKCE S256, state e nonce; verificação de assinatura, emissor, audiência, validade e e-mail verificado. Convites individuais vinculados ao e-mail, uso único e validade de 24 horas. Limite de cinco participantes. Sessões com token aleatório de 256 bits armazenado como hash, cookies Secure/HttpOnly/SameSite, oito horas absolutas e trinta minutos de inatividade. Alterações exigem origem exata e token CSRF; a página fica vinculada à conta para bloquear abas antigas após troca de usuário. Logout invalida a sessão no servidor; revogação invalida sessões e convites.

Cada usuário recebe um banco SQLite separado. O servidor escolhe esse banco pela sessão autenticada, nunca por um identificador de conta enviado pelo navegador. As APIs comuns, categorias, parâmetros, importação, exportação e arquivamento usam a mesma separação. O login do Home Assistant não autentica o piloto.

## Limites desta entrega

Testes automatizados com identidades/servidor OIDC controlados não comprovam login real no Google ou funcionamento no seu Home Assistant. Ainda exigem validação o Google real, a configuração do proxy, cookies no navegador real, Supervisor e imagem ARM. Não é uma certificação de segurança nem revisão independente.

HTTPS protege o trajeto navegador–Nginx. A rede interna Nginx–aplicativo usa HTTP, como o proxy atual do Home Assistant. SQLite e opções do aplicativo NÃO são criptografados em disco por esta versão. Permissões restritas não equivalem a criptografia. Backups padrão do HA podem incluir opções/credenciais; use a proteção de backups da instalação e armazenamento protegido. Criptografia em repouso e avaliação independente permanecem requisitos antes de usar dados sensíveis ou liberar artesãos. Não copie bancos, clientes ou credenciais da aplicação principal.

## Instalação manual separada

1. Na loja do HA, atualize o catálogo e instale **Artesão Digital — Testes**. Não desinstale Fabricação e Orçamentos.
2. Mantenha a porta do host desabilitada. O Nginx acessará a porta interna 8099 pelo hostname mostrado na informação do novo aplicativo.
3. Não inicie sem configurar as opções abaixo. Ausência de Google ou URL válida faz o processo recusar a inicialização; não existe modo de autenticação simulada em produção.
4. Copie o **hostname real do novo aplicativo**. Não adivinhe prefixos nem reutilize o hostname da aplicação principal.

## Cliente Google

Crie um cliente OAuth de tipo aplicativo da Web no Google Cloud/Google Auth Platform. Para o piloto restrito, mantenha a audiência em modo de teste e adicione o e-mail Google de cada participante autorizado, até cinco contas no aplicativo. Essa lista do Google é separada dos convites individuais do aplicativo. Os nomes e rótulos da interface do Google podem variar.

Para uma URL pública `https://seu-dominio:porta/artesaos-piloto/`, cadastre exatamente:

- Origem JavaScript: `https://seu-dominio:porta`.
- URI de redirecionamento: `https://seu-dominio:porta/artesaos-piloto/auth/google/callback`.

Solicitamos somente openid e email; não acesso ao Gmail. Configure Client ID e Client Secret nas opções do aplicativo. Não cole o segredo em chat, Git, logs ou arquivos de configuração públicos.

## Opções

- `public_url`: endereço HTTPS completo, terminando em `/artesaos-piloto/`. Use sempre este mesmo endereço, inclusive em casa.
- `google_client_id` e `google_client_secret`: cliente Web configurado no Google.
- `test_email_1`/`test_invite_1` até `test_email_5`/`test_invite_5`: até cinco pares de e-mail e convite. Os pares ainda não usados podem ficar com os dois campos vazios. Ao preencher um par, informe o e-mail Google autorizado e um código aleatório exclusivo de no mínimo 32 caracteres. Gerar códigos com um gerenciador de senhas; não usar a senha das contas Google. Os primeiros dois pares existentes permanecem compatíveis.

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

## Atualização 0.1.1 — retorno após login

Atualize somente o aplicativo Artesão Digital — Testes, sem desinstalar. Contas, convites registrados e configurações permanecem no volume existente. Não é necessário recriar o cliente Google nem alterar a rota Nginx que já está funcionando.

Depois de autenticar no Google, o piloto exibe brevemente Concluindo acesso, confirma a sessão e abre Produtos automaticamente. A mesma regra vale para o primeiro acesso com convite e para o novo login de conta já ativada com convite vazio. Se a sessão não for reconhecida, a página mostra o problema e oferece entrar novamente, em vez de um retorno silencioso.

O teste local usa um provedor controlado e verifica conteúdo da aplicação visível, inclusive através de Nginx HTTPS. A validação com Google real na sua instalação ainda é necessária: faça primeiro logout/login com a conta já ativada; use o segundo convite somente depois de confirmar a entrada automática da primeira conta. Não use links diretos como substituto deste teste.

O rodapé identifica separadamente a versão do piloto e a versão-base do Fabricação e Orçamentos. Os metadados são gerados no build a partir do manifesto e pacote; core-base.json registra o commit-base e deve ser atualizado conscientemente ao incorporar uma nova versão validada do projeto principal. A compilação recusa divergência entre a versão declarada da base e o pacote.

## Atualização 0.1.2 — Artesão Digital

O nome visível passa a Artesão Digital e a entrada após login é Orçamentos. O rodapé fica fixo com as duas versões. Atualize apenas o aplicativo de testes existente: seu identificador, volume, conta Google, convites e rota permanecem os mesmos; não é outra instalação. O nome de apresentação no console do Google pode ser alterado separadamente, sem recriar credenciais, e não é modificado por esta atualização.

### Botão Abrir interface Web

Na página Info do aplicativo, o botão abre o login pelo mesmo hostname usado no navegador do Home Assistant e pela porta HTTPS8443, já atendida pelo Nginx desta instalação de teste. Não é aberta uma nova porta do piloto. Para o botão usar o domínio correto do certificado e do cliente Google, acesse o Home Assistant pelo endereço HTTPS habitual. Se estiver no HA por IP local, use diretamente o endereço público configurado no piloto; o botão padrão do HA usa o hostname da página atual. Esse atalho é específico do ambiente temporário de testes e não altera a futura implantação standalone.

## Atualização 0.1.3 — carregamento da interface

A versão anterior podia redirecionar requisições dos arquivos JavaScript para a tela de login; o navegador recusava HTML como módulo e mostrava apenas a barra da conta. Agora os arquivos compilados em dist/assets são servidos como recursos públicos com MIME correto. Esses arquivos não incluem credenciais nem dados dos usuários. HTML com contexto da conta, sessão, operações e APIs de dados continuam autenticados e isolados. Atualize somente o aplicativo existente, sem reinstalar ou recriar contas/convites.

## Carregamento no mesmo domínio do Home Assistant

A partir da 0.1.4, o adaptador registra um service worker restrito ao caminho configurado do piloto. Ele busca os recursos pela rede, sem cache local, para impedir que o worker da interface do Home Assistant forneça HTML antigo no lugar dos módulos JavaScript. A ativação remove apenas entradas de cache desse caminho; não remove o registro nem os demais recursos do Home Assistant. Não há funcionamento offline. Se o navegador não conseguir concluir a preparação, o login fica indisponível com uma mensagem explícita. Isso não substitui sessão, autorização por conta ou proteção de CSRF no servidor.

## Sessão expirada e saída (0.1.5)

Se a tela ficar aberta além do prazo da sessão, Sair continua levando ao login e remove os cookies restantes. As sessões continuam com os mesmos prazos; não são renovadas por esta correção. Se faltar conexão, a tela informa que não foi possível sair e permite tentar novamente. Não considera uma falha de rede como encerramento confirmado. Sessões válidas continuam protegidas por origem, CSRF e identificação da aba.

Ao atualizar uma instalação 0.1.3, confirme que o rodapé passou para Artesão Digital 0.1.5 (base 0.1.19). Feche a aba antiga, abra o login pelo domínio HTTPS habitual e confira o acesso e F5 comuns sem Ctrl+Shift+R. Não desinstale nem copie dados do aplicativo principal. A configuração Google/Nginx e os convites existentes são preservados.

## Antes dos primeiros participantes externos

Revise a escolha no Google: manter em Teste e adicionar os e-mails dos participantes, ou publicar a configuração OAuth conforme as exigências do Google. Não é necessário publicar o OAuth para este piloto se os e-mails já estiverem na lista de teste. Isso não dispensa o convite individual do aplicativo. A abertura dos novos campos não representa certificação de segurança; valide primeiro o isolamento com duas contas e mantenha dados fictícios enquanto a revisão de segurança e a proteção dos dados em repouso estiverem pendentes.

Os convites adicionados nos campos 3, 4 e 5 são registrados ao salvar as opções e reiniciar o aplicativo, com a mesma validade de 24 horas dos anteriores. Preencha perto do momento de usar: reiniciar não renova um convite já expirado, consumido ou revogado. Não recrie as contas existentes nem desinstale para atualizar.

## Atualização 0.1.7 — interesse no piloto e administração

A tela de login informa que o piloto exige convite. O formulário de interesse pede **nome e e-mail obrigatórios**; WhatsApp é opcional. O usuário deve concordar com a finalidade indicada. O envio apenas registra interesse: não cria conta, não emite convite e não envia mensagens automaticamente.

### E-mails administrativos

Na configuração do aplicativo, preencha `admin_emails` com os e-mails Google das pessoas autorizadas. A lista inicia vazia, sem conceder administração à primeira pessoa que entrar. Enquanto estiver vazia, a coleta de interesses fica indisponível. Na execução independente, `PILOT_ADMIN_EMAILS` aceita uma lista separada por vírgulas. E-mails inválidos impedem a inicialização para evitar uma configuração enganosa.

A entrada administrativa é `/artesaos-piloto/admin/login`, também acessível pelo link na tela de login de usuários. Ela usa o **mesmo cliente Google e o mesmo callback já configurado**. No Google em modo Teste, acrescente à lista de testadores os e-mails administrativos também. Não precisa de outro cliente OAuth, senha local ou mudança no Nginx.

O administrador autentica sua identidade no Google e o servidor compara o e-mail verificado com `admin_emails`. Um e-mail digitado, um link ou uma sessão comum de usuário não concedem administração. Essa autenticação usa uma sessão administrativa separada, com cookies restritos ao caminho administrativo, duração máxima de uma hora e expiração após quinze minutos de inatividade. Cada operação protegida revalida a sessão e a lista autorizada; retirar um e-mail das opções e reiniciar remove sua autorização. A conta administrativa não precisa consumir convite nem uma das cinco vagas de usuário. Para usar também a aplicação, a mesma pessoa precisa do acesso de usuário normal.

A tela inicial da administração consulta somente a lista de interessados, em páginas de 25 registros, com nome, e-mail, WhatsApp quando informado e data. A paginação só aparece quando necessária. Não inclui gestão completa de usuários, redefinição de senhas, envio de mensagens ou upload de logo.

### Proteção dos interessados e seus limites

O formulário valida os campos no servidor, exige origem correta e um token de formulário vinculado a cookie Secure/HttpOnly e de uso único, válido por quinze minutos. Tem limites de tentativas e campo anti-robô. O limite usa o endereço observado pelo servidor, sem confiar em cabeçalhos que visitantes possam forjar; atrás do Nginx, esse limite pode ser compartilhado entre visitantes. Retornos de registro não revelam se um contato já existia e não substituem dados anteriores. A capacidade é de até cinco mil registros ativos.

Os contatos novos ficam em `pilot-interest.sqlite`, com o conteúdo cifrado por AES-256-GCM e chaves de pesquisa derivadas por HMAC. O processo cria `pilot-interest.key`, de 32 bytes, com permissão restrita. A cifra autentica também a identificação e data do registro. A falta ou troca da chave após uso faz o sistema recusar esse armazenamento, sem descartar os contatos silenciosamente. Conserve **o banco e a chave** ao restaurar. Não publique, envie pelo chat ou versione nenhum desses arquivos.

**Limite importante:** a chave é mantida no volume do próprio aplicativo. Quem tiver acesso ao banco e à chave poderá decifrar os contatos. Isto não cifra todo o banco de usuários, os dados comerciais, as opções do Home Assistant nem o arquivo de backup completo. Backups devem continuar com acesso restrito e proteção própria. Esta implementação não constitui certificação, nem substitui revisão independente de segurança.

A lista ativa mantém contatos por noventa dias. A limpeza roda na inicialização, na consulta/registro e periodicamente; cópias antigas de backup não são apagadas por essa rotina. A política e exclusão de backups precisam ser administradas pelo responsável da instalação. Valide com dados fictícios e confira as permissões com contas distintas antes de coletar contatos reais.

### Logo incluída no pacote

A imagem estática fica em `pilot/branding/logo.png` na fonte, sendo copiada para `dist/pilot-logo.png` na compilação. O pacote exportado usa `branding/logo.png`. Aceita PNG de até 2 MB; esta versão não oferece upload ou troca pela administração. O cabeçalho prioriza a imagem disponível e mantém o nome Artesão Digital para acessibilidade; sem imagem ou ao falhar seu carregamento, apresenta o nome por escrito.

### Conferência manual após atualização

Atualize sem desinstalar, preserve os pares de e-mail/convite existentes e configure `admin_emails`. Reinicie; abra o login pelo domínio HTTPS. Teste o interesse sem WhatsApp, rejeição sem e-mail, login administrativo da conta autorizada, rejeição de uma conta comum e saída. Verifique nome/contato na administração e ausência de paginação com poucos registros. O mesmo Google/callback/Nginx existente é preservado; não use dados pessoais reais na primeira conferência.

## Atualização 0.1.8 — base 0.1.19 para 0.1.23

Código-base incorporado: versão 0.1.23, commit `f56f0e5707ad81f74f42c351171d4132f793cf9a`. A versão própria é 0.1.8; instalação e conferência no Home Assistant continuam manuais. O rodapé e o arquivo de build identificam essa base efetivamente incorporada. A base inclui as melhorias das listas e filtros, seleção para catálogo, validação dos formulários, cadastro de materiais, unidades de compra/consumo e fluxo de fabricação atualizado.

A atualização mantém as adaptações do Artesão Digital: autenticação Google, convites, contas isoladas, administração restrita, lista de interesse cifrada, logo, marca e metadados de duas versões. Cada banco de produtos continua no diretório do seu usuário; não há banco comercial compartilhado. A migração de materiais da base roda dentro desse banco individual, ao acessá-lo, sem ler arquivos da instalação principal.

Antes de instalar a futura atualização, faça uma cópia completa e protegida do volume de dados com o aplicativo parado. Preserve bancos de cada usuário, controle de acesso, lista de interesse e sua chave. Não confunda a cópia interna de produtos antigos com um backup completo da instalação. A cópia anterior deve ser mantida intacta: para voltar à versão antiga, restaure esse backup, em vez de abrir bancos já alterados com um código antigo.

A base cria tabelas de materiais e de acompanhamento/cópia de registros antigos. Registros de fabricação antigos aguardam uma referência de compra válida do primeiro material cadastrado, em gramas ou quilos. Não é inventada uma conversão para outro tipo de unidade. A conversão preserva os preços finais salvos, inclui etapas adicionais e produtos arquivados, e guarda os dados anteriores em tabela própria. O preço da referência escolhido determina o novo cálculo; por isso, confira-o antes de cadastrar o primeiro material. Produtos novos não são capturados retroativamente por esse lote de migração. Não aplicar preços calculados automaticamente.

As novas faixas de multiplicadores podem deixar parâmetros antigos fora do intervalo aceito: revise-os explicitamente, sem substituir valores silenciosamente. A nova seleção de catálogo começa desmarcada para produtos antigos e não altera a autorização de divulgação nem publica produtos na internet.

O ensaio reproduzível de atualização é `node --import tsx scripts/verify-pilot-upgrade.mjs`, executado na fonte com histórico Git e dependências disponíveis. Ele arquiva o código anterior real do piloto, cria dados fictícios de duas contas e verifica preservação de dados, cálculos, referências inválidas, isolamento, reinício, contatos/administração e restauração do backup na versão anterior. Não usa nem migra dados reais.
