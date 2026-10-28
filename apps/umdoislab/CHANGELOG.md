# Histórico

## 0.1.3

- Adiciona wireframe navegável do cadastro de produto em modal dentro do orçamento.
- Preserva cliente, CEP e observações ao abrir/fechar o cadastro.
- Demonstra uso só no orçamento ou também no catálogo, em memória desta página.
- Separa origem (próprio/de cliente) e autorização de divulgação; privado por padrão.
- Exibe preço de venda informado, medidas da peça e pendências sem calcular fabricação ou consultar frete.
- Inclui verificação do fluxo em Chromium, desktop e celular.
- O wireframe não usa banco nem salva produtos reais; a anotação de teste permanece intacta.

## 0.1.2

- Separa o controle por Ingress do servidor de aplicação.
- Adiciona modo independente local, com endereço de loopback obrigatório.
- Permite configurar porta e armazenamento sem mudar o banco ou seu esquema.
- Resolve arquivos estáticos independentemente do diretório de execução.
- Documenta backup, restauração e preparação do repositório Home Assistant.
- Solicita backup frio no Supervisor para manter o SQLite consistente.
- Adiciona testes de processo, persistência, restauração e caminhos com prefixo.

## 0.1.1

- Renomeia a interface e o painel para Fabricação e Orçamentos.
- Mantém o identificador interno para atualização da instalação local existente.

## 0.1.0

- Primeira aplicação de validação: React, API e anotação persistida em SQLite.
