/**
 * H2 House of Health - Unified Global Navbar Script
 * Handles active link state, mobile drawer, cart/wishlist badge counts,
 * cross-page action redirection, and global authentication detection.
 */

(function () {
  'use strict';

  function getInitials(name) {
    const raw = String(name || '').trim();
    if (!raw) return 'H2';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'H2';
    if (parts.length === 1) {
      return (parts[0].length >= 2 ? parts[0].substring(0, 2) : parts[0]).toUpperCase();
    }
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
    const isBookingPage = window.location.pathname.startsWith('/booking');
    let cartCount = 0;

    if (isBookingPage) {
      try {
        const guestBookingCart = JSON.parse(localStorage.getItem('h2_guest_cart') || '[]');
        if (Array.isArray(guestBookingCart)) {
          cartCount = guestBookingCart.filter((b) => {
            if (!b || typeof b !== 'object') return false;
            if (String(b.status || '').trim().toLowerCase() === 'cancelled') return false;
            return String(b.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid';
          }).length;
        }
      } catch {}
    } else {
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
    }

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
      // Close other drawers if open
      if (typeof window.closeCart === 'function') {
        window.closeCart();
      }
      if (typeof window.closeAccountDrawer === 'function') {
        window.closeAccountDrawer();
      }
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

    // Close drawer when any navigation link inside it is clicked
    drawer.querySelectorAll('.h2-navbar__drawer-link').forEach((link) => {
      link.addEventListener('click', closeDrawer);
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    // Close on window resize to desktop (>= 1400px)
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1400 && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    window.closeNavDrawer = closeDrawer;
  }

  // --- 4. Cross-Page Action Interceptors ---
  function bindActions() {
    const isMerchPage = window.location.pathname.startsWith('/merch');
    const isBookingPage = window.location.pathname.startsWith('/booking');

    // Search Action
    document.querySelectorAll('#searchToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
        if (isMerchPage) {
          if (typeof window.openSearch === 'function') {
            e.preventDefault();
            window.openSearch();
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/wellness-products/?search=1';
        }
      });
    });

    // Cart Action
    document.querySelectorAll('#cartToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
        if (isBookingPage) {
          e.preventDefault();
          if (typeof window.openBookingCart === 'function') {
            window.openBookingCart();
          } else {
            window.location.hash = '#cart';
          }
        } else if (isMerchPage) {
          if (typeof window.openCart === 'function') {
            e.preventDefault();
            window.openCart();
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/wellness-products/?cart=1';
        }
      });
    });

    // Wishlist Action
    document.querySelectorAll('#wishlistToggleBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
        if (isMerchPage) {
          if (typeof window.openAccountDrawer === 'function') {
            e.preventDefault();
            window.openAccountDrawer('account-wishlist');
          }
        } else {
          e.preventDefault();
          window.location.href = '/merch/wellness-products/?wishlist=1';
        }
      });
    });

    // Book Now Action
    document.querySelectorAll('#h2BookNowBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (isBookingPage) {
          e.preventDefault();
          if (typeof window.enterGuestBookingMode === 'function') {
            window.enterGuestBookingMode({ scrollToServices: true });
          } else {
            window.location.href = '/booking/?entry=guest';
          }
        }
      });
    });

    // Auth Action (Sign Up / Sign In)
    document.querySelectorAll('#h2AuthBtn, #h2DrawerAuthBtn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        if (btn.classList.contains('h2-navbar__btn--profile')) {
          if (isMerchPage) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
            if (typeof window.openAccountDrawer === 'function') {
              window.openAccountDrawer('account-profile');
            }
          } else if (isBookingPage) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
            if (typeof window.openProfileDialog === 'function') {
              window.openProfileDialog();
            }
          }
          return;
        }
        if (isBookingPage) {
          e.preventDefault();
          if (typeof window.openAuthFromLanding === 'function') {
            window.openAuthFromLanding();
          } else {
            window.location.href = '/booking/?auth=1';
          }
        } else if (isMerchPage) {
          e.preventDefault();
          window.location.href = '/merch/auth.html?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
        }
      });
    });
  }

  // --- 5. Merch & Booking Deep Link Trigger ---
  function handleDeepLinks() {
    const isMerch = window.location.pathname.startsWith('/merch');
    const isBooking = window.location.pathname.startsWith('/booking');
    const params = new URLSearchParams(window.location.search);

    if (isMerch) {
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
    } else if (isBooking) {
      if (params.get('cart') === '1') {
        setTimeout(() => {
          if (typeof window.openBookingCart === 'function') window.openBookingCart();
        }, 350);
      }
    }
  }

  // --- 6. Global Auth State Detection ---
  function resetAuthButtons() {
    document.body.classList.remove('is-logged-in');
    const isMerch = window.location.pathname.startsWith('/merch');
    const navbarBtn = document.getElementById('h2AuthBtn');
    if (navbarBtn) {
      navbarBtn.classList.remove('h2-navbar__btn--profile');
      navbarBtn.classList.add('h2-navbar__btn--outline');
      navbarBtn.innerHTML = 'Sign Up / Sign In';
      navbarBtn.setAttribute(
        'href',
        isMerch
          ? '/merch/auth.html?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)
          : '/booking/?auth=1'
      );
      navbarBtn.setAttribute('aria-label', 'Sign Up or Sign In');
      navbarBtn.onclick = null;
    }

    const drawerAuthBtn = document.getElementById('h2DrawerAuthBtn');
    if (drawerAuthBtn) {
      drawerAuthBtn.classList.remove('h2-navbar__btn--profile');
      drawerAuthBtn.innerHTML = 'Sign Up / Sign In';
      drawerAuthBtn.setAttribute(
        'href',
        isMerch
          ? '/merch/auth.html?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)
          : '/booking/?auth=1'
      );
      drawerAuthBtn.setAttribute('aria-label', 'Sign Up or Sign In');
      drawerAuthBtn.onclick = null;
      const drawerItem = drawerAuthBtn.closest('li');
      if (drawerItem) drawerItem.style.display = '';
    }

    const drawerDivider = document.querySelector('.h2-navbar__drawer-divider');
    if (drawerDivider) {
      drawerDivider.style.display = '';
    }
  }

  function setAuthButtonsUser(user) {
    if (!user) {
      resetAuthButtons();
      return;
    }
    document.body.classList.add('is-logged-in');
    const isMerch = window.location.pathname.startsWith('/merch');
    const isBooking = window.location.pathname.startsWith('/booking');

    // 1. Keep profile in navbar ONLY (mobile & desktop)
    const navbarBtn = document.getElementById('h2AuthBtn');
    if (navbarBtn) {
      const rawName = String(user.name || user.email || 'My Account').trim();
      const firstName = rawName.split(' ')[0];
      const displayName = firstName ? (firstName.charAt(0).toUpperCase() + firstName.slice(1)) : 'My Account';
      const initials = getInitials(rawName);
      const avatarUrl = user.avatarUrl ? String(user.avatarUrl).trim() : '';
      const avatarStyle = avatarUrl ? `style="background-image: url('${avatarUrl}'); background-size: cover; background-position: center; color: transparent;"` : '';
      navbarBtn.innerHTML = `<span class="h2-navbar__avatar" ${avatarStyle}>${initials}</span> <span>${displayName}</span>`;
      navbarBtn.classList.remove('h2-navbar__btn--outline');
      navbarBtn.classList.add('h2-navbar__btn--profile');
      if (isMerch) {
        navbarBtn.setAttribute('href', '#');
        navbarBtn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
          if (typeof window.openAccountDrawer === 'function') {
            window.openAccountDrawer('account-profile');
          }
        };
      } else if (isBooking) {
        navbarBtn.setAttribute('href', '#');
        navbarBtn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.closeNavDrawer === 'function') window.closeNavDrawer();
          if (typeof window.openProfileDialog === 'function') {
            window.openProfileDialog();
          }
        };
      } else {
        navbarBtn.setAttribute('href', '/booking/');
        navbarBtn.onclick = null;
      }
      navbarBtn.setAttribute('aria-label', `Account of ${displayName}`);
    }

    // 2. Hide from drawer — do not duplicate in hamburger drawer!
    const drawerAuthBtn = document.getElementById('h2DrawerAuthBtn');
    if (drawerAuthBtn) {
      drawerAuthBtn.classList.remove('h2-navbar__btn--profile');
      const drawerItem = drawerAuthBtn.closest('li');
      if (drawerItem) drawerItem.style.display = 'none';
    }
    const drawerDivider = document.querySelector('.h2-navbar__drawer-divider');
    if (drawerDivider) {
      drawerDivider.style.display = 'none';
    }
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        resetAuthButtons();
        return;
      }
      const data = await res.json();
      const user = data?.user;
      if (!user) {
        resetAuthButtons();
        return;
      }
      setAuthButtonsUser(user);
    } catch {
      resetAuthButtons();
    }
  }

  window.syncGlobalNavbarAuth = setAuthButtonsUser;
  window.refreshGlobalNavbarAuth = checkAuth;
  window.resetGlobalNavbarAuth = resetAuthButtons;

  // --- Initialization ---
  function init() {
    highlightActiveLink();
    updateBadges();
    bindDrawer();
    bindActions();
    handleDeepLinks();
    checkAuth();

    window.addEventListener('storage', updateBadges);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
