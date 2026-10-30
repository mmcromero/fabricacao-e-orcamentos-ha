"""WCAG A/AA automated checks on a disposable loopback server; not a full conformance audit."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--axe',required=True);parser.add_argument('--report',default='/tmp/fabricacao-accessibility-report.json');args=parser.parse_args();base='http://127.0.0.1:8198/';results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page()
 def check(label):
  page.wait_for_load_state('networkidle')
  page.add_script_tag(path=args.axe)
  result=page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),passes:r.passes.length};}")
  results.append(dict(label=label,**result))
 for width in [1280,390]:
  page.set_viewport_size(dict(width=width,height=900))
  for view in ['orcamentos','clientes','produtos','fabricacao','configuracoes&area=produtos','configuracoes&area=clientes','configuracoes&area=fabricacao']:
   page.goto(base+'?view='+view);page.get_by_role('heading',level=1).wait_for();check(f'{view}-{width}')
  for view,button in [('clientes','Novo cliente'),('produtos','Novo produto'),('orcamentos','Novo orçamento')]:
   page.goto(base+'?view='+view);page.get_by_role('button',name=button,exact=True).click();expect(page.locator('dialog[open]')).to_have_count(1);check(f'modal-{view}-{width}');page.keyboard.press('Escape')
  page.goto(base+'?view=orcamentos');page.get_by_role('button',name='Novo orçamento',exact=True).click();page.get_by_role('button',name='+ Novo cliente',exact=True).click();check(f'modal-cliente-aninhado-{width}');page.keyboard.press('Escape');page.keyboard.press('Escape')
  page.goto(base+'?view=orcamentos');page.wait_for_load_state('networkidle')
  if page.locator('.quote-record').count():
   page.locator('.quote-record').first.get_by_role('button',name='Editar',exact=True).click();check(f'modal-orcamento-com-item-{width}');toggle=page.get_by_role('button',name='Selecionar produtos do catálogo',exact=False)
   if toggle.is_enabled():toggle.click();check(f'catalogo-popup-{width}');toggle.click()
   page.locator('.quote-modal-header .modal-close').click()
  page.goto(base+'?view=fabricacao');check(f'form-fabricacao-{width}')
  page.goto(base+'?view=configuracoes&area=produtos')
  product=dict(name='Peça fictícia de acessibilidade',sku='A11Y-1',origin='own',publicAllowed=False,prices=dict(wholesale=1000,factory=None,retail=None),lengthCm=None,widthCm=None,heightCm=None,weightGrams=None,colors=[],sourceKeys=['excel:a11y'],family='',description='',category='Linha fictícia')
  payload=dict(type='manufacturing-import-v1',records=[dict(key='a11y',product=product)],settings={})
  page.get_by_label('Arquivo para importar',exact=True).set_input_files(dict(name='ficticio.json',mimeType='application/json',buffer=json.dumps(payload).encode()));expect(page.get_by_label('Conciliação da planilha',exact=True).locator('.reconciliation-record')).to_have_count(1);check(f'conciliacao-{width}');page.get_by_role('button',name='Cancelar conciliação',exact=True).click()
 browser.close()
Path(args.report).write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
violations=[dict(label=row['label'],id=v['id'],help=v['help']) for row in results for v in row['violations']]
print(json.dumps(dict(scenarios=len(results),violations=violations,manualReview=sum(len(row['incomplete']) for row in results)),ensure_ascii=False))
assert not violations,'Corrigir violações antes da entrega. Ver relatório local.'
