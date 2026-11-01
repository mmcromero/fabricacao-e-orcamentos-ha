#!/usr/bin/env python3
"""Operações locais explícitas; backup frio e restauração somente em diretório novo.
Não instala Docker, não configura rede, não sobrescreve dados nem emite códigos.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, tarfile, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def compose(*args, capture=False):
    env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
    return subprocess.run(['docker','--host=unix:///var/run/docker.sock','compose','--project-directory',str(ROOT),*args],check=True,text=True,capture_output=capture,env=env)

def initialize(uid,gid):
    # Refuse partially existing installations, symlinks and accidental overwrite.
    targets=[ROOT/n for n in ['data','config','private-codes','.env']]
    if any(p.exists() or p.is_symlink() for p in targets):raise ValueError('Instalação já preparada ou parcial. Não sobrescrever; revise os diretórios.')
    lines=(ROOT/'settings.env.example').read_text()
    lines=re.sub(r'^ARTESAO_UID=\d+$','ARTESAO_UID='+str(uid),lines,flags=re.M)
    lines=re.sub(r'^ARTESAO_GID=\d+$','ARTESAO_GID='+str(gid),lines,flags=re.M)
    if os.geteuid()!=0 and (os.geteuid(),os.getegid())!=(uid,gid):raise ValueError('Execute como root ou com UID/GID indicados no modelo. Não altere dados existentes.')
    for name in ['data','config','private-codes']:
        p=ROOT/name;p.mkdir(mode=0o700)
        if os.geteuid()==0:os.chown(p,uid,gid)
    for src,dst in [('settings.env.example','.env'),('options.example.json','config/options.json')]:
        p=ROOT/dst
        with p.open('x') as f:f.write(lines if dst=='.env' else (ROOT/src).read_text())
        p.chmod(0o600)
        if os.geteuid()==0:os.chown(p,uid,gid)
    print('Diretórios privados preparados. Configure options.json; nenhum serviço iniciado.')

def safe_tree(root):
    if not root.exists() or root.is_symlink():raise ValueError('Links não são aceitos.')
    for p in root.rglob('*'):
        if p.is_symlink() or not(p.is_file() or p.is_dir()):raise ValueError('Backup aceita somente arquivos/diretórios regulares.')

def backup(output):
    if output.is_symlink():raise ValueError('Link de saída recusado.')
    output=output.resolve()
    if output.exists():raise ValueError('Arquivo de backup já existe.')
    if output.is_relative_to(ROOT):raise ValueError('Guarde backup fora da pasta da instalação.')
    for name in ['data','config','.env']:safe_tree(ROOT/name)
    running=bool(compose('ps','--status','running','--quiet','artesao',capture=True).stdout.strip())
    try:
        if running:compose('stop','artesao')
        # Exclusive output, restrictive permissions; never overwrite.
        staging=output.with_name(output.name+'.incomplete')
        fd=os.open(staging,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        try:
            with os.fdopen(fd,'wb') as stream:
                with tarfile.open(fileobj=stream,mode='w:gz') as tar:
                    for name in ['data','config','.env','release.json']:tar.add(ROOT/name,arcname=name,recursive=True)
            os.link(staging,output)
            staging.unlink()
        except Exception:
            # Keep incomplete output identifiable; no automatic deletion of data.
            raise ValueError('Backup incompleto. Não usar esse arquivo para restauração.')
    finally:
        if running:compose('start','artesao')
    print('Backup frio criado com configuração/chaves. Proteja-o: contém segredos e dados privados.')

def restore(archive,target):
    if target.is_symlink():raise ValueError('Link de destino recusado.')
    target=target.resolve()
    if target.exists():raise ValueError('Destino deve ser novo/inexistente; não sobrescrever instalação.')
    # Validate entire archive before creating destination. No links, devices, traversal,
    # duplicates or unexpected top-level payload. Codes are intentionally excluded.
    with tarfile.open(archive,'r:gz') as tar:
        seen=set()
        for m in tar.getmembers():
            p=Path(m.name)
            if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] not in ['data','config','.env','release.json'] or p.as_posix() in seen or not(m.isfile() or m.isdir()):raise ValueError('Conteúdo inseguro ou inesperado no backup.')
            seen.add(p.as_posix())
        for name in ['data','config']:
            if name not in seen or not tar.getmember(name).isdir():raise ValueError('Diretório obrigatório ausente.')
        for name in ['.env','release.json']:
            if name not in seen or not tar.getmember(name).isfile():raise ValueError('Arquivo obrigatório ausente.')
        if not all(n in seen for n in ['data','config','.env','release.json']):raise ValueError('Backup incompleto.')
        target.mkdir(mode=0o700)
        tar.extractall(target,filter='data')
    # Restored files stay private; extraction does not trust archived owner IDs.
    for p in target.rglob('*'):p.chmod(0o700 if p.is_dir() else 0o600)
    print('Restaurado em pasta nova. Confira integridade e versão antes de promover; serviço não iniciado.')

def verify():
    release=json.loads((ROOT/'release.json').read_text())
    common=json.loads((ROOT/'app/artesao-release.json').read_text())
    if release['releaseVersion']!=common['version'] or release['schemaVersions']!=common['schemaVersions']:raise ValueError('Versão/schema divergentes.')
    for line in (ROOT/'SHA256SUMS').read_text().splitlines():
        expected,name=line.split('  ',1);p=ROOT/name
        if not p.resolve().is_relative_to(ROOT) or p.is_symlink() or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=expected:raise ValueError('Integridade do pacote divergente.')
    print('Pacote íntegro; versão e schema comuns: '+common['version'])

if __name__=='__main__':
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='action',required=True)
    init=sub.add_parser('initialize');init.add_argument('--uid',type=int,default=os.geteuid() or 1000);init.add_argument('--gid',type=int,default=os.getegid() or 1000);sub.add_parser('verify')
    b=sub.add_parser('backup');b.add_argument('--output',required=True,type=Path)
    r=sub.add_parser('restore');r.add_argument('--archive',required=True,type=Path);r.add_argument('--target',required=True,type=Path)
    a=p.parse_args()
    try:
        if a.action=='initialize':
            if not(1<=a.uid<=2147483647 and 1<=a.gid<=2147483647):raise ValueError('UID/GID inválidos.')
            initialize(a.uid,a.gid)
        elif a.action=='verify':verify()
        elif a.action=='backup':backup(a.output)
        else:restore(a.archive,a.target)
    except (ValueError,OSError,subprocess.SubprocessError,tarfile.TarError):
        p.exit(1,'Operação recusada/falhou. Confira caminhos, permissões e estado do serviço; nenhum segredo será exibido.\n')
