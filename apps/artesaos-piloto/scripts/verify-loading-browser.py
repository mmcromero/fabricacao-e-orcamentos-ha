"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-loading-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-loading-browser-server.log','w') as log:
  server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_DISTRIBUTION':'debian','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert},stdout=log,stderr=log)
  origin='https://127.0.0.1:8298';base=origin+'/artesaos-piloto/'
  try:
   for i in range(60):
    try:urllib.request.urlopen(base+'login',context=ssl._create_unverified_context(),timeout=1);break
    except Exception:time.sleep(.2)
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki])
    for width in [390,1280]:
     ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900});page=ctx.new_page();held=[]
     messages=[]
     page.on('console',lambda message:messages.append(message.text))
     def observe_native():
      page.evaluate("""()=>{for(const name of ['submit','click'])document.addEventListener(name,()=>{const s=document.getElementById('pilot-loading-status');if(s&&!s.hidden)console.log('UXTEST:'+s.textContent+':'+(getComputedStyle(s).display!=='none'));});}""")
     def release():
      for _ in range(60):
       if held:return held.pop(0)
       page.wait_for_timeout(25)
      raise AssertionError('Expected held request')
     page.goto(base+'admin/login');observe_native();expect(page.locator('#pilot-loading-status')).to_be_hidden()
     ctx.route('**/admin/auth/login',lambda route:held.append(route))
     page.locator('[name=email]').fill('admin@example.test');page.locator('[name=password]').fill('Incorrect password 123!');page.get_by_role('button',name='Entrar',exact=True).click(no_wait_after=True)
     route=release();assert 'UXTEST:Processando acesso…:true' in messages;route.continue_()
     expect(page.get_by_role('alert')).to_be_visible();expect(page.locator('#pilot-loading-status')).to_be_hidden()
     observe_native();page.locator('[name=email]').fill('admin@example.test');page.locator('[name=password]').fill('Synthetic admin pass 123!');page.get_by_role('button',name='Entrar',exact=True).click(no_wait_after=True);route=release();assert 'UXTEST:Processando acesso…:true' in messages;route.continue_()
     expect(page.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible();expect(page.locator('#pilot-loading-status')).to_be_hidden();ctx.unroute('**/admin/auth/login')
     observe_native();ctx.route('**/admin/users',lambda route:held.append(route));page.get_by_role('link',name='Usuários cadastrados',exact=True).click(no_wait_after=True);route=release();assert 'UXTEST:Carregando página…:true' in messages;route.continue_();expect(page.get_by_role('heading',name='Usuários cadastrados',exact=True)).to_be_visible();ctx.unroute('**/admin/users');expect(page.locator('#pilot-loading-status')).to_be_hidden()
     ctx.route('**/admin/api/users?*',lambda route:held.append(route));page.locator('#users-refresh').click();expect(page.locator('#pilot-loading-status')).to_be_visible();page.screenshot(path=f'/tmp/artesao-loading-{width}.png');release().fulfill(status=503,content_type='application/json',body='{"message":"Falha sintética UX"}');expect(page.locator('#pilot-loading-status')).to_be_hidden();expect(page.locator('#admin-status')).to_contain_text('Falha sintética UX');expect(page.locator('#users-refresh')).to_be_enabled()
     page.evaluate("()=>{window.pendingUX=Promise.all([fetch('api/users?page=1'),fetch('api/users?page=2')]);}");expect(page.locator('#pilot-loading-status')).to_be_visible();release().fulfill(status=200,content_type='application/json',body='{}');expect(page.locator('#pilot-loading-status')).to_be_visible();release().fulfill(status=200,content_type='application/json',body='{}');page.evaluate('()=>window.pendingUX');expect(page.locator('#pilot-loading-status')).to_be_hidden()
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');ctx.close()
    ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':900});page=ctx.new_page();held=[]
    ctx.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code=a'}))
    page.on('console',lambda message:messages.append(message.text));page.goto(base+'login');observe_native();page.locator('#invite').fill('synthetic-invite-a-01234567890123456789');ctx.route('**/auth/google/start',lambda route:held.append(route));page.get_by_role('button',name='Entrar com Google',exact=True).click(no_wait_after=True);route=release();assert 'UXTEST:Abrindo acesso Google…:true' in messages;route.continue_();expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();expect(page.locator('#pilot-loading-status')).to_be_hidden()
    ctx.close();browser.close();print('PASS UX-Loading-01 Chromium: native login held/error/success; admin navigation/request error/concurrent responses; Google controlled flow; 390/1280; synthetic data only.')
  finally:
   server.terminate();server.wait(timeout=10)
