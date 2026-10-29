"""Browser verification against a disposable local server, never Home Assistant."""
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8196/?view=produtos')
    page.get_by_role('button',name='Novo produto',exact=True).click()
    page.get_by_label('Nome',exact=True).fill('Teste cadastro')
    page.get_by_label('Origem',exact=True).select_option('client')
    assert page.get_by_label('Autorizar divulgação futura no site').count()==0
    page.get_by_role('button',name='Salvar produto',exact=True).click()
    page.get_by_role('alert').filter(has_text='Preencha pelo menos um preço.').wait_for()
    page.get_by_label('Valor atacado (R$)',exact=True).fill('12.34')
    page.get_by_role('button',name='Salvar produto',exact=True).click()
    page.get_by_role('heading',name='Teste cadastro',exact=True).wait_for()
    page.reload()
    page.get_by_role('button',name='Editar Teste cadastro',exact=True).click()
    assert page.get_by_label('Valor atacado (R$)',exact=True).input_value()=='12.34'
    page.get_by_label('Nome',exact=True).fill('Teste editado')
    page.get_by_role('button',name='Salvar produto',exact=True).click()
    page.get_by_role('heading',name='Teste editado',exact=True).wait_for()
    page.get_by_label('Arquivo de carga JSON').set_input_files(sys.argv[1])
    page.get_by_text('32 novos produtos; 0 já existentes.',exact=True).wait_for()
    page.get_by_role('button',name='Confirmar importação',exact=True).click()
    page.get_by_role('heading',name='Catálogo (33)',exact=True).wait_for()
    page.get_by_label('Arquivo de carga JSON').set_input_files(sys.argv[1])
    page.get_by_text('0 novos produtos; 32 já existentes.',exact=True).wait_for()
    assert page.get_by_role('button',name='Confirmar importação',exact=True).is_disabled()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    browser.close()
print('Cadastro, validação, edição, recarga, carga real de 32 itens, repetição e largura móvel: OK.')
