"""Use an EMPTY disposable loopback server. Creates fictitious test data only."""
import argparse
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url',default='http://127.0.0.1:8198/')
args=parser.parse_args();base=args.base_url
assert base.startswith('http://127.0.0.1:'),'Use loopback only.'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def post(path,data):
  response=page.request.post(base+'api/'+path,data=data);assert response.ok,response.text();return response.json()
 for path in ['clients','products','quotes']:
  assert page.request.get(base+'api/'+path).json()==[],'Use banco descartável vazio.'
 for i in range(23):
  client=dict(name=f'Empresa fictícia {i:02}',contact=f'Contato {i:02}',phone='',email='',taxDocument='',postal='')
  post('clients',client)
  post('products',dict(name=f'Produto fictício {i:02}',sku='SKU-EXATO' if i==0 else f'P-{i:02}',category='' if i%2 else 'Categoria teste',origin='own',publicAllowed=False,prices=dict(wholesale=1000,factory=None,retail=None),weightGrams=None,lengthCm=None,widthCm=None,heightCm=None,colors=[],sourceKeys=[],family='',description=''))
  post('quotes',dict(data=dict(client=None,items=[],notes='',title=f'Pedido fictício {i:02}'),expectedRevision=0))
 for width in [1280,390,320]:
  page.set_viewport_size(dict(width=width,height=900))
  for view in ['orcamentos','clientes','produtos']:
   print('CHECK',width,view,flush=True)
   page.goto(base+'?view='+view)
   rows=page.locator('.record-row');expect(rows).to_have_count(10)
   page.get_by_role('button',name='Próxima página',exact=True).click()
   expect(page.get_by_text(f'Página 2 de 3 · 23 {'orçamentos' if view=='orcamentos' else view}',exact=True)).to_be_visible()
   button=rows.first.get_by_role('button',name='Editar',exact=True)
   button.scroll_into_view_if_needed();scroll=page.evaluate('scrollY');button.click()
   modal=page.locator('dialog[open]');expect(modal).to_have_count(1)
   # Untouched closing must not invoke a confirmation.
   def unexpected(dialog):
    dialog.dismiss();raise AssertionError('Confirmação indevida sem alterações')
   page.on('dialog',unexpected)
   modal.locator('.modal-close:visible').click();page.remove_listener('dialog',unexpected)
   expect(modal).to_have_count(0)
   expect(page.get_by_text(f'Página 2 de 3 · 23 {'orçamentos' if view=='orcamentos' else view}',exact=True)).to_be_visible()
   expect(button).to_be_focused()
   assert abs(page.evaluate('scrollY')-scroll)<5
   search=page.get_by_label({'orcamentos':'Buscar orçamentos','clientes':'Buscar clientes','produtos':'Buscar produtos'}[view],exact=True)
   search.fill({'orcamentos':'Pedido fictício 00','clientes':'Contato 00','produtos':'SKU-EXATO'}[view])
   expect(rows).to_have_count(1)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   search.fill('')
   expect(rows).to_have_count(10)
  # Nested dialog Escape closes the top layer and preserves the draft.
  page.goto(base+'?view=orcamentos');page.get_by_role('button',name='Novo orçamento',exact=True).click()
  editor=page.locator('.quote-editor-modal');editor.get_by_role('button',name='Novo produto',exact=True).click()
  expect(page.locator('dialog[open]')).to_have_count(2)
  page.keyboard.press('Escape');expect(page.locator('dialog[open]')).to_have_count(1)
  expect(editor).to_be_visible();expect(editor.get_by_role('button',name='Novo produto',exact=True)).to_be_focused()
  editor.get_by_role('button',name='+ Novo cliente',exact=True).click()
  page.keyboard.press('Escape');expect(page.locator('dialog[open]')).to_have_count(1)
  editor.get_by_label('Título do orçamento',exact=True).fill('Alteração temporária')
  page.once('dialog',lambda d:d.dismiss());editor.locator('.modal-close:visible').click();expect(editor).to_be_visible()
  editor.get_by_label('Título do orçamento',exact=True).fill('')
  page.on('dialog',unexpected);page.keyboard.press('Escape');page.remove_listener('dialog',unexpected)
  expect(page.locator('dialog[open]')).to_have_count(0)
 # Save isolated settings through the UI and verify after a full reload.
 for area,value in [('clientes','20'),('produtos','30'),('orcamentos','50')]:
  page.goto(base+f'?view=configuracoes&area={area}')
  select=page.get_by_role('combobox',name='Registros por página',exact=True)
  expect(select.locator('option')).to_have_count(6)
  select.select_option(value);page.get_by_role('button',name='Salvar configurações',exact=True).click()
  expect(page.get_by_role('status')).to_have_text('Configurações salvas.')
  page.goto(base+'?view='+area);expect(page.locator('.record-row')).to_have_count(min(int(value),23))
 assert not errors,errors
 browser.close();print('PASS: listas, busca, páginas, configurações persistentes, foco, descarte e modais aninhados em computador e celular.')
