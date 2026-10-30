"""Uses a disposable test-only identity provider. Does NOT validate real Google or TLS."""
import os,ssl,tempfile,subprocess,time,urllib.request
from urllib.parse import urlparse,parse_qs
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
certdir=tempfile.TemporaryDirectory(prefix='pilot-tls-fixture-');key=str(Path(certdir.name)/'key.pem');cert=str(Path(certdir.name)/'cert.pem')
subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
log=open('/tmp/artesaos-browser-server.log','w')
server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert},stdout=log,stderr=log)
origin='https://127.0.0.1:8298';prefix='/artesaos-piloto/'
try:
 for _ in range(50):
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
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+prefix)
   expect(page.get_by_role('heading',name='Artesãos — Piloto',exact=True)).to_be_visible()
   page.get_by_label('Código de convite (somente no primeiro acesso)').fill('synthetic-invite-'+account+'-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
   expect(page.locator('#pilot-account')).to_contain_text(account+'@example.test')
   return ctx,page
  a,pa=context('a');pa.goto(origin+prefix+'?view=produtos');pa.get_by_role('button',name='Novo produto',exact=True).click();modal=pa.locator('dialog[open]');modal.get_by_label('Nome',exact=True).fill('Produto isolado A');modal.get_by_label('Origem',exact=True).select_option('own');modal.get_by_label('Valor varejo (R$)',exact=True).fill('25');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pa.locator('.product-record')).to_have_count(1)
  b,pb=context('b');pb.goto(origin+prefix+'?view=produtos');expect(pb.locator('.product-record')).to_have_count(0)
  pb.get_by_role('button',name='Novo produto',exact=True).click();modal=pb.locator('dialog[open]');modal.get_by_label('Nome',exact=True).fill('Produto isolado B');modal.get_by_label('Origem',exact=True).select_option('client');modal.get_by_label('Valor varejo (R$)',exact=True).fill('15');modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(pb.locator('.product-record')).to_have_count(1);expect(pb.locator('.product-record')).not_to_contain_text('Produto isolado A')
  pa.reload();expect(pa.locator('.product-record')).to_have_count(1);expect(pa.locator('.product-record')).not_to_contain_text('Produto isolado B')
  for page in [pa,pb]:
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
  assert not errors,errors
  browser.close()
 print('PASS: login/cookies/CSRF/renderização/contas isoladas/logout em computador e celular com provedor controlado; Google/TLS reais ainda não testados.')
finally:
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();certdir.cleanup()
