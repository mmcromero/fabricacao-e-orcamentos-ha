"""Requires an empty disposable loopback server. Uses fictitious data only."""
import argparse,json
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base-url',default='http://127.0.0.1:8198/');parser.add_argument('--woo-csv');args=parser.parse_args();base=args.base_url
assert base.startswith('http://127.0.0.1:')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 assert page.request.get(base+'api/products').json()==[],'Use banco descartável vazio.'
 for width in [1280,390]:
  page.set_viewport_size(dict(width=width,height=900));page.goto(base+'?view=configuracoes&area=produtos')
  category=f'Categoria fictícia {width} > Peças'
  page.get_by_label('Caminho da categoria',exact=True).fill(category);page.get_by_role('button',name='Adicionar categoria',exact=True).click();expect(page.get_by_role('status').last).to_have_text('Categoria salva. Produtos e subcategorias associados foram preservados.')
  assert not page.request.get(base+'api/products').json()
  file=page.get_by_label('Arquivo para importar',exact=True)
  file.set_input_files(dict(name='desconhecido.json',mimeType='application/json',buffer=b'{"unknown":[]}'));expect(page.get_by_role('status').last).to_contain_text('não reconhecido')
  fixture=json.dumps({'type':'categories','categories':[f'Importada {width} > Subcategoria']}).encode()
  file.set_input_files(dict(name='categorias.json',mimeType='application/json',buffer=fixture));preview=page.get_by_label('Prévia da importação',exact=True);expect(preview.get_by_role('heading',name='Importação de categorias',exact=True)).to_be_visible()
  assert not any(c['path']==f'Importada {width}' for c in page.request.get(base+'api/categories').json())
  page.get_by_role('button',name='Confirmar importação',exact=True).click();expect(preview).to_have_count(0)
  assert any(c['path']==f'Importada {width} > Subcategoria' for c in page.request.get(base+'api/categories').json())
  page.goto(base+'?view=produtos');expect(page.get_by_role('heading',name='Carga piloto',exact=True)).to_have_count(0)
  page.get_by_role('button',name='Novo produto',exact=True).click();modal=page.get_by_role('dialog',name='Novo produto',exact=True)
  modal.get_by_label('Origem',exact=True).select_option('own');select=modal.get_by_role('combobox',name='Categoria',exact=True);select.select_option(category)
  expect(select.locator('option',has_text='Produtos de cliente')).to_have_count(0)
  modal.get_by_label('Origem',exact=True).select_option('client');expect(select).to_have_count(0);expect(modal.get_by_label('Autorizar divulgação futura no site',exact=True)).to_have_count(0)
  page.once('dialog',lambda d:d.accept());modal.locator('.modal-close').click()
 if args.woo_csv:
  page.goto(base+'?view=configuracoes&area=produtos');before=page.request.get(base+'api/categories').json()
  page.get_by_label('Arquivo para importar',exact=True).set_input_files(args.woo_csv);expect(page.get_by_role('heading',name='Importação de categorias',exact=True)).to_be_visible()
  assert before==page.request.get(base+'api/categories').json();assert page.request.get(base+'api/products').json()==[]
  page.get_by_role('button',name='Cancelar importação',exact=True).click()
 assert not errors,errors
 browser.close();print('PASS: categorias, formato inválido, prévia sem gravação, importação confirmada fictícia, dropdown e privacidade em computador/celular.')
