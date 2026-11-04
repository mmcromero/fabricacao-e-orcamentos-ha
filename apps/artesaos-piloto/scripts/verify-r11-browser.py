"""Disposable HTTPS/synthetic identities only. No real Home Assistant or Google access."""
import base64,hashlib,os,re,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-r11-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-r11-browser-server.log','w') as log:
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
    def api(page,path,method='GET',body=None):
     return page.evaluate("""async({path,method,body})=>{const r=await fetch(new URL('api/'+path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();}""",{'path':path,'method':method,'body':body})
    for width in [1280,390]:
     ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':900})
     public=ctx.new_page();public.goto(base+'login')
     for i in range(3):
      public.locator('#interest-name').fill('Pessoa sintética '+str(i));public.locator('#interest-email').fill(f'r11-{width}-{i}@example.test');public.locator('[name=consent]').check();public.locator('#interest-submit').click();expect(public.locator('#interest-status')).to_contain_text('Interesse registrado');expect(public.locator('#interest-email')).to_have_value('');expect(public.locator('#interest-submit')).to_be_enabled();expect(public.locator('#interest-submit')).to_be_visible()
     public.close();ctx.close()
    ctx=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':900});page=login(ctx,'a')
    expect(page.locator('[role=alert]:visible')).to_have_count(0)
    # Existing feedback for all three welcome blocks; only synthetic writes.
    company=page.locator('.company-settings');company.locator('[name=companyName]').fill('Empresa sintética');company.locator('[name=companyResponsible]').fill('Pessoa teste');company.locator('[name=companyPhone]').fill('11999999999');company.locator('[name=companyEmail]').fill('a@example.test');company.get_by_role('button',name='Salvar dados da empresa').click();expect(company.locator('p[role=status]')).to_have_text('Dados da empresa salvos.')
    materials=page.locator('#materiais');materials.get_by_label('Nome do material',exact=False).fill('Material sintético');materials.get_by_label('Quantidade da compra',exact=False).fill('1');materials.get_by_label('Unidade da compra',exact=False).select_option('kg');materials.get_by_label('Preço pago pela compra',exact=False).fill('20');materials.get_by_role('button',name='Salvar material').click();expect(materials.locator('p[role=status]')).to_contain_text('Material salvo.')
    settings=api(page,'settings/fabricacao');api(page,'settings/fabricacao','PUT',{'data':{**settings['data'],'humanHour':'20','productiveHours':'160','otherCost':'100'},'expectedRevision':settings['revision']})
    page.reload();expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible();page.get_by_role('button',name='Salvar configurações gerais',exact=True).click();expect(page.get_by_text('Configurações salvas.',exact=True)).to_be_visible()
    page.evaluate("""()=>{const orig=window.fetch;window.fetch=async(input,init)=>{if(init?.method==='PUT'&&String(input).includes('settings/fabricacao'))return new Response(JSON.stringify({message:'Falha controlada R1.1'}),{status:503});return orig(input,init);};}""");page.get_by_role('button',name='Salvar configurações gerais',exact=True).click();expect(page.get_by_role('alert')).to_have_text('Falha controlada R1.1')
    page.reload();api(page,'onboarding/complete','POST',{})
    page.goto(base+'?view=suporte&novo=1');expect(page.get_by_role('heading',name='Suporte técnico',exact=True)).to_be_visible();expect(page.locator('dialog[open]')).to_have_count(0)
    page.get_by_role('button',name='Abrir chamado',exact=True).click();dialog=page.locator('dialog[open]');expect(dialog.get_by_role('alert')).to_have_count(0);dialog.get_by_role('button',name='Cancelar',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
    def fill_ticket(subject):
     page.get_by_role('button',name='Abrir chamado',exact=True).click();dialog=page.locator('dialog[open]');dialog.get_by_role('button',name='Enviar chamado',exact=True).click();expect(dialog.locator('[data-validation-message]').first).to_be_visible();dialog.get_by_label('Motivo do contato').select_option(index=1);dialog.get_by_label('Assunto',exact=False).fill(subject);dialog.get_by_label('Descrição da dúvida ou erro',exact=False).fill('Mensagem de teste sintético R1.1');return dialog
    dialog=fill_ticket('Primeiro R1.1')
    page.once('dialog',lambda d:d.dismiss());dialog.get_by_role('button',name='Cancelar',exact=True).click();expect(dialog).to_be_visible();expect(dialog.get_by_label('Assunto',exact=False)).to_have_value('Primeiro R1.1')
    dialog.get_by_role('button',name='Enviar chamado',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
    dialog=fill_ticket('Segundo R1.1')
    # Lose the response after the real synthetic commit. Retry must reuse the key.
    page.evaluate("""()=>{const orig=window.fetch;let lost=false;window.fetch=async(input,init)=>{const r=await orig(input,init);if(!lost&&init?.method==='POST'&&String(input).endsWith('/api/support')){lost=true;throw Error('Resposta perdida');}return r;};}""")
    dialog.get_by_role('button',name='Enviar chamado',exact=True).click();expect(dialog.get_by_role('alert')).to_contain_text('Não foi possível confirmar');expect(dialog.get_by_label('Assunto',exact=False)).to_have_value('Segundo R1.1');dialog.get_by_role('button',name='Enviar chamado',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
    assert api(page,'support')['total']==2
    page.get_by_role('button',name='Abrir chamado',exact=True).click();dialog=page.locator('dialog[open]');expect(dialog.get_by_label('Assunto',exact=False)).to_have_value('');dialog.get_by_label('Assunto',exact=False).fill('Descartar teste');page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Cancelar',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
    # Direct detail must survive list filters and pagination.
    old=api(page,'finance/titles','POST',{'requestKey':'r11-old-finance','direction':'out','amountCents':1000,'dueOn':'2020-01-01','clientId':None,'description':'Título antigo R1.1'})
    for i in range(22):api(page,'finance/titles','POST',{'requestKey':'r11-finance-'+str(i),'direction':'out','amountCents':100,'dueOn':'','clientId':None,'description':'Outro título '+str(i)})
    page.goto(base+'?view=financeiro&tab=entries');expect(page.get_by_role('heading',name='Título antigo R1.1',exact=True)).to_have_count(0);page.get_by_role('button',name='Próxima',exact=True).click()
    page.get_by_role('button',name='Pendências: 1 abertas').click();modal=page.locator('dialog[open]');modal.get_by_role('link',name='Abrir fluxo de correção').click();expect(page.get_by_role('heading',name='Título antigo R1.1',exact=True).last).to_be_visible();assert api(page,'attention/count')['open']==1
    page.goto(base+'?view=financeiro&origin=manual&title='+old['id']);page.get_by_text('Filtros',exact=True).click();page.locator('input[type=date]').first.fill('2099-01-01');expect(page.get_by_role('heading',name='Título antigo R1.1',exact=True)).to_be_visible();assert api(page,'finance/titles/'+old['id'])['title']['id']==old['id']
    other=browser.new_context(ignore_https_errors=True);b=login(other,'b');expect(b.locator('[role=alert]:visible')).to_have_count(0)
    # A real failed legal acceptance must remain visible.
    # b is already past legal gate; API isolation still refuses before onboarding.
    response=b.evaluate("""async id=>{const r=await fetch(new URL('api/finance/titles/'+id,document.baseURI));return r.status;}""",old['id']);assert response in [404,428]
    api(b,'company','PUT',{'data':{'name':'Outra empresa','responsible':'Teste','phone':'11999999999','email':'b@example.test'},'expectedRevision':0});api(b,'materials','POST',{'name':'Material B','mode':'quantity','purchaseQuantity':1,'purchasePrice':1,'purchaseUnit':'kg','customUnit':''});s=api(b,'settings/fabricacao');api(b,'settings/fabricacao','PUT',{'data':{**s['data'],'humanHour':'20','productiveHours':'160','otherCost':'100'},'expectedRevision':s['revision']});api(b,'onboarding/complete','POST',{})
    assert b.evaluate("""async id=>(await fetch(new URL('api/finance/titles/'+id,document.baseURI))).status""",old['id'])==404
    other.close();ctx.close();browser.close();print('PASS R1.1 browser: consecutive public interests desktop/mobile, welcome feedback, empty/real alerts, support cancel/validation/two submissions/lost-response retry, finance direct link/filters/pagination/old record/tenant isolation; synthetic data only.')
  finally:
   server.terminate();server.wait(timeout=15)
