# Glass Giveaway Bot project notes

- Work from this folder as the Vite/Telegram Serverless project root.
- Frontend lives in src/; static build output is dist/.
- Telegram runtime modules live only under tgcloud/ and use the documented SDK imports.
- Telegram Serverless runtime is a V8 isolate: no Node APIs, filesystem, timers, npm imports or arbitrary network. Use sdk, sdk/db, relative imports with .js extensions and Telegram Bot API through api.
- Keep secrets out of git and browser code. Use @BotFather Serverless CLI Access token only with tgcloud login or GitHub Actions secret TGCLOUD_TOKEN.
- Deploy frontend and backend together using npm run deploy. Apply schema changes separately with npx tgcloud migrate.
- Never run npx tgcloud push from the parent fileserver repo root; run it from glass-giveaway-bot.
- GitHub Actions workflows must live in the parent repository .github/workflows directory; the scheduler workflow executes commands with working-directory glass-giveaway-bot.
