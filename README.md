# Fabricação e Orçamentos

Distribuição experimental para Home Assistant. Versão 0.1.23.
A interface inclui catálogo, fabricação, clientes e orçamentos persistentes. Diagnóstico fica em Suporte e diagnóstico nas configurações.
O catálogo possui categorias persistentes e importação com prévia nas Configurações de Produtos. CSV WooCommerce importa somente categorias; JSON preparado importa produtos; a carga de fabricação pode ser conciliada com o catálogo, preservando preços por padrão e exigindo confirmação das escolhas.
Clientes e Orçamentos são persistentes e usam o catálogo real. Há títulos, busca,
rascunhos, finalização e marcação manual de envio. A lista é paginada e o
formulário abre em modal. As três listas têm busca, ação Editar responsiva e paginação padrão de dez, ajustável nas Configurações de cada área. Entrega/frete são informados
manualmente ou escolhidos como retirada/cortesia sem cobrança.
Fabricação usa o cadastro único de Produtos, com parâmetros e cálculos de custo. Aplicar preços exige revisão e escolha explícita. Cotação de frete permanece manual. Marcar Enviado não envia mensagens nem faz postagem.
O formulário completo de produto é compartilhado entre Fabricação, Produtos e Orçamentos, com seções abertas conforme o contexto e aplicação individual de preços calculados. As listas permitem arquivar/restaurar registros; produtos têm filtros separados e ações de divulgação em lote, sem publicação automática no site.
Há um wireframe navegável do cadastro de produto dentro do orçamento, acessível
pela tela inicial. O wireframe usa dados temporários e não consome o catálogo real.
O fluxo real é a tela inicial. Consulte apps/umdoislab/DOCS.md e PILOTO.md.

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

## Aplicativo adicional: Artesão Digital — Testes

Disponível separadamente para instalação manual, sem substituir Fabricação e Orçamentos. Base do núcleo: 0.1.23; versão experimental do piloto: 0.1.14. Login Google próprio, convites e dados separados por conta. Requer cliente Google e rota HTTPS no proxy. Ainda não validado com Google real ou no seu Supervisor; usar apenas dados fictícios, não liberar terceiros. O banco e as opções não são criptografados em disco por esta versão.

[Configuração e limites do piloto](apps/artesaos-piloto/DOCS.md).

A versão 0.1.12 abre em Produtos, reúne configurações por abas e inclui dados da empresa por conta. A navegação tem ícones em faixa própria e menu hambúrguer no celular. O uso dos dados da empresa no documento final do orçamento permanece em [Ideias Futuras](apps/artesaos-piloto/BACKLOG.md).

A versão 0.1.13 acrescenta preparação inicial obrigatória, corrige os multiplicadores mínimos e impede a inclusão de produtos de clientes no catálogo. Despesas operacionais usam o tempo humano quando não há tempo de máquina na etapa. Contas existentes também precisam concluir a preparação inicial uma vez.

A versão 0.1.14 inclui suporte técnico no rodapé, a aba Meus chamados e a Central de suporte administrativa, com mensagens, filtros e histórico de status. O acompanhamento ocorre dentro do sistema, sem envio automático de e-mail.
