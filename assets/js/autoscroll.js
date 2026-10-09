// Cifra Fox — Smooth Auto-Scroll Engine
(function (global) {
  'use strict';

  let isScrolling = false;
  let scrollSpeed = 1;
  let scrollAnimationFrame = null;
  let lastScrollTimestamp = null;

  function toggleAutoScroll() {
    isScrolling = !isScrolling;
    const btn = document.getElementById('btnAutoScroll');
    const status = document.getElementById('scrollStatus');

    if (isScrolling) {
      if (btn) {
        btn.innerText = '⏸';
        btn.style.background = '#22c55e';
      }
      if (status) status.innerText = 'Rolando...';
      startScrolling();
    } else {
      if (btn) {
        btn.innerText = '▶';
        btn.style.background = 'var(--primary)';
      }
      if (status) status.innerText = 'Auto-Rolagem';
      stopScrolling();
    }
  }

  function startScrolling() {
    stopScrolling();
    const basePixelsPerSecond = 26; // 1x = 26px/s, 2x = 52px/s, 3x = 78px/s
    lastScrollTimestamp = null;

    const tick = (timestamp) => {
      if (!isScrolling) return;

      if (lastScrollTimestamp === null) {
        lastScrollTimestamp = timestamp;
        scrollAnimationFrame = requestAnimationFrame(tick);
        return;
      }

      const elapsed = timestamp - lastScrollTimestamp;
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
      if (currentScrollTop >= maxScroll - 2) {
        isScrolling = false;
        stopScrolling();
        const btn = document.getElementById('btnAutoScroll');
        const status = document.getElementById('scrollStatus');
        if (btn) {
          btn.innerText = '▶';
          btn.style.background = 'var(--primary)';
        }
        if (status) status.innerText = 'Auto-Rolagem';
        return;
      }

      // Delta calculation based on elapsed time for high-refresh-rate display smoothness
      const delta = (basePixelsPerSecond * scrollSpeed * elapsed) / 1000;
      const nextScrollTop = Math.min(currentScrollTop + delta, maxScroll);

      window.scrollTo(0, nextScrollTop);
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
  }

  function changeScrollSpeed(button) {
    const speeds = [1, 2, 3];
    let nextIdx = (speeds.indexOf(scrollSpeed) + 1) % speeds.length;
    scrollSpeed = speeds[nextIdx];
    if (button) button.innerText = scrollSpeed + 'x';
    // If running, it continues seamlessly at the new speed on next frame
  }

  function resetAutoScroll() {
    if (isScrolling) {
      toggleAutoScroll();
    }
    stopScrolling();
  }

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
