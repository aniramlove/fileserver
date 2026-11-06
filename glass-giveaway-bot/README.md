# Glass Giveaway Bot

Mini App для Telegram-розыгрышей. Frontend: React + TypeScript + Vite. Backend and SQLite: Telegram Serverless. All code for this project is kept in this folder; the scheduler workflow is added at the repository root under .github/workflows because GitHub only loads workflows from that location.

## Implemented

- Liquid Glass UI with Telegram light/dark theme support.
- Giveaway list and details.
- First-open arithmetic CAPTCHA, stored server-side per user and giveaway; successful verification is remembered.
- Mandatory channel/group subscription checks at join and again before the winner draw.
- Referral deep links through the bot's Main Mini App; valid referrals add configurable weighted tickets.
- Live Boost count read through getUserChatBoosts; ticket balance is recalculated when the list is loaded and again at the draw.
- Admin panel to create giveaways, set prizes, dates, winners, announcement chat, Boost chat and required subscriptions.
- Weighted winner draw without replacement, persisted winners and repeat-run protection.
- GitHub Actions scheduler every five minutes plus manual run.

## Requirements

- Windows 10/11.
- Node.js 18+ (recommended: current Node.js 22 LTS) and Git.
- Existing Telegram bot with Serverless enabled in @BotFather.
- You must be able to add the bot as administrator to required and Boost-tracked channels/groups.
- GitHub Actions enabled for the repository.

## Run on Windows

Open PowerShell:

```powershell
git clone https://github.com/aniramlove/fileserver.git
cd fileserver\glass-giveaway-bot
node -v
npm -v
npm install
```

Use Node 18 or newer. If node/npm commands are not found, install Node.js LTS from https://nodejs.org and reopen PowerShell.

## Connect the existing bot

1. In Telegram, open @BotFather, choose your existing bot, then Serverless → CLI Access → Access token.
2. Copy the **CLI Access token**. It looks like app12345:secret. It is NOT the normal Bot API token. Never commit it or send it in chat.
3. From this project folder run:

```powershell
npx tgcloud login
```

Paste the CLI Access token when prompted. It is saved locally under .tgcloud and is ignored by Git.

### Important: protect the existing Serverless project\n\nBecause this is an existing bot, do not deploy blindly. After `npx tgcloud login`, run:\n\n```powershell\nnpx tgcloud fetch\nnpx tgcloud status\n```\n\nReview the status before the first push. Telegram Serverless full push mirrors the local `tgcloud/` module set and can remove remote modules that are not present in this folder. If the bot already has handlers or database schema for another feature, stop and merge those modules into this project before deploying. Do not run `npx tgcloud pull` over this project without first making a backup.\n\n## Configure the administrator

1. In a private chat with the bot, send /id (after the first deployment of the message handler).
2. Copy the numeric Telegram ID.
3. Open tgcloud/lib/config.js and replace the empty array:

```js
export const ADMIN_IDS = [123456789];
```

You may add more IDs separated by commas. Keep this file free of bot tokens.

## Build and deploy

From glass-giveaway-bot:

```powershell
npm run build
npx tgcloud push
npx tgcloud migrate
```

During migrate, review the listed schema changes and confirm the initial table/index creation. Do not skip the migration: without it the database tables do not exist.

The push output prints the Mini App URL, similar to https://app123456.tgcloud.ai/. Keep the exact URL.

After changing ADMIN_IDS, repeat npx tgcloud push. After changing schema.js, push and then run npx tgcloud migrate again.

## Configure Telegram launch links

In @BotFather:

1. Configure the bot's **Main Mini App** and set its URL to the exact tgcloud.ai URL from push. This is needed for referral deep links with startapp.
2. Use /setmenubutton (or Bot Settings → Menu Button) and set the menu button text (for example, “Розыгрыши”) plus the same URL.

Then open the bot and tap the menu button. The app is intended to run inside Telegram; opening the hosted URL in an ordinary browser shows only demo content.

## Add channels and turn on features

- Add the bot as an administrator to every mandatory channel/group. For channels where the bot must publish announcements, allow posting messages.
- For each chat whose Boosts should count, make the bot an administrator. Telegram's getUserChatBoosts method requires administrator rights.
- In the admin tab, create a giveaway. Enter each required chat on a separate line as @channel_username|Display name (or -100...|Display name).
- Announcement chat is where the bot posts the start and final results. Use @channel_username or a numeric chat ID.
- Boost chat is the channel/supergroup whose current Boosts by a participant are counted.
- The default configuration awards 1 additional ticket per valid referral and 1 per active Boost. Change the two constants in tgcloud/lib/config.js to set different weights.

## Enable the GitHub Actions scheduler

The workflow is at the repository root: .github/workflows/glass-giveaway-scheduler.yml.

1. Open the GitHub repository → Settings → Secrets and variables → Actions.
2. Create a repository secret named TGCLOUD_TOKEN.
3. Its value is the same Telegram Serverless **CLI Access token** used for tgcloud login (app...:secret).
4. Open Actions and ensure workflows are enabled. Use “Glass Giveaway Scheduler” → “Run workflow” for a manual test.

The schedule checks every five minutes, but GitHub may delay scheduled runs. It is not a real-time guarantee. The scheduler posts the start/end announcement and performs the final weighted draw. If you do not need automatic scheduling, you can run the endpoint manually from the project folder:

```powershell
npx tgcloud run endpoints/processSchedule '{}'
```

## Recommended first test

1. Create a private test channel.
2. Add the bot as administrator.
3. Deploy, migrate and set the Main Mini App/menu button.
4. Create a test giveaway with start time a few minutes ahead, end time 10–15 minutes ahead, and require that test channel.
5. Join with a second Telegram account, test an incorrect and correct CAPTCHA, test subscription validation, then test the referral link.
6. Add Boosts to the configured channel from a test account and reopen the giveaway list to refresh ticket counts.
7. Run the scheduler manually or wait for the next GitHub Actions tick, then confirm the winner post.

## Safety / production notes

- Telegram Serverless validates Mini App initData before invoking an endpoint; the backend derives the user identity from ctx.initData, not a client-supplied user ID.
- Do not put Bot API tokens or CLI Access tokens in the repository or frontend.
- GitHub cron can be delayed, so do not advertise exact-second start/end execution.
- Subscription verification can only be trusted when Telegram returns member information; grant the bot administrator rights and check BotFather/Telegram errors.
- The initial implementation is a functional MVP scaffold, not an audited high-volume raffle platform. Before a large public campaign, add automated tests, operational alerts, independent draw audit logs and explicit concurrency/rate-limit handling.
