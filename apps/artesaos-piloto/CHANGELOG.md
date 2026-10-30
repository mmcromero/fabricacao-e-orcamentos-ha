# Histórico do Artesão Digital — Testes

## 0.1.2

- Adota Artesão Digital como nome visível no aplicativo, telas de login e instalação de testes.
- Abre Orçamentos automaticamente após login e ao acessar o login com sessão válida.
- Mantém as duas versões em rodapé fixo visível, com espaço reservado para não cobrir controles.
- Usa faixa verde fixa no topo, com nome à esquerda, e-mail centralizado e Sair à direita, adaptada a telas estreitas.
- Preserva slug, volume, contas, convites e URL de retorno Google existentes.
- Inclui Abrir interface Web na página do aplicativo do HA, apontando ao login HTTPS pela porta já existente8443.
- Acrescenta testes de rodapé dentro do viewport e marca da implantação nas áreas principais.

## 0.1.1

- Exibe no rodapé a versão do piloto e a versão-base do Fabricação e Orçamentos, obtidas dos metadados de compilação.

- Conclui o login em uma página própria, remove parâmetros OAuth do histórico e confirma a sessão antes de abrir Produtos automaticamente.
- Usa a mesma entrada para primeiro acesso e novo login sem convite, mantendo os dados e as contas já ativadas.
- Mostra orientação explícita quando a sessão não pode ser reconhecida, sem retornar silenciosamente à tela de convite.
- Testa Produtos efetivamente renderizado após login, além da barra da conta, sem abrir links manuais.
- Exercita duas contas, logout/novo login, sessão inicialmente indisponível e sessão ausente através de Nginx HTTPS com backend HTTP, usando provedor controlado.
- Preserva porta externa na rota sem barra final no gerador Nginx.

## 0.1.0

- Primeira versão experimental com Google OpenID Connect, convites individuais, sessões protegidas e banco separado por conta.
- Instalação separada no Home Assistant; uso somente com dados fictícios enquanto a validação e as proteções pendentes não forem concluídas.
