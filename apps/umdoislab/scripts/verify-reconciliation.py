"""Disposable empty loopback server only. Real prepared files are previewed, never confirmed."""
import argparse,json
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--prepared-path');args=parser.parse_args();base='http://127.0.0.1:8198/'
manufacturing=dict(machineSeconds=3600,humanSeconds=600,materialGrams=50,extras=1,packaging=2,label=1)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 def post(path,data):
  r=page.request.post(base+path,data=data);assert r.ok,r.text();return r.json()
 def upload(data):page.get_by_label('Arquivo para importar',exact=True).set_input_files(dict(name='carga-ficticia.json',mimeType='application/json',buffer=json.dumps(data).encode()))
 assert page.request.get(base+'api/products').json()==[],'Use banco descartável vazio.'
 for width in [1280,390]:
  product=dict(name=f'Cadastro original fictício {width}',sku=f'FAKE-{width}',origin='own',publicAllowed=False,prices=dict(retail=1200,wholesale=None,factory=None),lengthCm=None,widthCm=None,heightCm=None,weightGrams=None,colors=[],sourceKeys=[f'https://loja.example#woocommerce:{width}'],family='',description='',category='')
  post('api/products/import',dict(products=[product],confirm=True));original=next(v for v in page.request.get(base+'api/products').json() if v['sku']==product['sku'])
  incoming={**product,'name':f'Linha do arquivo fictício {width}','sourceKeys':[f'excel:fake-{width}'],'prices':dict(wholesale=2000,factory=3000,retail=4000),'manufacturing':manufacturing,'category':'Linha fictícia > Peças'}
  new={**incoming,'name':f'Novo fictício {width}','sku':f'NEW-{width}','sourceKeys':[f'excel:new-{width}']}
  payload=dict(type='manufacturing-import-v1',records=[dict(key='matched',product=incoming),dict(key='new',product=new)],settings=dict(filamentKgPrice='100'))
  page.set_viewport_size(dict(width=width,height=900));page.goto(base+'?view=configuracoes&area=produtos');upload(payload)
  panel=page.get_by_label('Conciliação da planilha',exact=True);expect(panel.locator('.reconciliation-record')).to_have_count(2)
  expect(page.get_by_label('Arquivo para importar',exact=True)).to_be_disabled()
  confirm=panel.get_by_role('button',name='Confirmar carga revisada',exact=True);expect(confirm).to_be_enabled()
  row=panel.locator('.reconciliation-record').first
  expect(row.get_by_text('Preços atuais:',exact=False)).to_contain_text('Varejo: R$\u00a012,00')
  expect(row.get_by_label('Aplicar os preços desta linha',exact=True)).not_to_be_checked()
  row.get_by_role('combobox',name=f'Categoria de {incoming["name"]} {incoming["sku"]}',exact=True).select_option('')
  expect(confirm).to_be_disabled();panel.get_by_role('button',name='Revisar vínculos e alterações',exact=True).click();expect(confirm).to_be_enabled()
  if width==1280:
   data={k:v for k,v in original.items() if k not in ['id','updatedAt']};data['description']='Edição concorrente fictícia';r=page.request.put(base+f'api/products/{original["id"]}',data=data);assert r.ok
   confirm.click();expect(panel.get_by_role('status').first).to_contain_text('mudaram');expect(confirm).to_be_disabled();panel.get_by_role('button',name='Revisar vínculos e alterações',exact=True).click();expect(confirm).to_be_enabled()
  else:
   panel.get_by_label('Aplicar também os parâmetros de fabricação apresentados acima',exact=True).check();expect(confirm).to_be_disabled();panel.get_by_role('button',name='Revisar vínculos e alterações',exact=True).click();expect(confirm).to_be_enabled()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  confirm.click();expect(panel).to_have_count(0);expect(page.get_by_role('status').last).to_contain_text('Carga revisada concluída.')
  saved=next(v for v in page.request.get(base+'api/products').json() if v['id']==original['id']);assert saved['name']==original['name'];assert saved['prices']==original['prices'];assert saved['manufacturing']==manufacturing;assert saved['category']=='';assert product['sourceKeys'][0] in saved['sourceKeys'];assert f'excel:fake-{width}' in saved['sourceKeys']
  assert page.request.get(base+'api/settings/fabricacao').json()['revision']==(0 if width==1280 else 1)
  with page.expect_download() as downloaded:page.get_by_role('link',name='Baixar catálogo para conferência',exact=True).click()
  download=downloaded.value
  with open(download.path()) as f:export=json.load(f)
  assert export['type']=='catalog-export-v1';assert 'clients' not in export and 'quotes' not in export
 if args.prepared_path:
  before=page.request.get(base+'api/products').json();page.get_by_label('Arquivo para importar',exact=True).set_input_files(args.prepared_path);panel=page.get_by_label('Conciliação da planilha',exact=True);expect(panel.locator('.reconciliation-record')).to_have_count(140);expect(panel.get_by_role('button',name='Confirmar carga revisada',exact=True)).to_be_enabled();assert before==page.request.get(base+'api/products').json();panel.get_by_role('button',name='Cancelar conciliação',exact=True).click();assert before==page.request.get(base+'api/products').json()
 assert not errors,errors
 browser.close();print('PASS: conciliação, preservação do piloto/preços, revisão, confirmação obsoleta bloqueada, parâmetros explícitos e exportação em computador/celular. Prévia real não confirmada.')
