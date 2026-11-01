# Prioridades posteriores à 0.2.0-dev.12 — registrar, não implementar

## Alta: auditoria abrangente

LGPD, segurança, bases legais, retenção, exclusão, exportação e tratamento de dados
pessoais. Revisão jurídica dos textos iniciais beta e processos reais da instalação.
Revisar armazenamento, backups, permissões e segurança de arquivos enviados.

## Central de Resultados e Indicadores

Gráficos de faturamento/evolução, custos/despesas/resultados, produtos, feiras/eventos,
visitantes/conversão, novos contatos por evento, origem e retorno de contatos captados.
Usar eventos/IDs/snapshots históricos; não recalcular vendas antigas com preços atuais.
Nenhum gráfico entregue neste pacote.

## Catálogos personalizados

Escolher tabela de preços ao gerar catálogo (atacado/varejo/outra disponível),
independentemente da classificação informativa do cliente.

Backlog anterior preservado abaixo (fretes, notificações, licenciamento, imagens, PWA
etc.); itens não promovidos expressamente continuam fora do escopo.

---

# Backlog do Artesão Digital

## Regras

“Colocar no backlog” registra em **Ideias Futuras**, sem execução automática. “Backlog do pacote” ou decisão explícita promove para entrega.

## Pacote experimental 0.1.15

- Logo individual opcional, única por conta, otimizada, substituível e removível; sem histórico de imagens.
- Dados da empresa no documento final (promovido explicitamente).
- PDF em memória, edições e valores preservados, logo atual, baixar e compartilhar quando suportado; envio confirmado separadamente.
- Aviso de guarda da cópia entregue; testes e medidas locais. Validação real e capacidade do servidor continuam pendentes.
- Estrutura jurídica preparada, desativada por padrão, com minutas em legal-drafts.

## Pacote experimental 0.1.16 — fechamento autorizado

- Administração: lista de usuários que efetivamente ativaram a conta com convite e Google, com e-mail, total e situação do acesso; separada dos interessados e dos convites não usados. Botão Exibir dados com empresa, responsável, telefone e e-mail de contato; somente consulta nesta etapa.
- Convites: formulário nome/e-mail/WhatsApp e canal; Salvar gera código e mensagem; novos códigos vinculam à primeira conta Google que usar; aceitos saem da lista e entram em Usuários cadastrados. Sem controle de envio no produto.
- WhatsApp com mensagem pronta via wa.me; SMTP opcional para e-mail automático após configurar no servidor. Validação real de envio ainda pendente.
- Manutenção: documentar parada/desinstalação futura do principal e recuperação do acesso por reinício do Nginx.
- Fechamento/publicação autorizados expressamente após estimativa de 10 a 20 minutos. Outras ideias futuras não são promovidas por esta autorização.

## Pacote experimental 0.1.17 — autorizado

- Convites somente pela administração; retirada dos cinco pares das opções e da trava de cinco contas em produção.
- Sem vencimento nos novos/atuais ativos; antigos expirados/revogados não são reativados automaticamente.
- Revogar e Ativar novamente com novo código, mantendo anterior inválido; preservação de contas, contatos e chave.
- Busca/paginação e bancos abertos sob demanda, sem limite fixo de cadastro.
- Fechamento/publicação autorizados pelo usuário; outras ideias futuras não foram promovidas.

## Próximo Pacote — legal e operação

- Revisar e ativar documentos públicos, identificação/contato, aceite antes das boas-vindas e informação de cookies da instalação.
- Definir retenção, incidentes, direitos, saída/exportação completa e descarte.
- Inventariar fornecedores/transferências, público etário, papéis e obrigações; revisão jurídica atualizada.

## Para o primeiro release piloto

- Concluir pacote legal; testar celular real, Google real e hospedagem/HA.
- Conferir cálculos, isolamento de contas/logos/documentos/chamados, atualização, reinício e restauração.
- Backup inexistente atualmente: definir, configurar e testar recuperação protegida em outro dispositivo/local.
- Medir memória, desempenho e espaço no servidor efetivo; revisar textos contra operação e normas vigentes.
- Corrigir falhas que impeçam o fluxo, alterem valores ou exponham dados. Compilar/publicar este pacote não declara release estável.

## Ideias Futuras

- Administração completa de usuários: quantidade, acessos, recuperação/revogação.
- Upload/substituição da marca Artesão Digital pela administração (distinto da logo individual).
- Catálogo público.
- Envio automático por API do WhatsApp Business; e-mail SMTP foi promovido explicitamente para a preparação atual.
- Aprovação/assinatura eletrônica.
- Pagamentos.
- Cálculo automático de frete e prazo.
