"""IMG-PROD-001: local TLS, synthetic accounts/images only. No production access."""
import base64,hashlib,json,os,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-photos-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-product-photos-browser-server.log','w') as log:
  server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert,'PILOT_TEST_DISTRIBUTION':'debian'},stdout=log,stderr=log)
  origin='https://127.0.0.1:8298';base=origin+'/artesaos-piloto/'
  try:
   for _ in range(60):
    try:urllib.request.urlopen(base+'login',context=ssl._create_unverified_context(),timeout=1);break
    except Exception:time.sleep(.2)
   else:raise RuntimeError('Fixture unavailable')
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki]);checks=[]
    for who,width in [('a',1280),('b',390)]:
     context=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':950});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     context.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code='+who}))
     page.goto(base+'login');page.locator('#invite').fill('synthetic-invite-'+who+'-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
     expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar',exact=True).click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     page.evaluate("""async()=>{const api=async(p,m,b)=>{const r=await fetch(new URL('api/'+p,document.baseURI),{method:m,headers:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json();};await api('company','PUT',{data:{name:'Ateliê sintético',responsible:'Teste',phone:'11999999999',email:'test@example.test'},expectedRevision:0});await api('materials','POST',{name:'PLA teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''});const s=await api('settings/fabricacao','GET');await api('settings/fabricacao','PUT',{data:{...s.data,humanHour:'20',productiveHours:'160',otherCost:'100'},expectedRevision:s.revision});await api('onboarding/complete','POST',{});} """)
     page.goto(base+'?view=produtos');expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible();page.get_by_role('button',name='Novo produto',exact=True).click();dialog=page.locator('dialog[open]');dialog.get_by_label('Nome',exact=False).first.fill('Peça sintética '+who);dialog.get_by_label('Origem',exact=False).select_option('own');dialog.get_by_label('Valor varejo (R$)',exact=False).fill('10');picker=dialog.locator('section[aria-label="Foto do produto"]');file=picker.locator('input[type=file]')
     def picture(fmt,color):
      encoded=page.evaluate("""({fmt,color})=>{const c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,c.width,c.height);return c.toDataURL('image/'+fmt,.9).split(',')[1];}""",{'fmt':fmt,'color':color});return {'name':'synthetic.'+fmt,'mimeType':'image/'+fmt,'buffer':base64.b64decode(encoded)}
     file.set_input_files(picture('jpeg','red'));expect(picker.get_by_role('status')).to_contain_text('Foto enviada.');preview=picker.locator('img');expect(preview).to_be_visible();page.wait_for_function("document.querySelector('section[aria-label=\"Foto do produto\"] img')?.naturalWidth===1024");old=preview.get_attribute('src')
     file.set_input_files({'name':'invalid.png','mimeType':'image/png','buffer':b'corrupt PNG bytes'});expect(picker.get_by_role('alert')).to_be_visible();expect(preview).to_have_attribute('src',old);expect(dialog.get_by_label('Nome',exact=False).first).to_have_value('Peça sintética '+who)
     file.set_input_files({'name':'oversized.png','mimeType':'image/png','buffer':b'x'*(8*1024*1024+1)});expect(picker.get_by_role('alert')).to_contain_text('8 MB');expect(preview).to_have_attribute('src',old)
     for fmt,color in [('webp','blue'),('png','green')]:
      prior=preview.get_attribute('src');file.set_input_files(picture(fmt,color));expect(preview).not_to_have_attribute('src',prior);expect(picker.get_by_role('status')).to_contain_text('Foto enviada.');page.wait_for_function("document.querySelector('section[aria-label=\"Foto do produto\"] img')?.naturalWidth===1024")
     final=preview.get_attribute('src');dialog.get_by_role('button',name='Salvar produto',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0);expect(page.get_by_text('Produto salvo.',exact=True)).to_be_visible();expect(page.locator('.product-list-photo img')).to_have_attribute('src',final)
     page.reload();expect(page.locator('.product-list-photo img')).to_have_attribute('src',final);page.get_by_role('button',name='Editar',exact=True).first.click();dialog=page.locator('dialog[open]');picker=dialog.locator('section[aria-label="Foto do produto"]');expect(picker.locator('img')).to_have_attribute('src',final)
     context.route('**/api/product-photos',lambda route:route.fulfill(status=503,content_type='application/json',body='{}'))
     picker.locator('input[type=file]').set_input_files(picture('png','purple'));expect(picker.get_by_role('alert')).to_contain_text('foto anterior foi preservada');expect(picker.locator('img')).to_have_attribute('src',final);context.unroute('**/api/product-photos')
     picker.locator('input[type=file]').set_input_files(picture('png','purple'));expect(picker.get_by_role('status')).to_contain_text('Foto enviada.');dialog.get_by_role('button',name='Salvar produto',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;checks.append('JPEG/WebP/PNG optimize/upload/preview/save/reopen/replace; invalid/oversize/network failure preserve image and fields; '+str(width));context.close()
    browser.close();print(json.dumps({'status':'passed','checks':checks,'limitations':['Chromium viewport only; no physical Android/iOS/Forja/HA or real Google']},ensure_ascii=False))
  finally:server.terminate();server.wait(timeout=15)
