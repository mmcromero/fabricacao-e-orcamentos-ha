"""Browser check. Requires Python Playwright and a local Chromium installation."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='http://127.0.0.1:8193/')
parser.add_argument('--chromium', default='/usr/bin/chromium')
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
if args.screenshots:
    args.screenshots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.goto(args.base_url + '?view=produto')
    expect(page.get_by_role('heading', name='Vamos montar o pedido.')).to_be_visible()
    customer = {
        'Nome do cliente ou empresa': 'Cliente do teste visual',
        'Nome do contato': 'Contato de demonstração',
        'Telefone': 'telefone de teste',
        'E-mail': 'teste@example.com',
        'CEP de entrega': '20220-410',
        'Observações do pedido': 'Preservar os dados ao adicionar o produto.',
    }
    for label, value in customer.items():
        page.get_by_label(label, exact=True).fill(value)
    expect(page.get_by_label('CPF ou CNPJ', exact=True)).to_have_value('')
    page.get_by_role('button', name='+ Novo produto', exact=True).click()
    modal = page.get_by_role('dialog')
    expect(modal).to_be_visible()
    expect(modal.get_by_text('Embalagem individual neste orçamento', exact=True)).to_have_count(0)
    expect(page.get_by_role('radio', name='Autorizo a elegibilidade para divulgação futura')).to_have_count(0)
    expect(page.get_by_role('checkbox', name='Salvar também no catálogo')).not_to_be_checked()
    page.get_by_role('button', name='Adicionar ao orçamento', exact=True).click()
    expect(page.get_by_role('alert')).to_contain_text('Informe o nome')
    page.get_by_role('button', name='Preencher exemplo histórico', exact=True).click()
    page.get_by_label('Origem do produto', exact=True).select_option('own')
    expect(page.get_by_role('radio', name='Privado — não incluir em futura carga no site')).to_be_checked()
    page.get_by_role('radio', name='Autorizo a elegibilidade para divulgação futura').check()
    page.get_by_label('Origem do produto', exact=True).select_option('client')
    expect(page.get_by_role('radio', name='Autorizo a elegibilidade para divulgação futura')).to_have_count(0)
    expect(page.get_by_text('Produto de cliente: sempre privado e bloqueado para divulgação no site.', exact=True)).to_be_visible()
    page.get_by_label('Origem do produto', exact=True).select_option('own')
    expect(page.get_by_role('radio', name='Privado — não incluir em futura carga no site')).to_be_checked()
    page.get_by_label('Preço de venda por unidade (R$)', exact=True).fill('-1')
    page.get_by_role('button', name='Adicionar ao orçamento', exact=True).click()
    expect(page.get_by_role('alert')).to_contain_text('preço válido')
    expect(page.get_by_label('Nome do produto', exact=False)).to_have_value('Quebra-cabeça deslizante de duas faces')
    page.get_by_label('Preço de venda por unidade (R$)', exact=True).fill('32,50')
    page.get_by_role('button', name='Adicionar ao orçamento', exact=True).click()
    expect(modal).not_to_be_visible()
    for label, value in customer.items():
        expect(page.get_by_label(label, exact=True)).to_have_value(value)
    expect(page.get_by_text('Documento para envio: pendente; não bloqueia cotação', exact=True)).to_be_visible()
    expect(page.locator('.wf-total')).to_have_text('R$ 1.462,50')
    first = page.locator('.wf-item').first
    expect(first).to_contain_text('Próprio')
    expect(first).to_contain_text('Bloqueado para futura carga no site')
    first.get_by_label('Embalar cada unidade deste item?', exact=True).select_option('with')
    first.get_by_label('Tipo de embalagem individual', exact=True).fill('Saquinho autoadesivo')
    first.get_by_label('Acréscimo por embalagem individual (R$)', exact=True).fill('0,30')
    expect(page.locator('.wf-total')).to_have_text('R$ 1.476,00')
    first.get_by_label('Embalagem já incluída no preço de venda informado', exact=True).check()
    expect(page.locator('.wf-total')).to_have_text('R$ 1.462,50')
    first.get_by_label('Embalagem já incluída no preço de venda informado', exact=True).uncheck()
    expect(page.locator('.wf-total')).to_have_text('R$ 1.476,00')
    first.get_by_label('Acréscimo por embalagem individual (R$)', exact=True).fill('-1')
    expect(first.get_by_role('alert')).to_contain_text('valor válido')
    expect(page.get_by_text('Soma parcial: há preço de produto ou embalagem pendente.', exact=True)).to_be_visible()
    first.get_by_label('Acréscimo por embalagem individual (R$)', exact=True).fill('0,30')
    page.get_by_role('button', name='Catálogo simulado', exact=True).click()
    expect(page.get_by_role('heading', name='Nenhum produto salvo no catálogo')).to_be_visible()
    page.get_by_role('button', name='Voltar ao orçamento', exact=True).click()
    page.get_by_label('CPF ou CNPJ', exact=True).fill('DOCUMENTO DE TESTE')
    first.get_by_role('button', name=re.compile('^Editar ')).click()
    expect(modal.get_by_label('Embalar cada unidade deste item?', exact=True)).to_have_count(0)
    page.get_by_role('checkbox', name='Salvar também no catálogo').check()
    page.get_by_role('button', name='Salvar alterações no item', exact=True).click()
    expect(first.get_by_label('Acréscimo por embalagem individual (R$)', exact=True)).to_have_value('0,30')
    expect(first.get_by_label('Tipo de embalagem individual', exact=True)).to_have_value('Saquinho autoadesivo')
    expect(page.get_by_label('CPF ou CNPJ', exact=True)).to_have_value('DOCUMENTO DE TESTE')
    expect(page.get_by_text('Documento para envio: informado, ainda não validado', exact=True)).to_be_visible()
    page.get_by_role('button', name='Catálogo simulado', exact=True).click()
    expect(page.get_by_text('Privado · não exportar para site', exact=True)).to_be_visible()
    expect(page.get_by_label('Embalar cada unidade deste item?', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Usar no orçamento', exact=True).click()
    expect(page.locator('.wf-item')).to_have_count(2)
    second = page.locator('.wf-item').nth(1)
    expect(second.get_by_label('Embalar cada unidade deste item?', exact=True)).to_have_value('')
    expect(first.get_by_label('Embalar cada unidade deste item?', exact=True)).to_have_value('with')
    second.get_by_label('Embalar cada unidade deste item?', exact=True).select_option('none')
    expect(page.locator('.wf-total')).to_have_text('R$ 1.508,50')
    page.get_by_role('button', name='+ Novo produto', exact=True).click()
    page.get_by_label('Nome do produto', exact=False).fill('Produto pendente')
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.get_by_role('button', name='Cancelar', exact=True).click()
    expect(modal).to_be_visible()
    expect(page.get_by_label('Nome do produto', exact=False)).to_have_value('Produto pendente')
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Cancelar', exact=True).click()
    expect(modal).not_to_be_visible()
    page.get_by_role('button', name='+ Novo produto', exact=True).click()
    page.get_by_label('Nome do produto', exact=False).fill('Peça com dados a definir')
    page.get_by_label('Origem do produto', exact=True).select_option('client')
    page.get_by_role('button', name='Adicionar ao orçamento', exact=True).click()
    expect(page.get_by_text('Soma parcial: há preço de produto ou embalagem pendente.', exact=True)).to_be_visible()
    expect(page.get_by_text('Há dados físicos incompletos para preparar o envio.', exact=True)).to_be_visible()
    expect(page.locator('.wf-item').last).to_contain_text('De cliente')
    expect(page.locator('.wf-item').last).to_contain_text('Bloqueado para futura carga no site')
    if args.screenshots:
        page.screenshot(path=str(args.screenshots / 'wireframe-orcamento-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Overflow horizontal no celular'
    page.get_by_role('button', name='+ Novo produto', exact=True).click()
    expect(modal).to_be_visible()
    assert modal.bounding_box()['width'] <= 390
    page.get_by_label('Nome do produto', exact=False).fill('Produto no celular')
    page.get_by_label('Preço de venda por unidade (R$)', exact=True).fill('10,00')
    page.get_by_label('Origem do produto', exact=True).select_option('own')
    page.get_by_role('radio', name='Autorizo a elegibilidade para divulgação futura').check()
    page.get_by_role('button', name='Adicionar ao orçamento', exact=True).click()
    last = page.locator('.wf-item').last
    last.get_by_label('Embalar cada unidade deste item?', exact=True).select_option('with')
    last.get_by_label('Tipo de embalagem individual', exact=True).fill('Caixa individual')
    last.get_by_label('Acréscimo por embalagem individual (R$)', exact=True).fill('2,00')
    expect(last).to_contain_text('Elegível para divulgação futura; ainda não publicado')
    expect(last).to_contain_text('Somente neste orçamento')
    expect(last).to_contain_text('Com embalagem individual: Caixa individual')
    expect(page.get_by_role('heading', name=re.compile('Pacote de envio'))).to_be_visible()
    expect(page.get_by_text(re.compile('Embalagem de transporte obrigatória'))).to_be_visible()
    if args.screenshots:
        page.screenshot(path=str(args.screenshots / 'wireframe-orcamento-celular.png'), full_page=True)
    page.reload()
    expect(page.get_by_text('Uma peça nova também pode entrar aqui.', exact=True)).to_be_visible()
    assert not errors, errors
    assert not any('/api/' in url for url in requests), 'O protótipo não deve chamar a API ou gravar no banco'
    browser.close()
    print('PASS: modal, cliente/contato/documento pendente, privacidade por origem, embalagem só no orçamento, cálculo por unidade, sem duplicação de custo, catálogo preservado, descarte e navegação móvel; sem chamadas à API.')
