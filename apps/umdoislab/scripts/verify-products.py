"""Browser verification against a disposable local server, never Home Assistant."""
import sys, base64, json
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    # The image transport is mocked: availability of the real site is verified by the user.
    pixel=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=')
    page.route('https://**/*',lambda route:route.fulfill(status=200,content_type='image/png',body=pixel) if route.request.resource_type=='image' else route.abort())
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8196/?view=produtos')
    page.get_by_role('button',name='Novo produto',exact=True).click()
    assert page.get_by_label('Família',exact=True).count()==0
    assert not page.get_by_label('SKU',exact=True).is_visible()
    page.get_by_role('button',name='Editar informações para o site',exact=True).click()
    page.get_by_label('SKU',exact=True).fill('TEST-001')
    page.get_by_label('Descrição',exact=True).fill('Descrição preservada')
    page.get_by_role('button',name='Recolher informações para o site',exact=True).click()
    assert not page.get_by_label('Descrição',exact=True).is_visible()
    page.get_by_label('Categoria',exact=True).fill('Categoria de teste')
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
    assert page.get_by_label('Categoria',exact=True).input_value()=='Categoria de teste'
    page.get_by_role('button',name='Editar informações para o site',exact=True).click()
    assert page.get_by_label('SKU',exact=True).input_value()=='TEST-001'
    assert page.get_by_label('Descrição',exact=True).input_value()=='Descrição preservada'
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
    if len(sys.argv)>2:
        page.get_by_role('button',name='Cancelar carga',exact=True).click()
        page.get_by_label('Completar SKU, descrições e fotos vazias dos produtos existentes',exact=True).check()
        page.get_by_label('Arquivo de carga JSON').set_input_files(sys.argv[2])
        page.get_by_text('32 produtos com campos vazios a completar.',exact=True).wait_for()
        page.get_by_role('button',name='Confirmar importação',exact=True).click()
        page.get_by_role('status').filter(has_text='0 produtos importados; 32 completados; 0 já existentes.').wait_for()
        assert page.get_by_role('heading',name='Catálogo (33)',exact=True).count()==1
        data=json.load(open(sys.argv[2]))['products']
        sample=data[0]
        page.get_by_role('button',name='Editar '+sample['name'],exact=True).click()
        expect(page.get_by_label('SKU',exact=True)).to_be_visible()
        assert page.get_by_label('SKU',exact=True).input_value()==sample['sku']
        expected=sample['imageUrl']
        assert page.get_by_label('Endereço da foto',exact=True).input_value()==expected
        assert page.get_by_role('dialog').get_by_role('img').get_attribute('src')==expected
        page.get_by_role('button',name='Salvar produto',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    browser.close()
print('Cadastro, validação, edição, recarga, carga real de 32 itens, repetição e largura móvel: OK.')
