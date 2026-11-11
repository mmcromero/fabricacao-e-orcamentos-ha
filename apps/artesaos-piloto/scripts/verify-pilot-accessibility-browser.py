#!/usr/bin/env python3
"""Verificacao Axe de telas internas em piloto descartavel; nao repete entrada B1."""
import argparse
import base64
import hashlib
import json
import os
import ssl
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--axe',required=True)
parser.add_argument('--report',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('BROWSER_CI_OUTPUT','/tmp')).resolve()
out.mkdir(parents=True,exist_ok=True)
report=Path(args.report).resolve()
report.parent.mkdir(parents=True,exist_ok=True)
source=Path(args.axe).read_text(encoding='utf-8')
results=[]
page=None
server=None

def audit(label):
    page.wait_for_load_state('networkidle')
    page.evaluate(source)
    item=page.evaluate("""async()=>{
      const r=await axe.run(document.querySelector('main'),{
        runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
      });
      return {
        violations:r.violations.map(v=>({
          id:v.id,impact:v.impact,help:v.help,
          nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))
        })),
        incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),
        passes:r.passes.length
      };
    }""")
    item['scenario']=label
    item['horizontalOverflow']=not page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    results.append(item)
    if item['violations'] or item['horizontalOverflow']:
        page.screenshot(path=str(out/f'falha-{label}.png'),full_page=True)

try:
    with tempfile.TemporaryDirectory(prefix='artesao-b3-a11y-') as temp:
        key=str(Path(temp)/'key.pem');cert=str(Path(temp)/'cert.pem')
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes',
          '-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost',
          '-addext','subjectAltName=IP:127.0.0.1'],check=True,
          stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        pub=subprocess.check_output(['openssl','x509','-in',cert,'-pubkey','-noout'])
        spki=base64.b64encode(hashlib.sha256(subprocess.check_output(
          ['openssl','pkey','-pubin','-outform','DER'],input=pub)).digest()).decode()
        base='https://127.0.0.1:8298/artesaos-piloto/'
        with (out/'acessibilidade-fixture.log').open('w') as log:
            server=subprocess.Popen(['node','--import','tsx',
              'scripts/pilot-browser-server.mjs'],cwd=root,
              env={**os.environ,'PILOT_BROWSER_TEST':'1',
                   'PILOT_TEST_KEY':key,'PILOT_TEST_CERT':cert},
              stdout=log,stderr=log)
            for _ in range(60):
                try:
                    urllib.request.urlopen(base+'login',
                      context=ssl._create_unverified_context(),timeout=1)
                    break
                except Exception:
                    time.sleep(.2)
            else:
                raise RuntimeError('Fixture piloto indisponivel')

            with sync_playwright() as pw:
                browser=pw.chromium.launch(
                  **({} if os.environ.get('BROWSER_CI_CHROMIUM')=='1'
                     else {'executable_path':'/usr/bin/chromium'}),
                  args=['--no-sandbox','--ignore-certificate-errors-spki-list='+spki])
                try:
                    ctx=browser.new_context(ignore_https_errors=True,
                      viewport={'width':1280,'height':900})
                    def google(route):
                        state=parse_qs(urlparse(route.request.url).query)['state'][0]
                        route.fulfill(status=302,headers={'location':
                          base+'auth/google/callback?state='+state+'&code=a'})
                    ctx.route('https://accounts.google.com/**',google)
                    page=ctx.new_page()
                    page.goto(base+'login')
                    page.get_by_role('link',name='Já sou cadastrado',exact=True).click()
                    page.get_by_role('button',name='Tenho um convite',exact=True).click()
                    page.locator('#invite').fill('synthetic-invite-a-01234567890123456789')
                    page.get_by_role('button',name='Continuar com Google',exact=True).click()
                    expect(page.get_by_role('heading',name='Termos de Uso',exact=True)).to_be_visible()
                    page.get_by_role('checkbox').check()
                    page.get_by_role('button',name='Confirmar e continuar').click()
                    expect(page.get_by_role('heading',name='Que bom ter você aqui!',exact=True)).to_be_visible()
                    page.get_by_role('textbox',name='Seu nome',exact=True).fill('Artesa sintetica')
                    page.get_by_role('textbox',name='Telefone',exact=True).fill('11999990000')
                    page.get_by_role('button',name='Cadastrar meus produtos').click()
                    expect(page.get_by_role('heading',name='Produtos',exact=True)).to_be_visible()
                    for width in (1280,390):
                        page.set_viewport_size({'width':width,'height':900})
                        # No piloto, custos de Fabricação estão dentro de Configurações.
                        for view,title in (('produtos','Produtos'),
                                           ('vendas','Vendas'),
                                           ('configuracoes','Configurações')):
                            page.goto(base+'?view='+view)
                            expect(page.get_by_role('heading',name=title,
                              exact=True,level=1)).to_be_visible()
                            audit(f'{view}-{width}')
                        page.goto(base+'?view=produtos')
                        page.get_by_role('button',name='Novo produto',exact=True).click()
                        expect(page.locator('dialog[open]')).to_have_count(1)
                        audit(f'modal-produto-{width}')
                        page.keyboard.press('Escape')
                    ctx.close()
                finally:
                    browser.close()
except Exception:
    if page is not None:
        try:
            page.screenshot(path=str(out/'falha-execucao.png'),
              full_page=True,timeout=4000)
        except Exception:
            pass
    raise
finally:
    report.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',
                      encoding='utf-8')
    if server is not None:
        server.terminate()
        try:server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill();server.wait()
violations=[{'scenario':r['scenario'],'id':v['id'],'impact':v['impact']}
            for r in results for v in r['violations']]
overflow=[r['scenario'] for r in results if r['horizontalOverflow']]
print(json.dumps({'scenarios':len(results),'violations':violations,
                  'overflow':overflow,
                  'manualReview':sum(len(r['incomplete']) for r in results)},
                 ensure_ascii=False))
assert not violations,'Violacoes Axe encontradas; conferir relatorio'
assert not overflow,'Rolagem horizontal detectada'
