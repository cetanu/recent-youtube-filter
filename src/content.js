const DEFAULT_MAX_AGE_DAYS = 30;
const MIN_MAX_AGE_DAYS = 0;
const MAX_MAX_AGE_DAYS = 3650;
const DEFAULT_HIDE_SHORTS_PANEL = false;
const DEFAULT_HIDE_PODCAST_LINKS = false;

const VIDEO_RENDERER_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-rich-grid-slim-media",
  "ytm-shorts-lockup-view-model",
  "yt-lockup-view-model"
].join(",");

const SHORTS_SHELF_SELECTOR = [
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-reel-shelf-renderer"
].join(",");

const PODCAST_LINK_LABELS = [
  "view full podcast",
  "personalised mix for you"
];

const ALWAYS_HIDDEN_LABELS = [
  "playables",
  "view full playlist"
];

const LABELLED_CONTENT_SELECTOR = [
  "ytd-rich-shelf-renderer",
  "ytd-horizontal-card-list-renderer",
  "ytd-rich-item-renderer",
  "ytd-playlist-renderer",
  "ytd-grid-playlist-renderer",
  "ytd-compact-playlist-renderer",
  "ytd-radio-renderer",
  "ytd-grid-radio-renderer",
  "ytd-compact-radio-renderer",
  "ytd-game-card-renderer",
  "yt-lockup-view-model"
].join(",");

let maxAgeDays = DEFAULT_MAX_AGE_DAYS;
let hideShortsPanel = DEFAULT_HIDE_SHORTS_PANEL;
let hidePodcastLinks = DEFAULT_HIDE_PODCAST_LINKS;
let scanTimer = null;

function isFeedPage() {
  return window.location.pathname === "/" || window.location.pathname.startsWith("/feed/");
}

function clampMaxAgeDays(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_AGE_DAYS;
  }

  return Math.min(MAX_MAX_AGE_DAYS, Math.max(MIN_MAX_AGE_DAYS, parsed));
}

async function readSettings() {
  const settings = await browser.storage.sync.get({
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    hideShortsPanel: DEFAULT_HIDE_SHORTS_PANEL,
    hidePodcastLinks: DEFAULT_HIDE_PODCAST_LINKS
  });

  maxAgeDays = clampMaxAgeDays(settings.maxAgeDays);
  hideShortsPanel = Boolean(settings.hideShortsPanel);
  hidePodcastLinks = Boolean(settings.hidePodcastLinks);
}

function daysFromRelativeAge(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /\b(?:streamed|premiered|posted|uploaded)?\s*(\d+|a|an|one)\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/
  );

  if (!match) {
    return null;
  }

  const amount = ["a", "an", "one"].includes(match[1])
    ? 1
    : Number.parseInt(match[1], 10);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2];

  if (["second", "minute", "hour"].includes(unit)) {
    return 0;
  }

  if (unit === "day") {
    return amount;
  }

  if (unit === "week") {
    return amount * 7;
  }

  if (unit === "month") {
    return amount * 30;
  }

  if (unit === "year") {
    return amount * 365;
  }

  return null;
}

function getCandidateText(renderer) {
  const metadataNodes = renderer.querySelectorAll([
    "#metadata-line",
    "#video-info",
    "#metadata",
    "ytd-video-meta-block",
    "yt-formatted-string",
    "span"
  ].join(","));

  const metadataText = Array.from(metadataNodes)
    .flatMap((node) => [
      node.textContent || "",
      node.getAttribute("aria-label") || "",
      node.getAttribute("title") || ""
    ]);

  const labelledText = Array.from(renderer.querySelectorAll("[aria-label], [title]"))
    .flatMap((node) => [
      node.getAttribute("aria-label") || "",
      node.getAttribute("title") || ""
    ]);

  return [
    renderer.textContent || "",
    renderer.getAttribute("aria-label") || "",
    renderer.getAttribute("title") || "",
    ...metadataText,
    ...labelledText
  ].join(" ");
}

function shouldHideRenderer(renderer) {
  const ageDays = daysFromRelativeAge(getCandidateText(renderer));

  return (isShortRenderer(renderer) && (ageDays === null || ageDays > maxAgeDays)) ||
    (ageDays !== null && ageDays > maxAgeDays) ||
    (hidePodcastLinks && isPodcastLink(renderer));
}

function isShortRenderer(renderer) {
  return renderer.matches([
    "ytd-reel-item-renderer",
    "ytd-rich-grid-slim-media",
    "ytm-shorts-lockup-view-model"
  ].join(",")) ||
    Boolean(renderer.closest(SHORTS_SHELF_SELECTOR)) ||
    Boolean(renderer.querySelector("a[href^='/shorts/']"));
}

function isPodcastLink(renderer) {
  const text = (renderer.textContent || "").toLowerCase();

  return PODCAST_LINK_LABELS.some((label) => text.includes(label));
}

function getShortsPanel(shelf) {
  return shelf.closest("ytd-rich-section-renderer, ytd-item-section-renderer") || shelf;
}

function hasAlwaysHiddenLabel(element) {
  const descendantLabels = Array.from(element.querySelectorAll("[aria-label], [title]"))
    .flatMap((node) => [
      node.getAttribute("aria-label") || "",
      node.getAttribute("title") || ""
    ]);
  const text = [
    element.textContent || "",
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    ...descendantLabels
  ].join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  return ALWAYS_HIDDEN_LABELS.some((label) => text.includes(label));
}

function getLabelledContentContainer(element) {
  if (element.matches("ytd-rich-shelf-renderer, ytd-horizontal-card-list-renderer")) {
    return element.closest("ytd-rich-section-renderer, ytd-item-section-renderer") || element;
  }

  return element;
}

function setRendererVisibility(renderer) {
  setHiddenForReason(renderer, "ryfHiddenRenderer", shouldHideRenderer(renderer));
}

function setHiddenForReason(element, reason, shouldHide) {
  if (shouldHide) {
    element.dataset[reason] = "true";
  } else {
    delete element.dataset[reason];
  }

  const isHidden = element.dataset.ryfHiddenRenderer === "true" ||
    element.dataset.ryfHiddenShortsPanel === "true" ||
    element.dataset.ryfHiddenLabel === "true";

  if (isHidden) {
    element.dataset.ryfHidden = "true";
    element.style.display = "none";
  } else {
    delete element.dataset.ryfHidden;
    element.style.display = "";
  }
}

function scanFeed() {
  scanTimer = null;

  if (!isFeedPage()) {
    restoreHiddenElements();
    return;
  }

  document.querySelectorAll(VIDEO_RENDERER_SELECTOR).forEach(setRendererVisibility);
  document.querySelectorAll(SHORTS_SHELF_SELECTOR).forEach((shelf) => {
    const panel = getShortsPanel(shelf);
    setHiddenForReason(panel, "ryfHiddenShortsPanel", hideShortsPanel);
  });
  document.querySelectorAll("[data-ryf-hidden-label='true']").forEach((element) => {
    setHiddenForReason(element, "ryfHiddenLabel", false);
  });
  document.querySelectorAll(LABELLED_CONTENT_SELECTOR).forEach((element) => {
    if (!hasAlwaysHiddenLabel(element)) {
      return;
    }

    const container = getLabelledContentContainer(element);
    setHiddenForReason(container, "ryfHiddenLabel", true);
  });
}

function restoreHiddenElements() {
  document.querySelectorAll("[data-ryf-hidden='true']").forEach((element) => {
    delete element.dataset.ryfHidden;
    delete element.dataset.ryfHiddenRenderer;
    delete element.dataset.ryfHiddenShortsPanel;
    delete element.dataset.ryfHiddenLabel;
    element.style.display = "";
  });
}

function scheduleScan() {
  if (scanTimer !== null) {
    return;
  }

  scanTimer = window.setTimeout(scanFeed, 250);
}

async function init() {
  await readSettings();
  scanFeed();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes.maxAgeDays) {
      maxAgeDays = clampMaxAgeDays(changes.maxAgeDays.newValue);
    }
    if (changes.hideShortsPanel) {
      hideShortsPanel = Boolean(changes.hideShortsPanel.newValue);
    }
    if (changes.hidePodcastLinks) {
      hidePodcastLinks = Boolean(changes.hidePodcastLinks.newValue);
    }
    scanFeed();
  });
}

init().catch((error) => {
  console.error("Recent YouTube Filter failed to start", error);
});
