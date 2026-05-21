window.NT = window.NT || {};

(function () {
  const { TOOLTIP_SHOW_DELAY_MS, TOOLTIP_HIDE_DELAY_MS } = NT.constants;

  let tooltipEl = null;
  let showTimer = null;
  let hideTimer = null;
  let currentTarget = null;
  let entityBySlug = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = "nt-tooltip";
    tooltipEl.hidden = true;
    const full = document.createElement("div");
    full.className = "nt-full";
    const first = document.createElement("div");
    first.className = "nt-first";
    tooltipEl.appendChild(full);
    tooltipEl.appendChild(first);
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(targetRect) {
    const el = tooltipEl;
    el.hidden = false;
    el.style.visibility = "hidden";
    el.style.left = "0px";
    el.style.top = "0px";
    const rect = el.getBoundingClientRect();
    const margin = 8;

    let left = targetRect.left + targetRect.width / 2 - rect.width / 2;
    let top = targetRect.top - rect.height - margin;

    if (top < 4) {
      top = targetRect.bottom + margin;
    }
    const maxLeft = window.innerWidth - rect.width - 4;
    if (left < 4) left = 4;
    if (left > maxLeft) left = Math.max(4, maxLeft);

    el.style.left = `${Math.round(left + window.scrollX)}px`;
    el.style.top = `${Math.round(top + window.scrollY)}px`;
    el.style.visibility = "visible";
  }

  function showFor(target) {
    const slug = target.dataset.entity;
    const ent = entityBySlug.get(slug);
    if (!ent) return;
    ensureTooltip();
    tooltipEl.querySelector(".nt-full").textContent = ent.canonical;
    const firstEl = tooltipEl.querySelector(".nt-first");
    if (ent.firstSentence) {
      firstEl.textContent = ent.firstSentence;
      firstEl.style.display = "";
    } else {
      firstEl.textContent = "";
      firstEl.style.display = "none";
    }
    positionTooltip(target.getBoundingClientRect());
  }

  function hide() {
    if (tooltipEl) tooltipEl.hidden = true;
    currentTarget = null;
  }

  function onMouseOver(e) {
    const t = e.target.closest && e.target.closest(".nt-name");
    if (!t) return;
    if (t === currentTarget) return;
    currentTarget = t;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(() => showFor(t), TOOLTIP_SHOW_DELAY_MS);
  }

  function onMouseOut(e) {
    const t = e.target.closest && e.target.closest(".nt-name");
    if (!t) return;
    const related =
      e.relatedTarget &&
      e.relatedTarget.closest &&
      e.relatedTarget.closest(".nt-name");
    if (related === t) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, TOOLTIP_HIDE_DELAY_MS);
  }

  function install(root, entityMap) {
    entityBySlug = entityMap;
    ensureTooltip();
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener(
      "scroll",
      () => {
        if (currentTarget && tooltipEl && !tooltipEl.hidden) {
          positionTooltip(currentTarget.getBoundingClientRect());
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", hide);
  }

  NT.tooltip = { install };
})();
