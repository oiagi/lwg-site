// ── Device detection ─────────────────────────────────────────────
//    Runs synchronously before first paint to set data-device on <html>.
//    Detects phone / tablet / desktop using screen size + pointer type
//    + user-agent so CSS can adapt per device class.
(function () {
  const ua = navigator.userAgent;
  const w = window.screen.width;
  const h = window.screen.height;
  const short = Math.min(w, h);

  // Pointer capability: "fine" = mouse, "coarse" = touch
  const hasCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hasHover = window.matchMedia('(hover: hover)').matches;

  // UA hints for phones and tablets
  const uaPhone = /iPhone|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua);
  const uaTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);

  let device;
  if (uaPhone || (hasCoarse && !hasHover && short < 600)) {
    device = 'mobile';
  } else if (uaTablet || (hasCoarse && !hasHover && short >= 600)) {
    device = 'tablet';
  } else {
    device = 'desktop';
  }

  document.documentElement.setAttribute('data-device', device);
  // Also flag touch so JS can guard hover-only interactions
  if (hasCoarse) {
    document.documentElement.setAttribute('data-touch', 'true');
  }
})();
