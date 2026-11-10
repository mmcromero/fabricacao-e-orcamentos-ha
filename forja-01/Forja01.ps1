param([switch]$VerificarDownload, [switch]$BaixarPacote)

# Stable launcher. No publication level or version is stored in the shortcut/config.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:OfficialRoot = 'https://raw.githubusercontent.com/mmcromero/fabricacao-e-orcamentos-ha/'
$script:PublicationsRoot = $script:OfficialRoot + 'main/forja-01/publicacoes/'

function Get-Field($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $p = $Object.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}
function Assert-Publication($Publication) {
    if ((Get-Field $Publication 'metadataVersion') -ne 1 -or (Get-Field $Publication 'repository') -ne 'mmcromero/fabricacao_e_orcamentos' -or (Get-Field $Publication 'distribution') -ne 'debian') { throw 'Origem/formato da publicacao invalidos.' }
    $version = Get-Field $Publication 'version'; $commit = Get-Field $Publication 'sourceCommit'
    if ($version -isnot [string] -or -not $version -or $commit -cnotmatch '^[0-9a-f]{40}$') { throw 'Versao/commit de destino ausente ou invalido.' }
    $policy = Get-Field $Publication 'securityPolicy'; $level = Get-Field $policy 'level'
    if (($level -isnot [int] -and $level -isnot [long]) -or $level -notin @(1,2) -or (Get-Field $policy 'decision') -ne 'explicit-owner-approval') { throw 'Nivel de publicacao ausente, invalido ou sem aprovacao.' }
    $package = Get-Field $Publication 'package'
    foreach ($key in @('sha256','policySha256')) {
        if ((Get-Field $package $key) -cnotmatch '^[0-9a-f]{64}$') { throw 'Integridade do pacote/politica ausente.' }
    }
    $runner = Get-Field $Publication 'runner'
    if ((Get-Field $runner 'sha256') -cnotmatch '^[0-9a-f]{64}$') { throw 'Runner sem integridade oficial.' }
}
function Get-Requirements([int]$Level) {
    $common = @('Versao/commit e integridade; compatibilidade sem migracao', 'Preservar dados, volumes e configuracao; imagem anterior/retorno', 'Inicializacao, healthcheck, versao efetiva e registro do resultado')
    switch ($Level) {
        1 { return $common + @('Backup recomendado; certificacao/copia externa/recuperacao nao sao pre-requisitos') }
        2 { return $common + @('Politica Nivel 2 completa e aprovada', 'Backup recente, integro e compativel; evidencia de recuperacao e copia independente') }
        default { throw 'Nivel invalido; nenhuma atualizacao executada.' }
    }
}
function Get-OfficialFile([string]$Url, [string]$Destination) {
    $pattern = '^https://raw\.githubusercontent\.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/publicacoes/([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)\.json$'
    if ($Url -cnotmatch $pattern) { throw 'URL fora da origem publica oficial de metadados.' }
    Get-DistributionFile $Url $Destination
}
function Get-DistributionFile([string]$Url, [string]$Destination) {
    $pattern = '^https://raw\.githubusercontent\.com/mmcromero/fabricacao-e-orcamentos-ha/main/forja-01/(?:publicacao-atual\.json|publicacoes/[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?\.json|Forja-01-[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?\.zip)$'
    $releasePattern = '^https://github\.com/mmcromero/fabricacao_e_orcamentos/releases/download/forja-(?<tag>[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)/Forja-01-(?<zip>[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)\.zip$'
    $release = $Url -cmatch $releasePattern
    if ($release) {
        if ($Matches['tag'] -cne $Matches['zip']) { throw 'Versao da Release diverge do arquivo ZIP.' }
    } elseif ($Url -cnotmatch $pattern) {
        throw 'URL fora das origens oficiais de distribuicao.'
    }
    Write-Host ('Consultando origem publica oficial: ' + $Url)
    try {
        if ($release) {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -MaximumRedirection 5 | Out-Null
        } else {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -MaximumRedirection 0 | Out-Null
        }
        Write-Host 'Arquivo obtido por HTTPS, sem login GitHub.'
    } catch {
        $response = Get-Field $_.Exception 'Response'
        $status = Get-Field $response 'StatusCode'
        if ($null -eq $status) { throw ('Falha de rede/TLS ao consultar ' + $Url + '. Nenhum servidor foi contatado.') }
        throw ('HTTP ' + [int]$status + ' ao consultar ' + $Url + '. Origem publica indisponivel ou versao nao publicada. Nenhum servidor foi contatado; nao foi usado nivel padrao ou metadado local como substituto.')
    }
}

function Assert-Hash([string]$Path, [string]$Expected) {
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant() -cne $Expected) { throw 'Integridade SHA256 divergente; operacao interrompida.' }
}
function Read-Configuration([string]$Path) {
    $c = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    if ((Get-Field $c 'sshHost') -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*$' -or (Get-Field $c 'sshUser') -cnotmatch '^[a-zA-Z_][a-zA-Z0-9_-]*$') { throw 'Destino SSH invalido.' }
    $port = Get-Field $c 'sshPort'
    if (($port -isnot [int] -and $port -isnot [long]) -or $port -lt 1 -or $port -gt 65535) { throw 'Porta SSH invalida.' }
    foreach ($key in @('installationRoot','backupPath','recoveryEvidencePath')) {
        $value = Get-Field $c $key
        if (($key -eq 'installationRoot' -or $null -ne $value) -and ($value -isnot [string] -or $value -cnotmatch '^/[a-zA-Z0-9_./-]+$' -or $value -match '(^|/)\.\.(/|$)')) { throw 'Caminho remoto invalido.' }
    }
    if ($null -ne (Get-Field $c 'level') -or $null -ne (Get-Field $c 'securityPolicy')) { throw 'Nivel nao pode ser configurado no Windows.' }
    return $c
}
function Invoke-ForjaSsh($Config, [string]$Command) {
    $result = & ssh.exe -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -p $Config.sshPort ($Config.sshUser + '@' + $Config.sshHost) $Command
    if ($LASTEXITCODE -ne 0) {
        # The remote helper may return a sanitized diagnostic JSON with an error/blockers.
        if ($result) {
            try {
                $diagnostic = ($result -join "`n") | ConvertFrom-Json
                if (Get-Field $diagnostic 'error') { Write-Host ('Erro remoto: ' + $diagnostic.error) }
                $remotePlan = Get-Field $diagnostic 'plan'
                foreach ($blocker in @(Get-Field $remotePlan 'blockers')) { if ($blocker) { Write-Host ('Bloqueio: ' + $blocker) } }
            } catch { Write-Host 'Diagnostico remoto indisponivel; nenhuma recuperacao automatica executada.' }
        }
        throw 'SSH ou verificacao remota falhou. Nenhuma recuperacao automatica foi solicitada.'
    }
    return ($result -join "`n")
}
function Send-ForjaFiles($Config, [string[]]$Files, [string]$Directory) {
    & scp.exe -q -o BatchMode=yes -o StrictHostKeyChecking=yes -P $Config.sshPort @Files ($Config.sshUser + '@' + $Config.sshHost + ':' + $Directory + '/')
    if ($LASTEXITCODE -ne 0) { throw 'Transferencia SSH falhou.' }
}
function Invoke-ForjaAdmin($Config, [string]$Command) {
    # Native console I/O: sudo reads its password directly from the remote PTY.
    # Never capture this terminal stream, pipe a password, or start a transcript.
    & ssh.exe -tt -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -p $Config.sshPort ($Config.sshUser + '@' + $Config.sshHost) $Command
    if ($LASTEXITCODE -ne 0) { throw 'Sessao administrativa falhou; sem repeticao automatica. Consultar recibos antes de tentar novamente.' }
}
function Expand-Delivery([string]$ZipPath, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $expected = @('publication.json','package.tar.gz','forja-update.py')
        if ($zip.Entries.Count -ne $expected.Count) { throw 'Pacote Windows incompleto ou ambiguo.' }
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -cnotin $expected -or $seen.ContainsKey($entry.FullName)) { throw 'Entrada ZIP invalida ou duplicada.' }
            $seen[$entry.FullName] = $true
        }
        foreach ($entry in $zip.Entries) {
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $Destination $entry.FullName), $false)
        }
    } finally { $zip.Dispose() }
}
function Read-VerifiedDelivery([string]$ZipPath, [string]$work) {
        Expand-Delivery $ZipPath $work
        $descriptorPath = Join-Path $work 'publication.json'
        $local = Get-Content -Raw -Encoding UTF8 -LiteralPath $descriptorPath | ConvertFrom-Json
        # The filename/version from the ZIP is untrusted until matched with the official repository.
        $version = Get-Field $local 'version'
        if ($version -isnot [string] -or $version -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$') { throw 'Identificador de publicacao invalido.' }
        $official = Join-Path $work 'official.json'
        Get-OfficialFile ($script:PublicationsRoot + $version + '.json') $official
        $d = Get-Content -Raw -Encoding UTF8 -LiteralPath $official | ConvertFrom-Json
        Assert-Publication $d
        if ($d.version -cne $version) { throw 'Versao do arquivo diverge da publicacao oficial.' }
        Assert-Hash $descriptorPath ((Get-FileHash -Algorithm SHA256 -LiteralPath $official).Hash.ToLowerInvariant())
        $archive = Join-Path $work 'package.tar.gz'; $runner = Join-Path $work 'forja-update.py'
        Assert-Hash $archive $d.package.sha256
        Assert-Hash $runner $d.runner.sha256
        return $d
}
function Invoke-ForjaDownload([string]$HomeDirectory) {
    $inbox = Join-Path $HomeDirectory 'Pacotes'
    New-Item -ItemType Directory -Path $inbox -Force | Out-Null
    # Same filesystem for atomic promotion. Partial files are never visible as pending ZIPs.
    $work = Join-Path $HomeDirectory ('.download-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        $catalogPath = Join-Path $work 'current.json'
        Get-DistributionFile ($script:OfficialRoot + 'main/forja-01/publicacao-atual.json') $catalogPath
        $c = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json
        $version = Get-Field $c 'version'
        if ((Get-Field $c 'catalogVersion') -ne 1 -or (Get-Field $c 'repository') -cne 'mmcromero/fabricacao_e_orcamentos' -or (Get-Field $c 'distribution') -cne 'debian' -or $version -isnot [string] -or $version -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$') { throw 'Indice oficial ausente ou invalido.' }
        $name = 'Forja-01-' + $version + '.zip'
        if ((Get-Field $c 'file') -cne $name -or (Get-Field $c 'sha256') -cnotmatch '^[0-9a-f]{64}$' -or (Get-Field $c 'metadataSha256') -cnotmatch '^[0-9a-f]{64}$') { throw 'Arquivo/integridade ausente no indice oficial.' }
        $official = Join-Path $work 'publication-target.json'
        Get-OfficialFile ($script:PublicationsRoot + $version + '.json') $official
        Assert-Hash $official $c.metadataSha256
        $d = Get-Content -Raw -Encoding UTF8 -LiteralPath $official | ConvertFrom-Json
        Assert-Publication $d
        if ($d.version -cne $version -or $d.sourceCommit -cne (Get-Field $c 'sourceCommit')) { throw 'Indice e publicacao oficial inconsistentes.' }
        Write-Host ('Versao publicada: ' + $version + ' | commit ' + $d.sourceCommit + ' | nivel ' + $d.securityPolicy.level)
        $target = Join-Path $inbox $name
        $candidate = Join-Path $work 'package.zip.part'
        $reuse = (Test-Path -LiteralPath $target -PathType Leaf) -and ((Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant() -ceq $c.sha256)
        if ($reuse) { $candidate = $target; Write-Host 'Arquivo existente possui SHA256 oficial; conferindo conteudo.' }
        else {
            $downloadUrl = Get-Field $c 'downloadUrl'
            if ($null -eq $downloadUrl) {
                $downloadUrl = $script:OfficialRoot + 'main/forja-01/' + $name
            } else {
                $expectedUrl = 'https://github.com/mmcromero/fabricacao_e_orcamentos/releases/download/forja-' + $version + '/' + $name
                if ($downloadUrl -cne $expectedUrl) { throw 'Endereco de download diverge da origem oficial esperada.' }
            }
            Get-DistributionFile $downloadUrl $candidate
        }
        Assert-Hash $candidate $c.sha256
        $check = Join-Path $work 'verified'; New-Item -ItemType Directory -Path $check | Out-Null
        $verified = Read-VerifiedDelivery $candidate $check
        Assert-Hash (Join-Path $check 'official.json') $c.metadataSha256
        if ($verified.sourceCommit -cne $d.sourceCommit) { throw 'Pacote difere da publicacao selecionada.' }
        $previous = Join-Path $HomeDirectory 'Pacotes-Anteriores'
        if (-not $reuse) {
            if (Test-Path -LiteralPath $target) {
                New-Item -ItemType Directory -Path $previous -Force | Out-Null
                [IO.File]::Replace($candidate, $target, (Join-Path $previous ([guid]::NewGuid().ToString('N') + '-' + $name)))
            } else { [IO.File]::Move($candidate, $target) }
        }
        # Preserve other pending ZIPs outside the inbox; never guess which one to install.
        foreach ($old in @(Get-ChildItem -LiteralPath $inbox -Filter '*.zip' -File)) {
            if ($old.FullName -cne $target) {
                New-Item -ItemType Directory -Path $previous -Force | Out-Null
                Move-Item -LiteralPath $old.FullName -Destination (Join-Path $previous ([guid]::NewGuid().ToString('N') + '-' + $old.Name))
                Write-Host ('Pacote anterior preservado em: ' + $previous)
            }
        }
        Write-Host ('SUCESSO: ' + $name + ' | SHA256 ' + $c.sha256)
        Write-Host ('Salvo em: ' + $target)
        Write-Host 'Somente download/validacao. Nenhum SSH, diagnostico ou instalacao executado.'
        Write-Host 'Proximo passo opcional: Verificar-Download.cmd. Atualizar-Forja-01.cmd exige autorizacao separada.'
    } finally { Remove-Item -LiteralPath $work -Recurse -Force }
}
function Invoke-ForjaUpdate([string]$ConfigPath, [switch]$DownloadOnly) {
    $homeDir = Split-Path -Parent $ConfigPath
    $inbox = Join-Path $homeDir 'Pacotes'
    if (-not (Test-Path -LiteralPath $inbox)) { New-Item -ItemType Directory -Path $inbox | Out-Null }
    $pending = @(Get-ChildItem -LiteralPath $inbox -Filter '*.zip' -File)
    if ($pending.Count -eq 0) { throw 'Coloque o arquivo ZIP gerado pelo Codex na pasta Pacotes e execute este mesmo atalho.' }
    if ($pending.Count -ne 1) { throw 'Mais de um pacote aguardando em Pacotes. Nenhum foi escolhido ou executado.' }
    $work = Join-Path ([IO.Path]::GetTempPath()) ('artesao-forja-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        $d = Read-VerifiedDelivery $pending[0].FullName $work
        $descriptorPath = Join-Path $work 'publication.json'
        $archive = Join-Path $work 'package.tar.gz'; $runner = Join-Path $work 'forja-update.py'
        Write-Host ('Destino: Artesao Digital ' + $d.version + ' | commit ' + $d.sourceCommit)
        Write-Host ('Nivel identificado na publicacao: ' + $d.securityPolicy.level)
        Write-Host 'Verificacoes exigidas (executadas pelo operations.py existente):'
        Get-Requirements $d.securityPolicy.level | ForEach-Object { Write-Host (' - ' + $_) }
        if ($DownloadOnly) { Write-Host 'Download e integridade confirmados. Teste encerrado SEM conectar ao Forja.'; return }
        $config = Read-Configuration $ConfigPath
        $remote = '/tmp/artesao-forja-' + [guid]::NewGuid().ToString('N')
        Invoke-ForjaSsh $config ('umask 077 && mkdir ' + $remote) | Out-Null
        $admin = Join-Path $homeDir 'forja-admin.py'
        if (-not (Test-Path -LiteralPath $admin)) { throw 'Ferramenta administrativa ausente; atualizar o kit preservando configuracao e Pacotes.' }
        Send-ForjaFiles $config @($descriptorPath,$archive,$runner,$admin) $remote
        $command = 'sudo -- python3 ' + $remote + '/forja-admin.py --work ' + $remote + ' --root ' + $config.installationRoot
        if (Get-Field $config 'backupPath') { $command += ' --backup ' + $config.backupPath }
        if (Get-Field $config 'recoveryEvidencePath') { $command += ' --recovery-evidence ' + $config.recoveryEvidencePath }
        Write-Host 'Se necessario, sudo solicitara sua senha administrativa. A digitacao nao aparece.'
        Write-Host 'Uma unica sessao executa o plano, pede sua autorizacao e conclui a atualizacao.'
        Invoke-ForjaAdmin $config $command
        $result = (Invoke-ForjaSsh $config ('cat ' + $remote + '/admin-result.json')) | ConvertFrom-Json
        $reports = Join-Path $homeDir 'Relatorios'
        if (-not (Test-Path -LiteralPath $reports)) { New-Item -ItemType Directory -Path $reports | Out-Null }
        $result | ConvertTo-Json -Depth 50 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $reports (([guid]::NewGuid().ToString('N')) + '-resultado.json'))
        Write-Host ('Resultado da execucao: ' + $result.status)
        if ($result.status -eq 'cancelled') { Write-Host 'Cancelado; pacote permanece pendente.'; return }
        if ($result.status -ne 'healthy' -or $result.observed.declared.sourceCommit -ne $d.sourceCommit -or $result.securityLevel -ne $d.securityPolicy.level) { throw 'Atualizacao nao confirmada para a publicacao selecionada; consultar recibos.' }
        $done = Join-Path $homeDir 'Concluidos'
        if (-not (Test-Path -LiteralPath $done)) { New-Item -ItemType Directory -Path $done | Out-Null }
        Move-Item -LiteralPath $pending[0].FullName -Destination (Join-Path $done (([guid]::NewGuid().ToString('N')) + '-' + $pending[0].Name))
        Write-Host ('Resultado: healthy. Commit instalado confirmado: ' + $result.observed.declared.sourceCommit)
        Write-Host 'Homologacao funcional e login real ainda devem ser conferidos.'
    } finally {
        Remove-Item -LiteralPath $work -Recurse -Force
    }
}
if ($MyInvocation.InvocationName -ne '.') {
    try {
        if ($BaixarPacote -and $VerificarDownload) { throw 'Escolha somente um comando.' }
        if ($BaixarPacote) { Invoke-ForjaDownload $PSScriptRoot }
        else { Invoke-ForjaUpdate (Join-Path $PSScriptRoot 'forja-config.json') -DownloadOnly:$VerificarDownload }
    }
    catch { Write-Host ('ERRO: ' + $_.Exception.Message); exit 1 }
}
