/* ==========================================================================
   H2 UNIVERSAL NAVBAR JAVASCRIPT
   Handles mobile menu drawer, active navigation state, and live cart counter
   ========================================================================== */

(function () {
  function initNavbar() {
    initActiveNavLinks();
    initMobileNavDrawer();
    initCartCounterSync();
  }

  // Highlight active link and handle smooth scrolling for anchor links
  function initActiveNavLinks() {
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach((link) => {
      const linkHref = link.getAttribute('href');
      if (!linkHref) return;

      if (linkHref.startsWith('#')) {
        link.addEventListener('click', (e) => {
          const targetId = linkHref.substring(1);
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    });

    // Handle Shop Now CTA button on Home Page
    const ryanBtn = document.getElementById('headerRyanBtn');
    if (ryanBtn) {
      ryanBtn.addEventListener('click', (e) => {
        const collectionSec = document.getElementById('collection');
        if (collectionSec) {
          e.preventDefault();
          collectionSec.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  // Accessible Mobile Menu Drawer
  function initMobileNavDrawer() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const closeBtn = document.getElementById('mobileNavClose');

    if (!toggleBtn || !drawer) return;

    function openDrawer() {
      drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openMenu') === 'true' || urlParams.get('openMenu') === '1') {
      setTimeout(openDrawer, 100);
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDrawer();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });

    // Close when clicking any link inside drawer
    const mobileLinks = drawer.querySelectorAll('a');
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });
  }

  // Sync Cart Counter from localStorage across all pages
  function initCartCounterSync() {
    function updateCount() {
      let count = 0;
      try {
        const raw = localStorage.getItem('merch_cart') || localStorage.getItem('h2_cart');
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            count = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
          }
        }
      } catch (e) {
        count = 0;
      }

      const badges = document.querySelectorAll('.cart-badge');
      badges.forEach((badge) => {
        badge.textContent = String(count);
      });
    }

    updateCount();
    window.addEventListener('storage', updateCount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();
