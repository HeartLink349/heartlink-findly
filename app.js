(function () {
  const ROOT_BASE = location.protocol === "file:"
    ? new URL("./", document.currentScript?.src || document.baseURI).href
    : "/";
  const ORIG = `${ROOT_BASE}assets/original/img/`;
  const Q_ASSET = `${ROOT_BASE}assets/questions/`;

  const {
    LANGUAGES,
    COUNTRIES,
    escapeHtml: safe,
    underlineSvgUrl,
    formatRichText,
    t: rawT
  } = window.dbmI18n;

  const root = document.getElementById("app");
  const bootScreen = document.getElementById("boot-screen");
  const bootStartedAt = performance.now();

  const state = {
    language: localStorage.getItem("dbm-language") || "ar",
    displayLangCode: localStorage.getItem("dbm-display-lang") || localStorage.getItem("dbm-language") || "ar",
    country: window.quizStore.getCountry() || "EG",
    route: "home", // home | userName | userCreating | userShare | userScoreboard | userAnswers | contact | find | playerName | playerPlaying | playerCompleted | notFound
    // Creator flow
    nameSubstep: "name", // name | gender
    ownerName: "",
    gender: "female",
    questionPool: [],
    poolCursor: 0,
    questionSet: [],
    answers: [],
    step: 0,
    creatingSelected: null,
    creatingCompleted: false,
    quiz: null,
    copied: false,
    // Creator answers view
    reviewResponseId: null,
    // Player flow
    playerQuiz: null,
    playerName: "",
    guesses: [],
    playerStep: 0,
    playerFeedback: null, // { pickedIndex, correctIndex, isCorrect }
    playerResponse: null,
    // Overlays
    drawerOpen: false,
    langModalOpen: false,
    countryModalOpen: false,
    countrySearch: "",
    confirmModal: null, // { type: 'newQuiz' | 'deleteQuiz' | 'deletePlayer', targetId?: string }
    deletedSuccess: false,
    inviteModalOpen: false,
    toastTimer: null,
    toastMessage: ""
  };

  let activeTimers = [];
  let activeRafs = [];
  let completedBgAudio = null;

  function scheduleTimeout(fn, ms) {
    const handle = window.setTimeout(fn, ms);
    activeTimers.push(handle);
    return handle;
  }

  function clearAsyncWork() {
    activeTimers.forEach((h) => window.clearTimeout(h));
    activeTimers = [];
    activeRafs.forEach((r) => window.cancelAnimationFrame(r));
    activeRafs = [];
    if (completedBgAudio) {
      window.dbmAudio.stop(completedBgAudio);
      completedBgAudio = null;
    }
    window.dbmAudio.stopAll();
  }

  const t = (ns, key) => rawT(state.language, ns, key);
  const isAr = () => state.language === "ar";
  const imageQuestionId = (item) => (item.id === "96" ? "95" : item.id);
  const uid = () => {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 12);
  };
  const expiredMessage = () => (isAr()
    ? "انتهت صلاحية هذا الرابط (24 ساعة) وتم حذفه نهائياً"
    : "This quiz link expired after 24 hours and was permanently deleted");

  function currentLanguageDisplay() {
    const found = LANGUAGES.find((l) => l.code === state.displayLangCode);
    if (found) return found.native;
    return isAr() ? "العربية" : "English";
  }

  function currentCountryObj() {
    return COUNTRIES.find((c) => c.code === state.country) || COUNTRIES.find((c) => c.code === "EG") || COUNTRIES[0];
  }

  function logoForGender(gender) {
    return gender === "male" ? `${ORIG}logo-m.webp` : `${ORIG}logo-f.webp`;
  }

  function configurePlayerBootSplash(genderFlag) {
    if (!bootScreen) return;
    const logo = genderFlag === "m" ? `${ORIG}logo-m.webp` : `${ORIG}logo-f.webp`;
    bootScreen.className = "loading-screen";
    bootScreen.innerHTML = `
      <div class="loading-panel">
        <img class="loading-brand" src="${logo}" alt="Don't Block Me" />
        <div class="loading-scene" aria-hidden="true">
          <div class="loading-cloud loading-cloud-left"></div>
          <div class="loading-cloud loading-cloud-right"></div>
          <div class="loading-glow"></div>
          <img class="loading-sticker loading-star-top" src="${ORIG}doodles/doodle-10.svg" alt="" />
          <img class="loading-sticker loading-heart-right" src="${ORIG}doodles/doodle-16.svg" alt="" />
          <img class="loading-sticker loading-star-bottom" src="${ORIG}doodles/doodle-11.svg" alt="" />
          <div class="loading-note-wrap">
            <img class="loading-note" src="${ORIG}player/home/note-card.svg" alt="" />
            <div class="loading-note-content">
              <h1 class="loading-title" data-boot-loading>${safe(t("player", "home.loadingMessage"))}</h1>
              <div class="loading-progress-track">
                <span class="loading-progress-dot"></span>
                <span class="loading-progress-dot"></span>
                <span class="loading-progress-dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function releaseBootScreen() {
    if (!bootScreen || bootScreen.dataset.released) return;
    bootScreen.dataset.released = "true";
    const bootTitle = bootScreen.querySelector("[data-boot-title]");
    const bootLoading = bootScreen.querySelector("[data-boot-loading]");
    if (bootTitle) bootTitle.textContent = t("user", "home.tagline");
    if (bootLoading) {
      bootLoading.textContent = state.route === "find"
        ? t("player", "home.loadingMessage")
        : t("user", "home.loadingMessage");
    }
    const showFullSplash = state.route === "home" || state.route === "find";
    const minWait = showFullSplash ? 1500 : 120;
    const delay = Math.max(0, minWait - (performance.now() - bootStartedAt));
    window.setTimeout(() => {
      bootScreen.classList.add("is-leaving");
      window.setTimeout(() => bootScreen.remove(), 300);
    }, delay);
  }

  function showToast(message) {
    state.toastMessage = message;
    let existing = document.querySelector(".toast-banner");
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "toast-banner";
      document.body.appendChild(existing);
    }
    existing.textContent = message;
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      existing.remove();
      state.toastMessage = "";
    }, 2400);
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function getShareUrl(quiz) {
    const qFlag = quiz.gender === "male" ? "m" : "f";
    if (location.protocol === "file:") {
      const u = new URL(location.href);
      u.search = "";
      u.searchParams.set("quiz", quiz.id);
      u.searchParams.set("q", qFlag);
      u.hash = "";
      return u.href;
    }
    return `${location.origin}/find?id=${encodeURIComponent(quiz.id)}&q=${qFlag}`;
  }

  function buildShareMessage(quiz) {
    const template = t("user", quiz.gender === "male" ? "share.shareText_m" : "share.shareText_f");
    return template
      .replaceAll("{{USERNAME}}", quiz.ownerName)
      .replaceAll("{{LINK}}", getShareUrl(quiz));
  }

  function formatQuestionHtml(rawPrompt, ownerName) {
    const escaped = safe(rawPrompt || "");
    const ownerSpan = `<span class="creating-owner-highlight fancy-underline" style="--u-img:${underlineSvgUrl("#72d6ff", "default")}">${safe(ownerName)}</span>`;
    return escaped.replaceAll("userName", ownerSpan);
  }

  function getRoutePath(route, opts = {}) {
    if (location.protocol === "file:") {
      const u = new URL(location.href);
      u.search = "";
      u.hash = "";
      if (route === "find" || route === "playerName" || route === "playerPlaying" || route === "playerCompleted") {
        const q = state.playerQuiz;
        if (q) {
          u.searchParams.set("quiz", q.id);
          u.searchParams.set("q", q.gender === "male" ? "m" : "f");
        }
        if (route !== "find") u.searchParams.set("step", route);
      } else if (route !== "home") {
        u.searchParams.set("view", route);
        if (opts.noRedirect) u.searchParams.set("no_redirect", "1");
      } else if (opts.noRedirect) {
        u.searchParams.set("no_redirect", "1");
      }
      return u.href;
    }
    const map = {
      home: opts.noRedirect ? "/?no_redirect=1" : "/",
      userName: "/user/name",
      userCreating: "/user/creating",
      userShare: "/user/share",
      userScoreboard: "/user/scoreboard",
      userAnswers: `/user/scoreboard/answers${state.reviewResponseId ? `?player=${encodeURIComponent(state.reviewResponseId)}` : ""}`,
      contact: "/contact",
      find: state.playerQuiz ? `/find?id=${encodeURIComponent(state.playerQuiz.id)}&q=${state.playerQuiz.gender === "male" ? "m" : "f"}` : "/",
      playerName: "/player/name",
      playerPlaying: "/player/playing",
      playerCompleted: "/player/completed",
      notFound: "/404"
    };
    return map[route] || "/";
  }

  function navigate(route, opts = {}) {
    clearAsyncWork();
    state.route = route;
    state.drawerOpen = false;
    state.langModalOpen = false;
    state.countryModalOpen = false;
    state.confirmModal = null;
    state.inviteModalOpen = false;
    state.deletedSuccess = false;
    if (opts.assign) Object.assign(state, opts.assign);
    const targetUrl = getRoutePath(route, opts);
    if (!opts.skipHistory) {
      if (opts.replace) history.replaceState({ route }, "", targetUrl);
      else history.pushState({ route }, "", targetUrl);
    }
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* =========================================================================
     SHARED UI PIECES (Icons, SceneHeader, Scoreboard, Modals)
     ========================================================================= */

  const ICONS = {
    back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    arrowRight: `<span class="btn-circle-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>`,
    chevronDown: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
    link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11.1 4.8"/><path d="M14 11a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07l1.4-1.4"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;fill:currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92A2.92 2.92 0 1 0 18 16.08z"/></svg>`,
    forward: `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;fill:currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M20.2 11.8a8.2 8.2 0 0 1-8.2 8.2 8.5 8.5 0 0 1-3.9-.9L4 20l.9-3.8a8.5 8.5 0 1 1 15.3-4.4Z"/><path d="M9 8.5c.4-.8.8-.8 1.2-.1l.8 1.4c.2.3.1.6-.2.9l-.6.6c.7 1.3 1.7 2.2 3 2.8l.6-.7c.2-.3.5-.4.9-.2l1.4.7c.6.3.6.8.2 1.3-.6.8-1.4 1.1-2.4.9-2.9-.7-5.3-3-6.1-5.8-.3-.8.2-1.4 1.2-1.8Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.1" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none"/></svg>`,
    snapchat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c-3.1 0-5.2 2.3-5.2 5.5v2c0 .7-.7 1.2-1.5 1.5-.7.3-1.2.7-1.1 1.3.1.6.8.9 1.5 1 .8.2 1.4.2 1.5.8.1.5-.5 1.2-1.1 1.7-.6.5-1.5.9-1.3 1.4.2.5 1 .6 1.8.7.7.1 1.1.4 1.3 1 .2.7.8.9 1.5.5.8-.4 1.6-.8 2.6-.8s1.8.4 2.6.8c.7.4 1.3.2 1.5-.5.2-.6.6-.9 1.3-1 .8-.1 1.6-.2 1.8-.7.2-.5-.7-.9-1.3-1.4-.6-.5-1.2-1.2-1.1-1.7.1-.6.7-.6 1.5-.8.7-.1 1.4-.4 1.5-1 .1-.6-.4-1-1.1-1.3-.8-.3-1.5-.8-1.5-1.5v-2c0-3.2-2.1-5.5-5.2-5.5Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.85 21v-8h2.7l.4-3.12h-3.1V7.9c0-.9.26-1.52 1.56-1.52h1.66V3.6a21 21 0 0 0-2.42-.13c-2.4 0-4.05 1.47-4.05 4.18v2.23H7.9V13h2.7v8h3.25Z"/></svg>`,
    messenger: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m5 14.4 4.1-4.35 3.02 2.06 6.48-3.52-4.4 5.5-3.1-2.2L5 14.4Z"/></svg>`,
    telegram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m2.8 11.45 17.55-7.1c.82-.32 1.53.2 1.26 1.43l-2.99 14.1c-.22 1-.82 1.25-1.67.78l-4.62-3.4-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.7 8.56-7.73c.37-.32-.08-.5-.56-.19L6.9 13.48l-4.58-1.43c-.99-.3-1-.98.48-1.6Z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`
  };

  function renderSceneHeader(opts = {}) {
    const logoSrc = logoForGender(opts.gender || state.quiz?.gender || state.gender);
    const leftHtml = opts.showBack
      ? `<button class="scene-action-btn" data-action="go-back" aria-label="${safe(opts.backLabel || t("common", "nav.back"))}">${ICONS.back}</button>`
      : `<span></span>`;
    let rightHtml = `<span></span>`;
    if (opts.showCountry) {
      const c = currentCountryObj();
      rightHtml = `<button class="country-trigger" data-action="open-country" aria-label="${safe(t("user", "name.countryPicker.open"))}: ${safe(c.code)}"><span class="country-trigger-code">${safe(c.code)}</span>${ICONS.chevronDown}</button>`;
    } else if (opts.showMenu) {
      rightHtml = `<button class="scene-action-btn" data-action="open-drawer" aria-label="${safe(t("common", "contact.toggleMenu"))}">${ICONS.menu}</button>`;
    }
    return `
      <header class="scene-header">
        <div class="scene-header-slot-left">${leftHtml}</div>
        <img class="scene-logo" src="${logoSrc}" alt="Don't Block Me" />
        <div class="scene-header-slot-right">${rightHtml}</div>
        <img class="scene-cloud-band" src="${ORIG}user/clouds.svg" alt="" aria-hidden="true" />
      </header>
    `;
  }

  function renderScoreboardSection(quiz, opts = {}) {
    const responses = [...(quiz?.responses || [])].sort((a, b) => b.score - a.score || (b.createdAt || "").localeCompare(a.createdAt || ""));
    const totalQ = Math.max(1, quiz?.questions?.length || 10);
    const countLabel = responses.length === 1
      ? t("user", "scoreboard.totalFriendsOne")
      : t("user", "scoreboard.totalFriends").replace("{{count}}", String(responses.length));
    const mySubmissionId = window.quizStore.getPlayerSubmission(quiz?.id);
    const emptyBear = quiz?.gender === "male" ? `${ORIG}user/scoreboard/dudu.webp` : `${ORIG}user/scoreboard/bubu.webp`;

    let bodyHtml = "";
    if (responses.length === 0) {
      bodyHtml = `
        <div class="sb-empty-card">
          <img src="${emptyBear}" alt="No Data" />
          <h3>${safe(t("player", "scoreboard.emptyTitle"))}</h3>
          <p>${safe(t("player", "scoreboard.emptyDescription"))}</p>
        </div>
      `;
    } else {
      const rows = responses.map((resp, idx) => {
        const rank = idx + 1;
        const rankImg = rank <= 3 ? `rank${rank}.svg` : "rankall.svg";
        const avatarNum = ((rank - 1) % 30) + 1;
        const doodleNum = ((rank - 1) % 30) + 1;
        const pct = Math.max(0, Math.min(100, Math.round((resp.score / totalQ) * 100)));
        const isMe = opts.showYouBadge && mySubmissionId && resp.id === mySubmissionId;
        const creatorActions = opts.isCreator ? `
          <div class="sb-creator-actions">
            <button class="sb-action-chip sb-action-view" data-action="view-answers" data-response-id="${safe(resp.id)}">👁 ${safe(t("user", "scoreboard.view_action"))}</button>
            <button class="sb-action-chip sb-action-remove" data-action="ask-remove-player" data-response-id="${safe(resp.id)}">🗑 ${safe(t("user", "scoreboard.remove_action"))}</button>
          </div>
        ` : "";

        return `
          <li class="sb-row-card">
            <div class="sb-rank-badge">
              <img src="${ORIG}user/scoreboard/ranks/${rankImg}" alt="Rank ${rank}" />
              ${rank > 3 ? `<span class="sb-rank-num">${rank}</span>` : ""}
            </div>
            ${isMe ? `<span class="sb-you-pill">${safe(t("user", "scoreboard.you"))}</span>` : ""}
            <img class="sb-row-doodle" src="${ORIG}doodles/doodle-${doodleNum}.svg" alt="" aria-hidden="true" />
            <div class="sb-row-main">
              <img class="sb-avatar" src="${ORIG}user/scoreboard/avatars/avatar${avatarNum}.webp" alt="${safe(resp.name)}" />
              <div class="sb-row-info">
                <div class="sb-row-top">
                  <span class="sb-player-name">${safe(resp.name)}</span>
                  <span class="sb-score-frac"><strong>${resp.score}</strong>/${totalQ}</span>
                </div>
                <div class="sb-bar-track"><div class="sb-bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>
            ${creatorActions}
          </li>
        `;
      }).join("");
      bodyHtml = `<ol class="sb-list">${rows}</ol>`;
    }

    return `
      <section class="sb-section">
        <div class="sb-banner">
          <img class="sb-banner-tape" src="${ORIG}user/creating/pink-tape-strip.svg" alt="" aria-hidden="true" />
          <span class="sb-banner-trophy" aria-hidden="true">🏆</span>
          <h2 class="sb-banner-title">${safe(t("user", "scoreboard.title"))}</h2>
          <span class="sb-banner-trophy" aria-hidden="true">🏆</span>
        </div>
        <div class="sb-count-pill">${safe(countLabel)}</div>
        ${bodyHtml}
      </section>
    `;
  }

  /* =========================================================================
     OVERLAYS (Menu Drawer, 25-Language Modal, 248-Country Modal, Confirms, Invite)
     ========================================================================= */

  function renderDrawer() {
    if (!state.drawerOpen) return "";
    const isPlayerContext = ["find", "playerName", "playerPlaying", "playerCompleted"].includes(state.route);
    const createLabel = isPlayerContext ? t("common", "nav.createMyQuiz") : t("common", "nav.createQuizAgain");
    const createAction = isPlayerContext ? "go-home-fresh" : "ask-new-quiz";

    return `
      <div class="drawer-overlay">
        <button class="drawer-scrim" data-action="close-drawer" aria-label="${safe(t("common", "contact.closeMenu"))}"></button>
        <aside class="drawer-panel" role="dialog" aria-modal="true">
          <button class="drawer-close" data-action="close-drawer" aria-label="${safe(t("common", "contact.closeMenu"))}">×</button>
          <button class="drawer-lang-btn" data-action="open-lang-modal">
            <span class="drawer-lang-globe"><img src="${ORIG}user/home/language-selector-globe.svg" alt="" /></span>
            <span class="drawer-lang-copy">
              <small>${safe(t("common", "language.select"))}</small>
              <b>${safe(currentLanguageDisplay())}</b>
            </span>
            <span aria-hidden="true">${ICONS.chevronDown}</span>
          </button>
          <div class="drawer-divider"></div>
          <nav class="drawer-nav">
            <button class="drawer-item" data-action="${createAction}">
              <svg viewBox="0 0 24 24"><path d="M13 5h6v6M19 5l-9 9M18 14v5H5V6h5"/></svg>
              <span>${safe(createLabel)}</span>
            </button>
            <button class="drawer-item" data-action="go-contact">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>${safe(t("common", "nav.contactUs"))}</span>
            </button>
            <a class="drawer-item" href="https://instagram.com/official_fake_friend_finder" target="_blank" rel="noopener noreferrer">
              ${ICONS.instagram}
              <span>${safe(t("common", "nav.followInstagram"))}</span>
            </a>
          </nav>
        </aside>
      </div>
    `;
  }

  function renderLanguageModal() {
    if (!state.langModalOpen) return "";
    const rows = LANGUAGES.map((lang) => {
      const active = lang.code === state.displayLangCode;
      return `<button class="lang-modal-row ${active ? "is-active" : ""}" data-action="select-lang" data-lang="${lang.code}">${safe(lang.label)} (${safe(lang.native)})</button>`;
    }).join("");
    return `
      <div class="modal-backdrop" data-action="close-modals-backdrop">
        <div class="lang-modal-wrap" role="dialog" aria-modal="true" aria-label="${safe(t("common", "language.select"))}">
          <div class="lang-modal-list">${rows}</div>
          <button class="lang-modal-close" data-action="close-lang-modal">${safe(t("common", "language.close"))}</button>
        </div>
      </div>
    `;
  }

  function renderCountryModal() {
    if (!state.countryModalOpen) return "";
    const cur = currentCountryObj();
    const q = state.countrySearch.trim().toLowerCase();
    const filtered = q
      ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : COUNTRIES;

    const listHtml = filtered.length
      ? `<ul class="country-list">${filtered.map((c) => {
          const sel = c.code === cur.code;
          return `
            <li>
              <button class="country-row ${sel ? "is-selected" : ""}" data-action="select-country" data-code="${c.code}">
                <span class="country-row-flag">${c.flag}</span>
                <span class="country-row-name">${safe(c.name)}</span>
                <span class="country-row-code">${c.code}</span>
                <span>${sel ? `<span class="country-check">✓</span>` : ""}</span>
              </button>
            </li>
          `;
        }).join("")}</ul>`
      : `<div style="text-align:center;padding:48px 16px;font-weight:800;opacity:.7">${safe(t("user", "name.countryPicker.empty"))}</div>`;

    return `
      <div class="country-modal-viewport" role="dialog" aria-modal="true">
        <div class="country-picker">
          <div class="country-picker-header">
            <div class="country-title-group">
              <div class="country-current-flag">${cur.flag}</div>
              <div>
                <h2 class="country-picker-title">${safe(t("user", "name.countryPicker.title"))}</h2>
                <p class="country-current-name">${safe(cur.name)}</p>
              </div>
            </div>
            <button class="country-close-btn" data-action="close-country" aria-label="${safe(t("user", "name.countryPicker.close"))}">×</button>
          </div>
          <div class="country-search-region">
            <div class="country-search-field">
              ${ICONS.search}
              <input id="country-search-input" class="country-search-input" type="search" value="${safe(state.countrySearch)}" placeholder="${safe(t("user", "name.countryPicker.search"))}" autocomplete="off" />
            </div>
          </div>
          <div class="country-results" id="country-results-box">${listHtml}</div>
        </div>
      </div>
    `;
  }

  function renderConfirmModal() {
    if (!state.confirmModal) return "";
    const { type } = state.confirmModal;
    let title = "";
    let desc = "";
    let cancelText = "";
    let okText = "";
    let okAction = "";
    let okPrimary = false;

    if (type === "newQuiz") {
      title = t("common", "nav.createQuizAgain");
      desc = t("common", "nav.confirmNewQuiz");
      cancelText = t("user", "scoreboard.cancel");
      okText = t("user", "home.cta");
      okAction = "confirm-new-quiz";
      okPrimary = true;
    } else if (type === "deleteQuiz") {
      title = t("common", "contact.deletion.confirmTitle");
      desc = t("common", "contact.deletion.confirmDescription");
      cancelText = t("common", "contact.deletion.cancel");
      okText = t("common", "contact.deletion.confirm");
      okAction = "confirm-delete-quiz";
    } else if (type === "deletePlayer") {
      title = t("user", "scoreboard.confirmDeletion");
      desc = t("user", "scoreboard.deleteConfirmation");
      cancelText = t("user", "scoreboard.cancel");
      okText = t("user", "scoreboard.delete");
      okAction = "confirm-remove-player";
    }

    return `
      <div class="modal-backdrop" data-action="close-modals-backdrop">
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          <h2>${safe(title)}</h2>
          <p>${safe(desc)}</p>
          <div class="confirm-actions">
            <button class="confirm-cancel-btn" data-action="close-confirm">${safe(cancelText)}</button>
            <button class="confirm-ok-btn ${okPrimary ? "is-primary" : ""}" data-action="${okAction}">${safe(okText)}</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInviteModal() {
    if (!state.inviteModalOpen) return "";
    const line1 = formatRichText(t("player", "completed.modal.headingFirstLine"), {
      underlineColor: "#ffcd20"
    });
    const line2 = safe(t("player", "completed.modal.headingSecondLine"));
    const confettiDots = Array.from({ length: 18 }, (_, i) => {
      const colors = ["#fff", "#fe7fb4", "#ffe47e", "#84e2fa"];
      const left = 6 + ((i * 17) % 88);
      const top = 12 + ((i * 23) % 72);
      const col = colors[i % colors.length];
      return `<span class="woohoo-confetti-dot" style="left:${left}%;top:${top}%;background:${col};animation-delay:${(i * 0.14).toFixed(2)}s"></span>`;
    }).join("");

    return `
      <div class="modal-backdrop" data-action="close-invite">
        <div class="invite-card" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <button class="invite-close" data-action="close-invite" aria-label="${safe(t("player", "completed.modal.close"))}">×</button>
          <div class="invite-illustration">
            <img class="invite-logo" src="${ORIG}logo-f.webp" alt="Don't Block Me" />
            <div class="invite-scene">
              <div class="woohoo-confetti-layer">${confettiDots}</div>
              <img class="invite-chars" src="${ORIG}user/home/characters.webp" alt="" />
            </div>
          </div>
          <div class="invite-copy">
            <h2 class="invite-heading">${line1}<br>${line2}</h2>
            <img class="invite-wave" src="${ORIG}doodles/doodle-23.svg" alt="" aria-hidden="true" />
            <div class="invite-action">
              <button class="app-btn" data-action="go-home-fresh">${safe(t("player", "completed.modal.cta"))}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* =========================================================================
     VIEW 1: HOMEPAGE (/)
     ========================================================================= */

  function renderHome() {
    document.body.className = "theme-home";
    document.title = "Find Friends you can't trust - Don't Block Me";

    const headingHtml = formatRichText(t("user", "home.heading"), {
      sClasses: ["text-accent-pink", "text-accent-navy"],
      brushBg: "#f8d83a"
    });

    const steps = [
      ["✍️", t("user", "home.howToPlay.steps.createQuiz.title"), t("user", "home.howToPlay.steps.createQuiz.description")],
      ["📤", t("user", "home.howToPlay.steps.shareWithFriends.title"), t("user", "home.howToPlay.steps.shareWithFriends.description")],
      ["🏆", t("user", "home.howToPlay.steps.findFakeFriends.title"), t("user", "home.howToPlay.steps.findFakeFriends.description")]
    ].map(([icon, title, desc]) => `
      <li class="how-step">
        <span class="how-icon" aria-hidden="true">${icon}</span>
        <div class="how-copy">
          <h3 class="how-step-title">${safe(title)}</h3>
          <p class="how-step-desc">${safe(desc)}</p>
        </div>
      </li>
    `).join("");

    return `
      <main class="page-shell">
        <div class="mobile-canvas home-canvas">
          <section class="home-hero">
            <div class="home-top-decorations" aria-hidden="true">
              ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<img src="${ORIG}doodles/white-doodles/doodle-white-${n}.svg" alt="" />`).join("")}
            </div>
            <img class="home-logo" src="${ORIG}logo-f.webp" alt="Don't Block Me" />
            <div class="home-tagline">
              <img src="${ORIG}user/home/strip.svg" alt="" aria-hidden="true" />
              <h1>${safe(t("user", "home.tagline"))}</h1>
            </div>
            <div class="home-clouds" aria-hidden="true">
              <img src="${ORIG}user/home/clouds.webp" alt="" />
            </div>
            <div class="home-lang-wrap">
              <button class="home-lang-pill" data-action="open-lang-modal" aria-label="${safe(t("common", "language.select"))}">
                <span class="home-lang-inner">
                  <img class="home-lang-globe" src="${ORIG}user/home/language-selector-globe.svg" alt="" aria-hidden="true" />
                  <span class="home-lang-label">${safe(currentLanguageDisplay())}</span>
                  <span class="home-lang-chevron" aria-hidden="true">${ICONS.chevronDown}</span>
                </span>
              </button>
            </div>
          </section>

          <section class="home-quiz-card">
            <div class="home-card-doodles" aria-hidden="true">
              <img class="hc-heart" src="${ORIG}doodles/doodle-25.svg" alt="" />
              <img class="hc-cloud" src="${ORIG}doodles/doodle-22.svg" alt="" />
              <img class="hc-d1" src="${ORIG}doodles/doodle-24.svg" alt="" />
              <img class="hc-d3" src="${ORIG}doodles/doodle-26.svg" alt="" />
              <img class="hc-d4" src="${ORIG}doodles/doodle-27.svg" alt="" />
              <img class="hc-d5" src="${ORIG}doodles/doodle-28.svg" alt="" />
              <img class="hc-d6" src="${ORIG}doodles/doodle-29.svg" alt="" />
              <img class="hc-d7" src="${ORIG}doodles/doodle-30.svg" alt="" />
              <img class="hc-d8" src="${ORIG}doodles/doodle-31.svg" alt="" />
              <img class="hc-d9" src="${ORIG}doodles/doodle-32.svg" alt="" />
              <img class="hc-d10" src="${ORIG}doodles/doodle-34.svg" alt="" />
            </div>
            <div class="home-card-inset">
              <div class="home-card-content">
                <div class="home-char-scene">
                  <img class="home-char-bg" src="${ORIG}doodles/doodle-21.svg" alt="" aria-hidden="true" />
                  <img class="home-char-img" src="${ORIG}user/home/characters.webp" alt="Bubu and Dudu" />
                </div>
                <div class="home-card-title">${headingHtml}</div>
                <img class="home-curly-line" src="${ORIG}doodles/doodle-23.svg" alt="" aria-hidden="true" />
                <div class="home-cta-wrap">
                  <button class="app-btn" data-action="start-create" aria-label="${safe(t("user", "home.cta"))}">
                    <span>${safe(t("user", "home.cta"))}</span>
                    ${ICONS.arrowRight}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="how-band">
            <div class="how-section">
              <div class="how-header">
                <h2 class="how-title">${safe(t("user", "home.howToPlay.kicker"))}</h2>
                <h3 class="how-kicker">${safe(t("user", "home.howToPlay.title"))}</h3>
              </div>
              <ol class="how-steps">${steps}</ol>
            </div>
          </section>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 2: CREATOR NAME & GENDER (/user/name)
     ========================================================================= */

  function renderUserName() {
    document.body.className = "theme-user";
    document.title = "Enter your name";

    let stepContent = "";
    if (state.nameSubstep === "name") {
      const bubbleHtml = formatRichText(t("user", "name.whatYourName"), {
        sClasses: ["name-speech-accent"]
      });
      stepContent = `
        <section class="name-step">
          <div class="name-prompt-scene">
            <img class="name-doodle name-doodle-bear" src="${ORIG}doodles/doodle-3.svg" alt="" aria-hidden="true" />
            <img class="name-doodle name-doodle-heart-top" src="${ORIG}doodles/doodle-19.svg" alt="" aria-hidden="true" />
            <img class="name-doodle name-doodle-heart-mid" src="${ORIG}doodles/doodle-16.svg" alt="" aria-hidden="true" />
            <img class="name-doodle name-doodle-star" src="${ORIG}doodles/doodle-10.svg" alt="" aria-hidden="true" />
            <div class="name-speech-wrap">
              <img src="${ORIG}user/name/speech-bubble.svg" alt="" aria-hidden="true" />
              <div class="name-speech-text">${bubbleHtml}</div>
            </div>
            <div class="name-mascot-wrap">
              <img class="name-doodle name-doodle-rays" src="${ORIG}doodles/doodle-13.svg" alt="" aria-hidden="true" />
              <img class="name-mascot-img" src="${ORIG}user/name/name-input-bubu-mascot.webp" alt="" />
            </div>
          </div>
          <form id="creator-name-form" class="name-form-stack" novalidate>
            <div class="tooltip-wrap" id="creator-name-tooltip-wrap">
              <div class="shake-tooltip" id="creator-name-error">${safe(t("user", "name.errorNameRequired"))}</div>
              <div class="name-input-box">
                <input id="creator-name-input" type="text" maxlength="15" autocomplete="nickname" placeholder="${safe(t("player", "name.namePlaceholder"))}" value="${safe(state.ownerName)}" />
                <span class="name-counter" id="creator-name-counter">${Array.from(state.ownerName).length}/15</span>
              </div>
            </div>
            <button class="app-btn" type="submit">
              <span>${safe(t("user", "name.continue"))}</span>
              ${ICONS.arrowRight}
            </button>
          </form>
        </section>
      `;
    } else {
      const genderTitleHtml = formatRichText(t("user", "name.selectYourGender"), {
        underlineColor: "#ff942d"
      });
      stepContent = `
        <section class="gender-step">
          <p class="gender-greeting">${safe(t("user", "name.hi"))}, <span class="text-accent-gold">${safe(state.ownerName)}</span> 👋</p>
          <div class="gender-prompt-pill">
            <h1 class="gender-prompt-text">${genderTitleHtml}</h1>
          </div>
          <div class="gender-support-sparkles" aria-hidden="true">
            <img class="gender-sparkle-left" src="${ORIG}doodles/doodle-37.svg" alt="" />
            <img class="gender-sparkle-right" src="${ORIG}doodles/doodle-33.svg" alt="" />
          </div>
          <div class="gender-row">
            <button class="gender-col tilt-left" data-action="choose-gender" data-gender="male">
              <span class="gender-card"><img src="${ORIG}user/name/male.webp" alt="${safe(t("user", "name.male"))}" /></span>
              <span class="gender-label">${safe(t("user", "name.male"))}</span>
            </button>
            <button class="gender-col tilt-right" data-action="choose-gender" data-gender="female">
              <span class="gender-card"><img src="${ORIG}user/name/female.webp" alt="${safe(t("user", "name.female"))}" /></span>
              <span class="gender-label">${safe(t("user", "name.female"))}</span>
            </button>
          </div>
        </section>
      `;
    }

    return `
      <main class="page-shell">
        <div class="mobile-canvas">
          ${renderSceneHeader({ showBack: true, showCountry: true, gender: "female" })}
          <div class="user-name-content">${stepContent}</div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 3: QUIZ CREATION (/user/creating) + WOOHOO COMPLETION CARD
     ========================================================================= */

  function renderWoohooCard() {
    const celeb = formatRichText(t("user", "creating.celebrationTitle"), { highlightBg: "transparent" });
    const readyHtml = formatRichText(t("user", "creating.quizIsReady"), { brushBg: "#FFE8A1" });
    const shareMsgHtml = formatRichText(t("user", "creating.shareMessage"), { underlineColor: "#ffcd20" });
    const mascot = state.gender === "male" ? `${ORIG}user/creating/dudu.webp` : `${ORIG}user/creating/bubu.webp`;

    const confetti = Array.from({ length: 16 }, (_, i) => {
      const colors = ["#fc5286", "#0093ff", "#ffcd20", "#8b5cf6", "#22c55e"];
      const left = 8 + ((i * 19) % 84);
      const top = 4 + ((i * 13) % 34);
      return `<span class="woohoo-confetti-dot" style="left:${left}%;top:${top}%;background:${colors[i % colors.length]};animation-delay:${(i * 0.13).toFixed(2)}s"></span>`;
    }).join("");

    return `
      <div class="woohoo-wrap">
        <section class="woohoo-card">
          <div class="woohoo-confetti-layer" aria-hidden="true">${confetti}</div>
          <img class="woohoo-doodle wd-heart" src="${ORIG}doodles/doodle-30.svg" alt="" aria-hidden="true" />
          <img class="woohoo-doodle wd-star" src="${ORIG}doodles/doodle-29.svg" alt="" aria-hidden="true" />
          <img class="woohoo-doodle wd-shoot" src="${ORIG}doodles/doodle-25.svg" alt="" aria-hidden="true" />
          <img class="woohoo-doodle wd-sparkle" src="${ORIG}doodles/doodle-31.svg" alt="" aria-hidden="true" />

          <div class="woohoo-popper" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <path d="M18 62 L38 18 L62 42 Z" fill="#8b5cf6" stroke="#5b21b6" stroke-width="3" stroke-linejoin="round"/>
              <path d="M27 42 L48 28 M23 52 L55 35" stroke="#ddd6fe" stroke-width="4" stroke-linecap="round"/>
              <circle cx="52" cy="14" r="4" fill="#fc5286"/>
              <circle cx="68" cy="24" r="3.5" fill="#ffcd20"/>
              <circle cx="64" cy="10" r="3" fill="#0093ff"/>
              <circle cx="32" cy="10" r="3" fill="#22c55e"/>
            </svg>
          </div>

          <h1 class="woohoo-heading">${celeb}</h1>
          <svg class="woohoo-scribble-blue" viewBox="0 0 280 24" aria-hidden="true">
            <path d="M4 18 28 5 52 18 76 5 100 18 124 5 148 18 172 5 196 18 220 5 244 18 276 5"/>
          </svg>
          <svg class="woohoo-scribble-pink" viewBox="0 0 180 12" aria-hidden="true">
            <path d="M2 6 Q10 1 18 6 T34 6 T50 6 T66 6 T82 6 T98 6 T114 6 T130 6 T146 6 T162 6 T178 6"/>
          </svg>
          <p class="woohoo-ready-line">${readyHtml}</p>

          <div class="woohoo-note-box">
            <img class="woohoo-note-bg" src="${ORIG}user/creating/note.svg" alt="" aria-hidden="true" />
            <img class="woohoo-note-mascot" src="${mascot}" alt="" />
            <div class="woohoo-note-overlay">
              <img class="woohoo-note-friends" src="${ORIG}user/creating/quiz-completed-note-friends.svg" alt="" aria-hidden="true" />
              <p class="woohoo-note-msg">${shareMsgHtml}</p>
            </div>
          </div>

          <button class="app-btn" data-action="go-share-after-create">
            ${ICONS.forward}
            <span>${safe(t("user", "creating.shareButtonText"))}</span>
          </button>
          <p class="woohoo-fun-footer">${safe(t("user", "creating.funFooter"))}</p>
        </section>
      </div>
    `;
  }

  function renderUserCreating() {
    document.body.className = "theme-user";
    document.title = "creating quiz...";

    const skyBackdrop = `
      <div class="creating-sky-bg" aria-hidden="true">
        <div class="creating-sky-doodles">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<img src="${ORIG}doodles/white-doodles/doodle-white-${n}.svg" alt="" />`).join("")}
        </div>
        <img class="creating-sky-clouds" src="${ORIG}user/clouds.svg" alt="" />
      </div>
    `;

    if (state.creatingCompleted) {
      return `
        <main class="page-shell">
          <div class="mobile-canvas creating-canvas">
            ${skyBackdrop}
            ${renderWoohooCard()}
          </div>
        </main>
      `;
    }

    const item = state.questionSet[state.step];
    if (!item) return renderHome();
    const total = state.questionSet.length || 10;
    const pct = Math.round(((state.step + 1) / total) * 100);
    const visualId = imageQuestionId(item);
    const options = item.options || [];
    const isBinary = options.length === 2;

    const optionsHtml = options.map((opt, idx) => {
      const selected = state.creatingSelected === idx;
      const wavyNum = (idx % 4) + 1;
      const imgSrc = `${Q_ASSET}${visualId}/${idx}.webp`;
      return `
        <button class="creating-option-card ${selected ? "is-selected" : ""}" style="animation-delay:${idx * 0.04}s" data-action="pick-owner-answer" data-index="${idx}" ${state.creatingSelected !== null ? "disabled" : ""}>
          <img class="creating-option-thumb" src="${imgSrc}" alt="" onerror="this.style.display='none'" />
          <span class="creating-option-cluster">
            <span class="creating-option-label">${safe(opt)}</span>
            <img class="creating-wavy-underline" src="${ORIG}doodles/wavy-under-lines/wavy-under-line-${wavyNum}.svg" alt="" aria-hidden="true" />
          </span>
        </button>
      `;
    }).join("");

    return `
      <main class="page-shell">
        <div class="mobile-canvas creating-canvas">
          ${skyBackdrop}
          <div class="creating-body">
            <div class="creating-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Quiz progress: ${pct}%">
              <div class="creating-progress-track">
                <div class="creating-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="creating-progress-count">${state.step + 1}/${total}</span>
            </div>

            <div class="creating-question-wrap">
              <img class="creating-tape" src="${ORIG}user/creating/pink-tape-strip.svg" alt="" aria-hidden="true" />
              <div class="creating-q-badge"><span>${safe(t("user", "creating.question"))} ${state.step + 1}</span></div>
              <div class="creating-question-card">
                <img class="creating-card-doodle cd-1" src="${ORIG}doodles/doodle-30.svg" alt="" aria-hidden="true" />
                <img class="creating-card-doodle cd-2" src="${ORIG}doodles/doodle-18.svg" alt="" aria-hidden="true" />
                <img class="creating-card-doodle cd-3" src="${ORIG}doodles/doodle-37.svg" alt="" aria-hidden="true" />
                <img class="creating-card-doodle cd-4" src="${ORIG}doodles/doodle-7.svg" alt="" aria-hidden="true" />
                <img class="creating-card-doodle cd-5" src="${ORIG}doodles/doodle-33.svg" alt="" aria-hidden="true" />
                <h1 class="creating-q-text">${formatQuestionHtml(item.question, state.ownerName)}</h1>
                <img class="creating-q-mascot" src="${Q_ASSET}${visualId}/header.webp" alt="" onerror="this.src='${ORIG}doodles/doodle-22.svg'" />
              </div>
            </div>

            <div class="creating-options-list ${isBinary ? "is-binary" : ""}">
              ${optionsHtml}
            </div>

            <div class="creating-skip-wrap">
              <button class="creating-skip-btn" data-action="skip-owner-question" ${state.creatingSelected !== null ? "disabled" : ""}>
                <span>↻</span>
                <span>${safe(t("user", "creating.skipQuestion"))}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 4: CREATOR SHARE DASHBOARD (/user/share)
     ========================================================================= */

  function renderUserShare() {
    document.body.className = "theme-share";
    document.title = "Share your quiz";
    const quiz = state.quiz;
    if (!quiz) return renderHome();

    const shareUrl = getShareUrl(quiz);
    const shareMessage = buildShareMessage(quiz);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedMsg = encodeURIComponent(shareMessage);

    const mascotSrc = quiz.gender === "male" ? `${ORIG}user/share/share-dudu.webp` : `${ORIG}user/share/share-bubu.webp`;
    const miniFace = quiz.gender === "male" ? `${ORIG}player/completed/dudu-face.webp` : `${ORIG}player/completed/bubu-face.webp`;

    const bubbleHtml = formatRichText(t("user", "share.bubble"), { highlightBg: "#FFE8A1" });
    const line1Html = formatRichText(t("user", "share.heading.line1"), { underlineColor: "#60a5fa" });
    const line2Text = t("user", "share.heading.line2");
    const line3Html = formatRichText(t("user", "share.heading.line3"), { highlightBg: "#FFE8A1" });

    return `
      <main class="page-shell">
        <div class="mobile-canvas share-canvas">
          ${renderSceneHeader({ showMenu: true, gender: quiz.gender })}
          <div class="share-content">
            <section class="share-card">
              <div class="share-hero">
                <img class="share-doodle sd-star" src="${ORIG}doodles/doodle-12.svg" alt="" aria-hidden="true" />
                <img class="share-doodle sd-heart" src="${ORIG}doodles/doodle-17.svg" alt="" aria-hidden="true" />
                <img class="share-doodle sd-twinkle" src="${ORIG}doodles/doodle-11.svg" alt="" aria-hidden="true" />
                <div class="share-mascot-stage">
                  <img class="share-mascot-img" src="${mascotSrc}" alt="" />
                  <div class="share-bubble">
                    <img class="share-bubble-mini" src="${miniFace}" alt="" aria-hidden="true" />
                    <div class="share-bubble-text">${bubbleHtml}</div>
                  </div>
                </div>
                <div class="share-hero-copy">
                  <div class="share-line"><span>${line1Html}</span><span aria-hidden="true">📎</span></div>
                  <div class="share-ampersand-row"><span class="share-ampersand">${safe(line2Text)}</span></div>
                  <div class="share-line"><span>${line3Html}</span><span aria-hidden="true">🎭</span></div>
                </div>
              </div>

              <div class="share-link-row">
                <div class="share-link-group">
                  <span class="share-link-icon">${ICONS.link}</span>
                  <input id="share-url-input" class="share-link-input" readonly value="${safe(shareUrl)}" />
                </div>
                <button class="share-copy-btn" data-action="copy-share-link">
                  ${ICONS.copy}
                  <span>${safe(state.copied ? t("user", "share.copied") : t("user", "share.copy"))}</span>
                </button>
              </div>

              <div class="share-primary-wa">
                <a class="app-btn theme-whatsapp" href="https://wa.me/?text=${encodedMsg}" target="_blank" rel="noopener noreferrer">
                  ${ICONS.whatsapp}
                  <span>${safe(t("user", "share.shareOn"))} WhatsApp</span>
                </a>
              </div>

              <div class="share-social-grid">
                <button class="social-tile" data-action="share-instagram">
                  <span class="social-badge badge-ig">${ICONS.instagram}</span>
                  <span>Instagram</span>
                </button>
                <a class="social-tile" href="snapchat://creativeKitWeb/camera/1?attachmentUrl=${encodedUrl}">
                  <span class="social-badge badge-sc">${ICONS.snapchat}</span>
                  <span>Snapchat</span>
                </a>
                <a class="social-tile" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer">
                  <span class="social-badge badge-fb">${ICONS.facebook}</span>
                  <span>Facebook</span>
                </a>
                <a class="social-tile" href="fb-messenger://share/?link=${encodedUrl}">
                  <span class="social-badge badge-ms">${ICONS.messenger}</span>
                  <span>Messenger</span>
                </a>
                <a class="social-tile" href="https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(t("user", "share.nativeShareText"))}" target="_blank" rel="noopener noreferrer">
                  <span class="social-badge badge-tg">${ICONS.telegram}</span>
                  <span>Telegram</span>
                </a>
                <button class="social-tile" data-action="share-other-apps">
                  <span class="social-badge badge-other">${ICONS.share}</span>
                  <span>${safe(t("user", "share.otherApps"))}</span>
                </button>
              </div>

              <div class="share-scores-cta">
                <button class="app-btn" data-action="go-scoreboard">
                  <span aria-hidden="true">🏆</span>
                  <span>${safe(t("user", "share.checkScores"))}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 5: CREATOR SCOREBOARD (/user/scoreboard) & VIEW ANSWERS (/user/scoreboard/answers)
     ========================================================================= */

  function renderUserScoreboard() {
    document.body.className = "theme-user";
    document.title = "Scoreboard...";
    const quiz = state.quiz;
    if (!quiz) return renderHome();

    const responses = quiz.responses || [];
    const emptyBear = quiz.gender === "male" ? `${ORIG}user/scoreboard/dudu.webp` : `${ORIG}user/scoreboard/bubu.webp`;

    const mainSection = responses.length === 0 ? `
      <section class="empty-score-card">
        <img class="empty-score-mascot" src="${emptyBear}" alt="No Data" />
        <h1>${safe(t("user", "scoreboard.emptyTitle"))}</h1>
        <p class="empty-score-sub">${safe(t("user", "scoreboard.emptyDescription"))}</p>
        <div style="width:min(100%, 280px)">
          <button class="app-btn rounded-full" data-action="share-other-apps">
            <span>${safe(t("user", "scoreboard.shareYourQuiz"))}</span>
            ${ICONS.share}
          </button>
        </div>
        <div class="empty-score-tip">💡 ${safe(t("user", "scoreboard.moreInteresting"))}</div>
      </section>
    ` : renderScoreboardSection(quiz, { isCreator: true });

    return `
      <main class="page-shell">
        <div class="mobile-canvas">
          ${renderSceneHeader({ showBack: true, showMenu: true, gender: quiz.gender, backLabel: t("user", "scoreboard.backToShare") })}
          <div class="scoreboard-page-content">
            ${mainSection}
          </div>
        </div>
      </main>
    `;
  }

  function renderUserAnswers() {
    document.body.className = "theme-user";
    document.title = "Scoreboard...";
    const quiz = state.quiz;
    if (!quiz) return renderHome();
    const response = (quiz.responses || []).find((r) => r.id === state.reviewResponseId);

    if (!response) {
      return `
        <main class="page-shell">
          <div class="mobile-canvas">
            ${renderSceneHeader({ showBack: true, showMenu: true, gender: quiz.gender })}
            <div class="scoreboard-page-content">
              <div class="empty-score-card">
                <p class="empty-score-sub">${safe(t("user", "viewAnswers.noAnswers"))}</p>
                <button class="app-btn" data-action="go-scoreboard">${safe(t("user", "viewAnswers.backToScoreboard"))}</button>
              </div>
            </div>
          </div>
        </main>
      `;
    }

    const totalQ = Math.max(1, quiz.questions?.length || 10);
    const titleHtml = formatRichText(t("user", "viewAnswers.answersTitle"), {
      vars: { playerName: response.name },
      varClasses: { playerName: "text-accent-blue" },
      underlineColor: "#ff4679"
    });

    const cards = (quiz.questions || []).map((q, idx) => {
      const pickedIdx = response.guesses?.[idx];
      const correctIdx = q.correctAnswer;
      const isCorrect = pickedIdx === correctIdx;
      const visualId = imageQuestionId(q);
      const theirText = q.options?.[pickedIdx] ?? "—";
      const rightText = q.options?.[correctIdx] ?? "—";
      const qLabel = t("user", "viewAnswers.question").replace("{number}", String(idx + 1));

      return `
        <article class="answer-review-card">
          <div class="answer-review-qnum">${safe(qLabel)}</div>
          <div class="answer-review-qtext">${formatQuestionHtml(q.question, quiz.ownerName)}</div>
          <div class="answer-review-label">${safe(t("user", "viewAnswers.theirAnswer"))}</div>
          <div class="answer-review-row ${isCorrect ? "is-correct" : "is-wrong"}">
            ${pickedIdx >= 0 ? `<img src="${Q_ASSET}${visualId}/${pickedIdx}.webp" alt="" onerror="this.style.display='none'" />` : ""}
            <div class="answer-review-copy">
              <div class="answer-review-choice">${safe(theirText)}</div>
              <div class="answer-review-status">${isCorrect ? `✓ ${safe(t("user", "viewAnswers.correctAnswer"))}` : `✗ ${safe(t("user", "viewAnswers.incorrectAnswer"))}`}</div>
            </div>
          </div>
          ${!isCorrect && correctIdx >= 0 ? `
            <div class="answer-review-label">${safe(t("user", "viewAnswers.correctAnswerLabel"))}</div>
            <div class="answer-review-row is-correct">
              <img src="${Q_ASSET}${visualId}/${correctIdx}.webp" alt="" onerror="this.style.display='none'" />
              <div class="answer-review-copy">
                <div class="answer-review-choice">${safe(rightText)}</div>
                <div class="answer-review-status">✓ ${safe(t("user", "viewAnswers.correctAnswer"))}</div>
              </div>
            </div>
          ` : ""}
        </article>
      `;
    }).join("");

    return `
      <main class="page-shell">
        <div class="mobile-canvas">
          ${renderSceneHeader({ showBack: true, showMenu: true, gender: quiz.gender })}
          <div class="scoreboard-page-content">
            <div class="answers-head">
              <h1>${titleHtml}</h1>
              <div class="answers-score-pill">
                <span>${safe(t("user", "viewAnswers.score"))}</span>
                <strong>${response.score}/${totalQ}</strong>
              </div>
            </div>
            <div>${cards}</div>
            <button class="app-btn" data-action="go-scoreboard">${safe(t("user", "viewAnswers.backToScoreboard"))}</button>
          </div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 6: CONTACT & DELETE QUIZ PAGE (/contact)
     ========================================================================= */

  function renderContact() {
    document.body.className = "theme-user";
    document.title = "Contact Us - YouTest.me - Don't Block Me";
    const hasQuiz = Boolean(state.quiz || window.quizStore.getActiveCreatorQuizId());
    const waMsg = encodeURIComponent(t("common", "contact.whatsappMessage"));

    const deleteBlock = state.deletedSuccess ? `
      <section class="contact-delete-card" style="background:#ecfdf5">
        <div class="contact-warn-circle" style="background:#bbf7d0;color:#16a34a">✓</div>
        <h2>${safe(t("common", "contact.deletion.success"))}</h2>
        <p style="margin:0;color:#166534;font-weight:700">${safe(t("common", "contact.deletion.redirecting"))}</p>
      </section>
    ` : (hasQuiz ? `
      <section class="contact-delete-card">
        <div class="contact-warn-circle" aria-hidden="true">⚠</div>
        <h2>${safe(t("common", "contact.deletion.title"))}</h2>
        <button class="contact-delete-btn" data-action="ask-delete-quiz">${safe(t("common", "contact.deletion.button"))}</button>
        <p class="contact-delete-warn">${safe(t("common", "contact.deletion.warning"))}</p>
      </section>
    ` : "");

    return `
      <main class="page-shell">
        <div class="mobile-canvas">
          ${renderSceneHeader({ showBack: true, showMenu: true, backLabel: t("common", "contact.backHome"), gender: state.quiz?.gender || "female" })}
          <div class="contact-content">
            <section class="contact-card">
              <h1>${safe(t("common", "contact.title"))}</h1>
              <p class="contact-sub">${safe(t("common", "contact.subtitle"))}</p>
              <div class="contact-ig-panel">
                <img class="contact-ig-art" src="${ORIG}contact/insta.webp" alt="Instagram" />
                <p class="contact-handle">@official_fake_friend_finder</p>
                <p class="contact-desc">${safe(t("common", "contact.description"))}</p>
                <a class="contact-ig-btn" href="https://instagram.com/official_fake_friend_finder" target="_blank" rel="noopener noreferrer">
                  ${ICONS.instagram}
                  <span>${safe(t("common", "contact.openInstagram"))}</span>
                </a>
                <a class="contact-wa-btn" href="https://wa.me/201125674359?text=${waMsg}" target="_blank" rel="noopener noreferrer">
                  ${ICONS.whatsapp}
                  <span>${safe(t("common", "contact.whatsappButton"))}</span>
                </a>
              </div>
            </section>

            <section class="contact-info-card">
              <h2>${safe(t("common", "contact.information.title"))}</h2>
              <div class="contact-info-group">
                <h3>💬 ${safe(t("common", "contact.information.userContent.title"))}</h3>
                <ul>
                  <li>${safe(t("common", "contact.information.userContent.names"))}</li>
                  <li>${safe(t("common", "contact.information.userContent.manage"))}</li>
                  <li>${safe(t("common", "contact.information.userContent.guesses"))}</li>
                </ul>
              </div>
              <div class="contact-info-group">
                <h3>🔒 ${safe(t("common", "contact.information.privacy.title"))}</h3>
                <ul>
                  <li>${safe(t("common", "contact.information.privacy.personalInfo"))}</li>
                  <li>${safe(t("common", "contact.information.privacy.entertainment"))}</li>
                  <li>${safe(t("common", "contact.information.privacy.delete"))}</li>
                  <li>${safe(t("common", "contact.information.privacy.safety"))}</li>
                </ul>
              </div>
              <div class="contact-info-group">
                <h3>👥 ${safe(t("common", "contact.information.enjoy.title"))}</h3>
                <ul>
                  <li>${safe(t("common", "contact.information.enjoy.share"))}</li>
                  <li>${safe(t("common", "contact.information.enjoy.fun"))}</li>
                </ul>
              </div>
            </section>

            ${deleteBlock}
          </div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 7: FRIEND LANDING (/find?id=<id>&q=<m|f>)
     ========================================================================= */

  function renderFindLanding() {
    document.body.className = "theme-find";
    document.title = "Find Friends you can't trust - Don't Block Me";
    const quiz = state.playerQuiz;
    if (!quiz) return renderNotFound();

    const mascot = quiz.gender === "male" ? `${ORIG}player/home/character-dudu.webp` : `${ORIG}player/home/character-bubu.webp`;
    const thoughtHtml = formatRichText(t("player", "home.thoughtBubble"), {
      sClasses: ["text-accent-rose"],
      highlightBg: "#fff3a6"
    });
    const headingHtml = formatRichText(t("player", "home.heading"), {
      vars: { userName: quiz.ownerName },
      varClasses: { userName: "text-accent-blue" },
      underlineColor: "#ffcd20"
    });
    const subHtml = formatRichText(t("player", "home.subHeading"), {
      vars: { userName: quiz.ownerName },
      varClasses: { userName: "text-accent-navy" }
    });

    return `
      <main class="page-shell">
        <div class="mobile-canvas find-canvas">
          <div class="find-topbar">
            <img class="find-brand" src="${logoForGender(quiz.gender)}" alt="Don't Block Me" />
            <div class="find-controls">
              <button class="find-menu-btn" data-action="open-drawer" aria-label="${safe(t("common", "contact.toggleMenu"))}">${ICONS.menu}</button>
              <button class="compact-lang-btn" data-action="open-lang-modal" aria-label="${safe(t("common", "language.select"))}">
                <img class="compact-lang-globe" src="${ORIG}player/home/globe.svg" alt="" aria-hidden="true" />
                <span>${safe(currentLanguageDisplay())}</span>
                <span class="compact-lang-chevron" aria-hidden="true">${ICONS.chevronDown}</span>
              </button>
            </div>
          </div>

          <section class="find-hero">
            <img class="find-hero-heart" src="${ORIG}doodles/doodle-17.svg" alt="" aria-hidden="true" />
            <img class="find-hero-star" src="${ORIG}doodles/doodle-12.svg" alt="" aria-hidden="true" />
            <div class="find-thought-group">
              <img class="find-thought-cloud" src="${ORIG}player/home/thought-cloud-3.svg" alt="" aria-hidden="true" />
              <div class="find-thought-text"><div>${thoughtHtml}</div></div>
            </div>
            <div class="find-mascot-wrap">
              <img class="find-mascot-img" src="${mascot}" alt="" />
            </div>
          </section>

          <section class="find-note-section">
            <div class="find-note-frame">
              <img class="find-note-card" src="${ORIG}player/home/note-card.svg" alt="" aria-hidden="true" />
              <img class="find-block-phone" src="${ORIG}player/home/block-phone.webp" alt="" aria-hidden="true" />
              <img class="find-sticker-flower" src="${ORIG}doodles/doodle-27.svg" alt="" aria-hidden="true" />
              <img class="find-sticker-star" src="${ORIG}doodles/doodle-29.svg" alt="" aria-hidden="true" />
              <div class="find-note-content">
                <h1 class="find-note-title">${headingHtml}</h1>
                <div class="find-note-divider" aria-hidden="true"><span>♡</span></div>
                <p class="find-note-sub">${subHtml}</p>
              </div>
            </div>
            <div class="find-cta-wrap">
              <button class="app-btn" data-action="start-player-flow">
                <span>${safe(t("player", "home.cta"))}</span>
                ${ICONS.arrowRight}
              </button>
            </div>
          </section>

          ${renderScoreboardSection(quiz, { showYouBadge: true })}
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 8: PLAYER NAME ENTRY (/player/name)
     ========================================================================= */

  function renderPlayerName() {
    document.body.className = "theme-player";
    document.title = "Enter your name";
    const quiz = state.playerQuiz;
    if (!quiz) return renderNotFound();

    const peekChar = quiz.gender === "male" ? `${ORIG}player/name/bubu.webp` : `${ORIG}player/name/dudu.webp`;
    const titleHtml = formatRichText(t("player", "name.enterYourName"), {
      underlineColor: "#60a5fa"
    });

    return `
      <main class="page-shell">
        <div class="mobile-canvas player-sky-canvas">
          <header class="player-name-header">
            <button class="player-back-btn" data-action="go-back" aria-label="${safe(t("common", "nav.back"))}">${ICONS.back}</button>
            <img class="player-header-logo" src="${logoForGender(quiz.gender)}" alt="Don't Block Me" />
            <span></span>
          </header>

          <section class="player-name-stage">
            <img class="pn-sky-star" src="${ORIG}doodles/white-doodles/doodle-white-7.svg" alt="" aria-hidden="true" />
            <img class="pn-sky-plane" src="${ORIG}doodles/white-doodles/doodle-white-8.svg" alt="" aria-hidden="true" />
            <span class="pn-sky-q" aria-hidden="true">?</span>

            <div class="dash-card-wrap">
              <img class="dash-peeking-char" src="${peekChar}" alt="" aria-hidden="true" />
              <img class="dash-nameplate" src="${ORIG}player/name/nameplate.webp" alt="" aria-hidden="true" />
              <img class="dash-sticker-star" src="${ORIG}doodles/doodle-29.svg" alt="" aria-hidden="true" />
              <img class="dash-sticker-heart" src="${ORIG}doodles/doodle-24.svg" alt="" aria-hidden="true" />
              <img class="dash-sticker-flower" src="${ORIG}doodles/doodle-27.svg" alt="" aria-hidden="true" />

              <div class="dash-card-inner">
                <h1 class="dash-card-title">${titleHtml}</h1>
                <form id="player-name-form" class="name-form-stack" novalidate>
                  <div class="tooltip-wrap" id="player-name-tooltip-wrap">
                    <div class="shake-tooltip" id="player-name-error">${safe(t("player", "name.errorNameRequired"))}</div>
                    <div class="name-input-box">
                      <input id="player-name-input" type="text" maxlength="15" autocomplete="nickname" placeholder="${safe(t("player", "name.namePlaceholder"))}" value="${safe(state.playerName)}" />
                      <span class="name-counter" id="player-name-counter">${Array.from(state.playerName).length}/15</span>
                    </div>
                  </div>
                  <button class="app-btn" type="submit">
                    <span>${safe(t("player", "name.continue"))}</span>
                    ${ICONS.arrowRight}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 9: PLAYER GAMEPLAY (/player/playing)
     ========================================================================= */

  function renderPlayerPlaying() {
    document.body.className = "theme-player";
    document.title = "guess answers....";
    const quiz = state.playerQuiz;
    if (!quiz) return renderNotFound();

    const questions = quiz.questions || [];
    const total = questions.length || 10;
    const item = questions[state.playerStep];
    if (!item) return renderPlayerCompleted();

    const visualId = imageQuestionId(item);
    const fb = state.playerFeedback;

    const tilesHtml = Array.from({ length: total }, (_, idx) => {
      let cls = "";
      let content = String(idx + 1);
      if (idx < state.playerStep) {
        const right = state.guesses[idx] === questions[idx].correctAnswer;
        cls = right ? "is-correct" : "is-wrong";
        content = right ? "✓" : "✕";
      } else if (idx === state.playerStep) {
        if (fb) {
          cls = fb.isCorrect ? "is-correct" : "is-wrong";
          content = fb.isCorrect ? "✓" : "✕";
        } else {
          cls = "is-current";
        }
      }
      return `<span class="playing-tile ${cls}">${content}</span>`;
    }).join("");

    const optionsHtml = (item.options || []).map((opt, idx) => {
      let cls = "";
      let badge = "";
      if (fb) {
        if (idx === fb.correctIndex) {
          cls = "is-correct";
          badge = `<div class="playing-opt-overlay"><span class="playing-opt-badge">✓</span></div>`;
        } else if (idx === fb.pickedIndex && !fb.isCorrect) {
          cls = "is-wrong";
          badge = `<div class="playing-opt-overlay"><span class="playing-opt-badge">✕</span></div>`;
        }
      }
      return `
        <button class="playing-opt-btn ${cls}" data-action="pick-player-guess" data-index="${idx}" ${fb ? "disabled" : ""}>
          <div class="playing-opt-frame">
            <img class="playing-opt-img" src="${Q_ASSET}${visualId}/${idx}.webp" alt="" onerror="this.style.display='none'" />
            ${badge}
          </div>
          <span class="playing-opt-label">${safe(opt)}</span>
        </button>
      `;
    }).join("");

    return `
      <main class="page-shell">
        <div class="mobile-canvas player-sky-canvas">
          <div class="playing-content">
            <section class="playing-stage">
              <div class="playing-tray">
                <div class="playing-track">${tilesHtml}</div>
              </div>

              <div class="playing-mascot-scene">
                <span class="playing-mascot-blob" aria-hidden="true"></span>
                <img class="playing-mascot-img" src="${Q_ASSET}${visualId}/header.webp" alt="" onerror="this.src='${ORIG}doodles/doodle-22.svg'" />
              </div>

              <div class="playing-q-card">
                <div class="playing-q-strip"><span>${safe(t("user", "creating.question"))} ${state.playerStep + 1}</span></div>
                <img class="playing-q-bg" src="${ORIG}player/playing/question-bg.svg" alt="" aria-hidden="true" />
                <div class="playing-q-content">
                  <h1 class="playing-q-text">${formatQuestionHtml(item.question, quiz.ownerName)}</h1>
                </div>
              </div>

              <div class="playing-option-grid">${optionsHtml}</div>
            </section>
          </div>
        </div>
      </main>
    `;
  }

  /* =========================================================================
     VIEW 10: PLAYER COMPLETED (/player/completed) — FULL 4-STAGE ANIMATED STORY
     ========================================================================= */

  function scoreCounterSvg(value, total) {
    const valStr = String(value);
    const twoDigits = valStr.length > 1;
    const vb = twoDigits ? "4 0 430 150" : "24 0 350 150";
    const vx = twoDigits ? 136 : 112;
    const vf = twoDigits ? 138 : 146;
    const sx = twoDigits ? 258 : 186;
    const tx = twoDigits ? 306 : 230;
    return `
      <svg class="score-svg" viewBox="${vb}" role="img" aria-label="${valStr} out of ${total}">
        <defs>
          <linearGradient id="score-blue-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#63acff"/>
            <stop offset="0.28" stop-color="#3d8bff"/>
            <stop offset="0.62" stop-color="#2872ff"/>
            <stop offset="1" stop-color="#1d5fe8"/>
          </linearGradient>
          <linearGradient id="score-ink-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#56647f"/>
            <stop offset="0.36" stop-color="#303d5b"/>
            <stop offset="1" stop-color="#14203a"/>
          </linearGradient>
          <filter id="score-shadow-f" x="-12%" y="-18%" width="124%" height="145%">
            <feDropShadow dx="0" dy="4" stdDeviation="2" flood-color="#4d5568" flood-opacity="0.28"/>
          </filter>
        </defs>
        <g class="score-svg-text" filter="url(#score-shadow-f)">
          <g fill="none" stroke="#fffefd" stroke-linejoin="round" stroke-width="16">
            <text x="${vx}" y="126" font-size="${vf}" text-anchor="middle">${valStr}</text>
            <text x="${sx}" y="123" font-size="109" text-anchor="middle">/</text>
            <text x="${tx}" y="124" font-size="112">${total}</text>
          </g>
          <g fill="none" stroke="#eff7ff" stroke-linejoin="round" stroke-width="10">
            <text x="${vx}" y="126" font-size="${vf}" text-anchor="middle">${valStr}</text>
          </g>
          <g fill="none" stroke="#f0f3f8" stroke-linejoin="round" stroke-width="10">
            <text x="${sx}" y="123" font-size="109" text-anchor="middle">/</text>
            <text x="${tx}" y="124" font-size="112">${total}</text>
          </g>
          <g fill="none" stroke="#1266f8" stroke-linejoin="round" stroke-width="4">
            <text x="${vx}" y="126" font-size="${vf}" text-anchor="middle">${valStr}</text>
          </g>
          <g fill="none" stroke="#101a31" stroke-linejoin="round" stroke-width="4">
            <text x="${sx}" y="123" font-size="109" text-anchor="middle">/</text>
            <text x="${tx}" y="124" font-size="112">${total}</text>
          </g>
          <text x="${vx}" y="126" font-size="${vf}" text-anchor="middle" fill="url(#score-blue-g)">${valStr}</text>
          <text x="${sx}" y="123" font-size="109" text-anchor="middle" fill="url(#score-ink-g)">/</text>
          <text x="${tx}" y="124" font-size="112" fill="url(#score-ink-g)">${total}</text>
        </g>
      </svg>
    `;
  }

  function renderPlayerCompleted() {
    document.body.className = "theme-player";
    document.title = "Quiz Completed";
    const quiz = state.playerQuiz;
    const resp = state.playerResponse;
    if (!quiz || !resp) return renderNotFound();

    const total = Math.max(1, quiz.questions?.length || 10);
    const creatorChar = quiz.gender === "male" ? "dudu" : "bubu";
    const playerChar = quiz.gender === "male" ? "bubu" : "dudu";
    const yourScoreHtml = formatRichText(t("player", "completed.youScored"), { sClasses: ["text-accent-pink"] });
    const nowTurnHtml = formatRichText(t("player", "completed.nowYourTurn"), { highlightBg: "transparent" });

    const scoreDoodles = [
      { n: 10, st: "width:8%;left:14%;bottom:33%" },
      { n: 19, st: "width:5%;right:14%;bottom:33%" },
      { n: 24, st: "width:10%;right:3%;bottom:20%" },
      { n: 33, st: "width:4%;right:3%;bottom:8%" },
      { n: 37, st: "width:4%;left:15%;bottom:13%" },
      { n: 35, st: "width:4%;left:30%;bottom:7%" },
      { n: 39, st: "width:7%;left:50%;bottom:35%" },
      { n: 29, st: "width:7%;left:55%;bottom:10%" }
    ].map((d, i) => `<img class="score-counter-doodle" src="${ORIG}doodles/doodle-${d.n}.svg" style="${d.st};animation-delay:${(i * 0.18).toFixed(2)}s" alt="" aria-hidden="true" />`).join("");

    return `
      <main class="page-shell">
        <div class="mobile-canvas completed-canvas">
          <div class="completed-score-slot" dir="ltr">
            <div class="score-counter-shell" id="completed-score-shell" dir="ltr">
              <img class="score-counter-bg" src="${ORIG}player/completed/score-counter-bg.svg" alt="" aria-hidden="true" />
              <div class="score-counter-doodles">${scoreDoodles}</div>
              <div class="your-score-slip">
                <img src="${ORIG}player/completed/your-score-bg.svg" alt="" aria-hidden="true" />
                <div class="your-score-label" dir="${isAr() ? "rtl" : "ltr"}">${yourScoreHtml}</div>
              </div>
              <div class="score-svg-container" id="completed-score-svg">
                ${scoreCounterSvg(0, total)}
              </div>
            </div>
          </div>

          <section class="completed-stage-area" id="completed-stage" dir="ltr">
            <img class="completed-stage-svg" src="${ORIG}player/completed/stage.svg" alt="" aria-hidden="true" />
            <div class="stage-nameplates-row">
              <div class="stage-nameplate-left">
                <img class="stage-face-icon" src="${ORIG}player/completed/${creatorChar}-face.webp" alt="" />
                <span class="stage-face-name">${safe(quiz.ownerName)}</span>
              </div>
              <div class="stage-nameplate-right">
                <img class="stage-face-icon" src="${ORIG}player/completed/${playerChar}-face.webp" alt="" />
                <span class="stage-face-name">${safe(resp.name)}</span>
              </div>
            </div>
            <div class="stage-actors-overlay">
              <div class="stage-actors-frame">
                <div class="stage-speech-layer" id="stage-speech-layer"></div>
                <div id="stage-actors" style="display:flex;align-items:flex-end;justify-content:center;width:100%;gap:8px;">
                  <img class="actor-creator is-walking" src="${ORIG}player/completed/${creatorChar}-walk.webp" alt="" />
                  <img class="actor-player" src="${ORIG}player/completed/${playerChar}-standing.webp" alt="" />
                </div>
              </div>
            </div>
          </section>

          <div class="completed-bottom-actions" id="completed-bottom-actions">
            <section class="completed-cta-band">
              <h2 class="completed-turn-title">${nowTurnHtml}</h2>
              <div class="completed-hand-pointer" aria-hidden="true">👇</div>
              <div class="completed-cta-btn-wrap">
                <button class="app-btn" data-action="go-home-fresh">${safe(t("player", "completed.createYourQuiz"))}</button>
              </div>
            </section>
            <div class="completed-sb-wrap">
              ${renderScoreboardSection(quiz, { showYouBadge: true })}
            </div>
          </div>
        </div>
      </main>
    `;
  }

  /* Typewriter animation across formatted DOM text nodes with bandpass noise ticks */
  function runTypewriter(containerEl, html, onDone) {
    containerEl.innerHTML = html;
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        nodes.push({ node, chars: Array.from(node.nodeValue) });
        node.nodeValue = "";
      }
    }
    let nIdx = 0;
    let cIdx = 0;
    function step() {
      if (nIdx >= nodes.length) {
        if (onDone) onDone();
        return;
      }
      const entry = nodes[nIdx];
      const ch = entry.chars[cIdx];
      entry.node.nodeValue += ch;
      if (ch && ch.trim()) window.dbmAudio.playTypeTick();
      cIdx += 1;
      if (cIdx >= entry.chars.length) {
        nIdx += 1;
        cIdx = 0;
      }
      scheduleTimeout(step, 58);
    }
    step();
  }

  function startCompletedSequence() {
    const quiz = state.playerQuiz;
    const resp = state.playerResponse;
    if (!quiz || !resp) return;

    const total = Math.max(1, quiz.questions?.length || 10);
    const score = Math.max(0, Math.min(total, resp.score || 0));
    const normalized10 = Math.round((score / total) * 10);
    const level = normalized10 >= 8 ? "high" : normalized10 >= 5 ? "medium" : "low";
    const reactNum = level === "high" ? "8" : level === "medium" ? "5" : "0";
    const creatorChar = quiz.gender === "male" ? "dudu" : "bubu";
    const playerChar = quiz.gender === "male" ? "bubu" : "dudu";

    const speechLayer = document.getElementById("stage-speech-layer");
    const actorsEl = document.getElementById("stage-actors");
    const scoreShell = document.getElementById("completed-score-shell");
    const scoreSvgHost = document.getElementById("completed-score-svg");
    const bottomActions = document.getElementById("completed-bottom-actions");
    if (!speechLayer || !actorsEl || !scoreShell || !scoreSvgHost || !bottomActions) return;

    function showBubble(side, rawKey, opts, onDone) {
      const bubbleImg = side === "right" ? "speech-bubble-right.svg" : "speech-bubble-left.svg";
      const alignCls = side === "right" ? "align-right" : side === "center" ? "align-center" : "align-left";
      speechLayer.innerHTML = `
        <div class="stage-speech-box ${alignCls}">
          <img src="${ORIG}player/completed/${bubbleImg}" alt="" aria-hidden="true" />
          <div class="stage-speech-copy" dir="${isAr() ? "rtl" : "ltr"}"><span id="tw-target"></span></div>
        </div>
      `;
      const tw = document.getElementById("tw-target");
      const formatted = formatRichText(t("player", rawKey), opts);
      runTypewriter(tw, formatted, onDone);
    }

    // Background audio starts after 600ms
    scheduleTimeout(() => {
      completedBgAudio = window.dbmAudio.play("complete-bg", { volume: 0.55, playbackRate: 1.05 });
    }, 600);

    // STAGE 1: CreatorEntrance
    window.dbmAudio.play("walk", { volume: 0.7 });
    scheduleTimeout(() => {
      window.dbmAudio.play("huh", { volume: 0.85 });
      actorsEl.innerHTML = `
        <img class="actor-creator" src="${ORIG}player/completed/${creatorChar}-walk-stop.webp" alt="" />
        <img class="actor-player" src="${ORIG}player/completed/${playerChar}-standing.webp" alt="" />
      `;
      showBubble("left", "completed.conversation.creator_1", { sClasses: ["text-accent-pink"] }, () => {
        scheduleTimeout(() => {
          window.dbmAudio.play("umm", { volume: 0.85 });
          showBubble("right", "completed.conversation.player_2", { sClasses: ["text-accent-crimson"], underlineColor: "#ffcd20" }, () => {
            scheduleTimeout(runConversationScene, 900);
          });
        }, 850);
      });
    }, 2150);

    // STAGE 2: ConversationScene
    function runConversationScene() {
      actorsEl.innerHTML = `
        <img class="actor-creator" src="${ORIG}player/completed/${creatorChar}-phone.webp" alt="" />
        <img class="actor-player is-flipped" src="${ORIG}player/completed/${playerChar}-confused.webp" alt="" />
      `;
      window.dbmAudio.play("aaapo", { volume: 0.8 });
      showBubble("left", "completed.conversation.creator_3", { sClasses: ["text-accent-pink"] }, () => {
        scheduleTimeout(() => {
          showBubble("right", "completed.conversation.player_4", { highlightBg: "#ffe8a1" }, () => {
            scheduleTimeout(() => {
              showBubble("left", "completed.conversation.creator_5", { highlightBg: "#ffe8a1" }, () => {
                scheduleTimeout(runDecisionScene, 900);
              });
            }, 850);
          });
        }, 850);
      });
    }

    // STAGE 3: DecisionScene + ScoreCounter Count-Up (exact cbrt easing)
    function runDecisionScene() {
      speechLayer.innerHTML = "";
      actorsEl.innerHTML = `
        <img class="actor-creator is-decision" src="${ORIG}player/completed/${creatorChar}-face-up.webp" alt="" />
        <img class="actor-player is-decision" src="${ORIG}player/completed/${playerChar}-face-up.webp" alt="" />
      `;
      scoreShell.classList.add("is-visible");
      document.getElementById("completed-stage")?.classList.add("has-score");
      window.dbmAudio.play("bounce", { volume: 0.7 });
      scheduleTimeout(() => window.dbmAudio.play("dun-dun", { volume: 0.32 }), 450);

      const duration = score === 0 ? 0 : score <= 2 ? 950 : score <= 4 ? 1400 : score <= 6 ? 1850 : score <= 8 ? 2250 : 2650;
      const startDelay = 1200;

      function stepTime(stepIdx) {
        let accum = 0;
        for (let i = 1; i <= stepIdx; i += 1) {
          accum = Math.max(accum + 100, duration * (1 - Math.cbrt(1 - (i - 0.5) / score)));
        }
        return accum;
      }

      if (score === 0) {
        scoreSvgHost.innerHTML = scoreCounterSvg(0, total);
        scheduleTimeout(runReactionScene, startDelay + 350);
        return;
      }

      for (let s = 1; s <= score; s += 1) {
        const tMs = startDelay + Math.round(stepTime(s));
        scheduleTimeout(() => {
          scoreSvgHost.innerHTML = scoreCounterSvg(s, total);
          window.dbmAudio.play("scorePop", { playbackRate: 1 + (s - 1) * 0.14, volume: 0.5 });
          if (s === score) {
            scheduleTimeout(runReactionScene, 550);
          }
        }, tMs);
      }
    }

    // STAGE 4: ReactionScene + Unlock Bottom CTA & Scoreboard + Timed Invitation Modal
    function runReactionScene() {
      window.dbmAudio.play(`result-${level}`, { volume: 0.85 });
      const animCls = level === "high" ? "actor-reaction-high" : level === "medium" ? "actor-reaction-medium" : "actor-reaction-low";
      actorsEl.innerHTML = `<img class="${animCls}" src="${ORIG}player/completed/${creatorChar}-${reactNum}.webp" alt="" />`;
      showBubble("center", `completed.replyText.${level}`, {
        sClasses: ["text-accent-pink"],
        highlightBg: "#ffe8a1",
        underlineColor: "#ffcd20"
      }, () => {
        scheduleTimeout(() => {
          window.dbmAudio.play("whoosh", { volume: 0.7 });
          bottomActions.classList.add("is-unlocked");
          // Timed Quiz Invitation Popup (11s after bottom actions reveal, exact match to live site)
          scheduleTimeout(() => {
            if (state.route === "playerCompleted" && !state.inviteModalOpen) {
              state.inviteModalOpen = true;
              renderOverlaysOnly();
            }
          }, 11000);
        }, 700);
      });
    }
  }

  /* =========================================================================
     VIEW 11: CUSTOM 404 PAGE (/404)
     ========================================================================= */

  function renderNotFound() {
    document.body.className = "theme-404";
    document.title = "Find Friends you can't trust - Don't Block Me";
    return `
      <main class="page-shell">
        <section class="not-found-scene" aria-labelledby="not-found-title">
          <span class="nf-cloud nf-cloud-l" aria-hidden="true"></span>
          <span class="nf-cloud nf-cloud-r" aria-hidden="true"></span>
          <span class="nf-sparkle nf-sp-1" aria-hidden="true"></span>
          <span class="nf-sparkle nf-sp-2" aria-hidden="true"></span>
          <div class="nf-content">
            <div class="nf-illustration">
              <span class="nf-code" aria-hidden="true">404</span>
              <img class="nf-bubu" src="${ORIG}user/scoreboard/bubu.webp" alt="${safe(t("common", "notFound.imageAlt"))}" />
            </div>
            <h1 id="not-found-title">${safe(t("common", "notFound.title"))}</h1>
            <p>${safe(t("common", "notFound.description"))}</p>
            <button class="app-btn rounded-full nf-home-btn" data-action="go-home-fresh">${safe(t("common", "notFound.home"))}</button>
          </div>
        </section>
      </main>
    `;
  }

  /* =========================================================================
     MASTER RENDER + OVERLAYS
     ========================================================================= */

  function renderOverlaysHtml() {
    return `${renderDrawer()}${renderLanguageModal()}${renderCountryModal()}${renderConfirmModal()}${renderInviteModal()}`;
  }

  function renderOverlaysOnly() {
    let overlayHost = document.getElementById("overlay-host");
    if (!overlayHost) {
      overlayHost = document.createElement("div");
      overlayHost.id = "overlay-host";
      root.appendChild(overlayHost);
    }
    overlayHost.innerHTML = renderOverlaysHtml();
    bindOverlayInputs();
  }

  function bindOverlayInputs() {
    const search = document.getElementById("country-search-input");
    if (search) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
      search.addEventListener("input", () => {
        state.countrySearch = search.value;
        const cur = currentCountryObj();
        const q = state.countrySearch.trim().toLowerCase();
        const filtered = q
          ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
          : COUNTRIES;
        const box = document.getElementById("country-results-box");
        if (!box) return;
        box.innerHTML = filtered.length
          ? `<ul class="country-list">${filtered.map((c) => {
              const sel = c.code === cur.code;
              return `<li><button class="country-row ${sel ? "is-selected" : ""}" data-action="select-country" data-code="${c.code}"><span class="country-row-flag">${c.flag}</span><span class="country-row-name">${safe(c.name)}</span><span class="country-row-code">${c.code}</span><span>${sel ? `<span class="country-check">✓</span>` : ""}</span></button></li>`;
            }).join("")}</ul>`
          : `<div style="text-align:center;padding:48px 16px;font-weight:800;opacity:.7">${safe(t("user", "name.countryPicker.empty"))}</div>`;
      });
    }
  }

  function render() {
    document.documentElement.lang = isAr() ? "ar" : "en";
    document.documentElement.dir = isAr() ? "rtl" : "ltr";

    const viewMap = {
      home: renderHome,
      userName: renderUserName,
      userCreating: renderUserCreating,
      userShare: renderUserShare,
      userScoreboard: renderUserScoreboard,
      userAnswers: renderUserAnswers,
      contact: renderContact,
      find: renderFindLanding,
      playerName: renderPlayerName,
      playerPlaying: renderPlayerPlaying,
      playerCompleted: renderPlayerCompleted,
      notFound: renderNotFound
    };

    const viewHtml = (viewMap[state.route] || renderNotFound)();
    root.innerHTML = `${viewHtml}<div id="overlay-host">${renderOverlaysHtml()}</div>`;

    bindViewListeners();
    bindOverlayInputs();
    releaseBootScreen();

    if (state.route === "playerCompleted") {
      startCompletedSequence();
    }
  }

  function bindViewListeners() {
    const creatorInput = document.getElementById("creator-name-input");
    if (creatorInput) {
      creatorInput.addEventListener("input", () => {
        state.ownerName = creatorInput.value.slice(0, 15);
        const counter = document.getElementById("creator-name-counter");
        if (counter) counter.textContent = `${Array.from(state.ownerName).length}/15`;
        document.getElementById("creator-name-tooltip-wrap")?.classList.remove("show-error");
      });
    }

    const playerInput = document.getElementById("player-name-input");
    if (playerInput) {
      playerInput.addEventListener("input", () => {
        state.playerName = playerInput.value.slice(0, 15);
        const counter = document.getElementById("player-name-counter");
        if (counter) counter.textContent = `${Array.from(state.playerName).length}/15`;
        document.getElementById("player-name-tooltip-wrap")?.classList.remove("show-error");
      });
    }
  }

  /* =========================================================================
     QUESTION BANK INITIALIZATION & QUIZ LOGIC
     ========================================================================= */

  function prepareQuestions(gender) {
    const bank = window.questionBanks?.[state.language]?.[gender]
      || window.questionBanks?.en?.[gender]
      || window.questionBanks?.female
      || [];
    const shuffled = bank.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pool = shuffled.map(([qId, question, options]) => ({ id: qId, question, options }));
    state.questionPool = pool;
    state.questionSet = pool.slice(0, Math.min(10, pool.length));
    state.poolCursor = state.questionSet.length;
    state.answers = [];
    state.step = 0;
    state.creatingSelected = null;
    state.creatingCompleted = false;
  }

  function skipCurrentOwnerQuestion() {
    if (state.questionPool.length <= state.questionSet.length) {
      // Still allow rotating with a random other question not in current slot
      return;
    }
    window.dbmAudio.play("swipe", { volume: 0.75 });
    const usedIds = new Set(state.questionSet.map((q) => q.id));
    let replacement = null;
    for (let tries = 0; tries < state.questionPool.length; tries += 1) {
      const candidate = state.questionPool[state.poolCursor % state.questionPool.length];
      state.poolCursor += 1;
      if (!usedIds.has(candidate.id)) {
        replacement = candidate;
        break;
      }
    }
    if (replacement) {
      state.questionSet[state.step] = replacement;
      render();
    }
  }

  async function finishOwnerQuiz() {
    const questions = state.questionSet.map((q, idx) => ({
      ...q,
      correctAnswer: state.answers[idx] ?? 0
    }));
    const quiz = {
      id: uid(),
      ownerName: state.ownerName.trim(),
      gender: state.gender,
      language: state.language,
      country: state.country,
      questions,
      createdAt: new Date().toISOString(),
      responses: []
    };
    try {
      state.quiz = await window.quizStore.save(quiz);
      window.quizStore.setActiveCreatorQuizId(state.quiz.id);
      state.creatingCompleted = true;
      state.creatingSelected = null;
      render();
    } catch (err) {
      console.error("[finishOwnerQuiz]", err);
      state.creatingSelected = null;
      render();
      showToast(isAr() ? "تعذر حفظ الاختبار الآن، حاول مرة أخرى" : "Could not save quiz right now, please try again");
    }
  }

  async function finishPlayerQuiz() {
    const quiz = state.playerQuiz;
    const score = state.guesses.reduce((sum, ans, idx) => (
      sum + (ans === quiz.questions[idx]?.correctAnswer ? 1 : 0)
    ), 0);
    const response = {
      id: uid(),
      name: state.playerName.trim(),
      guesses: state.guesses.slice(),
      score,
      createdAt: new Date().toISOString()
    };
    try {
      const updatedQuiz = await window.quizStore.addResponse(quiz.id, response);
      if (!updatedQuiz) {
        state.playerQuiz = null;
        navigate("home", { replace: true, noRedirect: true });
        showToast(expiredMessage());
        return;
      }
      state.playerQuiz = updatedQuiz;
      if (state.quiz && state.quiz.id === quiz.id) state.quiz = state.playerQuiz;
      state.playerResponse = response;
      window.quizStore.setPlayerSubmission(quiz.id, response.id);
      navigate("playerCompleted");
    } catch (err) {
      console.error("[finishPlayerQuiz]", err);
      showToast(isAr() ? "تعذر إرسال النتيجة، حاول مرة أخرى" : "Could not submit score, please try again");
    }
  }

  /* =========================================================================
     GLOBAL EVENT HANDLERS
     ========================================================================= */

  root.addEventListener("click", async (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "open-drawer") {
      state.drawerOpen = true;
      renderOverlaysOnly();
      root.querySelector(".drawer-close")?.focus();
    } else if (action === "close-drawer") {
      state.drawerOpen = false;
      renderOverlaysOnly();
    } else if (action === "open-lang-modal") {
      state.drawerOpen = false;
      state.langModalOpen = true;
      renderOverlaysOnly();
    } else if (action === "close-lang-modal") {
      state.langModalOpen = false;
      renderOverlaysOnly();
    } else if (action === "select-lang") {
      const chosen = el.dataset.lang || "en";
      state.displayLangCode = chosen;
      state.language = chosen === "ar" ? "ar" : "en";
      localStorage.setItem("dbm-display-lang", state.displayLangCode);
      localStorage.setItem("dbm-language", state.language);
      state.langModalOpen = false;
      clearAsyncWork();
      render();
    } else if (action === "open-country") {
      state.countrySearch = "";
      state.countryModalOpen = true;
      renderOverlaysOnly();
    } else if (action === "close-country") {
      state.countryModalOpen = false;
      renderOverlaysOnly();
    } else if (action === "select-country") {
      state.country = el.dataset.code || "EG";
      window.quizStore.setCountry(state.country);
      state.countryModalOpen = false;
      render();
    } else if (action === "close-confirm") {
      state.confirmModal = null;
      renderOverlaysOnly();
    } else if (action === "close-invite") {
      state.inviteModalOpen = false;
      renderOverlaysOnly();
    } else if (action === "close-modals-backdrop") {
      if (event.target === el) {
        state.langModalOpen = false;
        state.confirmModal = null;
        renderOverlaysOnly();
      }
    } else if (action === "start-create") {
      state.ownerName = "";
      state.nameSubstep = "name";
      navigate("userName");
    } else if (action === "go-home-fresh") {
      navigate("home", { noRedirect: true });
    } else if (action === "ask-new-quiz") {
      state.drawerOpen = false;
      state.confirmModal = { type: "newQuiz" };
      renderOverlaysOnly();
    } else if (action === "confirm-new-quiz") {
      window.quizStore.clearActiveCreatorQuizId();
      state.quiz = null;
      state.ownerName = "";
      state.nameSubstep = "name";
      navigate("home", { noRedirect: true });
    } else if (action === "go-contact") {
      navigate("contact");
    } else if (action === "ask-delete-quiz") {
      state.confirmModal = { type: "deleteQuiz" };
      renderOverlaysOnly();
    } else if (action === "confirm-delete-quiz") {
      const targetId = state.quiz?.id || window.quizStore.getActiveCreatorQuizId();
      state.confirmModal = null;
      if (targetId) await window.quizStore.delete(targetId);
      state.quiz = null;
      state.deletedSuccess = true;
      render();
      scheduleTimeout(() => navigate("home", { noRedirect: true, replace: true }), 1400);
    } else if (action === "choose-gender") {
      state.gender = el.dataset.gender === "male" ? "male" : "female";
      prepareQuestions(state.gender);
      navigate("userCreating");
    } else if (action === "pick-owner-answer") {
      if (state.creatingSelected !== null) return;
      const idx = Number(el.dataset.index);
      state.creatingSelected = idx;
      state.answers[state.step] = idx;
      window.dbmAudio.play("pop", { volume: 0.75 });
      render();
      scheduleTimeout(async () => {
        if (state.step >= state.questionSet.length - 1) {
          await finishOwnerQuiz();
        } else {
          state.step += 1;
          state.creatingSelected = null;
          render();
        }
      }, 320);
    } else if (action === "skip-owner-question") {
      skipCurrentOwnerQuestion();
    } else if (action === "go-share-after-create") {
      state.copied = false;
      navigate("userShare");
    } else if (action === "copy-share-link") {
      if (!state.quiz) return;
      await copyText(getShareUrl(state.quiz));
      state.copied = true;
      render();
      showToast(t("user", "share.linkCopiedAlert"));
      scheduleTimeout(() => {
        state.copied = false;
        if (state.route === "userShare") render();
      }, 2200);
    } else if (action === "share-instagram") {
      if (!state.quiz) return;
      await copyText(getShareUrl(state.quiz));
      showToast(t("user", "share.linkCopiedAlert"));
    } else if (action === "share-other-apps") {
      if (!state.quiz) return;
      const url = getShareUrl(state.quiz);
      const data = {
        title: t("user", "share.nativeShareTitle"),
        text: t("user", "share.nativeShareText"),
        url
      };
      if (navigator.share) {
        try { await navigator.share(data); } catch {}
      } else {
        await copyText(url);
        showToast(t("user", "share.linkCopiedAlert"));
      }
    } else if (action === "go-scoreboard") {
      if (state.quiz) {
        const refreshed = await window.quizStore.get(state.quiz.id);
        if (!refreshed) {
          state.quiz = null;
          navigate("home", { replace: true, noRedirect: true });
          showToast(expiredMessage());
          return;
        }
        state.quiz = refreshed;
      }
      navigate("userScoreboard");
    } else if (action === "view-answers") {
      state.reviewResponseId = el.dataset.responseId;
      navigate("userAnswers");
    } else if (action === "ask-remove-player") {
      state.confirmModal = { type: "deletePlayer", targetId: el.dataset.responseId };
      renderOverlaysOnly();
    } else if (action === "confirm-remove-player") {
      const respId = state.confirmModal?.targetId;
      state.confirmModal = null;
      if (state.quiz && respId) {
        state.quiz = await window.quizStore.removeResponse(state.quiz.id, respId);
      }
      render();
    } else if (action === "start-player-flow") {
      state.playerName = "";
      navigate("playerName");
    } else if (action === "pick-player-guess") {
      if (state.playerFeedback) return;
      const idx = Number(el.dataset.index);
      const item = state.playerQuiz?.questions?.[state.playerStep];
      if (!item) return;
      const isCorrect = idx === item.correctAnswer;
      state.guesses[state.playerStep] = idx;
      state.playerFeedback = { pickedIndex: idx, correctIndex: item.correctAnswer, isCorrect };
      window.dbmAudio.play(isCorrect ? "pop" : "pop1", { volume: 0.8 });
      render();
      scheduleTimeout(async () => {
        state.playerFeedback = null;
        if (state.playerStep >= (state.playerQuiz.questions?.length || 10) - 1) {
          await finishPlayerQuiz();
        } else {
          state.playerStep += 1;
          render();
        }
      }, isCorrect ? 850 : 1150);
    } else if (action === "go-back") {
      if (state.route === "userName" && state.nameSubstep === "gender") {
        state.nameSubstep = "name";
        render();
      } else if (state.route === "userName") {
        navigate("home", { noRedirect: true });
      } else if (state.route === "userScoreboard") {
        navigate("userShare");
      } else if (state.route === "userAnswers") {
        navigate("userScoreboard");
      } else if (state.route === "contact") {
        if (state.quiz) navigate("userShare");
        else navigate("home", { noRedirect: true });
      } else if (state.route === "playerName") {
        navigate("find");
      } else {
        navigate("home", { noRedirect: true });
      }
    }
  });

  root.addEventListener("submit", (event) => {
    if (event.target.id === "creator-name-form") {
      event.preventDefault();
      const input = document.getElementById("creator-name-input");
      const val = (input?.value || "").trim();
      if (!val) {
        const wrap = document.getElementById("creator-name-tooltip-wrap");
        if (wrap) {
          wrap.classList.remove("show-error");
          void wrap.offsetWidth;
          wrap.classList.add("show-error");
        }
        input?.setAttribute("aria-invalid", "true");
        input?.focus();
        return;
      }
      state.ownerName = val.slice(0, 15);
      state.nameSubstep = "gender";
      render();
    } else if (event.target.id === "player-name-form") {
      event.preventDefault();
      const input = document.getElementById("player-name-input");
      const val = (input?.value || "").trim();
      if (!val) {
        const wrap = document.getElementById("player-name-tooltip-wrap");
        if (wrap) {
          wrap.classList.remove("show-error");
          void wrap.offsetWidth;
          wrap.classList.add("show-error");
        }
        input?.setAttribute("aria-invalid", "true");
        input?.focus();
        return;
      }
      state.playerName = val.slice(0, 15);
      state.guesses = [];
      state.playerStep = 0;
      state.playerFeedback = null;
      navigate("playerPlaying");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.drawerOpen || state.langModalOpen || state.countryModalOpen || state.confirmModal || state.inviteModalOpen) {
        state.drawerOpen = false;
        state.langModalOpen = false;
        state.countryModalOpen = false;
        state.confirmModal = null;
        state.inviteModalOpen = false;
        renderOverlaysOnly();
      }
    }
  });

  /* =========================================================================
     ROUTE RESOLUTION ON LOAD & POPSTATE
     ========================================================================= */

  async function resolveCurrentUrl() {
    clearAsyncWork();
    const url = new URL(location.href);
    const params = url.searchParams;
    const rawPath = location.protocol === "file:"
      ? ""
      : url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

    // Restore active creator quiz if stored
    const activeId = window.quizStore.getActiveCreatorQuizId();
    if (activeId) {
      state.quiz = await window.quizStore.get(activeId);
    } else {
      const [latest] = await window.quizStore.list();
      if (latest && (rawPath === "user/share" || rawPath === "user/scoreboard" || params.has("share"))) {
        state.quiz = latest;
      }
    }

    // Legacy ?created= or ?share=1 support
    if (params.get("created")) {
      const q = await window.quizStore.get(params.get("created"));
      if (q) {
        state.quiz = q;
        window.quizStore.setActiveCreatorQuizId(q.id);
        state.route = "userShare";
        render();
        return;
      }
    }

    // Player route via /find?id=... or ?quiz=...
    const quizId = params.get("id") || params.get("quiz");
    if (rawPath === "find" || (location.protocol === "file:" && quizId)) {
      configurePlayerBootSplash(params.get("q") === "m" ? "m" : "f");
      if (!quizId) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      const quiz = await window.quizStore.get(quizId);
      if (!quiz) {
        navigate("home", { replace: true, noRedirect: true });
        showToast(expiredMessage());
        return;
      }
      state.playerQuiz = quiz;
      const stepParam = params.get("step");
      state.route = stepParam && ["playerName", "playerPlaying", "playerCompleted"].includes(stepParam)
        ? stepParam
        : "find";
      render();
      return;
    }

    const viewParam = params.get("view");
    if (rawPath === "" || rawPath === "index.html") {
      if (viewParam) {
        state.route = viewParam;
        render();
        return;
      }
      if (params.has("share") && state.quiz) {
        state.route = "userShare";
        render();
        return;
      }
      // Auto-redirect creator with active quiz unless ?no_redirect=1
      if (state.quiz && params.get("no_redirect") !== "1") {
        navigate("userShare", { replace: true });
        return;
      }
      state.route = "home";
      render();
      return;
    }

    if (rawPath === "user/name") {
      state.route = "userName";
      render();
    } else if (rawPath === "user/creating") {
      if (!state.questionSet.length) {
        navigate("userName", { replace: true });
        return;
      }
      state.route = "userCreating";
      render();
    } else if (rawPath === "user/share") {
      if (!state.quiz) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.route = "userShare";
      render();
    } else if (rawPath === "user/scoreboard") {
      if (!state.quiz) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.route = "userScoreboard";
      render();
    } else if (rawPath === "user/scoreboard/answers") {
      if (!state.quiz) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.reviewResponseId = params.get("player") || state.reviewResponseId;
      state.route = "userAnswers";
      render();
    } else if (rawPath === "contact") {
      state.route = "contact";
      render();
    } else if (rawPath === "player/name") {
      if (!state.playerQuiz) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.route = "playerName";
      render();
    } else if (rawPath === "player/playing") {
      if (!state.playerQuiz) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.route = "playerPlaying";
      render();
    } else if (rawPath === "player/completed") {
      if (!state.playerQuiz || !state.playerResponse) {
        navigate("home", { replace: true, noRedirect: true });
        return;
      }
      state.route = "playerCompleted";
      render();
    } else {
      state.route = "notFound";
      render();
    }
  }

  window.addEventListener("popstate", () => {
    resolveCurrentUrl();
  });

  // Auto-expire active creator session if left open past the 24-hour window
  window.setInterval(async () => {
    if (!state.quiz || !window.quizStore.isExpired?.(state.quiz)) return;
    const expiredId = state.quiz.id;
    state.quiz = null;
    await window.quizStore.get(expiredId);
    if (["userShare", "userScoreboard", "userAnswers"].includes(state.route)) {
      navigate("home", { replace: true, noRedirect: true });
      showToast(expiredMessage());
    }
  }, 60000);

  resolveCurrentUrl();
})();
