"""Uses a disposable test-only identity provider. Does NOT validate real Google or TLS."""
import argparse,re,base64,hashlib,json,os,ssl,tempfile,subprocess,time,urllib.request
from urllib.parse import urlparse,parse_qs
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--nginx',action='store_true');parser.add_argument('--ha-cache',action='store_true');args=parser.parse_args();args.nginx=args.nginx or args.ha_cache
root=Path(__file__).resolve().parents[1]
build_info=json.loads((root/'pilot-build.json').read_text())
certdir=tempfile.TemporaryDirectory(prefix='pilot-tls-fixture-');key=str(Path(certdir.name)/'key.pem');cert=str(Path(certdir.name)/'cert.pem')
subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
# Trust only this disposable fixture certificate for Service Worker tests.
pubkey=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout'])
spki=subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pubkey)
fixture_spki=base64.b64encode(hashlib.sha256(spki).digest()).decode()
log=open('/tmp/artesaos-browser-server.log','w')
server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert,'PILOT_TEST_HTTP_BACKEND':'1' if args.nginx else '0'},stdout=log,stderr=log)
origin='https://127.0.0.1:8298';prefix='/artesaos-piloto/'
docker_env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
docker=['docker','--host=unix:///var/run/docker.sock'];container='codex-pilot-proxy-'+str(os.getpid())
try:
 if args.nginx:
  route=Path(certdir.name)/'route.conf';subprocess.run(['python',str(root/'pilot/generate-nginx.py'),'--upstream-host','host.docker.internal','--output',str(route)],check=True,stdout=log)
  route.write_text(route.read_text().replace(':8099',':8296'))
  extra=''
  if args.ha_cache:
   import re
   bundle=re.search(r'src="\./assets/([^"]+)"',(root/'dist/index.html').read_text()).group(1)
   worker=Path(certdir.name)/'ha-cache-fixture-sw.js'
   worker.write_text(r"""const prefix=__PREFIX__;const bundle=__BUNDLE__;const cacheName='fixture-ha-files';
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(cacheName);await c.put(bundle,new Response('<!doctype html><title>Old cached login</title>',{headers:{'content-type':'text/html'}}));await c.put('/static/keep-ha-fixture.txt',new Response('Preserve HA'));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(prefix)||event.request.mode==='navigate'||/\/(api|auth)\//.test(u.pathname))return;const cached=caches.open(cacheName).then(c=>c.match(event.request));const network=cached.then(()=>fetch(event.request)).then(async r=>{if(r.status===200){const c=await caches.open(cacheName);await c.put(event.request,r.clone());}return r;});event.waitUntil(network.then(()=>{}).catch(()=>{}));event.respondWith(cached.then(hit=>hit||network));});
""".replace('__PREFIX__',json.dumps(prefix)).replace('__BUNDLE__',json.dumps(prefix+'assets/'+bundle)))
   Path(certdir.name).chmod(0o755)
   worker.chmod(0o644)
   extra='location = /ha-cache-fixture { default_type text/html; return 200 "<!doctype html><title>HA fixture</title>"; } location = /ha-cache-fixture-sw.js { alias /fixture/ha-cache-fixture-sw.js; default_type application/javascript; add_header Service-Worker-Allowed /; } '
  conf=Path(certdir.name)/'nginx.conf';conf.write_text('events {}\nhttp { server { listen 443 ssl; http2 on; ssl_certificate /fixture/cert.pem; ssl_certificate_key /fixture/key.pem; proxy_buffering off; include /fixture/route.conf; '+extra+'location / { return 404; } } }\n')
  subprocess.run(docker+['run','-d','--name',container,'--add-host','host.docker.internal:host-gateway','-p','127.0.0.1:8298:443','--mount',f'type=bind,src={certdir.name},dst=/fixture,readonly','--mount',f'type=bind,src={conf},dst=/etc/nginx/nginx.conf,readonly','nginx:stable-alpine'],check=True,stdout=log,stderr=log,env=docker_env)
 for _ in range(100):
  try:
   with urllib.request.urlopen(origin+prefix+'login',timeout=1,context=ssl._create_unverified_context()):break
  except Exception:time.sleep(.1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+fixture_spki]);contexts=[];errors=[];anonymous=pw.request.new_context(ignore_https_errors=True)
  def context(account):
   ctx=browser.new_context(ignore_https_errors=True,viewport={'width':1280 if account=='a' else 390,'height':900});contexts.append(ctx)
   def google(route):
    state=parse_qs(urlparse(route.request.url).query)['state'][0]
    route.fulfill(status=302,headers={'location':origin+prefix+'auth/google/callback?state='+state+'&code='+account})
   ctx.route('https://accounts.google.com/**',google)
   def public_asset(route):
    response=anonymous.get(route.request.url,max_redirects=0)
    assert response.status==200,(route.request.url,response.status)
    if urlparse(route.request.url).path.endswith('.js'):assert 'javascript' in response.headers.get('content-type','')
    route.fulfill(status=response.status,headers=response.headers,body=response.body())
   ctx.route(origin+prefix+'assets/**',public_asset)
   pending=[account=='a']
   def delayed_session(route):
    if pending[0]:pending[0]=False;route.fulfill(status=401,content_type='application/json',body='{"message":"Sessão ainda não disponível"}')
    else:route.continue_()
   ctx.route(origin+prefix+'api/pilot/session',delayed_session)
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   if args.ha_cache:
    page.goto(origin+'/ha-cache-fixture')
    page.evaluate("async()=>{await navigator.serviceWorker.register('/ha-cache-fixture-sw.js',{scope:'/'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));}")
   page.goto(origin+prefix)
   expect(page.get_by_role('heading',name='Artesão Digital',exact=True)).to_be_visible()

   expect(page.locator('[data-pilot-brand] img')).to_be_visible()
   assert page.locator('[data-pilot-brand] img').evaluate('img=>img.naturalWidth')==293
   page.get_by_label('Código de convite (somente no primeiro acesso)').fill('synthetic-invite-'+account+'-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
   expect(page).to_have_url(origin+prefix+'?view=produtos');expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
   finish=page.get_by_role('button',name='Concluir configuração inicial',exact=True);expect(finish).to_be_disabled()
   assert page.evaluate("async()=>(await fetch(new URL('api/products',document.baseURI))).status")==428
   if account=='a':
    page.get_by_role('link',name='Suporte técnico',exact=True).click();form=page.get_by_role('dialog',name='Abrir chamado de suporte',exact=True);expect(form).to_be_visible();form.get_by_label(re.compile('^Motivo do contato')).select_option('question');form.get_by_label(re.compile('^Assunto')).fill('Ajuda na preparação inicial');form.get_by_label(re.compile('^Descrição da dúvida ou erro')).fill('Como cadastrar o primeiro material?');form.get_by_role('button',name='Enviar chamado',exact=True).click();expect(form).to_have_count(0);expect(page.locator('.support-conversation')).to_contain_text('Ajuda na preparação inicial');page.goto(origin+prefix);expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
   company=page.get_by_role('region',name='Dados da empresa',exact=True)
   company.get_by_label(re.compile(r'^Nome\ da\ empresa(?:\s|$)')).fill('Ateliê inicial '+account.upper());company.get_by_label(re.compile(r'^Nome\ da\ pessoa\ responsável(?:\s|$)')).fill('Responsável '+account.upper());company.get_by_label(re.compile(r'^Telefone\ para\ contato(?:\s|$)')).fill('(11) 99999-0000');company.get_by_label(re.compile(r'^E\-mail\ para\ contato(?:\s|$)')).fill(account+'@example.test');company.get_by_role('button',name='Salvar dados da empresa',exact=True).click();expect(company.get_by_role('status')).to_contain_text('Dados da empresa salvos')
   if account=='a':
    page.get_by_role('button',name='Sair',exact=True).click();page.get_by_role('button',name='Entrar com Google',exact=True).click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();expect(page.get_by_label(re.compile(r'^Nome\ da\ empresa(?:\s|$)'))).to_have_value('Ateliê inicial A');expect(finish).to_be_disabled()
   material=page.locator('#materiais');material.get_by_label(re.compile(r'^Nome\ do\ material(?:\s|$)')).fill('Material inicial '+account);material.get_by_label(re.compile(r'^Quantidade\ da\ compra(?:\s|$)')).fill('1');material.get_by_label(re.compile(r'^Preço\ pago\ pela\ compra\ \(R\$\)(?:\s|$)')).fill('50');material.get_by_role('button',name='Salvar material',exact=True).click();expect(material.get_by_role('status')).to_contain_text('Material salvo')
   costs=page.locator('.settings-content');costs.get_by_label('Valor da hora humana (R$)',exact=True).fill('20');costs.get_by_label('Horas produtivas por mês',exact=True).fill('160');costs.get_by_label('Outras despesas (R$/mês)',exact=True).fill('160');costs.get_by_role('button',name='Salvar configurações gerais',exact=True).click();expect(costs.locator('> p[role=status]')).to_contain_text('Configurações salvas');expect(finish).to_be_enabled()
   page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/artesao-boas-vindas-'+account+'.png');finish.click()
   expect(page).to_have_url(origin+prefix+'?view=produtos');expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible();expect(page.locator('#pilot-account')).to_contain_text(account+'@example.test');expect(page.locator('#pilot-build-info')).to_contain_text('Artesão Digital v'+build_info['pilotVersion']);expect(page.locator('#pilot-build-info')).to_contain_text('Fabricação e Orçamentos v'+build_info['coreVersion']);expect(page.locator('#pilot-build-info')).to_be_in_viewport()
   page.reload();expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible()
   bar=page.locator('#pilot-account');expect(bar.locator('.pilot-account-title')).to_have_text('Artesão Digital');expect(bar.locator('.pilot-account-user')).to_have_text(account+'@example.test')
   if (root/'dist/pilot-logo.png').exists():
    logo=bar.locator('.pilot-account-title img');expect(logo).to_be_visible();assert logo.evaluate('img=>img.naturalWidth')==464
    assert page.locator('body').evaluate('el=>getComputedStyle(el).fontFamily').startswith('Arial')
    assert page.get_by_role('heading',name='Produtos',exact=True).evaluate('el=>getComputedStyle(el).fontFamily').startswith('Georgia')
    logo.evaluate("img=>img.src='/artesaos-piloto/brand/missing-logo.png'")
    expect(bar.locator('.pilot-account-title img')).to_have_count(0);expect(bar.locator('.pilot-account-title span')).to_be_visible()
    bar.locator('.pilot-account-title').evaluate('title=>window.pilotBrand(title)');expect(bar.locator('.pilot-account-title img')).to_be_visible()
   shell=page.locator('#pilot-shell');bb=bar.bounding_box();assert abs(bb['y'])<1
   menu=shell.get_by_role('navigation',name='Áreas',exact=True)
   toggle=shell.get_by_role('button',name='Menu',exact=True)
   if page.viewport_size['width']<=700:
    expect(menu).to_be_hidden();expect(toggle).to_have_attribute('aria-expanded','false');toggle.click()
    expect(menu).to_be_visible();expect(shell.get_by_role('button',name='Fechar menu',exact=True)).to_have_attribute('aria-expanded','true')
   else:expect(toggle).to_be_hidden()
   links=menu.get_by_role('link');assert links.all_text_contents()==['Produtos','Clientes','Orçamentos','Configurações']
   assert menu.get_by_role('link',name='Fabricação',exact=True).count()==0
   assert menu.bounding_box()['y']>=bb['height']-1
   if page.viewport_size['width']>700:
    tops=links.evaluate_all('items=>items.map(el=>el.getBoundingClientRect().top)');assert max(tops)-min(tops)<2
   else:
    shell.get_by_role('button',name='Fechar menu',exact=True).press('Escape');expect(menu).to_be_hidden();expect(toggle).to_be_focused()
   assert page.get_by_role('heading',name='Produtos',exact=True).bounding_box()['y']>=shell.bounding_box()['height']
   page.evaluate('scrollTo(0,document.body.scrollHeight)');assert abs(shell.bounding_box()['y'])<1;expect(page.locator('#pilot-build-info')).to_be_in_viewport();page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/artesao-digital-'+account+'.png')
   if account=='b':
    page.set_viewport_size({'width':320,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');expect(shell).to_be_in_viewport();expect(menu).to_be_hidden();page.screenshot(path='/tmp/artesao-digital-320.png')
    toggle.click();expect(menu).to_be_visible();expect(menu.get_by_role('link',name='Configurações',exact=True)).to_be_in_viewport();page.screenshot(path='/tmp/artesao-digital-320-menu.png');shell.get_by_role('button',name='Fechar menu',exact=True).click();expect(menu).to_be_hidden();page.set_viewport_size({'width':390,'height':900})
   if args.ha_cache:
    assert page.evaluate("navigator.serviceWorker.controller.scriptURL.includes('/artesaos-piloto/service-worker.js')")
    assert page.evaluate("async()=>{const c=await caches.open('fixture-ha-files');const r=await c.match('/static/keep-ha-fixture.txt');return await r.text();}")=="Preserve HA"
    cached_pilot=page.evaluate("async()=>{const found=[];for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys())if(new URL(request.url).pathname.startsWith('/artesaos-piloto/'))found.push(new URL(request.url).pathname);}return found;}")
    assert not cached_pilot,cached_pilot
    assert page.evaluate("async()=>(await navigator.serviceWorker.getRegistrations()).some(r=>new URL(r.scope).pathname==='/')")
   return ctx,page
  # A public expression of interest is distinct from activating a pilot account.
  interested=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':900});ip=interested.new_page();ip.goto(origin+prefix+'login')
  expect(ip.get_by_text('Projeto piloto: acesso somente para pessoas convidadas.',exact=True)).to_be_visible()
  assert ip.locator('#interest-form').bounding_box()['y']<ip.locator('#pilot-login').bounding_box()['y']
  assert ip.locator('form').first.get_attribute('id')=='interest-form'
  ip.screenshot(path='/tmp/artesao-login-interesse.png',full_page=True)
  ip.get_by_role('link',name='já tenho um convite/login',exact=True).click()
  expect(ip).to_have_url(origin+prefix+'login#pilot-login');expect(ip.get_by_role('heading',name='Já tem convite ou conta ativada?',exact=True)).to_be_in_viewport()
  ip.screenshot(path='/tmp/artesao-login-acesso.png')

  ip.get_by_label('Nome (obrigatório)',exact=True).fill('Interessado de teste')
  ip.get_by_label('E-mail (obrigatório)',exact=True).fill('interested@example.test')
  ip.get_by_role('checkbox').check();ip.get_by_role('button',name='Registrar interesse',exact=True).click()
  expect(ip.locator('#interest-status')).to_contain_text('Interesse registrado')
  interested.close()
  a,pa=context('a');pa.goto(origin+prefix+'?view=produtos');pa.get_by_role('button',name='Novo produto',exact=True).click();modal=pa.locator('dialog[open]');modal.get_by_label(re.compile(r'^Nome(?:\s|$)')).fill('Produto isolado A');modal.get_by_label('Origem',exact=True).select_option('own');modal.get_by_label('Exibir no catálogo',exact=True).check();modal.get_by_label('Origem',exact=True).select_option('client');expect(modal.get_by_label('Exibir no catálogo',exact=True)).to_have_count(0);modal.get_by_label('Origem',exact=True).select_option('own');expect(modal.get_by_label('Exibir no catálogo',exact=True)).not_to_be_checked();expect(modal.get_by_role('heading',name='Produção',exact=True)).to_be_visible();modal.locator('#main-machineSeconds-hours').fill('1');modal.locator('#main-humanSeconds-minutes').fill('15');modal.get_by_label(re.compile(r'^Valor varejo \(R\$\)')).fill('25');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pa.locator('.products-list-row')).to_have_count(1)
  saved=pa.evaluate("async()=>(await (await fetch(new URL('api/products',document.baseURI))).json())[0]");assert saved['manufacturing']['machineSeconds']==3600;assert saved['manufacturing']['humanSeconds']==900;assert saved['prices']['retail']==2500
  b,pb=context('b');pb.goto(origin+prefix+'?view=produtos');expect(pb.locator('.products-list-row')).to_have_count(0)
  pb.get_by_role('button',name='Novo produto',exact=True).click();modal=pb.locator('dialog[open]');modal.get_by_label(re.compile(r'^Nome(?:\s|$)')).fill('Produto isolado B');modal.get_by_label('Origem',exact=True).select_option('client');expect(modal.get_by_label('Exibir no catálogo',exact=True)).to_have_count(0);modal.get_by_label(re.compile(r'^Valor varejo \(R\$\)')).fill('15');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pb.locator('.products-list-row')).to_have_count(1);expect(pb.locator('.products-list-row')).not_to_contain_text('Produto isolado A')
  pa.reload();expect(pa.locator('.products-list-row')).to_have_count(1);expect(pa.locator('.products-list-row')).not_to_contain_text('Produto isolado B')
  pa.get_by_role('link',name='Suporte técnico',exact=True).click();form=pa.get_by_role('dialog',name='Abrir chamado de suporte',exact=True);form.get_by_label(re.compile('^Motivo do contato')).select_option('bug');form.get_by_label(re.compile('^Assunto')).fill('Erro de teste no cadastro');form.get_by_label(re.compile('^Descrição da dúvida ou erro')).fill('Descrição literal <img src=x onerror=alert(1)>\nPassos para reproduzir.');form.get_by_role('button',name='Enviar chamado',exact=True).click();expect(form).to_have_count(0);expect(pa.locator('.support-conversation')).to_contain_text('Erro de teste no cadastro');assert pa.locator('.support-conversation img').count()==0
  support_id=pa.evaluate("async()=>(await (await fetch(new URL('api/support',document.baseURI))).json()).items.find(item=>item.subject==='Erro de teste no cadastro').id")
  pb.goto(origin+prefix+'?view=configuracoes&area=suporte');panel=pb.get_by_role('tabpanel',name='Meus chamados',exact=True);expect(panel).to_be_visible();expect(panel).to_contain_text('Nenhum chamado encontrado.');assert pb.evaluate("async id=>(await fetch(new URL('api/support/'+id,document.baseURI))).status",support_id)==404
  for page,account in [(pa,'a'),(pb,'b')]:
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
   expect(page.get_by_label('Código de convite (somente no primeiro acesso)')).to_have_value('');page.get_by_role('button',name='Entrar com Google',exact=True).click()
   expect(page).to_have_url(origin+prefix+'?view=produtos');expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible();expect(page.locator('#pilot-account')).to_contain_text(account+'@example.test');expect(page.locator('#pilot-build-info')).to_contain_text('Artesão Digital v'+build_info['pilotVersion']);expect(page.locator('#pilot-build-info')).to_contain_text('Fabricação e Orçamentos v'+build_info['coreVersion']);expect(page.locator('#pilot-build-info')).to_be_in_viewport();page.goto(origin+prefix+'?view=produtos');expect(page.locator('.products-list-row')).to_have_count(1)
   for view,title in [('orcamentos','Orçamentos'),('clientes','Clientes'),('fabricacao','Produtos'),('configuracoes','Configurações')]:
    page.goto(origin+prefix+'?view='+view);expect(page.get_by_role('heading',name=title,exact=True,level=1)).to_be_visible();expect(page.locator('.pilot-account-title img')).to_be_visible();expect(page.locator('#pilot-build-info')).to_be_in_viewport()
   # The bare application path must also render an application, not only the account bar.
   page.goto(origin+prefix);expect(page.get_by_role('heading',name='Produtos',exact=True,level=1)).to_be_visible()
   page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
  def enter_settings(page):
   page.goto(origin+prefix+'?view=configuracoes');expect(page.get_by_role('heading',name='Configurações',exact=True)).to_be_visible()
  # General data stays in the existing fabrication namespace; tabs keep drafts mounted.
  # A has logged out at this point: authenticate again without repeating an invitation.
  pa.get_by_role('button',name='Entrar com Google',exact=True).click();expect(pa).to_have_url(origin+prefix+'?view=produtos')
  enter_settings(pa);company=pa.get_by_role('region',name='Dados da empresa',exact=True)
  company.get_by_label(re.compile(r'^Nome\ da\ empresa(?:\s|$)')).fill('Ateliê de teste A');company.get_by_label(re.compile(r'^Nome\ da\ pessoa\ responsável(?:\s|$)')).fill('Responsável A');company.get_by_label(re.compile(r'^Telefone\ para\ contato(?:\s|$)')).fill('(11) 99999-0000');company.get_by_label(re.compile(r'^E\-mail\ para\ contato(?:\s|$)')).fill('atelie-a@example.test');company.get_by_role('button',name='Salvar dados da empresa',exact=True).click();expect(company.get_by_role('status')).to_contain_text('Dados da empresa salvos')
  general=pa.locator('.pilot-general');expect(general.get_by_label('Valor da hora humana (R$)',exact=True)).to_be_visible()
  general.get_by_label('Valor da hora humana (R$)',exact=True).fill('23.50');general.get_by_role('button',name='Salvar configurações gerais',exact=True).click();expect(general.locator('.settings-content > p[role=status]')).to_contain_text('Configurações salvas')
  pa.get_by_role('tab',name='Clientes',exact=True).click();panel=pa.get_by_role('tabpanel',name='Clientes',exact=True);panel.get_by_label('Registros por página',exact=True).select_option('30')
  pa.get_by_role('tab',name='Produtos',exact=True).click();pa.get_by_role('tab',name='Clientes',exact=True).click();expect(panel.get_by_label('Registros por página',exact=True)).to_have_value('30')
  panel.get_by_role('button',name='Salvar configurações de clientes',exact=True).click();expect(panel.get_by_role('status')).to_contain_text('Configurações salvas')
  pa.reload();expect(pa.get_by_label(re.compile(r'^Nome\ da\ empresa(?:\s|$)'))).to_have_value('Ateliê de teste A');expect(pa.get_by_label('Valor da hora humana (R$)',exact=True)).to_have_value('23.50')
  pa.get_by_role('tab',name='Produtos',exact=True).focus();pa.get_by_role('tab',name='Produtos',exact=True).press('ArrowRight');expect(pa.get_by_role('tab',name='Clientes',exact=True)).to_have_attribute('aria-selected','true');expect(pa.get_by_role('tabpanel',name='Clientes',exact=True).get_by_label('Registros por página',exact=True)).to_have_value('30')
  pa.get_by_role('tab',name='Produtos',exact=True).click();pa.evaluate('scrollTo(0,0)');pa.screenshot(path='/tmp/artesao-configuracoes.png')
  # B's values are unchanged by A's settings.
  pb.get_by_role('button',name='Entrar com Google',exact=True).click();expect(pb).to_have_url(origin+prefix+'?view=produtos');enter_settings(pb);expect(pb.get_by_label(re.compile(r'^Nome\ da\ empresa(?:\s|$)'))).to_have_value('Ateliê inicial B');pb.get_by_role('tab',name='Clientes',exact=True).click();expect(pb.get_by_role('tabpanel',name='Clientes',exact=True).get_by_label('Registros por página',exact=True)).to_have_value('10')
  expect(pb.get_by_label('Valor da hora humana (R$)',exact=True)).not_to_have_value('23.50')
  pb.evaluate('scrollTo(0,0)');pb.screenshot(path='/tmp/artesao-configuracoes-mobile.png')
  pa.get_by_role('button',name='Sair',exact=True).click();pb.get_by_role('button',name='Sair',exact=True).click()
  # Reuse A's browser/storage for B: root HA caches must not restore A's UI/data.
  a.unroute('https://accounts.google.com/**')
  def switch_google(route):
   state=parse_qs(urlparse(route.request.url).query)['state'][0]
   route.fulfill(status=302,headers={'location':origin+prefix+'auth/google/callback?state='+state+'&code=b'})
  a.route('https://accounts.google.com/**',switch_google)
  pa.get_by_role('button',name='Entrar com Google',exact=True).click()
  expect(pa.get_by_role('heading',name='Produtos',exact=True)).to_be_visible()
  expect(pa.locator('#pilot-account')).to_contain_text('b@example.test')
  pa.goto(origin+prefix+'?view=produtos');expect(pa.locator('.products-list-row')).to_have_count(1)
  expect(pa.locator('.products-list-row')).to_contain_text('Produto isolado B');expect(pa.locator('.products-list-row')).not_to_contain_text('Produto isolado A')
  # A disconnected tab must explain the failure instead of leaving Sair inert.
  a.set_offline(True)
  pa.get_by_role('button',name='Sair',exact=True).click()
  expect(pa.locator('#pilot-session-status')).to_contain_text('Verifique sua conexão')
  expect(pa.get_by_role('button',name='Sair',exact=True)).to_be_enabled()
  a.set_offline(False)
  # Overnight absolute expiry removes browser cookies while the old tab stays open.
  a.clear_cookies()
  pa.get_by_role('button',name='Sair',exact=True).click()
  expect(pa.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
  expect(pa.get_by_label('Código de convite (somente no primeiro acesso)')).to_have_value('')
  # Separate Google admin login: an ordinary account cannot open the lead list.
  forbidden=browser.new_context(ignore_https_errors=True);fp=forbidden.new_page();fp.goto(origin+prefix+'admin/')
  expect(fp.get_by_role('heading',name='Acesso administrativo',exact=True)).to_be_visible();forbidden.close()
  adm=browser.new_context(ignore_https_errors=True,viewport={'width':1280,'height':900})
  def admin_google(route):
   state=parse_qs(urlparse(route.request.url).query)['state'][0]
   route.fulfill(status=302,headers={'location':origin+prefix+'auth/google/callback?state='+state+'&code=admin'})
  adm.route('https://accounts.google.com/**',admin_google);ap=adm.new_page();ap.goto(origin+prefix+'admin/login')
  ap.get_by_role('button',name='Entrar na administração com Google',exact=True).click()
  expect(ap).to_have_url(origin+prefix+'admin/');expect(ap.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible()
  expect(ap.locator('.pilot-account-title img')).to_be_visible()
  assert ap.locator('.pilot-account-title img').evaluate('img=>img.naturalWidth')==464
  expect(ap.locator('#interest-rows')).to_contain_text('interested@example.test');expect(ap.locator('#interest-rows')).to_contain_text('Não informado')
  expect(ap.locator('#admin-pagination')).to_be_hidden();ap.screenshot(path='/tmp/artesao-digital-admin.png')
  ap.set_viewport_size({'width':390,'height':900});assert ap.evaluate('document.documentElement.scrollWidth<=innerWidth');ap.screenshot(path='/tmp/artesao-digital-admin-mobile.png')
  ap.get_by_role('link',name='Chamados de suporte',exact=True).click();expect(ap.get_by_role('heading',name='Central de suporte',exact=True)).to_be_visible();ap.get_by_role('button',name='#'+str(support_id)+' — Erro de teste no cadastro',exact=True).click();expect(ap.locator('#support-detail')).to_contain_text('Erro de teste no cadastro');assert ap.locator('#support-events img').count()==0
  ap.get_by_label('Resposta ao cliente',exact=True).fill('Informe em qual etapa o erro ocorreu.');ap.get_by_label('Status após atualização',exact=True).select_option('waiting_customer');ap.get_by_role('button',name='Salvar atualização',exact=True).click();expect(ap.locator('#admin-status')).to_have_text('Atualização salva.');ap.screenshot(path='/tmp/artesao-suporte-admin.png')
  a.unroute('https://accounts.google.com/**')
  def support_google(route):
   state=parse_qs(urlparse(route.request.url).query)['state'][0];route.fulfill(status=302,headers={'location':origin+prefix+'auth/google/callback?state='+state+'&code=a'})
  a.route('https://accounts.google.com/**',support_google);pa.get_by_role('button',name='Entrar com Google',exact=True).click();expect(pa.get_by_role('heading',name='Produtos',exact=True)).to_be_visible();pa.goto(origin+prefix+'?view=suporte');pa.get_by_role('button',name='#'+str(support_id)+' — Erro de teste no cadastro',exact=True).click();conversation=pa.locator('.support-conversation');expect(conversation).to_contain_text('Aguardando resposta do cliente');expect(conversation).to_contain_text('Informe em qual etapa o erro ocorreu.')
  conversation.get_by_label(re.compile('^Sua mensagem')).fill('Ocorreu ao salvar o produto.');conversation.get_by_role('button',name='Enviar mensagem',exact=True).click();expect(conversation).to_contain_text('Ocorreu ao salvar o produto.');pa.reload();pa.get_by_role('button',name='#'+str(support_id)+' — Erro de teste no cadastro',exact=True).click();expect(pa.locator('.support-conversation')).to_contain_text('Ocorreu ao salvar o produto.');pa.set_viewport_size({'width':390,'height':900});assert pa.evaluate('document.documentElement.scrollWidth<=innerWidth');pa.screenshot(path='/tmp/artesao-suporte-mobile.png')
  ap.get_by_role('button',name='Atualizar conversa',exact=True).click();expect(ap.locator('#support-events')).to_contain_text('Ocorreu ao salvar o produto.');ap.get_by_label('Status após atualização',exact=True).select_option('closed');ap.get_by_role('button',name='Salvar atualização',exact=True).click();expect(ap.locator('#admin-status')).to_have_text('Atualização salva.');pa.get_by_role('button',name='Atualizar conversa',exact=True).click();expect(pa.get_by_role('button',name='Enviar mensagem e reabrir chamado',exact=True)).to_be_visible()
  ap.get_by_role('button',name='Sair da administração',exact=True).click();expect(ap.get_by_role('heading',name='Acesso administrativo',exact=True)).to_be_visible();adm.close()
  isolated=browser.new_context(ignore_https_errors=True);lost=isolated.new_page();lost.goto(origin+prefix+'auth/finish');expect(lost.get_by_role('status')).to_contain_text('Não foi possível confirmar a sessão');expect(lost.get_by_role('link',name='Entrar novamente',exact=True)).to_be_visible();expect(lost).to_have_url(origin+prefix+'auth/finish');isolated.close()
  assert not errors,errors
  anonymous.dispose();browser.close()
 print('PASS: primeiro acesso e novo login SEM URL manual, Produtos automático, marca/rodapé visíveis, demais áreas/raiz, contas isoladas, interesse com e-mail obrigatório, administração restrita, F5, logout após expiração e aviso de falha de rede; proxy Nginx='+str(args.nginx)+', cache HA='+str(args.ha_cache)+'. Provedor Google controlado, validação real pendente.')
finally:
 if args.nginx:subprocess.run(docker+['rm','-f',container],stdout=log,stderr=log,env=docker_env)
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();certdir.cleanup()
