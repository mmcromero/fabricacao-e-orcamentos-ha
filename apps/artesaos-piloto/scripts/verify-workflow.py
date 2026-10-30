"""Use only a disposable server on loopback, after verify-products.py seeds its pilot."""
import sys, json
from playwright.sync_api import sync_playwright
sample=json.load(open(sys.argv[1]))['products'][0]
name=sample['name']
expected=(sample['prices']['retail']*3+1000+90)/100
expected_text='R$\u00a0'+format(expected,'.2f').replace('.',',')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8196/')
    assert page.get_by_role('navigation',name='Áreas').get_by_role('link').all_text_contents()==['Fabricação','Orçamentos','Clientes','Produtos']
    page.get_by_role('button',name='Novo orçamento',exact=True).click()
    page.get_by_role('button',name='+ Novo cliente',exact=True).click()
    page.get_by_label('Nome da empresa',exact=True).fill('Cliente fictício do fluxo')
    page.get_by_label('Nome do contato',exact=True).fill('Contato de teste')
    page.get_by_role('button',name='Salvar e selecionar cliente',exact=True).click()
    page.get_by_text('Cliente salvo no cadastro e selecionado neste orçamento.',exact=True).wait_for()
    page.get_by_role('button',name='Selecionar produtos do catálogo',exact=True).click()
    page.get_by_label(name,exact=True).check()
    page.get_by_role('button',name='Adicionar selecionados (1)',exact=True).click()
    page.get_by_label('Quantidade de '+name,exact=True).fill('3')
    page.get_by_label('Embalar cada unidade de '+name+'?',exact=True).select_option('with')
    page.get_by_label('Tipo de embalagem',exact=True).fill('Saquinho')
    page.get_by_label('Acréscimo por unidade (R$)',exact=True).fill('0,30')
    page.get_by_label('Observações do pedido',exact=True).fill('Três unidades; cores nas observações.')
    page.get_by_role('button',name='Novo produto',exact=True).click()
    modal=page.get_by_role('dialog')
    modal.get_by_label('Nome do produto',exact=True).fill('Peça avulsa de teste')
    modal.get_by_label('Origem do produto',exact=True).select_option('client')
    modal.get_by_label('Valor atacado (R$)',exact=True).fill('10')
    modal.get_by_label('Valor varejo (R$)',exact=True).fill('20')
    modal.get_by_role('button',name='Adicionar ao orçamento',exact=True).click()
    modal.get_by_role('alert').filter(has_text='Escolha qual preço').wait_for()
    modal.get_by_label('Preço usado neste orçamento',exact=True).select_option('wholesale')
    modal.get_by_role('button',name='Adicionar ao orçamento',exact=True).click()
    page.get_by_role('heading',name='Peça avulsa de teste',exact=True).wait_for()
    page.get_by_label('Embalar cada unidade de Peça avulsa de teste?',exact=True).select_option('none')
    page.get_by_role('button',name='Salvar rascunho',exact=True).first.click()
    page.get_by_role('status').filter(has_text='Rascunho salvo.').wait_for()
    page.reload()
    page.locator('.quote-record[data-record-id="1"]').get_by_role('button',name='Editar',exact=True).click()
    assert page.get_by_label('Observações do pedido',exact=True).input_value()=='Três unidades; cores nas observações.'
    assert page.get_by_label('Quantidade de '+name,exact=True).input_value()=='3'
    assert page.get_by_label('Preço de Peça avulsa de teste',exact=True).input_value()=='wholesale'
    page.get_by_text(expected_text,exact=False).wait_for()
    page.get_by_role('navigation',name='Áreas').get_by_role('link',name='Clientes',exact=True).click()
    page.get_by_role('heading',name='Cliente fictício do fluxo',exact=True).wait_for()
    page.locator('.client-record').filter(has=page.get_by_role('heading',name='Cliente fictício do fluxo',exact=True)).get_by_role('button',name='Editar',exact=True).click()
    page.get_by_label('Nome do contato',exact=True).fill('Contato revisado')
    page.get_by_role('button',name='Salvar cliente',exact=True).click()
    page.get_by_role('status').filter(has_text='Cliente salvo.').wait_for()
    page.get_by_role('link',name='Configurações',exact=True).click()
    page.get_by_role('heading',name='Configurações — Clientes',exact=True).wait_for()
    page.get_by_role('navigation',name='Áreas').get_by_role('link',name='Fabricação',exact=True).click()
    page.get_by_role('link',name='Configurações',exact=True).click()
    page.get_by_label('Capacidade disponível por dia',exact=True).fill('Informação de teste — não calcular prazo')
    page.get_by_role('button',name='Salvar configurações',exact=True).click()
    page.get_by_role('status').filter(has_text='Configurações salvas.').wait_for()
    page.reload()
    assert page.get_by_label('Capacidade disponível por dia',exact=True).input_value()=='Informação de teste — não calcular prazo'
    page.get_by_role('navigation',name='Áreas').get_by_role('link',name='Orçamentos',exact=True).click()
    page.get_by_role('link',name='Configurações',exact=True).click()
    page.get_by_label('CEP de origem',exact=True).fill('12345-678')
    page.get_by_role('button',name='Salvar configurações',exact=True).click()
    page.get_by_role('status').filter(has_text='Configurações salvas.').wait_for()
    page.reload()
    assert page.get_by_label('CEP de origem',exact=True).input_value()=='12345-678'
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    browser.close()
print('Fluxo real: cliente no modal, catálogo, escolha de preço, embalagem, rascunho e configurações persistentes: OK.')
