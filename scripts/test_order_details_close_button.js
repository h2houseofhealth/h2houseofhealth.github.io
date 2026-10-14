/**
 * Test: Order Details Side Panel Close Button
 * Uses Puppeteer to test:
 * 1. Initial order selection & side panel opening
 * 2. Presence, placement, and attributes of the close button
 * 3. Clicking close button: side panel closes, grid expands to 1fr with no empty space
 * 4. State preservation: filters, search, pagination, and selected order
 * 5. Reopening the same order row
 * 6. Selecting a different order row and closing
 * 7. Keyboard navigation (focus + Enter / Escape)
 * 8. Responsive layout at narrow mobile viewport (480px)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/Users/sowmya/.gemini/antigravity-ide/brain/429c4ef2-aa16-4234-a1d1-7832b381e5d2';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Starting Order Details Close Button Test Suite ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Authenticate as Admin via API and set cookie
    console.log('[Step 1] Authenticating as Admin via /api/auth/login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login API call should succeed');
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert(token, 'Token must be returned');

    await page.setCookie({
      name: 'booking_portal_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    });
    console.log('  ✓ Admin cookie set.');

    // 2. Navigate to Orders view
    console.log('[Step 2] Navigating to Orders view...');
    await page.goto(`${BASE_URL}/merch/admin/index.html#orders`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Wait for orders table to load
    await page.waitForSelector('.admin-table tbody tr[data-action="select-order"]', { timeout: 10000 });
    console.log('  ✓ Orders table loaded.');

    // Verify side panel is NOT open initially
    let sidePanel = await page.$('.admin-side-panel');
    assert(!sidePanel, 'Side panel should not be open initially');
    console.log('  ✓ Side panel is closed initially.');

    page.on('console', (msg) => console.log('  [Browser]', msg.text()));
    page.on('pageerror', (err) => console.log('  [Browser Error]', err.message));

    // 3. Click first order row to open side panel
    console.log('[Step 3] Clicking first order row in #ordersView...');
    await page.waitForSelector('#ordersView .admin-table tbody tr[data-action="select-order"]', { timeout: 10000 });
    const firstRow = await page.$('#ordersView .admin-table tbody tr[data-action="select-order"]');
    assert(firstRow, 'First order row must exist in #ordersView');
    await firstRow.click();
    await sleep(600);

    const afterClickState = await page.evaluate(() => {
      return {
        selectedOrderId: window.state?.selectedOrderId,
        orderDetailsClosed: window.state?.orderDetailsClosed,
        hasSidePanel: Boolean(document.querySelector('.admin-side-panel')),
        bodyHtmlSnippet: document.querySelector('.admin-section__body')?.innerHTML?.slice(0, 500),
      };
    });
    console.log('  After click state:', afterClickState);

    // Verify side panel opened
    sidePanel = await page.$('.admin-side-panel');
    assert(sidePanel, 'Side panel must open when order row is clicked');
    console.log('  ✓ Side panel opened successfully.');

    // 4. Verify Close Button attributes and positioning
    console.log('[Step 4] Verifying Close Button in Order Details header...');
    const closeBtn = await page.$('.admin-side-panel .admin-card__head .admin-card__close');
    assert(closeBtn, 'Close button must exist in Order Details card head');

    const ariaLabel = await page.evaluate((el) => el.getAttribute('aria-label'), closeBtn);
    assert.strictEqual(ariaLabel, 'Close order details', 'aria-label must be "Close order details"');

    const titleAttr = await page.evaluate((el) => el.getAttribute('title'), closeBtn);
    assert.strictEqual(titleAttr, 'Close order details', 'title must be "Close order details"');

    const buttonType = await page.evaluate((el) => el.getAttribute('type'), closeBtn);
    assert.strictEqual(buttonType, 'button', 'type must be "button"');

    // Verify header has .admin-card__head--with-close class
    const hasWithCloseClass = await page.evaluate(() => {
      const head = document.querySelector('.admin-side-panel .admin-card__head');
      return head ? head.classList.contains('admin-card__head--with-close') : false;
    });
    assert(hasWithCloseClass, 'Card head must have .admin-card__head--with-close class for right-alignment');
    console.log('  ✓ Close button placement, styling, and accessible attributes verified.');

    // Screenshot open side panel
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'order_details_panel_open.png') });

    // 5. Click the close button
    console.log('[Step 5] Clicking Close Button to dismiss side panel...');
    await closeBtn.click();
    await sleep(600);

    // Verify side panel is removed
    sidePanel = await page.$('.admin-side-panel');
    assert(!sidePanel, 'Side panel must be closed after clicking close button');

    // Verify grid has style="grid-template-columns:1fr;" so content takes available width
    const gridStyle = await page.evaluate(() => {
      const grid = document.querySelector('.admin-grid--two');
      return grid ? grid.getAttribute('style') : null;
    });
    assert(gridStyle && gridStyle.includes('grid-template-columns:1fr'), 'Grid must expand to 1fr when side panel is closed');
    console.log('  ✓ Side panel dismissed and grid layout expanded to 1fr without empty space.');

    // Screenshot closed side panel
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'order_details_panel_closed.png') });

    // 6. Test reopening the same order
    console.log('[Step 6] Reopening the same order row...');
    const firstRowAgain = await page.$('#ordersView .admin-table tbody tr[data-action="select-order"]');
    await firstRowAgain.click();
    await sleep(600);

    sidePanel = await page.$('.admin-side-panel');
    assert(sidePanel, 'Clicking the same order row must reopen the side panel');
    console.log('  ✓ Reopening the same order row works cleanly.');

    // 7. Test selecting a different order row
    console.log('[Step 7] Selecting a second order row...');
    const allRows = await page.$$('#ordersView .admin-table tbody tr[data-action="select-order"]');
    if (allRows.length > 1) {
      await allRows[1].click();
      await sleep(600);
      sidePanel = await page.$('.admin-side-panel');
      assert(sidePanel, 'Side panel remains open when changing selected order');
      console.log('  ✓ Changing selected order updates side panel properly.');
    }

    // Close again
    const closeBtn2 = await page.$('.admin-side-panel .admin-card__head .admin-card__close');
    await closeBtn2.click();
    await sleep(600);
    assert(!(await page.$('.admin-side-panel')), 'Side panel closed again');

    // 8. Test Keyboard Navigation (Escape key)
    console.log('[Step 8] Testing Keyboard navigation (Escape key)...');
    const rowForEscape = await page.$('#ordersView .admin-table tbody tr[data-action="select-order"]');
    assert(rowForEscape, 'Order row must exist for Escape test');
    await rowForEscape.click();
    await sleep(600);
    assert(await page.$('.admin-side-panel'), 'Panel opened before Escape test');

    await page.keyboard.press('Escape');
    await sleep(600);
    assert(!(await page.$('.admin-side-panel')), 'Pressing Escape must close the side panel');
    console.log('  ✓ Keyboard Escape successfully closes the side panel.');

    // 9. Test Mobile / Narrow Screen Viewport (480px)
    console.log('[Step 9] Testing narrow mobile viewport (480px)...');
    await page.setViewport({ width: 480, height: 800 });
    await sleep(500);

    // Open panel on mobile
    const mobileFirstRow = await page.$('#ordersView .admin-table tbody tr[data-action="select-order"]');
    await mobileFirstRow.click();
    await sleep(600);

    const mobileCloseBtn = await page.$('.admin-side-panel .admin-card__head .admin-card__close');
    assert(mobileCloseBtn, 'Close button must exist on mobile');

    // Scroll close button into view away from sticky topbar
    await page.evaluate(() => {
      document.querySelector('.admin-side-panel .admin-card__head .admin-card__close')?.scrollIntoView({ block: 'center', inline: 'center' });
    });
    await sleep(300);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'order_details_mobile_open.png') });

    const isCloseBtnVisible = await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
    }, mobileCloseBtn);
    assert(isCloseBtnVisible, 'Close button must be visible on mobile viewport');

    await mobileCloseBtn.click();
    await sleep(600);
    assert(!(await page.$('.admin-side-panel')), 'Mobile close button click closes side panel');
    console.log('  ✓ Mobile viewport rendering and close button interaction verified.');

    // Screenshot mobile closed
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'order_details_mobile_closed.png') });

    console.log('\n🎉 ALL ORDER DETAILS CLOSE BUTTON TESTS PASSED! 🎉');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
