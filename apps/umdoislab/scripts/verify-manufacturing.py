"""Requires a disposable loopback server. All parameters and products are fictitious."""
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:8198/'
settings=dict(filamentKgPrice='100',energyHour='1',wearHour='2',humanHour='30',productiveHours='100',wholesaleMarkup='2',factoryMarkup='3',retailMarkup='4',internetCost='100')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 config=page.request.get(base+'api/settings/fabricacao').json();response=page.request.put(base+'api/settings/fabricacao',data=dict(data=settings,expectedRevision=config['revision']));assert response.ok,response.text()
 for width in [1280,390]:
  page.set_viewport_size(dict(width=width,height=900));page.goto(base+'?view=fabricacao');page.get_by_role('button',name='Novo produto com fabricação',exact=True).click()
  page.get_by_label('Nome',exact=True).fill(f'Fabricação fictícia {width}');page.get_by_label('Código/SKU',exact=True).fill(f'FAKE-{width}')
  time=page.locator('#main-machineSeconds-hours');time.fill('25');time.fill('');expect(time).to_have_value('')
  for key,h,m,s in [('machineSeconds','25','0','0'),('humanSeconds','0','10','0')]:
   for part,value in [('hours',h),('minutes',m),('seconds',s)]:page.locator(f'#main-{key}-{part}').fill(value)
  assert page.locator('#main-machineSeconds-hours').evaluate('(el)=>el.checkValidity()')
  page.locator('#main-machineSeconds-hours').fill('1');page.locator('#main-machineSeconds-minutes').fill('7')
  for label,value in [('Material utilizado (g)','50'),('Materiais extras (R$)','1'),('Embalagem de fabricação (R$)','2'),('Etiqueta (R$)','1')]:page.get_by_label(label,exact=True).fill(value)
  expect(page.get_by_text('Custo sem lucro:',exact=False)).to_contain_text('18,47')
  page.get_by_label('Revisei os resultados e quero aplicar os três preços calculados ao catálogo',exact=True).check();page.get_by_role('button',name='Salvar fabricação no cadastro único',exact=True).click();expect(page.get_by_role('status')).to_contain_text('os três preços foram aplicados')
  saved=max((v for v in page.request.get(base+'api/products').json() if v['sku']==f'FAKE-{width}'),key=lambda v:v['id']);assert saved['prices']['wholesale']==3693
  page.get_by_label('Materiais extras (R$)',exact=True).fill('2');page.get_by_role('button',name='Salvar fabricação no cadastro único',exact=True).click();expect(page.get_by_role('status')).to_contain_text('Preços do catálogo preservados.')
  again=next(v for v in page.request.get(base+'api/products').json() if v['id']==saved['id']);assert again['prices']==saved['prices'];assert again['manufacturing']['extras']==2
  page.reload();page.get_by_label('Produto do cadastro único',exact=True).select_option(str(saved['id']));expect(page.get_by_label('Materiais extras (R$)',exact=True)).to_have_value('2');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.goto(base+'?view=produtos');row=page.locator('.product-record').filter(has=page.get_by_role('heading',name=saved['name'],exact=True));expect(row).to_have_count(1)
 assert not errors,errors
 browser.close();print('PASS: formulário completo, duração >24h, cadastro único, cálculo, aplicação explícita e preservação de preços em computador/celular.')
