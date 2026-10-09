// Cifra Fox — Smooth Auto-Scroll Engine
(function (global) {
  'use strict';

  let isScrolling = false;
  let scrollSpeed = 1;
  let scrollAnimationFrame = null;
  let lastScrollTimestamp = null;
  let pendingPixels = 0;

  function updateControls() {
    const btn = document.getElementById('btnAutoScroll');
    const status = document.getElementById('scrollStatus');
    if (btn) {
      btn.innerText = isScrolling ? '⏸' : '▶';
      btn.style.background = isScrolling ? '#22c55e' : 'var(--primary)';
      btn.title = isScrolling ? 'Pausar Auto-Rolagem' : 'Iniciar Auto-Rolagem';
      btn.setAttribute('aria-pressed', String(isScrolling));
      btn.setAttribute('aria-label', btn.title);
    }
    if (status) status.innerText = isScrolling ? 'Rolando...' : 'Auto-Rolagem';
  }

  function toggleAutoScroll() {
    isScrolling = !isScrolling;
    updateControls();
    if (isScrolling) startScrolling();
    else stopScrolling();
  }

  function startScrolling() {
    stopScrolling();
    const basePixelsPerSecond = 18;
    lastScrollTimestamp = null;

    const tick = (timestamp) => {
      if (!isScrolling) return;

      if (lastScrollTimestamp === null) {
        lastScrollTimestamp = timestamp;
        scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      // Never catch up a long suspended frame by jumping through the song.
      const elapsed = Math.max(0, Math.min(100, timestamp - lastScrollTimestamp));
      lastScrollTimestamp = timestamp;

      // Cross-platform scroll metrics (Desktop, Android, Safari/iOS)
      const currentScrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      const clientHeight = window.innerHeight || document.documentElement.clientHeight || 1;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);

      // Reached bottom
      if (currentScrollTop >= maxScroll - 0.5) {
        isScrolling = false;
        stopScrolling();
        updateControls();
        return;
      }

      // Delta calculation based on elapsed time for high-refresh-rate display smoothness
      // Browsers may quantize scroll offsets to whole pixels. Preserve the
      // fractional remainder instead of losing it on every animation frame.
      pendingPixels += (basePixelsPerSecond * scrollSpeed * elapsed) / 1000;
      const step = Math.floor(pendingPixels);
      if (step > 0) {
        pendingPixels -= step;
        window.scrollTo({ left: window.scrollX || 0, top: Math.min(currentScrollTop + step, maxScroll), behavior: 'instant' });
      }
      scrollAnimationFrame = requestAnimationFrame(tick);
    };

    scrollAnimationFrame = requestAnimationFrame(tick);
  }

  function stopScrolling() {
    if (scrollAnimationFrame !== null) {
      cancelAnimationFrame(scrollAnimationFrame);
      scrollAnimationFrame = null;
    }
    lastScrollTimestamp = null;
    pendingPixels = 0;
  }

  function changeScrollSpeed(button) {
    const speeds = [0.5, 1, 1.5, 2, 3];
    let nextIdx = (speeds.indexOf(scrollSpeed) + 1) % speeds.length;
    scrollSpeed = speeds[nextIdx];
    if (button) {
      button.innerText = scrollSpeed + 'x';
      button.setAttribute?.('aria-label', `Velocidade ${scrollSpeed}x. Toque para mudar.`);
    }
    // If running, it continues seamlessly at the new speed on next frame
  }

  function resetAutoScroll() {
    if (isScrolling) {
      toggleAutoScroll();
    }
    stopScrolling();
  }

  function pauseForInteraction(event) {
    if (isScrolling && !event.target?.closest?.('.autoscroll-bar')) resetAutoScroll();
  }
  document.addEventListener('touchstart', pauseForInteraction, { passive: true });
  document.addEventListener('pointerdown', pauseForInteraction, { passive: true });
  document.addEventListener('wheel', pauseForInteraction, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetAutoScroll();
  });

  // Global exposure
  global.toggleAutoScroll = toggleAutoScroll;
  global.startScrolling = startScrolling;
  global.stopScrolling = stopScrolling;
  global.changeScrollSpeed = changeScrollSpeed;
  global.resetAutoScroll = resetAutoScroll;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      toggleAutoScroll,
      startScrolling,
      stopScrolling,
      changeScrollSpeed,
      resetAutoScroll
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
