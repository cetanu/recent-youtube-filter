# Recent YouTube Filter

A Firefox extension that hides YouTube feed videos when their visible upload age is older than the configured number of days.

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select `manifest.json` from this directory.
4. Open the extension options and set the maximum video age in days.

## Behavior

- Default threshold: `30` days.
- A value of `0` keeps videos from today and hides anything marked as at least `1 day ago`.
- The extension watches YouTube's dynamic page updates and re-applies filtering as new feed items load.
- Videos are only hidden when the extension can parse relative age text like `2 days ago`, `3 weeks ago`, `1 month ago`, or `Streamed 1 year ago`.
