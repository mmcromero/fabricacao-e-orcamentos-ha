"""Run only against a disposable local database; all records are synthetic."""
import base64,time
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:8198/'
stamp=int(time.time())
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.route('https://example.test/**',lambda route:route.fulfill(status=200,content_type='image/png',body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=')))
 config=page.request.get(base+'api/settings/fabricacao').json()
 settings=dict(filamentKgPrice='100',energyHour='1',wearHour='2',humanHour='30',productiveHours='100',wholesaleMarkup='2',factoryMarkup='3',retailMarkup='4')
 assert page.request.put(base+'api/settings/fabricacao',data=dict(data=settings,expectedRevision=config['revision'])).ok
 for width in [1280,390]:
  page.set_viewport_size(dict(width=width,height=900));page.goto(base+'?view=fabricacao')
  expect(page.get_by_role('heading',name='Produção',exact=True)).to_be_visible()
  expect(page.get_by_label('Descrição',exact=True)).to_be_hidden()
  name=f'Produto fictício {width}-{stamp}'
  page.get_by_label('Nome',exact=True).fill(name);page.get_by_label('Código/SKU').fill(f'FAKE-{width}-{stamp}')
  for key,h,m,s in [('machineSeconds','1','0','0'),('humanSeconds','0','10','0')]:
   for part,value in [('hours',h),('minutes',m),('seconds',s)]:page.locator(f'#main-{key}-{part}').fill(value)
  for label,value in [('Material utilizado (g)','50'),('Materiais extras (R$)','1'),('Embalagem de fabricação (R$)','2'),('Etiqueta (R$)','1')]:page.get_by_label(label,exact=True).fill(value)
  for tier in ['Atacado','Loja de fábrica','Varejo']:page.get_by_role('button',name=f'Usar preço calculado — {tier}',exact=True).click()
  page.get_by_label('Valor varejo (R$)',exact=True).fill('99')
  expect(page.get_by_text('Varejo: preço comercial diferente do cálculo de fabricação.',exact=True)).to_be_visible()
  page.get_by_role('button',name='Usar preço calculado — Varejo',exact=True).click()
  page.get_by_role('button',name='Editar informações para o site',exact=True).click();page.get_by_label('Descrição',exact=True).fill('Descrição sintética')
  page.get_by_label('Endereço da foto').fill('https://example.test/photo.png')
  page.get_by_role('button',name='Salvar produto',exact=True).click();expect(page.get_by_role('status').first).to_contain_text('salvo no cadastro único')
  saved=next(r for r in page.request.get(base+'api/products').json() if r['name']==name);assert saved['prices']==dict(wholesale=3400,factory=5100,retail=6800)
  page.goto(base+'?view=produtos');page.get_by_label('Buscar produtos',exact=True).fill(name)
  expect(page.get_by_role('navigation',name='Paginação de produtos')).to_have_count(0)
  row=page.locator('.product-record');expect(row).to_have_count(1)
  assert row.locator('.record-product-photo').bounding_box()['x']<row.locator('.record-product-details').bounding_box()['x']
  row.get_by_role('button',name='Editar',exact=True).click();modal=page.locator('dialog[open]')
  expect(modal.locator('.product-form-heading')).to_contain_text(name);expect(modal.locator('.product-form-heading img')).to_have_count(1)
  expect(modal.get_by_role('heading',name='Produção',exact=True)).to_be_hidden()
  modal.get_by_label('Valor varejo (R$)',exact=True).fill('99');expect(modal.get_by_role('button',name='Usar preço calculado — Varejo',exact=True)).to_be_visible()
  modal.get_by_role('button',name='Usar preço calculado — Varejo',exact=True).click()
  modal.get_by_role('button',name='Editar dados de fabricação',exact=True).click();modal.get_by_label('Materiais extras (R$)',exact=True).fill('2')
  expect(modal.get_by_role('button',name='Usar preço calculado — Atacado',exact=True)).to_be_visible()
  modal.get_by_role('button',name='Usar preço calculado — Varejo',exact=True).click();modal.get_by_role('button',name='Salvar produto',exact=True).click();expect(page.locator('dialog[open]')).to_have_count(0)
  saved=next(r for r in page.request.get(base+'api/products').json() if r['name']==name);assert saved['prices']==dict(wholesale=3400,factory=5100,retail=7200)
  page.get_by_label('Filtrar por categoria').select_option('__pending__');expect(row).to_have_count(1)
  page.get_by_role('button',name='Selecionar esta página',exact=True).click();page.get_by_label('Ação',exact=True).select_option('public');page.get_by_role('button',name='Revisar ação selecionada',exact=True).click()
  expect(page.get_by_role('status').filter(has_text='registro(s) alterado(s)')).to_be_visible()
  assert next(r for r in page.request.get(base+'api/products').json() if r['name']==name)['publicAllowed']
  row.get_by_role('button',name='Arquivar',exact=True).click();expect(row).to_have_count(0)
  page.get_by_role('button',name='Ver arquivados',exact=True).click();page.get_by_role('button',name=f'Restaurar {name}',exact=True).click();expect(row).to_have_count(1)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.goto(base+'?view=orcamentos');page.get_by_role('button',name='Novo orçamento',exact=True).click();page.get_by_role('button',name='Novo produto',exact=True).click()
  quick=page.locator('dialog[open]').last;quick.get_by_label('Nome',exact=True).fill(f'Só orçamento {width}-{stamp}');quick.get_by_label('Origem',exact=True).select_option('own');quick.get_by_label('Valor varejo (R$)',exact=True).fill('10')
  expect(quick.get_by_role('heading',name='Produção',exact=True)).to_be_hidden();quick.get_by_role('button',name='Adicionar ao orçamento',exact=True).click();expect(page.get_by_role('heading',name=f'Só orçamento {width}-{stamp}',exact=True)).to_be_visible()
  assert not any(r['name']==f'Só orçamento {width}-{stamp}' for r in page.request.get(base+'api/products').json())
  page.get_by_label('Título do orçamento',exact=True).fill(f'Orçamento teste {width}-{stamp}');page.get_by_role('button',name='Salvar rascunho',exact=True).click();page.locator('.quote-modal-footer').get_by_role('button',name='Fechar',exact=True).click()
  qr=page.locator('.quote-record').filter(has_text=f'Orçamento teste {width}-{stamp}');qr.get_by_role('button',name='Arquivar',exact=True).click();expect(qr).to_have_count(0)
  page.get_by_role('button',name='Ver arquivados',exact=True).click();page.get_by_role('button',name=f'Restaurar Orçamento teste {width}-{stamp}',exact=True).click();expect(qr).to_have_count(1)
  page.goto(base+'?view=configuracoes&area=produtos');page.get_by_role('link',name='Abrir diagnóstico da instalação',exact=True).click();expect(page.get_by_role('heading',name='Diagnóstico da instalação',exact=True)).to_be_visible()
 assert not errors,errors
 browser.close()
 print('PASS: shared form/routes, individual bidirectional prices, photo layout, filters, bulk disclosure, archive/restore, quote-only product and support link; desktop/mobile.')
