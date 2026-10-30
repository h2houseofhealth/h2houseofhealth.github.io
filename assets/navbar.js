/**
 * H2 House of Health - Unified Global Navbar Script
 * Handles active link state, mobile drawer, cart/wishlist badge counts,
 * cross-page action redirection, and global authentication detection.
 */

(function () {
  'use strict';

  function getInitials(name) {
    if (!name) return 'H2';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // --- 1. Active Link Detection ---
  function highlightActiveLink() {
    const path = window.location.pathname.toLowerCase();
    let currentNav = 'house';

    if (path.includes('about-us')) {
      currentNav = 'about';
    } else if (path.includes('by-the-house')) {
      currentNav = 'by';
    } else if (path.includes('with-the-house')) {
      currentNav = 'with';
    } else if (path.startsWith('/merch')) {
      currentNav = 'merch';
    } else if (path.startsWith('/booking')) {
      currentNav = 'booking';
    } else if (path.includes('contact')) {
      currentNav = 'contact';
    } else if (path === '/' || path.endsWith('/index.html') || path === '') {
      currentNav = 'house';
    }

    // Apply to desktop and drawer links
    const links = document.querySelectorAll('.h2-navbar__link, .h2-navbar__drawer-link');
    links.forEach((link) => {
      const navTarget = link.getAttribute('data-nav');
      if (navTarget === currentNav) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      }
    });
  }

  // --- 2. Live Badge Synchronization ---
  function updateBadges() {
    // 1. Cart Count
    let cartCount = 0;
    try {
      const guestCart = JSON.parse(localStorage.getItem('merch_cart_guest') || '[]');
      if (Array.isArray(guestCart)) {
        cartCount += guestCart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
      }
      if (cartCount === 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('merch_cart_user_')) {
            const userCart = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(userCart)) {
              cartCount += userCart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
              break;
            }
          }
        }
      }
    } catch {}

    const cartBadges = document.querySelectorAll('#cartBadge, .h2-navbar__badge--cart');
    cartBadges.forEach((badge) => {
      badge.textContent = cartCount;
      if (cartCount > 0) {
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', '');
      }
    });

    // 2. Wishlist Count
    let wishlistCount = 0;
    try {
      const guestWishlist = JSON.parse(localStorage.getItem('merch_wishlist_guest') || '[]');
      if (Array.isArray(guestWishlist)) {
        wishlistCount = guestWishlist.length;
      }
    } catch {}

    const wishlistBadges = document.querySelectorAll('#wishlistBadge, .h2-navbar__badge--wishlist');
    wishlistBadges.forEach((badge) => {
      badge.textContent = wishlistCount;
      if (wishlistCount > 0) {
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', '');
      }
    });
  }

  // --- 3. Drawer Toggle Actions ---
  function bindDrawer() {
    const toggleBtn = document.getElementById('h2NavDrawerToggle');
    const closeBtn = document.getElementById('h2NavDrawerClose');
    const drawer = document.getElementById('h2NavDrawer');
    const backdrop = document.getElementById('h2NavDrawerBackdrop');

    if (!drawer) return;

    function openDrawer() {
      drawer.classList.add('is-open');
      backdrop?.classList.add('is-open');
      toggleBtn?.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
      toggleBtn?.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    toggleBtn?.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });
  }

  // --- 4. Cross-Page Action Interceptors ---
  function bindActions() {
    const isMerchPage = window.location.pathname.startsWith('/merch');

    // Search Action
    document.querySelectorAll('#searchToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (isMerchPage) {
          if (typeof window.openSearch === 'function') {
            e.preventDefault();
            window.openSearch();
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/?search=1';
        }
      });
    });

    // Cart Action
    document.querySelectorAll('#cartToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (isMerchPage) {
          if (typeof window.openCart === 'function') {
            e.preventDefault();
            window.openCart();
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/?cart=1';
        }
      });
    });

    // Wishlist Action
    document.querySelectorAll('#wishlistToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (isMerchPage) {
          if (typeof window.openAccountDrawer === 'function') {
            e.preventDefault();
            window.openAccountDrawer('account-wishlist');
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/?wishlist=1';
        }
      });
    });
  }

  // --- 5. Merch Deep Link Trigger ---
  function handleMerchDeepLinks() {
    if (!window.location.pathname.startsWith('/merch')) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('cart') === '1') {
      setTimeout(() => {
        if (typeof window.openCart === 'function') window.openCart();
      }, 350);
    } else if (params.get('search') === '1') {
      setTimeout(() => {
        if (typeof window.openSearch === 'function') window.openSearch();
      }, 350);
    } else if (params.get('wishlist') === '1') {
      setTimeout(() => {
        if (typeof window.openAccountDrawer === 'function') window.openAccountDrawer('account-wishlist');
      }, 350);
    }
  }

  // --- 6. Global Auth State Detection ---
  async function checkAuth() {

    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const user = data?.user;
      if (!user) return;

      const authBtns = document.querySelectorAll('#h2AuthBtn, .h2-navbar__btn--outline');
      authBtns.forEach((btn) => {
        const displayName = (user.name || user.email || 'My Account').split(' ')[0];
        const initials = getInitials(displayName);
        btn.innerHTML = `<span class="h2-navbar__avatar">${initials}</span> <span>${displayName}</span>`;
        btn.classList.remove('h2-navbar__btn--outline');
        btn.classList.add('h2-navbar__btn--profile');
        btn.setAttribute('href', '/booking/');
        btn.setAttribute('aria-label', `Account of ${displayName}`);
      });
    } catch {}
  }

  // --- Initialization ---
  function init() {
    highlightActiveLink();
    updateBadges();
    bindDrawer();
    bindActions();
    handleMerchDeepLinks();
    checkAuth();

    window.addEventListener('storage', updateBadges);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
