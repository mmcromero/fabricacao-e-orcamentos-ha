# Fabricação e Orçamentos — Validação

Aplicativo experimental com React, TypeScript, Fastify e SQLite no Node.js 24.
A tela inicial é Orçamentos. Clientes, Produtos, orçamentos e configurações são
persistentes na instalação. Fabricação usa o mesmo cadastro de Produtos, com
custos e preços calculados a partir de parâmetros configurados. Aplicar preços
exige escolha explícita. Prazo, cotação automática de frete, envio de mensagens
e publicação no site ainda não estão implementados. Entrega e frete podem ser informados
manualmente; o orçamento pode ser finalizado e marcado como enviado pelo usuário.

- [Uso e limites](DOCS.md)
- [Carga piloto e preenchimento complementar](PILOTO.md)
- [Arquitetura e execução independente](../../docs/arquitetura.md)

No Home Assistant a instalação das novas versões é manual. Não habilitar
atualização automática. Faça backup incluindo o aplicativo e guarde cópia externa
antes de atualizar. O modo independente é local, sem login, restrito a loopback.
