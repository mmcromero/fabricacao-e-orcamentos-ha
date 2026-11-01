"""Disposable smoke test of the real production image; no real credentials/messages."""
import argparse,json,os,subprocess,tempfile,time,urllib.request,urllib.error,uuid,shutil
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--image',required=True);args=parser.parse_args()
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
docker=['docker','--host=unix:///var/run/docker.sock'];name='codex-artesao-smoke-'+uuid.uuid4().hex[:10]
data=Path(tempfile.mkdtemp(prefix='artesao-production-fixture-'));host='pilot-container.example.test'
(data/'options.json').write_text(json.dumps({'public_url':'https://'+host+'/artesaos-piloto/','google_client_id':'synthetic','google_client_secret':'synthetic','admin_emails':['admin@example.test'],'test_email_1':'legacy-options@example.test','test_invite_1':'synthetic-old-option-code-01234567890123456789'}))
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def command(*cmd):return subprocess.check_output(docker+list(cmd),env=env,text=True)
try:
 command('run','-d','--name',name,'-p','127.0.0.1::8099','--mount',f'type=bind,src={data},dst=/data',args.image)
 address=command('port',name,'8099/tcp').strip();base='http://'+address+'/artesaos-piloto/'
 def request(path,method='GET',body=None,headers=None):
  req=urllib.request.Request(base+path,method=method,data=None if body is None else json.dumps(body).encode(),headers={'Host':host,'Origin':'https://'+host,'Content-Type':'application/json',**(headers or {})})
  try:
   with opener.open(req,timeout=15) as r:return r.status,r.read().decode()
  except urllib.error.HTTPError as r:return r.code,r.read().decode()
 for _ in range(60):
  try:
   status,body=request('login')
   if status==200:break
  except (OSError,urllib.error.URLError):pass
  time.sleep(.2)
 else:raise AssertionError('Container did not serve login')
 assert 'Entrar com Google' in body and 'somente pelo Ingress' not in body
 assert request('api/products')[0]==401
 status,public=request('legal');assert status==200 and 'em prepara' in public
 source="""import {PilotStore} from './dist-server/pilot/store.js';const s=new PilotStore('/data');const a=s.adminSession({issuer:'https://accounts.google.com',subject:'synthetic-admin',email:'admin@example.test',verified:true});const c=s.getAdmin(a.value,['admin@example.test']);console.log(JSON.stringify({cookie:'__Secure-artesaos_admin_session='+a.value,'x-pilot-admin-context':c.context,'x-pilot-admin-csrf':a.csrf}));s.close();"""
 headers=json.loads(command('exec',name,'node','--input-type=module','-e',source))
 status,users=request('admin/api/users',headers=headers);assert status==200 and json.loads(users)['total']==0
 status,initial=request('admin/api/invitations',headers=headers);assert status==200 and json.loads(initial)['total']==0 and json.loads(initial)['maxUsers'] is None
 status,saved=request('admin/api/invitations','POST',{'name':'Synthetic person','email':'','phone':'+5511999990011','channel':'whatsapp','requestKey':str(uuid.uuid4())},headers);assert status==200,saved
 invitation=json.loads(saved);assert invitation['bindingMode']=='first_google' and invitation['code'] and 'sentAt' not in invitation and invitation['expiresAt'] is None
 for n in range(1,7):
  status,extra=request('admin/api/invitations','POST',{'name':'Additional person '+str(n),'email':'person'+str(n)+'@example.test','phone':'','channel':'email','requestKey':str(uuid.uuid4())},headers);assert status==200,extra
 status,listed=request('admin/api/invitations',headers=headers);assert status==200 and json.loads(listed)['total']==7
 status,revoked=request('admin/api/invitations/'+invitation['id']+'/revoke','POST',{},headers);assert status==200 and json.loads(revoked)['status']=='revoked'
 status,renewed=request('admin/api/invitations/'+invitation['id']+'/reactivate','POST',{'name':'Synthetic person','email':'','phone':'+5511999990011','channel':'whatsapp','requestKey':str(uuid.uuid4())},headers);assert status==200,renewed
 replacement=json.loads(renewed);assert replacement['code']!=invitation['code'] and replacement['expiresAt'] is None;status,prior=request('admin/api/invitations/'+invitation['id'],headers=headers);assert json.loads(prior)['replacementId']==replacement['id'];invitation=replacement
 status,screen=request('admin/invitations',headers=headers);assert status==200 and '>Salvar<' in screen and 'invitations.js' in screen
 font_source="""import {renderQuotePdf} from './dist-server/pilot/quote-pdf.js';const bytes=await renderQuotePdf(1,1,new Date().toISOString(),{company:{name:'Synthetic',responsible:'Test',phone:'11999990000',email:'test@example.test'},quote:{client:{name:'Test'},items:[],notes:'',delivery:{mode:'pickup',carrier:'',notes:''}},totals:{productCents:0,packagingCents:0,deliveryCents:0,totalCents:0}});if(bytes.length<1000)throw Error('Incomplete PDF');console.log(bytes.length);"""
 size=int(command('exec',name,'node','--input-type=module','-e',font_source).strip())
 command('restart',name)
 address=command('port',name,'8099/tcp').strip();base='http://'+address+'/artesaos-piloto/'
 for _ in range(60):
  try:
   status,persisted=request('admin/api/invitations/'+invitation['id'],headers=headers)
   if status==200:break
  except (OSError,urllib.error.URLError):pass
  time.sleep(.2)
 else:raise AssertionError('Container did not recover after restart: '+command('inspect','--format','{{.State.Status}}',name)+' '+command('logs','--tail','10',name))
 assert json.loads(persisted)['code']==invitation['code']
 print(f'PASS: production image starts the pilot independently, public login/legal, protected APIs, admin users/invitations, more than five invites, no expiry, revocation/reactivation with new code and restart persistence; bundled PDF fonts produce {size} bytes. Synthetic data, no real Google/SMTP/WhatsApp/HA.')
finally:
 subprocess.run(docker+['rm','-f',name],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 shutil.rmtree(data,ignore_errors=True)
