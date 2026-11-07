# Dungeons & Dynasties Mod Menu

An in-game cheat/trainer menu for **Dungeons & Dynasties** (Steam app 5101960), a
single-player guild management game. Press **F8** in game to show or hide it.

> Unofficial fan project, not affiliated with the game's developer. Single-player only.
> Back up your saves before heavy editing.

## Features

| Section | What it does |
|---|---|
| Treasury | Set gold, +10k / +100k / +1M, lock gold so it never drops |
| Guild | Set renown or add 100, patron confidence to 100 |
| Heroes (one or all) | Fully rest (condition/morale 100, stress/fatigue 0), heal injuries, set level 1–20 (XP set to match), max all attributes to 20 plus ability/potential to 200 (5★), max potential only (so they grow into it); toggle to keep everyone rested |
| Recruit anyone | Sign any hero for free, instantly: tavern recruits, league free agents, or any hero from any rival guild (sorted by ability, shown with ★ current/potential) |
| Item forge | Make any of the game's 41 item types (weapons by melee/ranged/spell, armour, trinkets, including the 5 trait-granting ★ items) at any rarity, with Normal / ×2 / ×3 power, 1–5 at a time, straight into the stash (Armoury → On the racks) |
| Guild Hall | Upgrade hall level (+3 beds, max level 6); finish in-progress builds (they finish at the next day tick); toggle to auto-finish |

Edits go through the game's own state, so they show up right away, and the game
saves (and re-signs) them normally.

## Install

1. Install the [.NET 9 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/9.0) if you don't have it.
2. Download `DDModLauncher.exe` from the Releases page, or build it (see below), and put it anywhere.
3. In Steam, right-click **Dungeons & Dynasties → Properties → General → Launch Options** and paste
   (with your own path):

   ```
   "C:\path\to\DDModLauncher.exe" %command%
   ```

4. Start the game from Steam as usual. The menu shows in the top-left. **F8** toggles it.

You can also run `DDModLauncher.exe` directly. It finds the game in any of your
Steam libraries. To uninstall, clear the launch options.

**Tip:** load into your guild (press Continue) before editing. Changes made on the
title screen can be replaced when the save loads.

## How it works (and why it's not a DLL)

The game is a [Tauri](https://tauri.app) app: a small Rust shell that hosts a
React/JavaScript game in Microsoft WebView2. All game state lives in JavaScript, so a
DLL injected into the process can't get at it.

`DDModLauncher.exe` starts the game with WebView2's DevTools port open (localhost
only, random port), using the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment
variable. It then injects [`menu.js`](menu.js) into the game page over the Chrome
DevTools Protocol, and injects it again whenever the page reloads. The menu finds
the guild's React `useState` hook and edits state through its own `dispatch`, just
like the game's UI does.

## Notes

- **Beds:** the game won't advance a day while you have more heroes than beds
  (6 + 3 × hall level). Upgrade the hall or let someone go before you recruit
  too many. The menu's roster/beds count is an estimate; the Roster screen
  shows the game's own count.
- **Levelling up** can trigger the game's own milestone story popups. That's normal.
- **Forged items** use the game's own formulas. Normal power is the best roll the
  game can make. ×2 / ×3 go beyond that, but combat still caps damage reduction
  at 80%, crit at 45% and block at 60%. Crown of Hubris (*arrogant*) and
  Hungering Coffer (*greedy*) grant traits that are probably drawbacks.
- **Recruiting from rivals** takes the hero off that guild's roster. The AI
  guild refills on its own.
- Built against game version **0.3**. The menu finds the game state by its shape
  (an object with `gold` and `roster`), so it should survive most updates, but
  item formulas and rules are mirrored from 0.3.
- The launcher writes `DDModLauncher.log` next to itself if something goes wrong.

## Build

Requires the .NET 9 SDK.

```
cd Launcher
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o ..\dist
```

`menu.js` is embedded into the exe at build time.

## Files

- `menu.js`: the mod menu (plain JavaScript, no dependencies)
- `Launcher/`: the C# launcher that starts the game and injects the menu
