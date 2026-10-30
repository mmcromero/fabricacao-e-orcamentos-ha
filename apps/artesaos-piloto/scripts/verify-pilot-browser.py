"""Uses a disposable test-only identity provider. Does NOT validate real Google or TLS."""
import argparse,json,os,ssl,tempfile,subprocess,time,urllib.request
from urllib.parse import urlparse,parse_qs
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--nginx',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
build_info=json.loads((root/'pilot-build.json').read_text())
certdir=tempfile.TemporaryDirectory(prefix='pilot-tls-fixture-');key=str(Path(certdir.name)/'key.pem');cert=str(Path(certdir.name)/'cert.pem')
subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
log=open('/tmp/artesaos-browser-server.log','w')
server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert,'PILOT_TEST_HTTP_BACKEND':'1' if args.nginx else '0'},stdout=log,stderr=log)
origin='https://127.0.0.1:8298';prefix='/artesaos-piloto/'
docker_env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
docker=['docker','--host=unix:///var/run/docker.sock'];container='codex-pilot-proxy-'+str(os.getpid())
try:
 if args.nginx:
  route=Path(certdir.name)/'route.conf';subprocess.run(['python',str(root/'pilot/generate-nginx.py'),'--upstream-host','host.docker.internal','--output',str(route)],check=True,stdout=log)
  route.write_text(route.read_text().replace(':8099',':8296'))
  conf=Path(certdir.name)/'nginx.conf';conf.write_text('events {}\nhttp { server { listen 443 ssl; http2 on; ssl_certificate /fixture/cert.pem; ssl_certificate_key /fixture/key.pem; proxy_buffering off; include /fixture/route.conf; location / { return 404; } } }\n')
  subprocess.run(docker+['run','-d','--name',container,'--add-host','host.docker.internal:host-gateway','-p','127.0.0.1:8298:443','--mount',f'type=bind,src={certdir.name},dst=/fixture,readonly','--mount',f'type=bind,src={conf},dst=/etc/nginx/nginx.conf,readonly','nginx:stable-alpine'],check=True,stdout=log,stderr=log,env=docker_env)
 for _ in range(100):
  try:
   with urllib.request.urlopen(origin+prefix+'login',timeout=1,context=ssl._create_unverified_context()):break
  except Exception:time.sleep(.1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);contexts=[];errors=[]
  def context(account):
   ctx=browser.new_context(ignore_https_errors=True,viewport={'width':1280 if account=='a' else 390,'height':900});contexts.append(ctx)
   def google(route):
    state=parse_qs(urlparse(route.request.url).query)['state'][0]
    route.fulfill(status=302,headers={'location':origin+prefix+'auth/google/callback?state='+state+'&code='+account})
   ctx.route('https://accounts.google.com/**',google)
   pending=[account=='a']
   def delayed_session(route):
    if pending[0]:pending[0]=False;route.fulfill(status=401,content_type='application/json',body='{"message":"Sessão ainda não disponível"}')
    else:route.continue_()
   ctx.route(origin+prefix+'api/pilot/session',delayed_session)
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+prefix)
   expect(page.get_by_role('heading',name='Artesão Digital',exact=True)).to_be_visible()
   page.get_by_label('Código de convite (somente no primeiro acesso)').fill('synthetic-invite-'+account+'-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
   expect(page).to_have_url(origin+prefix+'?view=orcamentos');expect(page.get_by_role('heading',name='Orçamentos',exact=True)).to_be_visible();expect(page.locator('#pilot-account')).to_contain_text(account+'@example.test');expect(page.locator('#pilot-build-info')).to_contain_text('Artesão Digital v'+build_info['pilotVersion']);expect(page.locator('#pilot-build-info')).to_contain_text('Fabricação e Orçamentos v'+build_info['coreVersion']);expect(page.locator('#pilot-build-info')).to_be_in_viewport()
   bar=page.locator('#pilot-account');expect(bar.locator('.pilot-account-title')).to_have_text('Artesão Digital');expect(bar.locator('.pilot-account-user')).to_have_text(account+'@example.test')
   bb=bar.bounding_box();assert abs(bb['y'])<1
   title_box=bar.locator('.pilot-account-title').bounding_box();user_box=bar.locator('.pilot-account-user').bounding_box();exit_box=bar.get_by_role('button',name='Sair',exact=True).bounding_box()
   assert title_box['x']<user_box['x']<exit_box['x'];assert abs(user_box['x']+user_box['width']/2-page.viewport_size['width']/2)<2
   assert page.get_by_role('heading',name='Orçamentos',exact=True).bounding_box()['y']>=bb['y']+bb['height']
   page.evaluate('scrollTo(0,document.body.scrollHeight)');assert abs(bar.bounding_box()['y'])<1;expect(page.locator('#pilot-build-info')).to_be_in_viewport();page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/artesao-digital-'+account+'.png')
   if account=='b':
    page.set_viewport_size({'width':320,'height':800});page.locator('.pilot-account-user').evaluate("el=>el.textContent='testador.com.email.longo@example.test'");assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');expect(bar).to_be_in_viewport();expect(page.locator('#pilot-build-info')).to_be_in_viewport();page.screenshot(path='/tmp/artesao-digital-320.png');page.set_viewport_size({'width':390,'height':900})
   return ctx,page
  a,pa=context('a');pa.goto(origin+prefix+'?view=produtos');pa.get_by_role('button',name='Novo produto',exact=True).click();modal=pa.locator('dialog[open]');modal.get_by_label('Nome',exact=True).fill('Produto isolado A');modal.get_by_label('Origem',exact=True).select_option('own');modal.get_by_label('Valor varejo (R$)',exact=True).fill('25');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pa.locator('.product-record')).to_have_count(1)
  b,pb=context('b');pb.goto(origin+prefix+'?view=produtos');expect(pb.locator('.product-record')).to_have_count(0)
  pb.get_by_role('button',name='Novo produto',exact=True).click();modal=pb.locator('dialog[open]');modal.get_by_label('Nome',exact=True).fill('Produto isolado B');modal.get_by_label('Origem',exact=True).select_option('client');modal.get_by_label('Valor varejo (R$)',exact=True).fill('15');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pb.locator('.product-record')).to_have_count(1);expect(pb.locator('.product-record')).not_to_contain_text('Produto isolado A')
  pa.reload();expect(pa.locator('.product-record')).to_have_count(1);expect(pa.locator('.product-record')).not_to_contain_text('Produto isolado B')
  for page,account in [(pa,'a'),(pb,'b')]:
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
   expect(page.get_by_label('Código de convite (somente no primeiro acesso)')).to_have_value('');page.get_by_role('button',name='Entrar com Google',exact=True).click()
   expect(page).to_have_url(origin+prefix+'?view=orcamentos');expect(page.get_by_role('heading',name='Orçamentos',exact=True)).to_be_visible();expect(page.locator('#pilot-account')).to_contain_text(account+'@example.test');expect(page.locator('#pilot-build-info')).to_contain_text('Artesão Digital v'+build_info['pilotVersion']);expect(page.locator('#pilot-build-info')).to_contain_text('Fabricação e Orçamentos v'+build_info['coreVersion']);expect(page.locator('#pilot-build-info')).to_be_in_viewport();page.goto(origin+prefix+'?view=produtos');expect(page.locator('.product-record')).to_have_count(1)
   for view,title in [('orcamentos','Orçamentos'),('clientes','Clientes'),('fabricacao','Fabricação')]:
    page.goto(origin+prefix+'?view='+view);expect(page.get_by_role('heading',name=title,exact=True,level=1)).to_be_visible();expect(page.locator('.brand')).to_have_text('Artesão Digital');expect(page.locator('#pilot-build-info')).to_be_in_viewport()
   # The bare application path must also render an application, not only the account bar.
   page.goto(origin+prefix);expect(page.get_by_role('heading',name='Orçamentos',exact=True,level=1)).to_be_visible()
   page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
  isolated=browser.new_context(ignore_https_errors=True);lost=isolated.new_page();lost.goto(origin+prefix+'auth/finish');expect(lost.get_by_role('status')).to_contain_text('Não foi possível confirmar a sessão');expect(lost.get_by_role('link',name='Entrar novamente',exact=True)).to_be_visible();expect(lost).to_have_url(origin+prefix+'auth/finish');isolated.close()
  assert not errors,errors
  browser.close()
 print('PASS: primeiro acesso e novo login SEM URL manual, Orçamentos automático, marca/rodapé visíveis, demais áreas/raiz, contas isoladas e logout; proxy Nginx='+str(args.nginx)+'. Provedor Google controlado, validação real pendente.')
finally:
 if args.nginx:subprocess.run(docker+['rm','-f',container],stdout=log,stderr=log,env=docker_env)
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();certdir.cleanup()
