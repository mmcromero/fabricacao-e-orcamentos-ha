"""Run against a disposable loopback server; creates one fictitious quote."""
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:8198/'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page()
 client=dict(id=1,name='Cliente fictício',contact='',phone='',email='',taxDocument='',postal='01001000')
 item=dict(id=1,name='Peça fictícia',origin='own',productId=None,prices=dict(wholesale=1000,factory=None,retail=None),priceKey='wholesale',quantity='2',weightGrams=100,lengthCm=2,widthCm=3,heightCm=4,packaging='with',packagingType='Saquinho',packagingIncluded=True,packagingAmount='',packagingWeightGrams=5)
 response=page.request.post(base+'api/quotes',data=dict(data=dict(title='Pacote fictício',client=client,items=[item],notes='',delivery=dict(mode='pickup',carrier='',amount='0',notes='')),expectedRevision=0));assert response.ok,response.text();qid=response.json()['id']
 for width in [1280,390]:
  page.set_viewport_size(dict(width=width,height=900));page.goto(base+'?view=orcamentos');page.locator(f'.quote-record[data-record-id="{qid}"]').get_by_role('button',name='Editar',exact=True).click();editor=page.locator('.quote-editor-modal')
  expect(editor.get_by_text('Peso estimado dos produtos: 200 g. Volume conhecido dos produtos: 48 cm³. Valores parciais quando há pendências.',exact=True)).to_be_visible()
  for label,value in [('Peso da caixa (g)','20'),('Peso da proteção (g)','10'),('Peso real do pacote (g)','250'),('Comprimento real do pacote (cm)','10'),('Largura real do pacote (cm)','8'),('Altura real do pacote (cm)','6')]:editor.get_by_label(label,exact=True).fill(value)
  expect(editor.get_by_text('Peso estimado com embalagens informadas: 240 g.',exact=True)).to_be_visible()
  editor.get_by_role('button',name='Salvar rascunho',exact=True).click();expect(editor.locator('.quote-modal-footer').get_by_role('status')).to_have_text('Rascunho salvo.');editor.locator('.quote-modal-header .modal-close').click()
  page.reload();page.locator(f'.quote-record[data-record-id="{qid}"]').get_by_role('button',name='Editar',exact=True).click();expect(editor.get_by_label('Peso real do pacote (g)',exact=True)).to_have_value('250');expect(editor.get_by_label('Comprimento real do pacote (cm)',exact=True)).to_have_value('10')
  editor.get_by_role('button',name='Finalizar orçamento',exact=True).click();expect(editor.get_by_label('Peso real do pacote (g)',exact=True)).to_be_disabled();page.once('dialog',lambda d:d.accept());editor.get_by_role('button',name='Reabrir como rascunho',exact=True).click();expect(editor.get_by_label('Peso real do pacote (g)',exact=True)).to_be_enabled();editor.locator('.quote-modal-header .modal-close').click()
 browser.close();print('PASS: peso/volume, embalagem, medidas reais, persistência e bloqueio de finalizado em computador e celular.')
