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
    def login(context,subject,admin=False,invite=None):
     context.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code='+subject}))
     page=context.new_page();page.goto(base+('admin/login' if admin else 'login'))
     if not admin:page.locator('#invite').fill(invite or 'synthetic-invite-'+subject+'-01234567890123456789')
     page.get_by_role('button',name='Entrar na administração com Google' if admin else 'Entrar com Google',exact=True).click()
     if admin:expect(page.get_by_role('heading',name='Interessados no piloto',exact=True)).to_be_visible()
     else:
      expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar').click();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     return page
    for subject,width,phone in [('a',1280,'11 99999-0001'),('b',390,'21 99999-0002')]:
     ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900},permissions=['clipboard-read','clipboard-write']);admin=login(ctx,'admin',True);admin.goto(base+'admin/resources');expect(admin.locator('#pix-key')).to_have_value('' if subject=='a' else '+5521999992222')
     admin.locator('#pix-enabled').check();admin.locator('#pix-key').fill('(11) 99999-1234');admin.locator('#pix-beneficiary').fill('Tudoe3d');admin.locator('#pix-message').fill('Apoio voluntário')
     admin.evaluate("""()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>{if(String(input).endsWith('/contribution')&&init?.method==='PUT')await new Promise(resolve=>window.releasePix=resolve);return original(input,init);};}""")
     admin.get_by_role('button',name='Salvar contribuição',exact=True).click();expect(admin.locator('#pix-form')).to_have_attribute('aria-busy','true');expect(admin.locator('#pix-status')).to_have_text('Salvando contribuição…');expect(admin.locator('#pix-save')).to_be_disabled();expect(admin.locator('#pix-status')).to_be_in_viewport();admin.evaluate('window.releasePix()');expect(admin.locator('#pix-status')).to_have_text('Configuração Pix salva.');expect(admin.locator('#pix-key')).to_have_value('+5511999991234')
     admin.goto(base+'admin/users');admin.goto(base+'admin/resources');expect(admin.locator('#pix-key')).to_have_value('+5511999991234');expect(admin.locator('#pix-enabled')).to_be_checked();admin.reload();expect(admin.locator('#pix-message')).to_have_value('Apoio voluntário')
     admin.locator('#pix-message').fill('Manter este preenchimento');admin.evaluate("""()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>String(input).endsWith('/contribution')&&init?.method==='PUT'?new Response(JSON.stringify({message:'Falha temporária simulada.'}),{status:503,headers:{'content-type':'application/json'}}):original(input,init);}""")
     admin.get_by_role('button',name='Salvar contribuição',exact=True).click();expect(admin.locator('#pix-status')).to_have_text('Falha temporária simulada.');expect(admin.locator('#pix-status')).to_be_in_viewport();expect(admin.locator('#pix-message')).to_have_value('Manter este preenchimento');expect(admin.locator('#pix-save')).to_be_enabled();admin.reload();expect(admin.locator('#pix-message')).to_have_value('Apoio voluntário')
     # Initial read delayed: save must work and late load cannot replace successful input.
     race=ctx.new_page();race.add_init_script("""const original=window.fetch.bind(window);window.fetch=async(input,init)=>{const r=await original(input,init);if(String(input).endsWith('/api/resources')&&(!init?.method||init.method==='GET'))await new Promise(resolve=>window.releaseInitial=resolve);return r;};""");race.goto(base+'admin/resources');race.wait_for_function('typeof window.releaseInitial==="function"');race.locator('#pix-enabled').check();race.locator('#pix-key').fill('+55 (21) 99999-2222');race.locator('#pix-beneficiary').fill('Tudoe3d');race.locator('#pix-message').fill('Configuração persistente');race.get_by_role('button',name='Salvar contribuição',exact=True).click();expect(race.locator('#pix-status')).to_have_text('Configuração Pix salva.');race.evaluate('window.releaseInitial()');expect(race.locator('#pix-key')).to_have_value('+5521999992222');race.close()
     anonymous=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900});page=anonymous.new_page();page.goto(base+'login');page.locator('#interest-name').fill('Lead da feira '+subject);page.locator('#interest-email').fill('lead-'+subject+'@example.test');page.locator('#interest-whatsapp').fill(phone);page.locator('#interest-form input[name=consent]').check();expect(page.locator('#interest-submit')).to_be_enabled();page.locator('#interest-submit').click();expect(page.locator('#interest-status')).to_contain_text('Interesse registrado')
     admin.goto(base+'admin/');row=admin.locator('#interest-rows tr').filter(has_text='lead-'+subject+'@example.test');expect(row).to_have_count(1);row.get_by_role('button',name='Enviar convite',exact=True).click();expect(admin.locator('#invitation-detail')).to_be_visible();expect(admin.locator('#invitation-detail-status')).to_contain_text('Mensagem pronta');code=admin.locator('#invitation-detail code').inner_text();expect(admin.get_by_role('button',name='Enviar por e-mail',exact=True)).to_have_count(0)
     admin.get_by_role('button',name='Copiar código',exact=True).click();expect(admin.locator('#invitation-detail-status')).to_have_text('Código copiado.');assert admin.evaluate('navigator.clipboard.readText()')==code
     admin.get_by_role('button',name='Copiar link',exact=True).click();expect(admin.locator('#invitation-detail-status')).to_contain_text('Link de acesso copiado');assert admin.evaluate('navigator.clipboard.readText()')==base+'login'
     admin.get_by_role('button',name='Copiar mensagem',exact=True).click();expect(admin.locator('#invitation-detail-status')).to_have_text('Mensagem copiada.');assert code in admin.evaluate('navigator.clipboard.readText()');assert code in admin.get_by_role('link',name='Abrir no WhatsApp',exact=True).get_attribute('href')
     footer=admin.locator('#pilot-build-info');expect(footer).not_to_contain_text('Fabricação e Orçamentos');version=footer.locator('.pilot-current-version');expect(version).to_have_text('Artesão Digital v0.2.0-dev.13');v=version.bounding_box();links=footer.locator('a:visible');assert all(v['y']>=x.bounding_box()['y']+x.bounding_box()['height'] for x in links.all());assert abs(v['x']+v['width']/2-width/2)<2;assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth');admin.screenshot(path='/tmp/artesao-dev13-invites-'+str(width)+'.png',full_page=True)
     admin.goto(base+'admin/');row=admin.locator('#interest-rows tr').filter(has_text='lead-'+subject+'@example.test');expect(row.get_by_role('button',name='Enviar convite',exact=True)).to_have_count(0);row.get_by_role('button',name='Exibir convite',exact=True).click();expect(admin.locator('#invitation-detail code')).to_have_text(code)
     user=login(anonymous,subject,False,code);user.goto(base+'?view=ajuda');user.get_by_text('Apoie voluntariamente o Artesão Digital',exact=True).click();expect(user.get_by_text('Beneficiário: Tudoe3d',exact=True)).to_be_visible();expect(user.get_by_text('+5521999992222',exact=True)).to_be_visible();user.goto(base+'?view=suporte');user.get_by_text('Apoie voluntariamente o Artesão Digital',exact=True).click();expect(user.get_by_text('+5521999992222',exact=True)).to_be_visible()
     admin.goto(base+'admin/');row=admin.locator('#interest-rows tr').filter(has_text='lead-'+subject+'@example.test');expect(row).to_contain_text('Conta cadastrada');expect(row.get_by_role('button',name='Enviar convite',exact=True)).to_have_count(0);expect(row.get_by_role('link',name='Ver usuários cadastrados')).to_be_visible();ctx.close();anonymous.close()
    browser.close();print('PASS stabilization desktop/mobile: Pix BR save/loading/reload/failed input/initial-read race, Help/Support, footer order/centering, interest conversion/reuse/copy/WhatsApp link, real invitation signup with synthetic Google and accepted state. No real HA/SMTP/Google access.')
  finally:
   server.terminate();server.wait(timeout=15)
