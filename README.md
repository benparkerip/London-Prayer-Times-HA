# London Prayer Times Cards

Two custom Lovelace cards for Home Assistant that display Islamic prayer times from the **London Prayer Times** sensors — a sleek next-prayer countdown card, and a scrollable month-view table you can page through — plus a ready-made sensor bundle that populates those sensors from the [London Prayer Times API](https://www.londonprayertimes.com/api/).

## Cards

### `london-prayer-card`

A compact "next prayer" card:

- Shows the next upcoming prayer and a live countdown
- A progress bar + ambient background glow that drifts and shifts colour through the day (indigo pre-dawn → gold midday → amber afternoon → red-orange sunset → navy night) — optional, see [Options](#options-london-prayer-card)
- Today's date shown as the Hijri (Islamic) date
- A row of tiles for Fajr, Sunrise, Dhuhr, Asr, Maghrib and Isha, with the current period highlighted — the Sunrise tile is optional too
- Tap the card to open the month view in an overlay

#### Options (`london-prayer-card`)

Both are on by default and can be flipped from the dashboard's card editor UI (no YAML needed) — edit the card, and you'll see two switches: "Show sunrise" and "Show colour gradient".

| Option | Default | Effect when off |
|---|---|---|
| `show_sunrise` | `true` | Drops the Sunrise divider from the tile row |
| `show_gradient` | `true` | Flat card background instead of the drifting, colour-shifting glow — useful if you'd rather match your theme's plain card style |

```yaml
type: custom:london-prayer-card
show_sunrise: false
show_gradient: false
```

<p align="center"><em>Next prayer countdown, daily tiles, and a tap-to-open month view.</em></p>

### `london-prayer-month-card`

A scrollable table of a full month's prayer times, with:

- Prev / next month navigation
- Auto-scroll to and highlight of today's row
- A "jump to current month" link when browsing another month

## Requirements

Both cards read their data from sensors named `sensor.london_prayer_times_*`. A ready-made sensor bundle for these is included in this repo — see [Sensor bundle](#sensor-bundle-data-source) below — or you can wire up your own equivalent.

Required entities:

| Entity | Used by | Notes |
|---|---|---|
| `sensor.london_prayer_times_fajr` | both | timestamp of Fajr |
| `sensor.london_prayer_times_sunrise` | both | timestamp of sunrise |
| `sensor.london_prayer_times_dhuhr` | both | timestamp of Dhuhr |
| `sensor.london_prayer_times_asr` | both | timestamp of Asr |
| `sensor.london_prayer_times_magrib` | both | timestamp of Maghrib |
| `sensor.london_prayer_times_isha` | both | timestamp of Isha |
| `sensor.london_prayer_times_month` | month card | `attributes.times` = `{ "YYYY-MM-DD": { fajr, sunrise, dhuhr, asr, magrib, isha }, ... }` (times as `"HH:MM"` strings) |
| `input_number.prayer_calendar_month_offset` | month card | a helper, min `-12`, max `12`, step `1`, used to request other months from your month sensor |

The five `sensor.london_prayer_times_<prayer>` entities must have `device_class: timestamp` (state = an ISO datetime) — that's what drives the countdown and the "current period" highlight.

## Sensor bundle (data source)

[`packages/london_prayer_times.yaml`](packages/london_prayer_times.yaml) creates every entity above using the [London Prayer Times API](https://www.londonprayertimes.com/api/) (the East London Mosque's official timetable — London only).

1. **Get a free API key** at [londonprayertimes.com/api](https://www.londonprayertimes.com/api/) (approval is manual, usually within a few hours). Each installer needs their own key — one isn't bundled with this repo.
2. **Enable packages** in `configuration.yaml` if you haven't already:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
3. Copy `packages/london_prayer_times.yaml` into `<config>/packages/`.
4. Restart Home Assistant.
5. Go to **Settings → Devices & services → Entities**, find **London Prayer Times API Key**, and paste in your key. No further restart needed — the sensors poll every 6 hours automatically, and immediately on demand whenever the month card's prev/next buttons request a different month.

The key lives in an `input_text` helper (not `secrets.yaml`) because the request URL is templated per day/month, which can't be mixed with a `!secret`. Its state is excluded from recorder history in the package so the key doesn't end up in your database — the entity itself is still visible to anyone with dashboard/admin access, same as any other helper.

## Installation

### Via HACS (custom repository)

1. In Home Assistant, go to **HACS → ⋮ (top right) → Custom repositories**
2. Add this repository's URL, category **Dashboard**
3. Install **London Prayer Times Cards**
4. Home Assistant will add the resource automatically (or add it yourself — see below)

### Manual

1. Copy `london-prayer-cards.js` into `<config>/www/`
2. Add it as a dashboard resource: **Settings → Dashboards → ⋮ → Resources → Add Resource**
   - URL: `/local/london-prayer-cards.js`
   - Resource type: `JavaScript Module`

Either way, HACS/the resource step only installs the cards themselves — the `packages/` sensor bundle isn't a Lovelace resource, so it needs the manual copy-in step described under [Sensor bundle](#sensor-bundle-data-source) below.

## Configuration

Add the cards to a dashboard via the card editor ("Manual" / YAML mode), or with YAML directly:

```yaml
type: custom:london-prayer-card
```

```yaml
type: custom:london-prayer-month-card
entity: sensor.london_prayer_times_month   # optional, this is the default
```

`london-prayer-card` takes no required options — tapping it opens `london-prayer-month-card` in a built-in overlay, so you don't need to add the month card separately unless you also want it as its own dashboard view/tile.

### Example: a dedicated "Calendar" tab

Neither card creates a dashboard view or tab on its own — installing via HACS only registers the two card types. If you'd like a separate tab with a calendar icon instead of relying on the tap-to-open overlay, add a view like this to a `sections`-type dashboard:

```yaml
views:
  - type: sections
    title: Calendar
    path: calendar
    icon: mdi:calendar-month
    sections:
      - type: grid
        cards:
          - type: custom:london-prayer-month-card
            entity: sensor.london_prayer_times_month
            grid_options:
              columns: full
```

That's the exact view config this repo's own dashboard uses. The optional drop shadow on that card comes from [card-mod](https://github.com/thomasloven/lovelace-card-mod) (a separate HACS install) — add this alongside `entity:`/`grid_options:` above if you want it too:

```yaml
card_mod:
  style: |
    ha-card {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
    }
```

## License

MIT — see [LICENSE](LICENSE).
