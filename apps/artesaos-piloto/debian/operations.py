#!/usr/bin/env python3
"""Operação Debian explícita. collect/plan não alteram serviço; apply exige aprovações."""
import argparse,hashlib,json,math,os,re,sqlite3,subprocess,tarfile,tempfile,time
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
HEX=re.compile(r'^[0-9a-f]{40}$')
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def read(p):return json.loads(p.read_text())
def now():return datetime.now(timezone.utc).isoformat()
def save(p,data):
    with p.open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')
    p.chmod(0o600)
def docker(*args):
    # Never return command output to the CLI on failure (may contain secrets).
    env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
    return subprocess.check_output(['docker','--host=unix:///var/run/docker.sock',*args],text=True,stderr=subprocess.PIPE,env=env)
def compose(*args):return docker('compose','--project-directory',str(ROOT),*args)
def safe_manifest(m):
    return {k:m.get(k) for k in ['releaseVersion','sourceCommit','builtAt','distribution','packageKind','schemaVersions','schemaChecksums','imageId','compatibility','validation']}
def validate(m):
    if not HEX.fullmatch(m.get('sourceCommit','')) or not m.get('releaseVersion') or m.get('distribution') not in ['debian','home-assistant']:raise ValueError('Manifesto incompleto')
    datetime.fromisoformat(m['builtAt'])
    if set(m['schemaVersions'])!={'tenant','control','interest','support','legal'} or any(type(n)!=int or n<1 for n in m['schemaVersions'].values()):raise ValueError('Schemas inválidos')
    if m.get('compatibility',{}).get('policy')!='same-schema-only':raise ValueError('Compatibilidade ausente')
    v=m.get('validation',{})
    if v.get('sourceCommit')!=m['sourceCommit'] or v.get('status')!='passed' or not v.get('checks') or any(c.get('status')!='passed' for c in v['checks']):raise ValueError('Validação ausente/divergente')
    if not m.get('schemaChecksums'):raise ValueError('Checksums de migração ausentes')
    return m

def verify_package(folder):
    folder=folder.resolve();m=validate(read(folder/'release.json'))
    if m['distribution']!='debian':raise ValueError('Pacote não Debian')
    seen=set()
    for line in (folder/'SHA256SUMS').read_text().splitlines():
        expected,name=line.split('  ',1);p=folder/name
        if name in seen or not re.fullmatch('[0-9a-f]{64}',expected) or not p.resolve().is_relative_to(folder) or any(parent.is_symlink() for parent in [p,*p.parents] if parent.is_relative_to(folder)) or not p.is_file() or digest(p)!=expected:raise ValueError('Checksum inválido')
        seen.add(name)
    required={'release.json','app/release.json','app/artesao-release.json','compose.yaml','manage.py','operations.py'}
    if not required<=seen:raise ValueError('Cobertura de checksums incompleta')
    mutable={'data','config','private-codes','.env','.operations','compose.override.yaml'}
    actual={str(p.relative_to(folder)) for p in folder.rglob('*') if p.is_file() and p.name!='SHA256SUMS' and p.relative_to(folder).parts[0] not in mutable}
    if seen!=actual:raise ValueError('Arquivo não coberto por checksum')
    app=read(folder/'app/release.json');common=read(folder/'app/artesao-release.json')
    if any(app.get(k)!=m[k] for k in ['sourceCommit','releaseVersion','schemaVersions','builtAt']) or common['version']!=m['releaseVersion'] or common['schemaVersions']!=m['schemaVersions'] or app.get('schemaChecksums')!=m['schemaChecksums']:raise ValueError('Fonte/pacote divergentes')
    return m

def collect():
    result={'observedAt':now(),'serverReachable':True,'declared':safe_manifest(read(ROOT/'release.json')),'container':None,'runtime':None,'matches':False}
    cid=compose('ps','--quiet','artesao').strip()
    if not cid:return result
    if len(cid.splitlines())!=1:raise ValueError('Instância ambígua')
    c=json.loads(docker('inspect',cid))[0];image=json.loads(docker('image','inspect',c['Image']))[0]
    labels=image.get('Config',{}).get('Labels') or {}
    result['container']={'imageId':c['Image'],'running':c['State']['Running'],'health':c['State'].get('Health',{}).get('Status','unknown'),'architecture':image.get('Architecture'),'oci':{k:labels.get(k) for k in ['org.opencontainers.image.revision','org.opencontainers.image.version','org.opencontainers.image.created','dev.artesao.distribution']},'mounts':[{'destination':m['Destination'],'type':m['Type']} for m in c.get('Mounts',[])]}
    try:result['runtime']=safe_manifest(json.loads(docker('exec',cid,'node','-e',"process.stdout.write(require('node:fs').readFileSync('/app/release.json','utf8'))")))
    except (subprocess.SubprocessError,ValueError):result['runtime']=None
    # Read only schema identities/checksums, never business rows or credentials.
    script="""const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');const out=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('link');if(e.isDirectory())walk(f);else if(e.name.endsWith('.sqlite')){const d=new DatabaseSync(f,{readOnly:true});try{const scope=d.prepare('SELECT scope FROM schema_identity WHERE id=1').get().scope;out.push({scope,migrations:d.prepare('SELECT version,name,checksum FROM schema_migrations ORDER BY version').all()});}finally{d.close();}}}}walk('/data');console.log(JSON.stringify(out));"""
    try:result['schemaCatalog']=json.loads(docker('exec',cid,'node','-e',script))
    except (subprocess.SubprocessError,ValueError):result['schemaCatalog']=None
    active=ROOT/'.operations/active-release.json'
    if active.is_file():
        result['packageDeclaration']=result['declared'];result['declared']=safe_manifest(read(active))
    declared=result['declared'];runtime=result['runtime'];oci=result['container']['oci']
    result['matches']=bool(runtime and all(runtime.get(k)==declared.get(k) for k in ['releaseVersion','sourceCommit','builtAt','distribution','schemaVersions']) and oci['org.opencontainers.image.revision']==declared['sourceCommit'] and oci['org.opencontainers.image.version']==declared['releaseVersion'] and oci['org.opencontainers.image.created']==declared['builtAt'] and oci['dev.artesao.distribution']=='debian' and (not declared.get('imageId') or declared['imageId']==c['Image']))
    result['limitations']=['Sem teste funcional de autenticação; nenhum segredo/log bruto exposto.']
    return result

def check_backup(archive):
    # Structural validation of a disposable extraction, never a production restore.
    with tarfile.open(archive,'r:gz') as tar:
        seen=set()
        for m in tar.getmembers():
            p=Path(m.name)
            if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] not in ['data','config','.env','release.json'] or p.as_posix() in seen or not(m.isfile() or m.isdir()):raise ValueError('Backup inseguro')
            seen.add(p.as_posix())
        if not {'data','config','.env','release.json','config/options.json','data/pilot-control.sqlite','data/pilot-interest.sqlite','data/pilot-support.sqlite','data/pilot-legal.sqlite'}<=seen:raise ValueError('Backup incompleto')
        with tempfile.TemporaryDirectory(prefix='artesao-backup-check-') as d:
            root=Path(d);tar.extractall(root,filter='data')
            databases=list((root/'data').rglob('*.sqlite'))
            schemas=[]
            for dbpath in databases:
                if Path(str(dbpath)+'-wal').exists() and Path(str(dbpath)+'-wal').stat().st_size:raise ValueError('Cópia não fria')
                db=sqlite3.connect(dbpath.as_uri()+'?mode=ro&immutable=1',uri=True)
                try:
                    if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('SQLite inválido')
                    scope=db.execute('SELECT scope FROM schema_identity WHERE id=1').fetchone()[0]
                    rows=db.execute('SELECT version,name,checksum FROM schema_migrations ORDER BY version').fetchall()
                    schemas.append({'scope':scope,'migrations':[dict(zip(['version','name','checksum'],row)) for row in rows]})
                finally:db.close()
            control=sqlite3.connect((root/'data/pilot-control.sqlite').as_uri()+'?mode=ro&immutable=1',uri=True)
            try:
                if control.execute("SELECT 1 FROM sqlite_master WHERE name='pilot_users'").fetchone():
                    for (tenant,) in control.execute('SELECT tenant_id FROM pilot_users'):
                        if not re.fullmatch('[0-9a-f-]{36}',str(tenant)) or not (root/'data/tenants'/tenant/'validation.sqlite').is_file():raise ValueError('Tenant ausente; verificar completude')
            finally:control.close()
            # Existing encrypted records require their original keys.
            for dbname,table,key in [('pilot-control.sqlite','pilot_invitation_details','pilot-invitations.key'),('pilot-control.sqlite','pilot_invitation_keycheck','pilot-invitations.key'),('pilot-interest.sqlite','interests','pilot-interest.key'),('pilot-interest.sqlite','metadata','pilot-interest.key')]:
                p=root/'data'/dbname
                if p.exists():
                    db=sqlite3.connect(p.as_uri()+'?mode=ro&immutable=1',uri=True)
                    try:needed=bool(db.execute("SELECT 1 FROM sqlite_master WHERE name=?",(table,)).fetchone() and db.execute('SELECT 1 FROM '+table+' LIMIT 1').fetchone())
                    finally:db.close()
                    if needed and (not (root/'data'/key).is_file() or (root/'data'/key).stat().st_size!=32):raise ValueError('Chave necessária ausente')
    return {'archiveSha256':digest(archive),'checkedAt':now(),'archiveIntegrity':True,'sqliteIntegrity':True,'databaseCount':len(databases),'schemas':schemas,'externalCopyVerified':False,'operationalRecoveryProven':False,'note':'Extração temporária e integridade não comprovam autenticação/decifragem/recuperação operacional.'}

def load_policy(policy=None):
    value=policy if policy is not None else read(ROOT/'operation-policy.json')
    if type(value.get('level')) is not int or value.get('level') not in [1,2] or value.get('decision')!='explicit-owner-approval':raise ValueError('Nível operacional não aprovado')
    return value

def plan(package,archive=None,evidence=None,policy=None):
    policy=load_policy(policy);target=verify_package(package);current=collect()
    blockers=[];warnings=[];backup=None
    if not current['container'] or not current['container']['running'] or current['container']['health']!='healthy':blockers.append('Origem não está healthy')
    if current['declared']['schemaVersions']!=target['schemaVersions']:blockers.append('Schema diferente: exige autorização e procedimento de migração separado')
    catalog=current.get('schemaCatalog')
    if not catalog or any(target['schemaChecksums'].get(item['scope'])!=item['migrations'] for item in catalog):blockers.append('Compatibilidade dos bancos atuais não confirmada; nenhuma migração autorizada')
    if archive:
        try:backup=check_backup(archive)
        except (ValueError,KeyError,TypeError,OSError,sqlite3.Error,tarfile.TarError):
            (warnings if policy['level']==1 else blockers).append('Backup fornecido não validado')
    if policy['level']==1:
        warnings.append('Nível 1: backup recomendado; cópia externa e recuperação não são condições bloqueantes')
    else:
        settings=policy.get('level2',{})
        if not all(settings.get(k) for k in ['maxBackupAgeHours','backupSchedule','retention','independentCopyRule','recoveryRule']):blockers.append('Política Nível 2 incompleta: definir frequência/retencão/cópia/recuperação')
        limit=settings.get('maxBackupAgeHours')
        if limit is not None and (type(limit) not in [int,float] or not math.isfinite(limit) or limit<=0):raise ValueError('Janela de backup inválida')
        if not backup or not evidence:blockers.append('Nível 2 exige backup verificado e evidência de recuperação/cópia independente')
        else:
            if any(target['schemaChecksums'].get(item['scope'])!=item['migrations'] for item in backup['schemas']):blockers.append('Backup incompatível com catálogo de destino')
            proof=read(evidence)
            if proof.get('archiveSha256')!=backup['archiveSha256'] or proof.get('operationalRecoveryProven') is not True or proof.get('externalCopyVerified') is not True or not all(proof.get(k) for k in ['operator','testedAt','backupCreatedAt']):blockers.append('Evidência incompleta ou não vinculada ao backup exato')
            elif settings.get('maxBackupAgeHours'):
                tested=datetime.fromisoformat(proof['testedAt']);created=datetime.fromisoformat(proof['backupCreatedAt']);clock=datetime.now(timezone.utc)
                if created>tested or tested>clock or (clock-created).total_seconds()>float(settings['maxBackupAgeHours'])*3600:blockers.append('Backup/evidência fora da política ou datas incoerentes')
    return {'createdAt':now(),'securityLevel':policy['level'],'securityPolicy':policy,'current':current,'target':safe_manifest(target),'backup':backup,'recoveryEvidenceSha256':digest(evidence) if evidence and policy['level']==2 else None,'blockers':blockers,'warnings':warnings,'legacyCurrent':not current['matches'],'policy':'image-only; same schemas; explicit approval required'}

def image_matches(image,m):
    info=json.loads(docker('image','inspect',image))[0];l=info.get('Config',{}).get('Labels') or {}
    if m.get('imageId') and info['Id']!=m['imageId']:raise ValueError('ID da imagem divergente')
    if info.get('Architecture')!='amd64' or info.get('Os')!='linux' or l.get('org.opencontainers.image.revision')!=m['sourceCommit'] or l.get('org.opencontainers.image.version')!=m['releaseVersion'] or l.get('org.opencontainers.image.created')!=m['builtAt'] or l.get('dev.artesao.distribution')!='debian':raise ValueError('Imagem/labels divergentes')
    runtime=json.loads(docker('run','--rm','--network','none','--read-only','--entrypoint','node',info['Id'],'-e',"process.stdout.write(require('node:fs').readFileSync('/app/release.json','utf8'))"))
    if any(runtime.get(k)!=m[k] for k in ['sourceCommit','releaseVersion','builtAt','schemaVersions']):raise ValueError('Runtime divergente')
    return info['Id']

def apply(package,archive,evidence,image,approve,allow_legacy=False,policy=None):
    if not approve:raise ValueError('Aprovação operacional obrigatória')
    p=plan(package,archive,evidence,policy)
    if p['blockers'] or (p['legacyCurrent'] and not allow_legacy):raise ValueError('Pré-condições não atendidas; consulte plan')
    target=validate(read(package/'release.json'));imageid=image_matches(image,target)
    previous=p['current']['container']['imageId'];docker('image','inspect',previous)
    override=ROOT/'compose.override.yaml'
    owner=ROOT/'.operations/override-owner.json'
    if override.is_symlink():raise ValueError('Override simbólico recusado')
    if override.exists() and (not owner.is_file() or read(owner).get('sha256')!=digest(override)):raise ValueError('Override existente sem proveniência: revisão necessária')
    previous_override=override.read_text() if override.exists() else None
    # Docker cannot remove the original image while these stopped keepers exist.
    keeper=docker('create','--network','none',previous).strip()
    state=ROOT/'.operations';state.mkdir(mode=0o700,exist_ok=True);run=state/('update-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f'));run.mkdir(mode=0o700)
    save(run/'previous-release.json',p['current']['declared'])
    record={**p,'previousImageId':previous,'targetImageId':imageid,'rollbackKeeper':keeper,'status':'prepared','rollback':'python3 operations.py rollback --record '+str(run/'deployment.json')+' --approve-code-only'}
    save(run/'deployment.json',record)
    # Compose's normal override mechanism changes only the immutable image selection.
    before=json.loads(compose('config','--format','json'))
    replacement={'services':{'artesao':{'image':imageid,'pull_policy':'never'}}}
    if override.exists():override.write_text(json.dumps(replacement)+'\n')
    else:save(override,replacement)
    started=False
    try:
        after=json.loads(compose('config','--format','json'))
        for config in [before,after]:
            config['services']['artesao'].pop('image',None);config['services']['artesao'].pop('pull_policy',None)
        if before!=after:raise ValueError('Configuração efetiva mudou além da imagem')
        compose('config','--quiet');started=True;compose('up','-d','--no-build','--pull','never','artesao')
        for _ in range(30):
            observation=collect()
            if observation['container'] and observation['container']['imageId']==imageid and observation['container']['health']=='healthy':break
            time.sleep(2)
        else:raise ValueError('Healthcheck não aprovado')
        # Expected package manifest, not historical checksums, becomes the active declaration.
        (state/'active-release.json').write_text(json.dumps(target,indent=2)+'\n')
        observation=collect()
        if not observation['matches']:raise ValueError('Verificação pós-publicação divergente')
        (state/'override-owner.json').write_text(json.dumps({'sha256':digest(override)})+'\n')
        record['status']='healthy';record['observed']=observation;record['functionalValidation']='pending'
    except Exception:
        if not started:
            if previous_override is None:override.unlink()
            else:override.write_text(previous_override)
        else:(state/'override-owner.json').write_text(json.dumps({'sha256':digest(override)})+'\n')
        record['status']='failed';record['nextAction']='Inspecionar collect e executar rollback explícito; nenhum dado foi restaurado.'
        raise
    finally:
        (run/'deployment.json').write_text(json.dumps(record,indent=2)+'\n')
    return {'record':str(run/'deployment.json'),'status':record['status'],'functionalValidation':'pending'}

def rollback(record_path,approve):
    if not approve:raise ValueError('Aprovação de retorno obrigatória')
    record=read(record_path)
    if not record_path.resolve().is_relative_to(ROOT/'.operations'):raise ValueError('Recibo externo recusado')
    c=collect()
    if not c['container'] or c['container']['imageId']!=record['targetImageId']:raise ValueError('Instalação mudou após a tentativa')
    if record['current']['declared']['schemaVersions']!=record['target']['schemaVersions']:raise ValueError('Retorno exige análise de dados')
    docker('image','inspect',record['previousImageId'])
    override=ROOT/'compose.override.yaml';override.write_text(json.dumps({'services':{'artesao':{'image':record['previousImageId'],'pull_policy':'never'}}})+'\n')
    (ROOT/'.operations/override-owner.json').write_text(json.dumps({'sha256':digest(override)})+'\n')
    compose('up','-d','--no-build','--pull','never','artesao')
    (ROOT/'.operations/active-release.json').write_text((record_path.parent/'previous-release.json').read_text())
    return {'status':'rollback-requested','dataRestored':False,'nextAction':'Executar collect e homologar; não declarar recuperação comprovada apenas pelo comando.'}

def main():
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=ROOT);sub=p.add_subparsers(dest='action',required=True)
    sub.add_parser('collect')
    b=sub.add_parser('check-backup');b.add_argument('--archive',type=Path,required=True)
    for name in ['plan','apply']:
        x=sub.add_parser(name);x.add_argument('--package',type=Path,required=True);x.add_argument('--archive',type=Path);x.add_argument('--recovery-evidence',type=Path);x.add_argument('--policy',type=Path)
        if name=='apply':x.add_argument('--image',required=True);x.add_argument('--approve-update',action='store_true');x.add_argument('--allow-legacy-current',action='store_true')
    x=sub.add_parser('rollback');x.add_argument('--record',type=Path,required=True);x.add_argument('--approve-code-only',action='store_true')
    a=p.parse_args();globals()['ROOT']=a.root.resolve()
    try:
        if a.action=='collect':result=collect()
        elif a.action=='check-backup':result=check_backup(a.archive)
        elif a.action=='plan':result=plan(a.package,a.archive,a.recovery_evidence,read(a.policy) if a.policy else None)
        elif a.action=='apply':result=apply(a.package,a.archive,a.recovery_evidence,a.image,a.approve_update,a.allow_legacy_current,read(a.policy) if a.policy else None)
        else:result=rollback(a.record,a.approve_code_only)
        print(json.dumps(result,ensure_ascii=False,indent=2))
        if result.get('blockers') or result.get('matches') is False:return 2
    except (ValueError,KeyError,OSError,TypeError,subprocess.SubprocessError,sqlite3.Error,tarfile.TarError):
        print(json.dumps({'ok':False,'error':'Verificação/operação recusada. Consulte os pré-requisitos; saída bruta e segredos omitidos.'}));return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
