"""Disposable loopback server only; verifies an old untitled draft remains editable."""
import json,urllib.request
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:8196/'
with urllib.request.urlopen(base+'api/quotes') as r:assert json.load(r)==[]
req=urllib.request.Request(base+'api/quotes',data=json.dumps({'data':{'client':None,'items':[],'notes':'Rascunho antigo sem título'},'expectedRevision':0}).encode(),headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r:assert r.status==200
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base)
 page.locator('.quote-record[data-record-id="1"]').get_by_role('button',name='Editar',exact=True).click()
 expect(page.get_by_label('Título do orçamento',exact=True)).to_have_value('')
 page.get_by_label('Título do orçamento',exact=True).fill('Reposição de teste — outubro')
 page.get_by_role('button',name='Salvar rascunho',exact=True).first.click()
 page.get_by_role('status').filter(has_text='Rascunho salvo.').wait_for()
 page.reload()
 page.get_by_label('Buscar orçamentos',exact=True).fill('Reposição de teste')
 expect(page.locator('.quote-record[data-record-id="1"]').get_by_role('button',name='Editar',exact=True)).to_be_visible()
 page.locator('.quote-record[data-record-id="1"]').get_by_role('button',name='Editar',exact=True).click()
 expect(page.get_by_label('Título do orçamento',exact=True)).to_have_value('Reposição de teste — outubro')
 expect(page.get_by_label('Observações do pedido',exact=True)).to_have_value('Rascunho antigo sem título')
 page.get_by_label('Título do orçamento',exact=True).fill('Título revisado')
 page.get_by_role('button',name='Salvar rascunho',exact=True).first.click()
 page.get_by_role('status').filter(has_text='Rascunho salvo.').wait_for()
 page.reload()
 page.get_by_role('heading',name='Título revisado — Cliente a definir',exact=True).wait_for()
 assert not errors,errors
 browser.close()
print('Título editável, pesquisa, reabertura e compatibilidade com rascunho antigo: OK.')
