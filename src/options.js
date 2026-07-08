const DEFAULT_MAX_AGE_DAYS = 30;
const MIN_MAX_AGE_DAYS = 0;
const MAX_MAX_AGE_DAYS = 3650;

const form = document.querySelector("#options-form");
const input = document.querySelector("#max-age-days");
const status = document.querySelector("#status");

function clampMaxAgeDays(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_AGE_DAYS;
  }

  return Math.min(MAX_MAX_AGE_DAYS, Math.max(MIN_MAX_AGE_DAYS, parsed));
}

async function restoreOptions() {
  const settings = await browser.storage.sync.get({
    maxAgeDays: DEFAULT_MAX_AGE_DAYS
  });

  input.value = clampMaxAgeDays(settings.maxAgeDays);
}

async function saveOptions(event) {
  event.preventDefault();

  const maxAgeDays = clampMaxAgeDays(input.value);
  input.value = maxAgeDays;

  await browser.storage.sync.set({ maxAgeDays });

  status.textContent = "Saved.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 1400);
}

form.addEventListener("submit", saveOptions);

restoreOptions().catch((error) => {
  status.textContent = "Could not load settings.";
  console.error("Recent YouTube Filter options failed to load", error);
});
