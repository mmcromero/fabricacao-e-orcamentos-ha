"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,re,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-dev12-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-dev12-browser-server.log','w') as log:
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
      expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     return page
    adminctx=browser.new_context(ignore_https_errors=True,viewport={'width':1280,'height':900});admin=login(adminctx,'admin',True);admin.goto(base+'admin/resources');expect(admin.get_by_role('heading',name='Documentos, manual e contribuição',exact=True)).to_be_visible()
    admin.locator('#pix-enabled').check();admin.locator('#pix-key').fill('support@example.test');admin.locator('#pix-beneficiary').fill('Tudoe3d');admin.locator('#pix-message').fill('Contribuição opcional');admin.get_by_role('button',name='Salvar contribuição',exact=True).click();expect(admin.locator('#resource-message')).to_have_text('Configuração Pix salva.')
    admin.locator('#resource-kind').select_option('manual');admin.locator('#resource-version').fill('manual-browser-1');admin.locator('#resource-file').set_input_files({'name':'manual.pdf','mimeType':'application/pdf','buffer':subprocess.check_output(['node','--input-type=module','-e',"import {PDFDocument} from 'pdf-lib';const p=await PDFDocument.create();p.addPage();process.stdout.write(Buffer.from(await p.save()));"],cwd=root)})
    admin.get_by_role('button',name='Salvar rascunho').click();expect(admin.locator('#resource-message')).to_contain_text('Rascunho salvo');manual=admin.locator('#resource-list details').filter(has_text='manual-browser-1');manual.locator('summary').click();manual.get_by_role('button',name='Publicar esta versão').click();expect(admin.locator('#resource-message')).to_have_text('Versão publicada.')
    for subject,width in [('a',1280),('b',390)]:
     ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900});page=login(ctx,subject)
     page.goto(base+'?view=suporte&novo=1');expect(page.get_by_role('heading',name='Suporte técnico',exact=True)).to_be_visible();expect(page.locator('dialog[open]')).to_have_count(0);expect(page.locator('[data-validation-message]')).to_have_count(0)
     page.get_by_role('button',name='Abrir chamado',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(1);expect(page.locator('[data-validation-message]')).to_have_count(0);page.get_by_role('button',name='Cancelar',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
     page.goto(base+'?view=ajuda');expect(page.get_by_role('heading',name='Ajuda',exact=True)).to_be_visible();expect(page.get_by_role('link',name='Visualizar ou baixar manual PDF')).to_be_visible();expect(page.get_by_text('Versão manual-browser-1',exact=False).first).to_be_visible();page.get_by_text('Apoie voluntariamente o Artesão Digital',exact=True).click();expect(page.get_by_role('button',name='Copiar chave Pix')).to_be_visible()
     page.evaluate("""async()=>{const api=async(p,method='GET',body)=>{const r=await fetch(new URL('api/'+p,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();};await api('company','PUT',{data:{name:'Ateliê de teste',responsible:'Pessoa teste',phone:'+5511999999999',email:'user@example.test'},expectedRevision:0});await api('materials','POST',{name:'Material teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''});const s=await api('settings/fabricacao');await api('settings/fabricacao','PUT',{data:{...s.data,humanHour:'20',productiveHours:'160',otherCost:'100'},expectedRevision:s.revision});await api('onboarding/complete','POST',{});const p=await api('sales-places','POST',{requestKey:crypto.randomUUID(),name:'Feira sintética',address:'',notes:'',active:true});const sess=await api('sales-sessions','POST',{requestKey:crypto.randomUUID(),placeId:p.id,dateOn:'2026-11-01',tier:'retail',stockControl:false});window.fixtureSession=sess.id;}""")
     sid=page.evaluate('window.fixtureSession');page.goto(base+'?view=vendas&session='+sid);expect(page.get_by_role('button',name=re.compile('Visitantes: 0'))).to_be_visible();expect(page.get_by_role('button',name='+1',exact=True)).to_have_count(0);page.get_by_role('button',name=re.compile('Visitantes: 0')).click();page.get_by_role('button',name='+1',exact=True).click(click_count=5);expect(page.get_by_role('button',name=re.compile('Visitantes: 5'))).to_be_visible();page.reload();expect(page.get_by_role('button',name='+1',exact=True)).to_be_visible();expect(page.get_by_role('button',name=re.compile('Visitantes: 5'))).to_be_visible()
     # Acknowledged-on-server response lost: retry after reload must not duplicate.
     page.evaluate("""()=>{const original=window.fetch.bind(window);let dropped=false;window.fetch=async(...args)=>{const r=await original(...args);if(!dropped&&r.url.includes('/visitors')){dropped=true;throw Error('Resposta perdida simulada após commit');}return r;};}""");page.get_by_role('button',name='+1',exact=True).click();expect(page.get_by_role('button',name='Tentar novamente',exact=True)).to_be_visible();page.reload();expect(page.get_by_role('button',name=re.compile('Visitantes: 6'))).to_be_visible()
     page.get_by_role('button',name=re.compile('Visitantes: 6')).click();page.reload();expect(page.get_by_role('button',name='+1',exact=True)).to_have_count(0);expect(page.get_by_role('button',name=re.compile('Visitantes: 6'))).to_be_visible()
     page.get_by_role('button',name='+ Novo cliente',exact=True).click();dialog=page.locator('dialog[open]');expect(dialog.get_by_role('combobox',name=re.compile('Tipo de cliente'))).to_have_value('retail');dialog.get_by_label('Nome do contato',exact=True).fill('Contato captado');dialog.get_by_role('button',name='Salvar e selecionar cliente',exact=True).click();expect(dialog).to_have_count(0);page.reload();expect(page.get_by_text('Novos contatos desta sessão: 1',exact=True)).to_be_visible()
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Horizontal overflow';page.screenshot(path='/tmp/artesao-dev12-'+str(width)+'.png',full_page=True)
     # Verify same open session loses API access after mandatory terms update.
     newdoc=admin.evaluate("""async()=>{const h={'Content-Type':'application/json','X-Pilot-Admin-Context':document.querySelector('meta[name=pilot-admin-context]').content,'X-Pilot-Admin-CSRF':decodeURIComponent(document.cookie.split('; ').find(v=>v.startsWith('__Secure-artesaos_admin_csrf=')).split('=').slice(1).join('='))};const b=new URL('api/resources',location.href);const r=await fetch(b,{method:'POST',headers:h,body:JSON.stringify({kind:'terms',version:'browser-'+crypto.randomUUID(),content:'Texto beta revisado sintético',requiresAcceptance:true})});const d=await r.json();await fetch(new URL('api/resources/'+d.id+'/publish',location.href),{method:'POST',headers:h,body:'{}'});return d;}""")
     assert page.evaluate("async()=> (await fetch(new URL('api/clients',document.baseURI))).status")==428
     page.reload();expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();ctx.close()
    browser.close();print('PASS browser desktop/mobile: support initial/explicit/cancel, legal gate and session renewal, admin Pix/manual, Help, visitors rapid/reload/preference, sale client/session capture, no horizontal overflow. Synthetic HTTPS/Google only.')
  finally:
   server.terminate();server.wait(timeout=15)
