"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,re,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-pwa01-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-pwa01-browser-server.log','w') as log:
  server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert},stdout=log,stderr=log)
  origin='https://127.0.0.1:8298';base=origin+'/artesaos-piloto/'
  try:
   for i in range(60):
    try:urllib.request.urlopen(base+'login',context=ssl._create_unverified_context(),timeout=1);break
    except Exception:time.sleep(.2)
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki])
    def login(context,subject,admin=False):
     context.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code='+subject}))
     page=context.new_page();page.goto(base+('admin/login' if admin else 'login'))
     if not admin:page.locator('#invite').fill('synthetic-invite-'+subject+'-01234567890123456789')
     page.get_by_role('button',name='Entrar na administração com Google' if admin else 'Entrar com Google',exact=True).click()
     if admin:expect(page.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible()
     else:
      expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();expect(page.locator('[role=alert]:visible')).to_have_count(0)
      page.evaluate("""()=>{const orig=window.fetch;let fail=true;window.fetch=(input,init)=>{if(fail&&String(input).includes('legal/accept')){fail=false;return Promise.resolve(new Response('{}',{status:503}));}return orig(input,init);};}""")
      page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click();expect(page.get_by_role('alert')).to_contain_text('Não foi possível registrar o aceite');page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     return page
    for width,subject in [(390,'a'),(1280,'b')]:
     ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900})
     page=login(ctx,subject)
     cdp=ctx.new_cdp_session(page);manifest=cdp.send('Page.getAppManifest');assert not manifest['errors'],manifest
     import json
     m=json.loads(manifest['data']);assert m['display']=='standalone' and m['start_url']=='/artesaos-piloto/' and m['id']=='/artesaos-piloto/'
     for icon in m['icons']:
      r=ctx.request.get(origin+icon['src']);assert r.status==200 and r.headers['content-type'].startswith('image/png')
     # Update a worker while editing: retain current form, keep HA cache intact.
     page.locator('[name=companyName]').fill('PWA dados ainda nao salvos')
     page.evaluate("""async()=>{const c=await caches.open('ha-fixture');await c.put('/lovelace',new Response('HA fixture'));await new Promise(async(resolve,reject)=>{const t=setTimeout(()=>reject(Error('worker timeout')),12000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});await navigator.serviceWorker.register('/artesaos-piloto/service-worker.js?v=pwa-test',{scope:'/artesaos-piloto/',updateViaCache:'none'});});}""")
     expect(page.locator('[name=companyName]')).to_have_value('PWA dados ainda nao salvos')
     assert page.evaluate("async()=>!!(await (await caches.open('ha-fixture')).match('/lovelace'))")
     assert page.evaluate("async()=>{for(const name of await caches.keys()){const c=await caches.open(name);for(const req of await c.keys())if(new URL(req.url).pathname.startsWith('/artesaos-piloto/'))return false;}return true;}")
     page.close();page=ctx.new_page();page.goto(base);expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     page.get_by_role('button',name='Sair',exact=True).click();expect(page.locator('#pilot-login')).to_be_visible()
     page.get_by_role('button',name='Entrar com Google',exact=True).click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     ctx.close()
    browser.close();print('PASS PWA-01 Chromium: manifest parsed, icons, synthetic Google login/relogin/logout, reopen, mobile/desktop, worker update preserves form and HA cache; no offline business cache.')
  finally:
   server.terminate();server.wait(timeout=10)
