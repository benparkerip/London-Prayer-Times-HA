/*!
 * London Prayer Times Cards for Home Assistant
 * https://github.com/YOUR-GITHUB-USERNAME/london-prayer-cards-ha
 *
 * Two custom Lovelace cards for the London Prayer Times sensors:
 *   - london-prayer-card        Next-prayer countdown + today's times
 *   - london-prayer-month-card  Scrollable month table with prev/next nav
 *
 * MIT License
 */

class LondonPrayerCard extends HTMLElement {
  // Real prayers (used for "next prayer" + countdown), in chronological order.
  static PRAYERS = [
    { key: "fajr", name: "Fajr", entity: "sensor.london_prayer_times_fajr" },
    { key: "dhuhr", name: "Zuhr", entity: "sensor.london_prayer_times_dhuhr" },
    { key: "asr", name: "Asr", entity: "sensor.london_prayer_times_asr" },
    { key: "magrib", name: "Maghrib", entity: "sensor.london_prayer_times_magrib" },
    { key: "isha", name: "Ishaa", entity: "sensor.london_prayer_times_isha" },
  ];

  // Sunrise is shown as a slim divider between Fajr and Zuhr — a time marker,
  // not a prayer.
  static SUNRISE = { key: "sunrise", name: "Sunrise", entity: "sensor.london_prayer_times_sunrise" };

  // Ambient glow colour at the START of each period, echoing the sky at that
  // time of day. The card fades from the current period's colour to the
  // next one's as the countdown progresses.
  static PERIOD_COLORS = {
    fajr: [63, 81, 181],     // pre-dawn indigo
    dhuhr: [255, 196, 61],   // midday gold
    asr: [255, 142, 60],     // afternoon amber
    magrib: [255, 87, 60],   // sunset red-orange
    isha: [37, 48, 94],      // deep night navy
  };

  setConfig(config) {
    this._config = { show_sunrise: true, show_gradient: true, ...(config || {}) };
  }

  static getConfigElement() {
    return document.createElement("london-prayer-card-editor");
  }

  _lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <style>
            london-prayer-card {
              display: block;
              height: 100%;
            }
            ha-card {
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 22px 24px 20px;
              cursor: pointer;
              border-radius: var(--ha-card-border-radius, 12px);
              overflow: hidden;
              background-color: var(--ha-card-background, var(--card-background-color));
              background-image: radial-gradient(circle, rgba(var(--rgb-primary-color, 3, 169, 244), 0.09), transparent 60%);
              background-repeat: no-repeat;
              background-size: 160% 180%;
              background-position: 0% 0%;
              transition: background-position 1.2s ease;
            }
            .header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 12px;
            }
            .next-label {
              font-size: var(--ha-font-size-m, 14px);
              font-weight: var(--ha-font-weight-normal, 400);
              color: var(--secondary-text-color);
              margin-bottom: 4px;
            }
            .next-name {
              font-size: calc(var(--ha-font-size-4xl, 40px) - 4px);
              font-weight: var(--ha-font-weight-normal, 400);
              color: var(--primary-text-color);
              line-height: 1.1;
            }
            .next-countdown {
              display: inline-block;
              margin-top: 8px;
              font-size: 12.5px;
              font-weight: var(--ha-font-weight-medium, 500);
              color: var(--primary-color, #4285f4);
            }
            .today {
              text-align: right;
              font-size: var(--ha-font-size-m, 14px);
              color: var(--secondary-text-color);
              padding-top: 2px;
              white-space: nowrap;
            }
            .progress-track {
              margin-top: 18px;
              height: 4px;
              border-radius: 4px;
              background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              border-radius: 4px;
              background: var(--primary-color, #4285f4);
              width: 0%;
              transition: width 1s linear;
            }
            .tiles {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 2px;
              margin-top: 18px;
            }
            .tile {
              flex: 1 1 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
              padding: 12px 2px;
              border-radius: 14px;
            }
            .tile.current {
              background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.16);
            }
            .tile .name {
              font-size: var(--ha-font-size-m, 14px);
              font-weight: var(--ha-font-weight-medium, 500);
              color: var(--primary-text-color);
            }
            .tile.current .name,
            .tile.current .time {
              color: var(--primary-color, #4285f4);
              font-weight: var(--ha-font-weight-bold, 600);
            }
            .tile .time {
              font-size: var(--ha-font-size-m, 14px);
              color: var(--primary-text-color);
            }
            .sunrise-marker {
              flex: 1 1 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
              padding: 12px 2px;
              border-radius: 14px;
              opacity: 0.6;
            }
            .sunrise-marker .name {
              font-size: var(--ha-font-size-m, 14px);
              font-weight: var(--ha-font-weight-medium, 500);
              color: var(--secondary-text-color);
            }
            .sunrise-marker .time {
              font-size: var(--ha-font-size-m, 14px);
              color: var(--secondary-text-color);
            }
          </style>
          <div class="header">
            <div>
              <div class="next-label">Next prayer</div>
              <div class="next-name"></div>
              <div class="next-countdown"></div>
            </div>
            <div class="today"></div>
          </div>
          <div class="progress-track"><div class="progress-fill"></div></div>
          <div class="tiles"></div>
        </ha-card>
      `;
      this.content = this;
      this.querySelector("ha-card").addEventListener("click", () => {
        this._openMonthOverlay();
      });
      // Countdown/progress needs to move even when no entity state changes,
      // so tick independently of hass updates.
      this._tick = setInterval(() => this._render(), 30000);
    }
    this._render();
    if (this._overlayMonthCard) {
      this._overlayMonthCard.hass = hass;
    }
  }

  disconnectedCallback() {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
    this._closeMonthOverlay();
  }

  _injectOverlayStyles() {
    if (document.getElementById("lpc-month-overlay-styles")) return;
    const style = document.createElement("style");
    style.id = "lpc-month-overlay-styles";
    style.textContent = `
      .lpc-month-overlay-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease, background 0.22s ease;
      }
      .lpc-month-overlay-backdrop.open {
        background: rgba(0, 0, 0, 0.5);
        opacity: 1;
        pointer-events: auto;
      }
      .lpc-month-overlay-panel {
        position: relative;
        width: 100%;
        max-width: 640px;
        max-height: 88vh;
        overflow-y: auto;
        border-radius: 20px;
        transform: scale(0.82);
        opacity: 0;
        transition: transform 0.22s ease, opacity 0.22s ease;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }
      .lpc-month-overlay-backdrop.open .lpc-month-overlay-panel {
        transform: scale(1);
        opacity: 1;
      }
      .lpc-month-overlay-close {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 2;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        font-size: 15px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .lpc-month-overlay-body london-prayer-month-card {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  _openMonthOverlay() {
    if (this._overlayEl || !this._hass) return;
    this._injectOverlayStyles();

    const backdrop = document.createElement("div");
    backdrop.className = "lpc-month-overlay-backdrop";

    const panel = document.createElement("div");
    panel.className = "lpc-month-overlay-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "lpc-month-overlay-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._closeMonthOverlay();
    });

    const body = document.createElement("div");
    body.className = "lpc-month-overlay-body";

    const monthCard = document.createElement("london-prayer-month-card");
    if (typeof monthCard.setConfig === "function") {
      monthCard.setConfig({});
    }
    monthCard.hass = this._hass;
    body.appendChild(monthCard);

    panel.appendChild(closeBtn);
    panel.appendChild(body);
    backdrop.appendChild(panel);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this._closeMonthOverlay();
    });

    this._escHandler = (e) => {
      if (e.key === "Escape") this._closeMonthOverlay();
    };
    document.addEventListener("keydown", this._escHandler);

    document.body.appendChild(backdrop);
    this._overlayEl = backdrop;
    this._overlayMonthCard = monthCard;

    requestAnimationFrame(() => {
      backdrop.classList.add("open");
    });
  }

  _closeMonthOverlay() {
    if (!this._overlayEl) return;
    const el = this._overlayEl;
    this._overlayEl = null;
    this._overlayMonthCard = null;
    if (this._escHandler) {
      document.removeEventListener("keydown", this._escHandler);
      this._escHandler = null;
    }
    el.classList.remove("open");
    const cleanup = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    el.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(cleanup, 400);
  }

  _entityDate(entityId) {
    const st = this._hass && this._hass.states[entityId];
    if (!st || st.state === "unavailable" || st.state === "unknown") return null;
    const d = new Date(st.state);
    return isNaN(d.getTime()) ? null : d;
  }

  _formatTime(d) {
    if (!d) return "--:--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  _render() {
    if (!this.content || !this._hass) return;
    const now = new Date();
    const prayers = LondonPrayerCard.PRAYERS.map((p) => ({ ...p, dt: this._entityDate(p.entity) }));
    const sunrise = { ...LondonPrayerCard.SUNRISE, dt: this._entityDate(LondonPrayerCard.SUNRISE.entity) };

    // Next prayer: first real prayer today still in the future, else tomorrow's Fajr.
    let next = prayers.find((p) => p.dt && p.dt > now);
    let nextDt = next ? next.dt : null;
    if (!next) {
      const fajr = prayers[0];
      next = fajr;
      nextDt = fajr.dt ? new Date(fajr.dt.getTime() + 24 * 3600 * 1000) : null;
    }
    this._nextEntity = next.entity;

    this.querySelector(".next-name").textContent = next.name;
    const countdownEl = this.querySelector(".next-countdown");
    let prevDt = null;
    if (nextDt) {
      const diffMs = Math.max(0, nextDt.getTime() - now.getTime());
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      countdownEl.textContent = `in ${h}h ${m}m`;
    } else {
      countdownEl.textContent = "";
    }

    let hijriText = "";
    try {
      const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
      const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" }).formatToParts(now);
      const day = parts.find((p) => p.type === "day").value;
      const monthNum = parseInt(parts.find((p) => p.type === "month").value, 10);
      hijriText = `${day} ${HIJRI_MONTHS[monthNum - 1]}`;
    } catch (e) {
      hijriText = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    }
    this.querySelector(".today").textContent = hijriText;

    // Current period = most recently passed real prayer (wrapping to yesterday's Isha before today's Fajr).
    let currentKey = null;
    const passed = prayers.filter((p) => p.dt && p.dt <= now);
    if (passed.length) {
      currentKey = passed[passed.length - 1].key;
      prevDt = passed[passed.length - 1].dt;
    } else if (prayers.length) {
      currentKey = prayers[prayers.length - 1].key;
      const isha = prayers[prayers.length - 1];
      prevDt = isha.dt ? new Date(isha.dt.getTime() - 24 * 3600 * 1000) : null;
    }

    // A prayer only counts as "current" (tile highlight) for as long as its
    // own window is actually open. Every prayer's window runs until the
    // next one — EXCEPT Fajr, whose valid time ends at sunrise, well before
    // Zuhr. Past that cutoff, nothing is "current" until the next prayer.
    let currentEndDt = nextDt;
    if (currentKey === "fajr" && sunrise.dt && prevDt && sunrise.dt > prevDt) {
      currentEndDt = sunrise.dt;
    }
    const highlightKey = currentKey && currentEndDt && now < currentEndDt ? currentKey : null;

    // Progress bar: fraction of the way from the current period's start to the next prayer.
    const fillEl = this.querySelector(".progress-fill");
    const cardEl = this.querySelector("ha-card");
    let frac = 0;
    if (prevDt && nextDt && nextDt > prevDt) {
      frac = Math.min(1, Math.max(0, (now.getTime() - prevDt.getTime()) / (nextDt.getTime() - prevDt.getTime())));
      fillEl.style.width = `${(frac * 100).toFixed(1)}%`;
    } else {
      fillEl.style.width = "0%";
    }
    // Drift the ambient corner glow across the card in step with that same
    // fraction, so it moves gradually over the course of each prayer period
    // (top-left at the start, bottom-right by the next prayer), and fade its
    // colour from the current period's sky tone to the next one's.
    // (show_gradient: false swaps this for a flat card background instead.)
    if (cardEl) {
      if (this._config.show_gradient !== false) {
        cardEl.style.backgroundPosition = `${(frac * 100).toFixed(1)}% ${(frac * 60).toFixed(1)}%`;
        const fromColor = LondonPrayerCard.PERIOD_COLORS[currentKey] || LondonPrayerCard.PERIOD_COLORS.isha;
        const toColor = LondonPrayerCard.PERIOD_COLORS[next.key] || fromColor;
        const [r, g, b] = this._lerpColor(fromColor, toColor, frac);
        cardEl.style.backgroundImage = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 60%)`;
      } else {
        cardEl.style.backgroundImage = "none";
      }
    }

    const tilesEl = this.querySelector(".tiles");
    const renderTile = (p) => {
      const isCurrent = p.key === highlightKey;
      return `
        <div class="tile${isCurrent ? " current" : ""}">
          <div class="name">${p.name}</div>
          <div class="time">${this._formatTime(p.dt)}</div>
        </div>
      `;
    };
    const renderSunrise = (p) => `
      <div class="sunrise-marker">
        <div class="name">${p.name}</div>
        <div class="time">${this._formatTime(p.dt)}</div>
      </div>
    `;

    const showSunrise = this._config.show_sunrise !== false;
    tilesEl.innerHTML = [
      renderTile(prayers[0]),
      showSunrise ? renderSunrise(sunrise) : "",
      renderTile(prayers[1]),
      renderTile(prayers[2]),
      renderTile(prayers[3]),
      renderTile(prayers[4]),
    ].join("");
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return { show_sunrise: true, show_gradient: true };
  }
}

// Visual editor: "Show sunrise" and "Show colour gradient" toggles, offered
// in the dashboard's card edit UI (the "Show code editor" YAML view still
// works without this).
class LondonPrayerCardEditor extends HTMLElement {
  static TOGGLES = [
    { key: "show_sunrise", label: "Show sunrise" },
    { key: "show_gradient", label: "Show colour gradient" },
  ];

  setConfig(config) {
    this._config = { show_sunrise: true, show_gradient: true, ...(config || {}) };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    this._render();
  }

  _render() {
    if (!this._config) return;
    if (!this.content) {
      this.innerHTML = `
        <div style="padding: 4px 0; display: flex; flex-direction: column; gap: 4px;">
          ${LondonPrayerCardEditor.TOGGLES.map(
            (t) => `
            <ha-formfield label="${t.label}">
              <ha-switch data-key="${t.key}"></ha-switch>
            </ha-formfield>
          `
          ).join("")}
        </div>
      `;
      this.content = this;
      this._switches = {};
      LondonPrayerCardEditor.TOGGLES.forEach(({ key }) => {
        const el = this.querySelector(`ha-switch[data-key="${key}"]`);
        this._switches[key] = el;
        el.addEventListener("change", (e) => {
          const config = { ...this._config, [key]: e.target.checked };
          this._config = config;
          this.dispatchEvent(
            new CustomEvent("config-changed", {
              detail: { config },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    }
    LondonPrayerCardEditor.TOGGLES.forEach(({ key }) => {
      this._switches[key].checked = this._config[key] !== false;
    });
  }
}

customElements.define("london-prayer-card-editor", LondonPrayerCardEditor);

customElements.define("london-prayer-card", LondonPrayerCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "london-prayer-card",
  name: "London Prayer Times Card",
  description: "Sleek next-prayer countdown and daily prayer times from London Prayer Times.",
});

class LondonPrayerMonthCard extends HTMLElement {
  static OFFSET_ENTITY = "input_number.prayer_calendar_month_offset";
  static PENDING_TIMEOUT_MS = 20000;

  setConfig(config) {
    this._config = config || {};
    if (!this._config.entity) {
      this._config.entity = "sensor.london_prayer_times_month";
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <style>
            ha-card {
              padding: 24px;
              border-radius: 20px;
              overflow: hidden;
            }
            .nav {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              margin-bottom: 14px;
            }
            .nav-btn {
              background: none;
              border: none;
              font-size: 22px;
              line-height: 1;
              cursor: pointer;
              color: var(--primary-text-color);
              padding: 6px 14px;
              border-radius: 10px;
            }
            .nav-btn:not(:disabled):hover {
              background: rgba(127, 127, 127, 0.12);
            }
            .nav-btn:disabled {
              opacity: 0.25;
              cursor: default;
            }
            .nav-center {
              flex: 1;
              text-align: center;
              min-width: 0;
            }
            .title {
              font-size: calc(var(--ha-font-size-4xl, 40px) - 3px);
              font-weight: var(--ha-font-weight-normal, 400);
              color: var(--primary-text-color);
              line-height: 1.15;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .today-link {
              font-size: var(--ha-font-size-s, 13px);
              color: var(--primary-color, #4285f4);
              cursor: pointer;
              margin-top: 2px;
            }
            .loading-banner {
              font-size: var(--ha-font-size-s, 13px);
              color: var(--secondary-text-color);
              text-align: center;
              padding: 0 0 14px 0;
            }
            .table-wrap {
              overflow-x: auto;
              border-radius: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            thead th {
              text-align: center;
              font-size: var(--ha-font-size-s, 13px);
              font-weight: var(--ha-font-weight-medium, 500);
              color: var(--secondary-text-color);
              padding: 6px 2px;
              border-bottom: 1px solid var(--divider-color);
              position: sticky;
              top: 0;
              background: var(--ha-card-background, var(--card-background-color));
            }
            thead th:first-child {
              text-align: left;
              width: 15%;
            }
            tbody td {
              text-align: center;
              font-size: var(--ha-font-size-s, 13px);
              color: var(--primary-text-color);
              padding: 7px 2px;
              border-bottom: 1px solid var(--divider-color);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            tbody td:first-child {
              font-weight: var(--ha-font-weight-medium, 500);
            }
            td.date-cell {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            td.date-cell .weekday {
              display: inline-block;
              width: 30px;
              text-align: left;
            }
            td.date-cell .daynum {
              text-align: left;
              font-variant-numeric: tabular-nums;
            }
            tbody tr:last-child td {
              border-bottom: none;
            }
            tbody tr.today td {
              background: rgba(66, 133, 244, 0.08);
              color: var(--primary-color, #4285f4);
              font-weight: var(--ha-font-weight-medium, 500);
            }
            .empty {
              text-align: center;
              color: var(--secondary-text-color);
              font-size: var(--ha-font-size-m, 14px);
              padding: 24px 0;
            }
          </style>
          <div class="nav">
            <button class="nav-btn prev" aria-label="Previous month">‹</button>
            <div class="nav-center">
              <div class="title"></div>
              <div class="today-link" hidden>Jump to current month</div>
            </div>
            <button class="nav-btn next" aria-label="Next month">›</button>
          </div>
          <div class="loading-banner" hidden></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fajr</th>
                  <th>Sunrise</th>
                  <th>Dhuhr</th>
                  <th>Asr</th>
                  <th>Maghrib</th>
                  <th>Isha</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </ha-card>
      `;
      this.content = this;
      this.querySelector(".prev").addEventListener("click", () => this._navigate(-1));
      this.querySelector(".next").addEventListener("click", () => this._navigate(1));
      this.querySelector(".today-link").addEventListener("click", () => this._jumpToToday());
    }
    this._render();
  }

  _currentOffset() {
    const st = this._hass.states[LondonPrayerMonthCard.OFFSET_ENTITY];
    const v = st ? parseInt(st.state, 10) : 0;
    return isNaN(v) ? 0 : v;
  }

  _targetForOffset(offset) {
    const now = new Date();
    const total = now.getMonth() + offset; // getMonth() is already 0-based
    const year = now.getFullYear() + Math.floor(total / 12);
    const month = (((total % 12) + 12) % 12) + 1;
    return { year, month };
  }

  _navigate(delta) {
    if (this._navigating) return;
    const cur = this._currentOffset();
    const next = Math.max(-12, Math.min(12, cur + delta));
    if (next === cur) return;
    this._beginNavigation(next);
  }

  _jumpToToday() {
    if (this._navigating) return;
    if (this._currentOffset() === 0) return;
    this._beginNavigation(0);
  }

  async _beginNavigation(newOffset) {
    this._navigating = true;
    this._navError = null;
    this._pendingTarget = this._targetForOffset(newOffset);
    this._navStartedAt = Date.now();
    this._render();
    try {
      await this._hass.callService("input_number", "set_value", {
        entity_id: LondonPrayerMonthCard.OFFSET_ENTITY,
        value: newOffset,
      });
      await this._hass.callService("homeassistant", "update_entity", {
        entity_id: this._config.entity,
      });
    } catch (err) {
      this._navigating = false;
      this._navError = "Couldn't request that month — check Settings → System → Logs.";
      this._render();
    }
  }

  _formatTime(t) {
    if (!t) return "--:--";
    const parts = t.split(":");
    if (parts.length !== 2) return t;
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return t;
    return `${hour}:${parts[1]}`;
  }

  _formatDayCell(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString([], { weekday: "short" });
    return `<span class="weekday">${weekday}</span><span class="daynum">${d.getDate()}</span>`;
  }

  _monthLabel(year, month) {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString([], { month: "long", year: "numeric" });
  }

  _render() {
    if (!this.content || !this._hass || !this._config) return;
    const stateObj = this._hass.states[this._config.entity];
    const tbody = this.querySelector("tbody");
    const titleEl = this.querySelector(".title");
    const prevBtn = this.querySelector(".prev");
    const nextBtn = this.querySelector(".next");
    const todayLink = this.querySelector(".today-link");
    const loadingBanner = this.querySelector(".loading-banner");

    const offset = this._currentOffset();
    prevBtn.disabled = offset <= -12;
    nextBtn.disabled = offset >= 12;
    todayLink.hidden = offset === 0;

    const times = stateObj && stateObj.attributes && stateObj.attributes.times;
    const dateKeys = times && typeof times === "object" ? Object.keys(times).sort() : [];

    // Clear "navigating" once fetched data matches the requested month, or
    // after a timeout so the UI never gets stuck if the fetch fails.
    if (this._navigating && this._pendingTarget) {
      const wantMonth = `${this._pendingTarget.year}-${String(this._pendingTarget.month).padStart(2, "0")}`;
      const gotMonth = dateKeys.length ? dateKeys[0].slice(0, 7) : null;
      if (gotMonth === wantMonth) {
        this._navigating = false;
        this._navError = null;
      } else if (Date.now() - this._navStartedAt > LondonPrayerMonthCard.PENDING_TIMEOUT_MS) {
        this._navigating = false;
        this._navError = "Still showing the previous month — the new data hasn't arrived. Check Settings → System → Logs for the REST sensor.";
      }
    }

    if (this._navigating && this._pendingTarget) {
      loadingBanner.hidden = false;
      loadingBanner.textContent = `Loading ${this._monthLabel(this._pendingTarget.year, this._pendingTarget.month)}…`;
    } else if (this._navError) {
      loadingBanner.hidden = false;
      loadingBanner.textContent = this._navError;
    } else {
      loadingBanner.hidden = true;
    }

    if (!stateObj) {
      titleEl.textContent = "Month calendar";
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty">Entity not found: ${this._config.entity}</div></td></tr>`;
      return;
    }

    if (!dateKeys.length) {
      titleEl.textContent =
        this._navigating && this._pendingTarget
          ? this._monthLabel(this._pendingTarget.year, this._pendingTarget.month)
          : "Month calendar";
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty">No month data yet — waiting on sensor attributes</div></td></tr>`;
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const first = new Date(dateKeys[0] + "T00:00:00");
    titleEl.textContent = isNaN(first.getTime())
      ? "Month calendar"
      : first.toLocaleDateString([], { month: "long", year: "numeric" });

    tbody.innerHTML = dateKeys
      .map((dateStr) => {
        const day = times[dateStr] || {};
        const isToday = offset === 0 && dateStr === todayStr;
        return `
          <tr class="${isToday ? "today" : ""}">
            <td class="date-cell">${this._formatDayCell(dateStr)}</td>
            <td>${this._formatTime(day.fajr)}</td>
            <td>${this._formatTime(day.sunrise)}</td>
            <td>${this._formatTime(day.dhuhr)}</td>
            <td>${this._formatTime(day.asr)}</td>
            <td>${this._formatTime(day.magrib)}</td>
            <td>${this._formatTime(day.isha)}</td>
          </tr>
        `;
      })
      .join("");

    // Only auto-scroll to today's row when actually viewing the current month.
    if (offset === 0 && (!this._scrolledFor || this._scrolledFor !== dateKeys.join(","))) {
      this._scrolledFor = dateKeys.join(",");
      requestAnimationFrame(() => {
        const todayRow = this.querySelector("tr.today");
        if (todayRow) {
          todayRow.scrollIntoView({ block: "center" });
        }
      });
    }
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { entity: "sensor.london_prayer_times_month" };
  }
}

customElements.define("london-prayer-month-card", LondonPrayerMonthCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "london-prayer-month-card",
  name: "London Prayer Times Month Card",
  description: "Scrollable table of a month's prayer times with prev/next navigation",
});
