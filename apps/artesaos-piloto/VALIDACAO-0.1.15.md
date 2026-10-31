# Validação local — 0.1.15 experimental

Data: 31/10/2026. Base preservada: Fabricação e Orçamentos 0.1.23 / f56f0e5707ad81f74f42c351171d4132f793cf9a. Reconstrução a partir do publicado 22db072; não foram recuperados os arquivos locais perdidos da sessão anterior.

## Evidências

- `npm run build`: TypeScript cliente/servidor, Vite e metadados consistentes.
- `npm test`: 50 testes, todos aprovados. Os cinco novos testes cobrem PNG/transparência/revisão/remoção/reinício/isolamento; edições/empresa/valores preservados, logo atual e rollback transacional; aceite desativado por padrão, bloqueio comercial/suporte, CSRF/contexto, persistência e novo aceite; imutabilidade de textos e ativação revisada; paginação e limite de concorrência.
- `python3 scripts/verify-pilot-browser.py`: Chromium com provedor Google controlado, HTTPS e certificado de teste. Fluxos existentes e novos: upload/prévia/salvamento, persistência e isolamento da logo; PDF em tela de 390 px sem transbordamento, download de arquivo real; primeiro login, novo login, contas, suporte e administração.
- `python3 scripts/verify-pilot-browser.py --legal`: mesmos fluxos com documentos fictícios ativados somente no servidor descartável; checkbox desmarcado, bloqueio das APIs de empresa/suporte antes de aceitar, aceite antes das boas-vindas, sem repetição no novo login. Compartilhamento de arquivo simulado por API controlada, com sucesso/falha e alternativa de download; ambas as situações preservam Finalizado. Não comprova a folha nativa de compartilhamento de um celular real.
- `node --import tsx scripts/verify-pilot-documents-upgrade.mjs`: banco fictício criado pelo código publicado 0.1.14; atualização preserva dados, não inventa snapshot antigo; nova finalização captura documento; cópia completa com processo parado é restaurada e lida pelo código original 0.1.14. Não configura backup real nem valida Supervisor.
- Ensaio histórico `scripts/verify-pilot-upgrade.mjs` também aprovado: migração já incorporada 0.1.19→0.1.23 em duas contas e restauração anterior. O harness foi ajustado para reconhecer as boas-vindas obrigatórias e preparar apenas seus bancos fictícios. Nenhuma nova base foi incorporada nesta entrega.
- PDF conferido visualmente e com `pdftotext`: texto selecionável, acentos, empresa, cliente, preço escolhido R$12,34 ×3, embalagem R$7,50, frete R$12,34 e total R$56,86. Preços alternativos internos não aparecem no PDF; não há custos/margens/multiplicadores. Arquivo simples com logo: aproximadamente 17 KB. Também gerado e analisado documento com múltiplas páginas.

## Consumo sintético neste worker

`node --import tsx scripts/measure-pilot-pdf.mjs`; Node 24.19.0, x64. RSS inicial ~101 MiB. Execuções sequenciais no mesmo processo, todas com 9.900 caracteres de observações; RSS inclui runtime/fontes/alocações, não memória exclusiva do PDF nem pico medido pelo sistema.

| Itens | Páginas | PDF | Tempo | RSS após geração |
| --- | --- | --- | --- | --- |
| 1 | 3 | 19.015 bytes | 1.707 ms | ~174 MiB |
| 80 | 8 | 24.110 bytes | 1.987 ms | ~184 MiB |
| 200 | 14 | 30.622 bytes | 2.450 ms | ~260 MiB |

Não extrapolar para ARM, servidor pessoal ou duas gerações simultâneas. Limites implementados: duas gerações por processo, quarenta páginas por PDF. API já limita até duzentos itens e dez mil caracteres de observações. Fontes precisam de memória mesmo com PDFs pequenos.

## Dependências e licenças

Adicionadas pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1 e pngjs 7.0.0 (MIT), tipos pngjs em desenvolvimento. Noto Sans Regular/Bold do repositório notofonts/noto-fonts, com OFL redistribuída em assets/fonts/OFL.txt. Fontes incorporadas por subconjunto; glifo não suportado vira “?”. Conferir documento antes de entregar.

`npm audit --omit=dev` apontou **3 alertas moderados**, sem altos/críticos: glob (GHSA-3g3m-2fjr-6pw4), minimatch (GHSA-g3hv-75wg-m249) e cadeia @fastify/static. A auditoria não indicou correção disponível. Não foram introduzidas atualizações do núcleo para tentar eliminar esses alertas. Reavaliar dependências e exposição antes de ampliar o piloto; auditoria automatizada não é certificação de segurança.

## Limites e pendências

Não houve teste com Google real, Home Assistant/Supervisor, ARM, telefone físico ou servidor pessoal. Não foi construído/testado novo contêiner Docker nesta rodada; a compilação e os caminhos de fontes são verificados no pacote exportado. Proxy Nginx/cache HA simulados não foram reexecutados nesta rodada. Não há backup real configurado.

Concluir revisão jurídica e conferência normativa vigente, retenção/direitos/saída/exportação/descarte, fornecedores/transferências, incidentes e público etário. O aceite permanece desativado na distribuição. Nenhuma configuração pessoal foi aplicada e o pacote não é declarado release estável.
