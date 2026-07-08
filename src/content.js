const DEFAULT_MAX_AGE_DAYS = 30;
const MIN_MAX_AGE_DAYS = 0;
const MAX_MAX_AGE_DAYS = 3650;

const VIDEO_RENDERER_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-reel-item-renderer"
].join(",");

let maxAgeDays = DEFAULT_MAX_AGE_DAYS;
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
    maxAgeDays: DEFAULT_MAX_AGE_DAYS
  });

  maxAgeDays = clampMaxAgeDays(settings.maxAgeDays);
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

  return Array.from(metadataNodes)
    .map((node) => node.textContent || "")
    .join(" ");
}

function shouldHideRenderer(renderer) {
  const ageDays = daysFromRelativeAge(getCandidateText(renderer));

  return ageDays !== null && ageDays > maxAgeDays;
}

function setRendererVisibility(renderer) {
  const shouldHide = shouldHideRenderer(renderer);

  if (shouldHide) {
    renderer.dataset.ryfHidden = "true";
    renderer.style.display = "none";
    return;
  }

  if (renderer.dataset.ryfHidden === "true") {
    delete renderer.dataset.ryfHidden;
    renderer.style.display = "";
  }
}

function scanFeed() {
  scanTimer = null;

  if (!isFeedPage()) {
    document.querySelectorAll("[data-ryf-hidden='true']").forEach((renderer) => {
      delete renderer.dataset.ryfHidden;
      renderer.style.display = "";
    });
    return;
  }

  document.querySelectorAll(VIDEO_RENDERER_SELECTOR).forEach(setRendererVisibility);
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
    if (areaName !== "sync" || !changes.maxAgeDays) {
      return;
    }

    maxAgeDays = clampMaxAgeDays(changes.maxAgeDays.newValue);
    scanFeed();
  });
}

init().catch((error) => {
  console.error("Recent YouTube Filter failed to start", error);
});
