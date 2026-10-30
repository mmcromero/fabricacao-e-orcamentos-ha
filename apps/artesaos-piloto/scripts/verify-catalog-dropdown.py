"""Disposable loopback server only; seeds 100 fictional products."""
import json,urllib.request
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:8196/'
with urllib.request.urlopen(base+'api/products') as r:assert json.load(r)==[], 'Use um banco descartável vazio.'
with urllib.request.urlopen(base+'api/quotes') as r:assert json.load(r)==[], 'Use um banco descartável vazio.'
for i in range(100):
 data={'name':f'Produto fictício {i:03d}','origin':'own','publicAllowed':False,'prices':{'wholesale':1000 if i==0 else None,'factory':None,'retail':2000},'lengthCm':None,'widthCm':None,'heightCm':None,'weightGrams':None,'colors':[],'sourceKeys':[],'family':'','description':''}
 req=urllib.request.Request(base+'api/products',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:assert r.status==200
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base)
 page.get_by_role('button',name='Novo orçamento',exact=True).click()
 trigger=page.get_by_role('button',name='Selecionar produtos do catálogo',exact=True)
 trigger.scroll_into_view_if_needed()
 height=page.evaluate('document.documentElement.scrollHeight')
 trigger.click()
 panel=page.get_by_role('dialog',name='Produtos do catálogo',exact=True)
 expect(panel).to_be_visible()
 region=panel.get_by_role('group',name='Lista de produtos do catálogo',exact=True)
 assert region.evaluate('(e)=>e.scrollHeight>e.clientHeight')
 assert panel.bounding_box()['height']<=440
 assert page.evaluate('document.documentElement.scrollHeight')==height
 expect(panel.get_by_label('Filtrar produtos',exact=True)).to_be_focused()
 panel.get_by_label('Filtrar produtos',exact=True).fill('000')
 panel.get_by_label('Produto fictício 000',exact=True).check()
 panel.get_by_role('button',name='Adicionar selecionados (1)',exact=True).click()
 expect(panel.get_by_role('alert')).to_contain_text('escolha de preço')
 panel.get_by_label('Preço para Produto fictício 000',exact=True).select_option('wholesale')
 panel.get_by_label('Filtrar produtos',exact=True).fill('099')
 panel.get_by_label('Produto fictício 099',exact=True).check()
 page.keyboard.press('Escape')
 expect(panel).not_to_be_visible()
 expect(trigger).to_be_focused()
 assert page.get_by_role('heading',name='Produto fictício 000',exact=True).count()==0
 trigger.click()
 panel=page.get_by_role('dialog',name='Produtos do catálogo',exact=True)
 expect(panel.get_by_label('Filtrar produtos',exact=True)).to_have_value('')
 expect(panel.get_by_label('Produto fictício 099',exact=True)).to_be_checked()
 panel.get_by_role('button',name='Adicionar selecionados (2)',exact=True).click()
 expect(panel).not_to_be_visible()
 expect(page.get_by_role('heading',name='Produto fictício 000',exact=True)).to_be_visible()
 assert page.get_by_label('Preço de Produto fictício 000',exact=True).input_value()=='wholesale'
 page.get_by_label('Quantidade de Produto fictício 000',exact=True).fill('7')
 trigger.click()
 page.get_by_label('Filtrar produtos',exact=True).fill('Produto inexistente')
 expect(page.get_by_text('Nenhum produto encontrado.',exact=True)).to_be_visible()
 page.get_by_role('heading',name='Produtos do orçamento',exact=True).click()
 expect(panel).not_to_be_visible()
 assert page.get_by_label('Quantidade de Produto fictício 000',exact=True).input_value()=='7'
 page.set_viewport_size({'width':390,'height':844})
 trigger.click()
 panel=page.get_by_role('dialog',name='Produtos do catálogo',exact=True)
 expect(panel).to_be_visible()
 box=panel.bounding_box();assert box['x']>=0 and box['x']+box['width']<=390 and box['y']>=0 and box['y']+box['height']<=844
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 assert not errors,errors
 browser.close()
print('100 produtos: painel suspenso, rolagem, filtro, escolha de preço, seleção múltipla, Escape, clique externo e largura móvel: OK.')
