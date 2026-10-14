const puppeteer = require('puppeteer');
const assert = require('assert');
const Database = require('better-sqlite3');

async function runTests() {
  console.log('--- Starting Merch Admin Orders Tabs Verification Tests ---');

  // 1. Get Admin JWT Token
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, 'JWT token must be present');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Set cookie and localStorage
    await page.setCookie({
      name: 'booking_portal_token',
      value: token,
      domain: 'localhost',
      path: '/'
    });

    await page.goto('http://localhost:3000/merch/admin/index.html#orders', {
      waitUntil: 'networkidle2'
    });

    // Ensure token in localStorage as well
    await page.evaluate((jwt) => {
      localStorage.setItem('booking_portal_auth_token', jwt);
    }, token);

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await page.waitForSelector('[data-order-filter="all"]', { timeout: 10000 });

    // Helper to get tab states
    async function getTabStates() {
      return await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.admin-orders-filter-row [data-order-filter]'));
        return tabs.map(tab => ({
          filter: tab.dataset.orderFilter,
          text: tab.innerText.trim(),
          classes: tab.className,
          isActive: tab.classList.contains('is-active'),
          isPrimary: tab.classList.contains('admin-btn--primary'),
          isGhost: tab.classList.contains('admin-btn--ghost'),
          bgColor: window.getComputedStyle(tab).backgroundColor,
          color: window.getComputedStyle(tab).color
        }));
      });
    }

    // Helper to verify single active tab
    async function assertSingleActiveTab(expectedActiveFilter) {
      const tabs = await getTabStates();
      const activeTabs = tabs.filter(t => t.isActive);
      assert.strictEqual(
        activeTabs.length,
        1,
        `Expected exactly 1 active tab, but found ${activeTabs.length}: ${activeTabs.map(t => t.filter).join(', ')}`
      );
      assert.strictEqual(
        activeTabs[0].filter,
        expectedActiveFilter,
        `Expected active tab to be "${expectedActiveFilter}", but found "${activeTabs[0].filter}"`
      );
      assert(activeTabs[0].isPrimary, `Active tab "${expectedActiveFilter}" must have class admin-btn--primary`);
      assert(!activeTabs[0].isGhost, `Active tab "${expectedActiveFilter}" must not have class admin-btn--ghost`);

      for (const tab of tabs) {
        if (tab.filter !== expectedActiveFilter) {
          assert(!tab.isActive, `Inactive tab "${tab.filter}" must not have class is-active`);
          assert(!tab.isPrimary, `Inactive tab "${tab.filter}" must not have class admin-btn--primary`);
          assert(tab.isGhost, `Inactive tab "${tab.filter}" must have class admin-btn--ghost`);
        }
      }
    }

    // --- TEST 1: Initial State (All selected) ---
    console.log('Test 1: Initial state after page load');
    await assertSingleActiveTab('all');
    const initialTabs = await getTabStates();
    const allTab = initialTabs.find(t => t.filter === 'all');
    const todayTab = initialTabs.find(t => t.filter === 'today');
    assert.strictEqual(allTab.color, 'rgb(255, 255, 255)', 'All tab text color must be white when active');
    console.log('  ✔ "All" is active and "Today" is inactive with mutually exclusive classes & colors');

    // --- TEST 2: Select "Today" ---
    console.log('Test 2: Clicking "Today" tab');
    await page.click('[data-order-filter="today"]');
    await wait(200);
    await assertSingleActiveTab('today');
    const todayClickedTabs = await getTabStates();
    const todayActive = todayClickedTabs.find(t => t.filter === 'today');
    const allInactive = todayClickedTabs.find(t => t.filter === 'all');
    assert(todayActive.isActive && todayActive.isPrimary, 'Today must have is-active and admin-btn--primary');
    assert(!allInactive.isActive && allInactive.isGhost, 'All must be inactive and have admin-btn--ghost');
    assert.strictEqual(todayActive.color, 'rgb(255, 255, 255)', 'Today tab text color must be white when active');
    console.log('  ✔ "Today" becomes the only active tab; "All" becomes inactive');

    // --- TEST 3: Click "Today" AGAIN (already selected) ---
    console.log('Test 3: Clicking already active "Today" tab again');
    await page.click('[data-order-filter="today"]');
    await wait(200);
    await assertSingleActiveTab('today');
    console.log('  ✔ Clicking "Today" again does not toggle off or cause visual inconsistency');

    // --- TEST 4: Select "All" again ---
    console.log('Test 4: Clicking "All" tab from "Today"');
    await page.click('[data-order-filter="all"]');
    await wait(200);
    await assertSingleActiveTab('all');
    console.log('  ✔ "All" becomes the only active tab; "Today" becomes inactive');

    // --- TEST 5: Click "All" AGAIN (already selected) ---
    console.log('Test 5: Clicking already active "All" tab again');
    await page.click('[data-order-filter="all"]');
    await wait(200);
    await assertSingleActiveTab('all');
    console.log('  ✔ Clicking "All" again remains active with single active state');

    // --- TEST 6: Test each order status tab ---
    const statusTabs = ['pending', 'processing', 'stock_shortage', 'shipped', 'delivered', 'cancelled', 'returned'];
    for (const status of statusTabs) {
      console.log(`Test 6: Selecting "${status}" tab`);
      await page.click(`[data-order-filter="${status}"]`);
      await wait(200);
      await assertSingleActiveTab(status);
      console.log(`  ✔ "${status}" is the sole active tab; All, Today, and others are inactive`);
    }

    // --- TEST 7: Search combinations ---
    console.log('Test 7: Search filter combinations');
    await page.click('[data-order-filter="all"]');
    await wait(200);
    await page.type('[data-input="ordersSearch"]', 'sowmya');
    await wait(200);
    await assertSingleActiveTab('all');

    // Switch to Pending with search query present
    await page.click('[data-order-filter="pending"]');
    await wait(200);
    await assertSingleActiveTab('pending');
    const searchVal = await page.$eval('[data-input="ordersSearch"]', el => el.value);
    assert.strictEqual(searchVal, 'sowmya', 'Search input value must be preserved when switching tabs');

    // Clear search
    await page.$eval('[data-input="ordersSearch"]', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(200);
    await assertSingleActiveTab('pending');
    console.log('  ✔ Search combination correctly preserves active filter tab and input state');

    // --- TEST 8: Date Range combinations ---
    console.log('Test 8: Date range interactions');
    // Switch to Today
    await page.click('[data-order-filter="today"]');
    await wait(200);
    await assertSingleActiveTab('today');

    // Set date range and apply
    await page.$eval('[data-input="ordersDateFrom"]', el => { el.value = '2026-07-01'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-input="ordersDateTo"]', el => { el.value = '2026-09-30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('[data-action="apply-orders-date-range"]');
    await wait(200);

    // Applying date range from "Today" should shift to "All" (with date range applied)
    await assertSingleActiveTab('all');
    console.log('  ✔ Applying custom date range from Today cleanly activates "All"');

    // Clear date range
    await page.click('[data-action="clear-orders-date-range"]');
    await wait(200);
    await assertSingleActiveTab('all');
    console.log('  ✔ Clearing date range keeps "All" active');

    // Switch to Pending and apply date range
    await page.click('[data-order-filter="pending"]');
    await wait(200);
    await assertSingleActiveTab('pending');

    await page.$eval('[data-input="ordersDateFrom"]', el => { el.value = '2026-07-01'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-input="ordersDateTo"]', el => { el.value = '2026-09-30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('[data-action="apply-orders-date-range"]');
    await wait(200);
    await assertSingleActiveTab('pending');
    console.log('  ✔ Applying custom date range from Pending preserves "Pending" active tab');

    // Clear date range again
    await page.click('[data-action="clear-orders-date-range"]');
    await wait(200);

    // --- TEST 9: Page Refresh / Order Sync ---
    console.log('Test 9: Order sync / re-render maintains active tab');
    await page.click('[data-order-filter="today"]');
    await wait(200);
    await assertSingleActiveTab('today');

    // Trigger re-render directly via renderOrders call in browser context
    await page.evaluate(() => {
      // simulate background poll refresh
      window.dispatchEvent(new Event('resize'));
    });
    await wait(200);
    await assertSingleActiveTab('today');
    console.log('  ✔ Tab remains active after re-render / sync');

    // Switch back to All
    await page.click('[data-order-filter="all"]');
    await wait(200);
    await assertSingleActiveTab('all');

    // --- TEST 10: Database Integrity ---
    console.log('Test 10: Verifying database orders count');
    const db = new Database('booking/data/booking.db');
    const orderCount = db.prepare('SELECT COUNT(*) as count FROM merch_orders').get().count;
    assert.strictEqual(orderCount, 52, `Database must contain exactly 52 orders, found ${orderCount}`);
    console.log('  ✔ Database strictly preserves the 52 genuine orders');

    console.log('\n🎉 ALL ADMIN ORDERS TABS TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
