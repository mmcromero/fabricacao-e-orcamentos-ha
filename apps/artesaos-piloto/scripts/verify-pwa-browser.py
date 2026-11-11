"""PWA / Service Worker in a disposable HTTPS pilot fixture; never uses production data."""
import base64
import hashlib
import json
import os
import ssl
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
evidence = Path(os.environ.get('BROWSER_CI_OUTPUT', '/tmp')).resolve()
evidence.mkdir(parents=True, exist_ok=True)
results = []
page = None

with tempfile.TemporaryDirectory(prefix='artesao-pwa01-browser-') as temporary:
    key = str(Path(temporary) / 'key.pem')
    cert = str(Path(temporary) / 'cert.pem')
    subprocess.run([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost',
        '-addext', 'subjectAltName=IP:127.0.0.1'
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    public = subprocess.check_output(['openssl', 'x509', '-in', cert, '-pubkey', '-noout'])
    spki = base64.b64encode(hashlib.sha256(subprocess.check_output(
        ['openssl', 'pkey', '-pubin', '-outform', 'DER'], input=public
    )).digest()).decode()
    origin = 'https://127.0.0.1:8298'
    base = origin + '/artesaos-piloto/'

    with (evidence / 'pwa-browser-server.log').open('w') as log:
        server = subprocess.Popen(
            ['node', '--import', 'tsx', 'scripts/pilot-browser-server.mjs'],
            cwd=root,
            env={**os.environ, 'PILOT_BROWSER_TEST': '1',
                 'PILOT_TEST_KEY': key, 'PILOT_TEST_CERT': cert},
            stdout=log, stderr=log
        )
        try:
            for _ in range(60):
                try:
                    urllib.request.urlopen(base + 'login',
                                           context=ssl._create_unverified_context(),
                                           timeout=1)
                    break
                except Exception:
                    time.sleep(.2)
            else:
                raise RuntimeError('Pilot fixture did not start')

            with sync_playwright() as pw:
                browser = pw.chromium.launch(
                    **({} if os.environ.get('BROWSER_CI_CHROMIUM') == '1'
                       else {'executable_path': '/usr/bin/chromium'}),
                    args=['--no-sandbox', '--ignore-certificate-errors-spki-list=' + spki]
                )
                try:
                    for width, subject in [(390, 'a'), (1280, 'b')]:
                        context = browser.new_context(
                            ignore_https_errors=True,
                            viewport={'width': width, 'height': 900}
                        )
                        try:
                            def google(route):
                                state = parse_qs(urlparse(route.request.url).query)['state'][0]
                                route.fulfill(status=302, headers={'location':
                                    base + 'auth/google/callback?state=' + state + '&code=' + subject})
                            context.route('https://accounts.google.com/**', google)

                            page = context.new_page()
                            page.goto(base + 'login')
                            # Minimum synthetic session setup. Entry UX is already tested by B1.
                            page.get_by_role('link', name='Já sou cadastrado', exact=True).click()
                            page.get_by_role('button', name='Tenho um convite', exact=True).click()
                            page.locator('#invite').fill(
                                'synthetic-invite-' + subject + '-01234567890123456789')
                            page.get_by_role('button', name='Continuar com Google', exact=True).click()
                            expect(page.get_by_role(
                                'heading', name='Termos de Uso', exact=True)).to_be_visible()
                            page.get_by_role('checkbox').check()
                            page.get_by_role('button', name='Confirmar e continuar').click()
                            expect(page.get_by_role(
                                'heading', name='Que bom ter você aqui!', exact=True)).to_be_visible()

                            # Browser acceptance of manifest, not duplicate HTTP/PNG tests in npm test.
                            manifest = context.new_cdp_session(page).send('Page.getAppManifest')
                            assert not manifest['errors'], manifest
                            metadata = json.loads(manifest['data'])
                            assert metadata['display'] == 'standalone'
                            assert metadata['start_url'] == '/artesaos-piloto/'
                            assert metadata['scope'] == '/artesaos-piloto/'
                            assert metadata['id'] == '/artesaos-piloto/'

                            page.wait_for_function("""() => navigator.serviceWorker &&
                              navigator.serviceWorker.controller?.scriptURL.includes('/service-worker.js')""")
                            page.wait_for_function("""() => {
                              const name=document.querySelector('[name=responsible]');
                              return name && !name.disabled;
                            }""")
                            draft = 'Nome de PWA ainda nao salvo - ' + subject
                            page.locator('[name=responsible]').fill(draft)
                            page.locator('[name=phone]').fill('11999990000')

                            # Explicit worker update must take control without resetting the form.
                            marker = 'pwa-ci-' + subject
                            update = page.evaluate("""async marker => {
                              const ha = await caches.open('ha-fixture');
                              await ha.put('/lovelace', new Response('HA fixture'));
                              const previous = navigator.serviceWorker.controller?.scriptURL;
                              if (!previous) throw Error('Missing initial Service Worker controller');
                              await new Promise(async (resolve, reject) => {
                                const timer = setTimeout(() => {
                                  navigator.serviceWorker.removeEventListener('controllerchange', check);
                                  reject(Error('Service Worker update timeout'));
                                }, 12000);
                                const check = () => {
                                  if (navigator.serviceWorker.controller?.scriptURL.includes(marker)) {
                                    clearTimeout(timer);
                                    navigator.serviceWorker.removeEventListener('controllerchange', check);
                                    resolve();
                                  }
                                };
                                navigator.serviceWorker.addEventListener('controllerchange', check);
                                try {
                                  await navigator.serviceWorker.register(
                                    '/artesaos-piloto/service-worker.js?v=' + marker,
                                    {scope:'/artesaos-piloto/',updateViaCache:'none'});
                                  check();
                                } catch (error) {
                                  clearTimeout(timer);
                                  navigator.serviceWorker.removeEventListener('controllerchange', check);
                                  reject(error);
                                }
                              });
                              const preserved = await (await caches.open('ha-fixture')).match('/lovelace');
                              if (!preserved || await preserved.text() !== 'HA fixture')
                                throw Error('External HA cache was not preserved');
                              return {previous, current:navigator.serviceWorker.controller.scriptURL};
                            }""", marker)
                            assert marker in update['current'], update
                            expect(page.locator('[name=responsible]')).to_have_value(draft)
                            expect(page.locator('[name=phone]')).to_have_value('11999990000')

                            # Reopen validates the updated worker and session without repeating B1 UX tests.
                            page.close()
                            page = context.new_page()
                            page.goto(base)
                            expect(page.get_by_role(
                                'heading', name='Que bom ter você aqui!', exact=True)).to_be_visible()
                            # On reopen, the application's bootstrap re-registers the
                            # Worker for its own served version. Compare the exact URL
                            # captured before the synthetic update, not just its filename.
                            page.wait_for_function("""expected =>
                              navigator.serviceWorker.controller?.scriptURL === expected""",
                              arg=update['previous'], timeout=12000)
                            reopened = page.evaluate("""async () => {
                              const cache = await caches.open('ha-fixture');
                              const response = await cache.match('/lovelace');
                              return {
                                controller: navigator.serviceWorker.controller?.scriptURL,
                                haCachePreserved: !!response &&
                                  await response.text() === 'HA fixture'
                              };
                            }""")
                            assert reopened['controller'] == update['previous'], reopened
                            assert reopened['haCachePreserved'], reopened
                            results.append({'viewport': width, 'manifest': 'ok',
                                            'workerUpdate': 'ok',
                                            'unsavedForm': 'preserved',
                                            'externalCache': 'preserved',
                                            'reopen': 'app-version-worker-restored',
                                            'reopenExternalCache': 'preserved'})
                            page = None
                        finally:
                            context.close()
                finally:
                    browser.close()
        except Exception:
            if page is not None:
                try:
                    page.screenshot(
                        path=str(evidence / 'pwa-failure.png'), full_page=True, timeout=5000,
                        mask=[page.locator('#invite,input[type=password]')]
                    )
                except Exception:
                    pass
            raise
        finally:
            (evidence / 'pwa-results.json').write_text(
                json.dumps(results, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8'
            )
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()

print(json.dumps({'result': 'PASS PWA-01', 'scenarios': results}, ensure_ascii=False))
