// ==========================================
// XELA TORTILLERÍA — JAVASCRIPT PÚBLICO
// ==========================================

// ---- Navbar scroll + mobile toggle ----
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.15)';
  } else {
    navbar.style.boxShadow = '0 1px 10px rgba(0,0,0,0.1)';
  }
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close menu when a link is clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});

// ---- Active nav link on scroll ----
const sections = document.querySelectorAll('section[id]');
const allNavLinks = document.querySelectorAll('.nav-links a');

const observerOpts = { rootMargin: '-50% 0px -50% 0px' };
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      allNavLinks.forEach(link => {
        link.style.background = '';
        link.style.color = '';
        if (link.getAttribute('href') === `#${id}`) {
          link.style.background = 'var(--color-bg-alt)';
          link.style.color = 'var(--color-primary)';
        }
      });
    }
  });
}, observerOpts);

sections.forEach(s => sectionObserver.observe(s));

// ---- Scroll reveal animation ----
const revealOpts = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, revealOpts);

document.querySelectorAll('.producto-card, .info-card, .nota, .stat').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});

// ---- Productos horizontal scroll ----
const CARDS_TO_SCROLL = 3;

function scrollProductos(direction) {
  const grid = document.querySelector('.productos-grid');
  if (!grid) return;
  const firstCard = grid.querySelector('.producto-card');
  if (!firstCard) return;
  const cardWidth = firstCard.offsetWidth + 24; // 24 = gap
  grid.scrollBy({ left: direction * cardWidth * CARDS_TO_SCROLL, behavior: 'smooth' });
}

(function initProductosIndicator() {
  const grid = document.querySelector('.productos-grid');
  const indicator = document.getElementById('productosIndicator');
  if (!grid || !indicator) return;

  const firstCard = grid.querySelector('.producto-card');
  if (!firstCard) return;

  const totalCards = grid.querySelectorAll('.producto-card').length;
  const visibleCount = () => Math.round(grid.offsetWidth / (firstCard.offsetWidth + 24));
  const dotCount = () => totalCards - visibleCount() + 1;

  function buildDots() {
    indicator.innerHTML = '';
    const n = dotCount();
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      indicator.appendChild(dot);
    }
  }

  function updateDots() {
    const dots = indicator.querySelectorAll('.dot');
    if (!dots.length) return;
    const cardW = firstCard.offsetWidth + 24;
    const idx = Math.round(grid.scrollLeft / cardW);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { buildDots(); updateDots(); }, 150);
  }

  buildDots();
  grid.addEventListener('scroll', updateDots, { passive: true });
  window.addEventListener('resize', onResize);
})();
