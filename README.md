# Fabricação e Orçamentos

Distribuição experimental para Home Assistant. Versão 0.1.8.
A interface atual valida API, SQLite e persistência de uma anotação de teste.
O catálogo de Produtos possui gravação persistente e importação piloto com conferência.
Clientes, fabricação e orçamentos persistentes ainda não estão implementados.
Há um wireframe navegável do cadastro de produto dentro do orçamento, acessível
pela tela inicial. O wireframe usa dados temporários e não consome o catálogo real.
A área Produtos é separada e grava no banco; consulte apps/umdoislab/PILOTO.md.

## Instalar

Na loja de aplicativos do Home Assistant, adicione este repositório:

https://github.com/mmcromero/fabricacao-e-orcamentos-ha

Instale **Fabricação e Orçamentos — Validação**, inicie e abra a interface pelo
Ingress. Não habilite atualização automática: a instalação de cada versão é
manual. A detecção depende da atualização do catálogo e de uma versão maior
no manifesto, não de qualquer commit. Não abrir portas no roteador.

Se já existe uma instalação local, não a desinstale: o aplicativo do repositório
tem outro volume e os dados não são transferidos automaticamente.

- [Instalação e migração](docs/migracao-repositorio.md)
- [Execução independente e arquitetura](docs/arquitetura.md)
- [Verificações da distribuição](docs/instalacao-home-assistant.md)

Este repositório é um artefato de distribuição gerado da base de desenvolvimento.
As alterações são feitas na base e exportadas; não manter duas implementações.
Ainda não foi definida uma licença para distribuição open source. A visibilidade
pública, por si só, não concede essa licença.
