# Debian — autenticação administrativa (B2)

Autenticação implementada na B2, preservada em C1/C2. Não é autorização de instalação
ou migração real. Consulte `../distribution/docs/DEBIAN.md` para o pacote Compose,
requisitos, TLS/DuckDNS e console; recuperação em `../distribution/docs/RECUPERACAO.md`.
A aplicação mantém um único código e o caminho público `/artesaos-piloto/`.

## Seleção do adaptador

- Ausência de `ARTESAO_DISTRIBUTION`: `home-assistant`, exatamente o login Google
  administrativo existente. Nenhuma rota local de setup/senha é registrada.
- Debian exige `ARTESAO_DISTRIBUTION=debian` no processo do servidor e console.
- `PILOT_PUBLIC_URL` continua exigindo HTTPS e `/artesaos-piloto/`.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` são externos e continuam necessários
  para usuários comuns. O callback é a URL pública + `auth/google/callback`.
- `DATA_DIR` deve ser próprio da instalação. Nunca apontar para dados do HA.
- O banco de controle registra o tipo da instalação. Troca de modo é recusada;
  um volume legado com contas/convites também não é aceito como Debian novo.
- Não alterar credenciais/callbacks Google existentes do HA para testar Debian.

## Primeiro Acesso — procedimento do operador local

Depois de compilar com `npm run build`, em um **ambiente Debian novo autorizado**:

1. Preparar diretório privado para os códigos, pertencente ao operador, modo 0700.
2. Executar, na raiz do aplicativo, com caminhos absolutos reais da instalação:

```sh
ARTESAO_DISTRIBUTION=debian node dist-server/pilot/local-admin-console.js setup-code /caminho/privado/dados /caminho/privado/codigos/ativacao-nova
```

3. Ler o arquivo localmente pelo console seguro. Ele tem permissão 0600. O comando
   não imprime o código em stdout/stderr nem o recebe na linha de comando.
4. Abrir `https://SEU-ENDERECO/artesaos-piloto/admin/login`, que encaminha ao
   Primeiro Acesso apenas enquanto não existe administrador.
5. Informar e-mail, senha, confirmação e código. Senha de 12 a 128 caracteres,
   sem controles; usar senha exclusiva e gerada por gerenciador.
6. Após criar, entrar normalmente com e-mail/senha. Setup passa a indisponível.
7. Remover o arquivo temporário do código após uso, pelo console local.

Cada código tem 256 bits aleatórios, dura 30 minutos e serve uma vez. Gerar outro
invalida o anterior. O banco guarda apenas hash SHA-256 do código. O arquivo não
é sobrescrito; usar novo nome em cada emissão. O arquivo em claro não faz parte
do pacote, backup público nem diretório servido por HTTP.

A criação confirma novamente código e ausência de administrador sob transação
IMMEDIATE, depois da derivação da senha. O singleton id=1 impede segundo admin.
Não existe cadastro público de administrador adicional.

## Recuperação

Com acesso ao console da instalação existente, emitir:

```sh
ARTESAO_DISTRIBUTION=debian node dist-server/pilot/local-admin-console.js recovery-code /caminho/privado/dados /caminho/privado/codigos/recuperacao-nova
```

Abrir `/artesaos-piloto/admin/recover` (link Recuperar acesso), informar e-mail
administrativo existente, nova senha, confirmação e código. Não modifica e-mail,
contas Google ou dados comerciais. O sucesso troca o hash, invalida todas as
sessões administrativas, consome o código e exige novo login. Não reabre setup.
Código errado/expirado não altera senha ou sessão. Remover o arquivo após uso.
Não editar diretamente SQLite nem apagar bancos para recuperar acesso.

## Segurança e limites

- scrypt N=32768, r=8, p=1, salt aleatório 128 bits e chave 512 bits; maxmem 64 MiB.
  Até duas derivações simultâneas por processo; excedente responde ocupado.
- Sessão administrativa: 1 hora, inatividade 15 minutos, cookies Secure/HttpOnly
  para sessão, CSRF/contexto/origem nas alterações e rotação no login.
- Limites persistentes de tentativas por IP e global. São limites do processo de
  autenticação, não justificativa para confiar em X-Forwarded-For arbitrário.
- O servidor continua trustProxy=false. Topologia TLS/proxy real será validada
  antes da implantação; clientes atrás do mesmo proxy podem compartilhar limite.
- Sem Google administrativo no Debian, inclusive callback administrativo antigo.
  Google de usuários continua separado de administração e de outros tenants.
- Código jamais enviado pela API. Nenhum segredo padrão ou credencial no artefato.
- Nenhum código é gerado automaticamente ao iniciar: instalação/console local
  precisa autorizá-lo. Nunca executar esses exemplos contra o HA real.
- Conta administrativa gerencia a instalação; não cria automaticamente uma conta
  comercial e não concede às APIs de usuário acesso a outros tenants.

## Validação versus instalação real

Os testes cobrem APIs injetadas, fixtures SQLite, console em subprocesso e OIDC
com provedor de teste. Isso não certifica Google real, navegador físico, TLS,
DuckDNS, Docker ou notebook. Não foram executados testes de saúde/estresse do HD.
