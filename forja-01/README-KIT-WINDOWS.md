# Kit de Publicação Forja 01 — Windows

Distribuição limpa, revisão de 04/11/2026. Fluxo manual principal do piloto Nível 1. Reutiliza o launcher e o motor oficiais existentes; não instala serviços nem muda sudo, políticas do Windows ou a aplicação por conta própria.

**Comece pelo `MANUAL-INSTALACAO-E-RECUPERACAO.txt`.** Ele contém os comandos para CMD, instalação limpa, desbloqueio seletivo e diagnóstico.

## Download oficial e integridade

- [ZIP completo](https://raw.githubusercontent.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/Instalar-Atualizador-Forja-01.zip)
- [SHA-256 do ZIP](https://raw.githubusercontent.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/Instalar-Atualizador-Forja-01.zip.sha256)
- [Checksums da distribuição](https://github.com/mmcromero/fabricacao-e-orcamentos-ha/blob/main/forja-01/SHA256SUMS)

Compare o SHA-256 antes de desbloquear/extrair. Hash divergente, detecção de ameaça ou procedência duvidosa: interrompa. Não restaure itens em quarentena nem crie exclusões de antivírus para prosseguir.

## Pré-requisitos

Windows PowerShell 5.1, OpenSSH Client (`ssh.exe`/`scp.exe`) e acesso já aprovado ao Forja via Tailscale. Autenticação SSH por chave aprovada e host key confiável no OpenSSH. O kit não exige Python no Windows, Git, GitHub CLI ou token GitHub. A sessão administrativa usa o Python/Docker já existentes no Debian.

A chave privada e a confiança do host são configuradas fora do kit, no OpenSSH/agent aprovado. Uma chave com senha exige seu mecanismo de desbloqueio já configurado; não remover a senha ou salvá-la em scripts. O kit usa `BatchMode=yes`, portanto não oferece login por senha SSH. Sudo, quando necessário, pede sua senha no terminal remoto interativo, sem salvá-la.

## Instalação limpa

1. Baixe e confira o ZIP oficial. Depois disso, se aplicável, desbloqueie **o ZIP específico**, seguindo o TXT. Não enfraqueça políticas corporativas.
2. Extraia em uma pasta nova e gravável do seu usuário, por exemplo `%USERPROFILE%\Forja01-Kit-Limpo`. Não extraia por cima de um kit antigo ou dentro de Program Files.
3. Abra `Atualizador-Forja-01\forja-config.json` no Bloco de Notas e preencha `sshHost`/`sshUser`, conferindo porta e `installationRoot`. O modelo distribuído tem esses dois campos vazios, sem identidade local ou segredo. `backupPath` e `recoveryEvidencePath` podem permanecer `null` no Nível 1; este kit não impõe backup frio novo.
4. Execute **Baixar-Pacote.cmd** primeiro. Ele usa a publicação oficial, valida os hashes e prepara o ZIP em Pacotes. Não conecta ao Forja.
5. Execute **Verificar-Download.cmd** para conferir o pacote sem conectar ao servidor.
6. Somente quando a atualização estiver autorizada e não houver backup em andamento, execute **Atualizar-Forja-01.cmd**. Confira destino/nível/plano e responda `ATUALIZAR` no prompt do mecanismo existente. Uma origem legada pode exigir `ACEITAR LEGADO`; não aceite divergência desconhecida como atalho.

As três janelas aguardam uma tecla ao final. Abra pelo CMD se a janela não permanecer aberta. Códigos de falha são preservados; nenhum CMD exclui seus próprios arquivos.

## Conteúdo do kit

- `Baixar-Pacote.cmd`, `Verificar-Download.cmd`, `Atualizar-Forja-01.cmd`.
- `Forja01.ps1`: launcher existente, sem reescrita.
- `forja-admin.py`: auxiliar administrativo existente, sem alteração.
- `forja-config.json`: modelo de configuração limpo, sem credenciais.
- `README.md`, `MANUAL-INSTALACAO-E-RECUPERACAO.txt`, `LEIA-ME.txt`.
- `SHA256SUMS`: hashes dos arquivos do kit (o hash do próprio ZIP fica publicado separadamente).
- `Pacotes/`: pasta inicialmente vazia, sem versão da aplicação embutida.

`Concluidos`, `Pacotes-Anteriores` e `Relatorios` são criados pelo fluxo existente quando necessários. Apenas `Concluidos` indica execução confirmada; healthcheck não substitui homologação funcional.

## Reinstalação e credenciais

Se perder o kit ou trocar de computador, baixe este ZIP completo e extraia em pasta nova. Reconfigure o JSON ou recupere somente sua configuração local revisada. Não precisa copiar nenhum script avulso de um kit antigo. Restabeleça separadamente OpenSSH/Tailscale, chave SSH aprovada e confiança do host; não inclua esses arquivos no ZIP.

Não copie chaves de recuperação de backups para o kit. O arquivo de configuração não armazena senha SSH/sudo, token ou nível operacional. Não grave senha no JSON, em CMD ou em transcript. Preserve os relatórios antigos que precisar guardar; não há obrigação de misturar pastas de pacotes antigos para uma instalação limpa.

## Segurança Windows e diagnóstico

O CMD solicita `RemoteSigned` somente para o processo PowerShell, como na versão anterior; não altera política persistente. GPO de máquina/usuário prevalece. Arquivo de Internet sem assinatura pode exigir desbloqueio seletivo após conferir o hash. `AllSigned` imposto exige assinatura confiável/decisão do administrador; não usar Bypass/Unrestricted como correção.

Na investigação desta revisão foi reproduzido o bloqueio “não está assinado digitalmente” em arquivo com ZoneId=3. O desaparecimento dos CMDs **não foi reproduzido nem atribuído ao atualizador**. Conferir Histórico de Proteção do Defender e, se houver, quarentena do antivírus de terceiros. O launcher limpa apenas suas áreas temporárias geradas; não há instrução de excluir os componentes do kit.

## Correção desta revisão

`Atualizar-Forja-01.cmd` passou a capturar o código de saída do PowerShell antes do `pause` e retorná-lo ao chamador, como os outros dois CMDs já faziam. Falha simulada exit7 retornava0 no CMD antigo e retorna7 no corrigido. README/TXT foram completados. Os outros dois CMDs, launcher e auxiliar administrativo permanecem byte a byte iguais ao kit oficial anterior.

Fontes: [Execution Policies](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies/), [Unblock-File](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/unblock-file), [Histórico de Proteção](https://support.microsoft.com/en-us/windows/security/windows-security/protection-history-in-the-windows-security-app).
