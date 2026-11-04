"""Local TLS/Chromium, synthetic accounts and held requests only. No production access."""
import base64,hashlib,json,os,ssl,subprocess,tempfile,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='artesao-feedback-legal-browser-') as d:
 key=str(Path(d)/'key.pem');cert=str(Path(d)/'cert.pem');bundle=Path(d)/'fixture.js'
 subprocess.run([str(root/'node_modules/.bin/esbuild'),'scripts/feedback-browser-fixture.tsx','--bundle','--format=iife','--jsx=automatic','--outfile='+str(bundle)],cwd=root,check=True,capture_output=True)
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout']);spki=base64.b64encode(hashlib.sha256(subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
 with open('/tmp/artesao-feedback-legal-browser-server.log','w') as log:
  server=subprocess.Popen(['node','--import','tsx','scripts/pilot-browser-server.mjs'],cwd=root,env={**os.environ,'PILOT_BROWSER_TEST':'1','PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert,'PILOT_TEST_DISTRIBUTION':'debian'},stdout=log,stderr=log)
  origin='https://127.0.0.1:8298';base=origin+'/artesaos-piloto/'
  try:
   for i in range(60):
    try:urllib.request.urlopen(base+'login',context=ssl._create_unverified_context(),timeout=1);break
    except Exception:time.sleep(.2)
   else:raise RuntimeError('Fixture unavailable')
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki]);checks=[]
    for index,width in enumerate([1280,390]):
     context=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':950});page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
     context.route(base+'fixture.js',lambda route:route.fulfill(content_type='application/javascript',body=bundle.read_bytes()))
     context.route(base+'feedback-fixture',lambda route:route.fulfill(content_type='text/html',body='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+base+'pilot.css"><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}</style><script defer src="'+base+'loading.js"></script><script defer src="'+base+'fixture.js"></script></head><body><div id="root"></div></body></html>'))
     held={};calls={}
     def hold(route):
      name=route.request.url.rsplit('/',1)[-1];calls[name]=calls.get(name,0)+1;held[name]=route
     context.route('**/api/test-feedback/*',hold)
     def release(name,status=200):
      expect(page.get_by_role('button',name={'first':'Primeira ação','second':'Segunda ação','form':'Enviar formulário'}[name],exact=True)).to_have_attribute('aria-busy','true')
      for i in range(80):
       if name in held:break
       page.wait_for_timeout(20)
      held.pop(name).fulfill(status=status,content_type='application/json',body='{"ok":true}')
     page.goto(base+'feedback-fixture');first=page.get_by_role('button',name='Primeira ação',exact=True);second=page.get_by_role('button',name='Segunda ação',exact=True)
     first.click();expect(first).to_be_disabled();first.dispatch_event('click');expect(second).to_be_enabled();second.click()
     expect(first).to_have_attribute('aria-busy','true');expect(second).to_have_attribute('aria-busy','true');assert 'Primeira ação concluída.' not in page.locator('main').inner_text()
     release('first');expect(first).to_be_enabled();expect(page.get_by_text('Primeira ação concluída.',exact=True)).to_be_visible();expect(second).to_be_disabled();release('second',500)
     expect(second).to_be_enabled();expect(page.get_by_role('alert')).to_have_count(1);assert 'synthetic-sensitive-error' not in page.locator('main').inner_text();assert calls['first']==1
     second.click();release('second');expect(second).to_be_enabled();expect(page.get_by_text('Segunda ação concluída.',exact=True)).to_be_visible();expect(page.get_by_role('alert')).to_have_count(0)
     page.get_by_label('Informação').fill('Rascunho preservado');submit=page.get_by_role('button',name='Enviar formulário',exact=True);submit.click();submit.dispatch_event('click');release('form',500)
     expect(submit).to_be_enabled();expect(page.get_by_label('Informação')).to_have_value('Rascunho preservado');expect(page.get_by_role('alert')).to_have_count(1);assert calls['form']==1
     submit.click();release('form');expect(submit).to_be_enabled();expect(page.get_by_text('Formulário confirmado.',exact=True)).to_be_visible();expect(page.get_by_role('alert')).to_have_count(0)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');checks.append('React actions/form success,error,duplicate,concurrency,restoration,mobile '+str(width))
     # Native admin buttons reuse the loading action helper, without React.
     page.goto(base+'admin/login');page.evaluate("""()=>{const b=document.createElement('button');b.type='button';b.textContent='Ação nativa';b.onclick=async()=>{b.disabled=true;try{const r=await fetch('/artesaos-piloto/api/test-feedback/native',{method:'POST'});if(!r.ok)throw Error('synthetic-sensitive-error');}finally{b.disabled=false;}};document.querySelector('main').append(b);}""")
     native=page.get_by_role('button',name='Ação nativa',exact=True);native.click();expect(native).to_have_attribute('aria-busy','true');native.dispatch_event('click')
     for i in range(80):
      if 'native' in held:break
      page.wait_for_timeout(20)
     held.pop('native').fulfill(status=500,body='error');expect(native).to_be_enabled();expect(native).not_to_have_attribute('aria-busy','true');assert calls['native']==1;assert 'synthetic-sensitive-error' not in page.locator('main').inner_text()
     checks.append('native action error/repeat/restoration '+str(width))
     context.route(origin+'/',lambda route:route.fulfill(content_type='text/html',body='<meta charset="utf-8"><h1>Landing sintética</h1><a href="/artesaos-piloto/login">Login</a><a href="/artesaos-piloto/legal">Jurídico</a>'))
     def back():page.get_by_role('button',name='Voltar',exact=True).click()
     fresh=context.new_page();fresh.goto(base+'legal');fresh.get_by_role('button',name='Voltar',exact=True).click();expect(fresh.get_by_role('heading',name='Landing sintética')).to_be_visible();fresh.get_by_role('link',name='Jurídico',exact=True).click();fresh.get_by_role('button',name='Voltar',exact=True).click();expect(fresh.get_by_role('heading',name='Landing sintética')).to_be_visible();fresh.close()
     page.goto(base+'login');page.get_by_role('link',name='Política de Privacidade',exact=True).click();back();expect(page).to_have_url(base+'login')
     page.goto(origin+'/');page.get_by_role('link',name='Jurídico',exact=True).click();back();expect(page).to_have_url(base+'login')
     context.route('https://accounts.google.com/**',lambda route:route.fulfill(status=302,headers={'location':base+'auth/google/callback?state='+parse_qs(urlparse(route.request.url).query)['state'][0]+'&code=a'}))
     page.locator('#invite').fill('synthetic-invite-a-01234567890123456789');page.get_by_role('button',name='Entrar com Google',exact=True).click()
     if not index:
      expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible();page.get_by_role('checkbox').check();page.get_by_role('button',name='Confirmar e continuar',exact=True).click()
     expect(page.get_by_role('heading',name='Boas-vindas ao Artesão Digital',exact=True)).to_be_visible()
     # Actual application form: HTTP error preserves input; retry reaches the synthetic database once.
     company=[];company_calls=[]
     def company_request(route):
      if route.request.method=='PUT':company.append(route);company_calls.append(route.request)
      else:route.continue_()
     context.route('**/api/company',company_request)
     page.locator('[name=companyName]').fill('Ateliê sintético feedback');page.locator('[name=companyResponsible]').fill('Pessoa teste');page.locator('[name=companyPhone]').fill('11999999999');page.locator('[name=companyEmail]').fill('a@example.test')
     save=page.get_by_role('button',name='Salvar dados da empresa',exact=True);save.click();expect(save).to_have_attribute('aria-busy','true');save.dispatch_event('click')
     for i in range(80):
      if company:break
      page.wait_for_timeout(20)
     assert len(company_calls)==1;company.pop(0).fulfill(status=503,content_type='application/json',body='{"message":"Falha controlada de teste."}')
     expect(save).to_be_enabled();expect(page.get_by_text('Falha controlada de teste.',exact=True)).to_be_visible();expect(page.locator('[name=companyName]')).to_have_value('Ateliê sintético feedback');expect(page.get_by_text('Dados da empresa salvos.',exact=True)).to_have_count(0)
     save.click();expect(save).to_have_attribute('aria-busy','true')
     for i in range(80):
      if company:break
      page.wait_for_timeout(20)
     company.pop(0).continue_();expect(page.get_by_text('Dados da empresa salvos.',exact=True)).to_be_visible();expect(save).to_be_enabled();assert len(company_calls)==2;context.unroute('**/api/company',company_request);checks.append('actual company form HTTP failure/preservation/retry/confirmed success '+str(width))
     target=base+'?view=configuracoes&focus=empresa#contatos';page.goto(target);page.locator('#pilot-build-info a[href*="legal"]').click();back();expect(page).to_have_url(target)
     unknown=context.new_page();unknown.goto(base+'legal');unknown.get_by_role('button',name='Voltar',exact=True).click();expect(unknown).to_have_url(base);unknown.close()
     page.goto(base+'legal?returnTo='+__import__('urllib.parse',fromlist=['quote']).quote('/artesaos-piloto/?view=financeiro&id=old',safe=''));context.clear_cookies();back();expect(page).to_have_url(base+'login')
     page.goto(base+'legal?returnTo=https%3A%2F%2Fevil.test');back();expect(page).to_have_url(origin+'/')
     assert not errors,errors;checks.append('six legal returns, login/landing continuity, expiry,external rejection '+str(width));context.close()
    browser.close();print(json.dumps({'status':'passed','checks':checks,'limitations':['local TLS/Chromium and synthetic landing/accounts only','no physical Android/Windows/Forja/HA or real landing change']},ensure_ascii=False))
  finally:
   server.terminate();server.wait(timeout=15)
