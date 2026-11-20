"""Browser-level Receipt Builder smoke and persistence QA. Requires Playwright + Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5173/#systems/receipt-builder'
SCREENSHOT = Path('qa-artifacts/receipt-builder-live.png')

def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print('PASS:', message)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                        args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1550, 'height': 1050}, device_scale_factor=1)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until='networkidle', timeout=30000)
    page.get_by_role('heading', name='Receipt Builder', exact=True).wait_for(timeout=15000)
    page.locator('.receipt-builder-canvas-scroll .receipt-layout-block').first.wait_for()
    check(page.locator('.receipt-builder-palette-item').count()==12, 'all 12 palette elements visible')
    check(page.locator('.receipt-layout-block').count()==13, 'standard template loaded')
    check(page.locator('.receipt-paper-58mm').count()==1, '58 mm is the initial preview format')

    page.get_by_role('button', name='Custom Text', exact=False).click()
    check(page.locator('.receipt-layout-block').count()==14, 'click adds a custom block')
    page.locator('.receipt-builder-settings textarea').fill('Thank you for visiting Mirko Resort')
    check('Thank you for visiting Mirko Resort' in page.locator('.receipt-builder-canvas-scroll').inner_text(), 'editor text appears live')
    page.get_by_role('button', name='Undo', exact=True).click()
    check('Thank you for visiting Mirko Resort' not in page.locator('.receipt-builder-canvas-scroll').inner_text(), 'undo reverses text change')
    page.get_by_role('button', name='Redo', exact=True).click()
    check('Thank you for visiting Mirko Resort' in page.locator('.receipt-builder-canvas-scroll').inner_text(), 'redo restores text')

    page.get_by_role('button', name='Move element up').click()
    check(page.locator('.receipt-layout-block').nth(12).get_attribute('data-receipt-block-id') ==
          page.locator('.receipt-block-custom-text').get_attribute('data-receipt-block-id'), 'accessible move up reorders blocks')
    page.locator('.receipt-builder-panel-title select').select_option('80mm')
    check(page.locator('.receipt-paper-80mm').count()==1, '80 mm canvas format works')
    page.get_by_role('button', name='Save Changes').click()
    page.get_by_text('Receipt layout saved').wait_for(timeout=10000)
    check(not page.get_by_role('button', name='Save Changes').is_enabled(), 'save clears dirty state')

    page.reload(wait_until='networkidle')
    page.locator('.receipt-block-custom-text').wait_for(timeout=10000)
    check('Thank you for visiting Mirko Resort' in page.locator('.receipt-builder-canvas-scroll').inner_text(), 'saved layout survives reload')

    page.locator('.receipt-block-grand-total').click()
    check(page.get_by_text('Required element').count()==1, 'financial total is marked protected')
    check(page.locator('.receipt-builder-remove').count()==0, 'protected financial element cannot be removed')
    page.locator('.receipt-block-custom-text').click()
    page.locator('.receipt-builder-remove').click()
    check(page.locator('.receipt-block-custom-text').count()==0, 'optional block can be removed')
    page.get_by_role('button', name='Reset to Standard').click()
    page.get_by_role('alertdialog').get_by_role('button', name='Cancel').click()
    check(page.locator('.receipt-layout-block').count()==13, 'cancel reset preserves the current draft')

    # Restore the previously saved layout for the next assertion.
    page.get_by_role('button', name='Undo', exact=True).click()
    check(page.locator('.receipt-block-custom-text').count()==1, 'undo restores a removed block')
    page.get_by_role('button', name='Reset to Standard').click()
    page.get_by_role('alertdialog').get_by_role('button', name='Reset to Standard').click()
    check(page.locator('.receipt-layout-block').count()==13, 'reset prepares standard draft')
    page.get_by_role('button', name='Undo', exact=True).click()
    check(page.locator('.receipt-block-custom-text').count()==1, 'reset participates in undo history')

    # Receipt Settings uses the saved Builder layout, not unsaved reset edits.
    page.goto('http://127.0.0.1:5173/#systems/receipt-settings', wait_until='networkidle')
    page.get_by_role('heading', name='Receipt Settings', exact=True).wait_for()
    check(page.locator('.receipt-preview-scroll .receipt-block-custom-text').count()==1,
          'Receipt Settings preview uses saved Builder template')

    page.goto(BASE, wait_until='networkidle')
    SCREENSHOT.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    check(not errors, 'no unhandled browser exceptions')
    print('Screenshot:',SCREENSHOT)
    browser.close()
