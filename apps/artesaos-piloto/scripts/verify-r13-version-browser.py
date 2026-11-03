"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,re,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-r13-version-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-r13-version-browser-server.log','w') as log:
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
      page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     return page
    def api(page,path,method='GET',body=None):
     return page.evaluate("""async({path,method,body})=>{const r=await fetch(new URL('api/'+path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();}""",{'path':path,'method':method,'body':body})
    ctx=browser.new_context(ignore_https_errors=True,permissions=['clipboard-read','clipboard-write'])
    page=login(ctx,'a')
    api(page,'company','PUT',{'data':{'name':'Empresa sintética R1.2','responsible':'Teste','phone':'11999999999','email':'a@example.test'},'expectedRevision':0})
    api(page,'materials','POST',{'name':'Material sintético','mode':'quantity','purchaseQuantity':1,'purchasePrice':1,'purchaseUnit':'kg','customUnit':''})
    settings=api(page,'settings/fabricacao');api(page,'settings/fabricacao','PUT',{'data':{**settings['data'],'humanHour':'20','productiveHours':'160','otherCost':'100'},'expectedRevision':settings['revision']});api(page,'onboarding/complete','POST',{})
    def login_again():
     expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible()
     page.get_by_role('button',name='Entrar com Google',exact=True).click()
     expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible()
     assert api(page,'pilot/session')['email']=='a@example.test'
     expect(page.get_by_role('heading',name='O Artesão Digital foi atualizado!',exact=True)).to_have_count(0)
    for width in [390,1280]:
     page.set_viewport_size({'width':width,'height':900});page.goto(base+'?view=suporte')
     expect(page.get_by_role('heading',name='Suporte técnico',exact=True)).to_be_visible()
     page.get_by_role('button',name='Abrir chamado',exact=True).click();page.get_by_label('Assunto',exact=False).fill('Rascunho local preservado')
     ctx.route('**/artesaos-piloto/version',lambda route:route.fulfill(content_type='application/json',body='{"version":"future-test","reauthenticate":false}'))
     page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
     expect(page.get_by_role('heading',name='O Artesão Digital foi atualizado!',exact=True)).to_be_visible()
     page.get_by_role('button',name='Entrar novamente',exact=True).click();expect(page.get_by_role('heading',name='Atenção às suas alterações',exact=True)).to_be_visible()
     page.screenshot(path=f'/tmp/artesao-r13-risk-{width}.png')
     page.get_by_role('button',name='Voltar e revisar',exact=True).click();expect(page.get_by_label('Assunto',exact=False)).to_have_value('Rascunho local preservado')
     expect(page.get_by_text('Esta versão não pode mais salvar ou enviar operações.',exact=False)).to_be_visible()
     # Even a direct programmatic request cannot bypass the blocked page.
     calls=[];ctx.route('**/api/probe',lambda route:(calls.append(route.request),route.abort()))
     page.evaluate("()=>{window.guardProbe=fetch(new URL('api/probe',document.baseURI),{method:'POST',body:'{}'});}")
     page.wait_for_timeout(100);assert len(calls)==0
     assert page.evaluate("document.cookie.includes('__Secure-artesaos_csrf=')")
     ctx.unroute('**/artesaos-piloto/version')
     page.get_by_role('button',name='Entrar novamente',exact=True).click();page.get_by_role('button',name='Continuar',exact=True).click()
     expect(page.get_by_role('button',name='Entrar com Google',exact=True)).to_be_visible();login_again()
     # Data confirmed before detection survives actual logout and new login.
     assert api(page,'company')['data']['name']=='Empresa sintética R1.2'
     page.reload();expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible();expect(page.locator('dialog[open]')).to_have_count(0)
    # A manual reload with a stale session marker must not render business UI.
    ctx.add_cookies([{'name':'__Secure-artesaos_version','value':'old-marker','domain':'127.0.0.1','path':'/artesaos-piloto/','secure':True,'httpOnly':True,'sameSite':'Lax'}])
    page.reload();expect(page.get_by_role('heading',name='O Artesão Digital foi atualizado!',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='Produtos',exact=True)).to_have_count(0)
    page.get_by_role('button',name='Entrar novamente',exact=True).click();login_again()
    ctx.close()
    ctx=browser.new_context(ignore_https_errors=True,viewport={'width':1280,'height':900});page=login(ctx,'admin',True)
    ctx.route('**/artesaos-piloto/version?admin=1',lambda route:route.fulfill(content_type='application/json',body='{"version":"future-test","reauthenticate":false}'))
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.get_by_role('heading',name='O Artesão Digital foi atualizado!',exact=True)).to_be_visible()
    page.get_by_role('button',name='Entrar novamente',exact=True).click();ctx.unroute('**/artesaos-piloto/version?admin=1')
    page.get_by_role('button',name='Continuar',exact=True).click()
    expect(page.get_by_role('button',name='Entrar na administração com Google',exact=True)).to_be_visible()
    page.get_by_role('button',name='Entrar na administração com Google',exact=True).click();expect(page.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible()
    ctx.close();browser.close();print('PASS R1.3 Chromium: normal login, visibility return/version change, warning/review retains draft, blocked mutation, continue/logout/new login without loop, stored company retained, unchanged reload and stale-session manual reload; 390/1280 synthetic only.')
  finally:
   server.terminate();server.wait(timeout=15)
