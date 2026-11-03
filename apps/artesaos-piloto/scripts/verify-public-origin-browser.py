"""Disposable local TLS at public hostname mapped to loopback:8298. Google mocked.
No real DNS/proxy/Google/Forja/HA access. API tests cover production Host without port.
"""
import base64,hashlib,json,os,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];origin='https://artesaodigital.com.br:8298';prefix='/artesaos-piloto/';base=origin+prefix
with tempfile.TemporaryDirectory(prefix='artesao-public-origin-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-public-origin-browser-server.log','w') as log:
  server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert,'PILOT_TEST_PUBLIC_ORIGIN':'1','PILOT_TEST_DISTRIBUTION':'debian'},stdout=log,stderr=log)
  try:
   for i in range(60):
    try:
     req=urllib.request.Request('https://127.0.0.1:8298'+prefix+'login',headers={'Host':urlparse(origin).netloc});urllib.request.urlopen(req,context=ssl._create_unverified_context(),timeout=1);break
    except Exception:time.sleep(.2)
   else:raise RuntimeError('Local fixture did not start')
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki,'--no-proxy-server','--host-resolver-rules=MAP artesaodigital.com.br 127.0.0.1'])
    context=browser.new_context(ignore_https_errors=True);errors=[]
    context.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code=a'}))
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'login');expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_enabled()
    page.locator('#invite').fill('synthetic-invite-a-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
    expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click()
    expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();assert page.url.startswith(base)
    def api(path,method='GET',body=None):
     return page.evaluate('''async ({path,method,body})=>{const r=await fetch(new URL('api/'+path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();}''',{'path':path,'method':method,'body':body})
    api('company','PUT',{'data':{'name':'Empresa sintética domínio oficial','responsible':'Teste','phone':'11999999999','email':'a@example.test'},'expectedRevision':0})
    for width in [1280,390]:
     page.set_viewport_size({'width':width,'height':900});page.reload();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    cookies=context.cookies(base);assert any(c['name']=='__Secure-artesaos_session' and c['domain']=='artesaodigital.com.br' and c['httpOnly'] and c['secure'] for c in cookies)
    assert page.evaluate("async()=>{const m=await(await fetch('manifest.webmanifest')).json();return m.scope==='/artesaos-piloto/'&&m.start_url==='/artesaos-piloto/';}")
    page.goto(base+'admin/login');page.locator('input[name=email]').fill('admin@example.test');page.locator('input[name=password]').fill('Synthetic admin pass 123!');page.get_by_role('button',name='Entrar',exact=True).click();expect(page.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible()
    for width in [1280,390]:
     page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.get_by_role('button',name='Sair da administração',exact=True).click();expect(page.get_by_role('heading',name='Acesso administrativo',exact=True)).to_be_visible()
    page.goto(base);expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();page.get_by_role('button',name='Sair',exact=True).click();expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
    page.get_by_role('button',name='Entrar com Google',exact=True).click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();assert api('company')['data']['name']=='Empresa sintética domínio oficial'
    assert not errors,errors;browser.close()
    print(json.dumps({'status':'passed','origin':origin,'viewports':[1280,390],'checks':['synthetic Google OAuth round-trip','host-only secure session','reload/navigation/PWA manifest','local Debian admin login/logout','user logout and new login without invitation','record persisted after new login','no JavaScript errors'],'limitations':['local TLS test port8298','no real Google, DNS, proxy, Android or target server']},ensure_ascii=False))
  finally:
   server.terminate();server.wait(timeout=15)
