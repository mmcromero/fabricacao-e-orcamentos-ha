"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,re,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-r12-ux-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-r12-ux-browser-server.log','w') as log:
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
    enabled=True
    def help_response(route):
     import json
     route.fulfill(content_type='application/json',body=json.dumps({'manual':{'id':'synthetic','version':'fixture-1','publishedAt':'2026-01-01'},'history':[],'contribution':{'enabled':enabled,'message':'Apoio sintético de teste','beneficiary':'Beneficiário sintético','key':'chave-sintetica-sem-pagamento'}}))
    ctx.route('**/api/help',help_response)
    for width in [390,1280]:
     page.set_viewport_size({'width':width,'height':900})
     for view in ['ajuda','suporte']:
      page.goto(base+'?view='+view);card=page.get_by_role('complementary',name='Apoio voluntário');expect(card).to_be_visible();expect(card.locator('details,summary')).to_have_count(0)
      expect(card.get_by_text('Apoio sintético de teste')).to_be_visible();expect(card.get_by_text('Beneficiário: Beneficiário sintético')).to_be_visible()
      assert card.evaluate('(el)=>el===el.parentElement.lastElementChild')
      assert card.evaluate("(el)=>Boolean(el.compareDocumentPosition(document.getElementById('pilot-build-info')) & Node.DOCUMENT_POSITION_FOLLOWING)")
      page.evaluate("()=>{window.copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copied=value;}}});}")
      card.get_by_role('button',name='Copiar chave Pix').click();expect(card.get_by_role('status')).to_have_text('Chave copiada.');assert page.evaluate('window.copied')=='chave-sintetica-sem-pagamento'
      page.evaluate("()=>{navigator.clipboard.writeText=async()=>{throw Error('synthetic clipboard denial');};}");card.get_by_role('button',name='Copiar chave Pix').click();expect(card.get_by_role('status')).to_contain_text('Não foi possível copiar')
      if view=='ajuda':
       assert page.get_by_role('link',name='Visualizar ou baixar manual PDF').get_attribute('href').endswith('api/manuals/synthetic')
       assert page.get_by_role('link',name='Ler documentos e histórico integral').get_attribute('href')=='legal'
      else:
       page.get_by_role('button',name='Abrir chamado',exact=True).click();expect(page.locator('dialog[open]')).to_be_visible();page.get_by_role('button',name='Cancelar',exact=True).click()
      card.scroll_into_view_if_needed();page.screenshot(path=f'/tmp/artesao-r12-{view}-{width}.png');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    enabled=False
    for view in ['ajuda','suporte']:
     page.goto(base+'?view='+view);expect(page.get_by_role('heading',name='Ajuda' if view=='ajuda' else 'Suporte técnico',exact=True)).to_be_visible();expect(page.get_by_role('complementary',name='Apoio voluntário')).to_have_count(0)
    ctx.close();browser.close();print('PASS AD-UX-002 Chromium: Help/Support 390/1280; last content before footer, always expanded, clipboard success/failure, existing links/actions, disabled contribution hidden; synthetic only.')
  finally:
   server.terminate();server.wait(timeout=15)
