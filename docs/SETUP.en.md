# Complete setup guide — English

[Home](../README.md) · [العربية](SETUP.ar.md) · [Troubleshooting](TROUBLESHOOTING.md)

This guide starts with an existing self-hosted n8n and ends with an hourly workflow. Every user runs their own helper, signs in to their own Steam account, and uses their own Telegram bot. There is no shared Steam account or hosted credential service.

> This release is experimental. Tests exercise the code with fixtures; successful live Steam license grants and the full portable deployment still need integration validation. Start in dry-run mode.

## Contents

1. [Requirements](#1-requirements)
2. [Download and build](#2-download-and-build)
3. [Generate the key and sign in](#3-generate-the-key-and-sign-in-to-steam)
4. [Connect n8n to the helper](#4-connect-n8n-to-the-helper)
5. [Import the workflow](#5-import-the-workflow)
6. [Create the helper credential](#6-create-the-helper-credential-in-n8n)
7. [Create the Telegram bot and credential](#7-create-the-telegram-bot-and-credential)
8. [Find your chat ID](#8-find-your-telegram-chat-id)
9. [Test and activate](#9-test-then-enable-real-claims)
10. [Configure failure alerts](#10-configure-failure-alerts)
11. [Maintenance](#11-maintenance)

## 1. Requirements

| Requirement | Details |
| --- | --- |
| Docker host | Linux server with Docker Engine and Compose v2 already installed |
| Existing n8n | Self-hosted on the same Docker host, with permission to import workflows and create credentials |
| Git | To clone and update this repository; downloading GitHub's ZIP is also possible |
| Steam account | Your own login name, password, and access to Steam Guard |
| Telegram | Your own account and a new or existing bot |
| Internet access | Outbound access to Steam; n8n needs outbound access to Telegram |

Check the tools in your **server terminal**:

```bash
docker --version
docker compose version
git --version
```

If Docker requires elevated privileges, use your host's normal Docker access method, for example `sudo docker compose ...`. Do not change Docker socket permissions to world-writable. Install Docker using the [official Engine installation guide](https://docs.docker.com/engine/install/), and see the [official Compose installation guide](https://docs.docker.com/compose/install/).

The container is based on Node.js 22. ARM64 and AMD64 are intended targets; both image architectures still require real build validation. The supplied helper has a **512 MB memory cap** and a **0.5 CPU cap**; those are limits, not measured typical consumption. n8n is a separate existing service.

This deployment does not directly support n8n Cloud: the helper lives on a private Docker network. Do not publish the helper API to the internet as a shortcut.

## 2. Download and build

Run on the Docker server, in the directory where you keep projects:

```bash
git clone https://github.com/Ebnhussein/n8n-steam-free-games.git
cd n8n-steam-free-games
docker compose build
```

Stay in this directory for the following `docker compose` commands. No Node.js/npm installation is required on the host for Docker deployment. The image installs the pinned dependencies itself.

## 3. Generate the key and sign in to Steam

### 3.1 Generate your helper API key

```bash
docker compose run --rm steam-helper node src/cli.cjs init
```

The command prints a randomly generated key. Copy it to a private password manager; you will use it in step 6. It is your **helper key**, not a Steam Web API key and not your Telegram token.

The key is saved in the project's private `steam_data` Docker volume. Running `init` again reads the existing key rather than rotating it. Do not paste its output in GitHub issues or screenshots.

### 3.2 Sign in interactively

```bash
docker compose run --rm steam-helper node src/cli.cjs login
```

Answer the terminal prompts:

| Prompt | What to enter |
| --- | --- |
| `Steam account name` | Your actual Steam login name, not your profile display name or profile URL |
| `Password (hidden)` | Your account password; no characters are displayed |
| `Current MOBILE Steam Guard code...` | For a mobile authenticator, the current code from Steam Guard; otherwise press Enter |
| Follow-up Guard code | The email code Steam just sent, or the requested current mobile code |

For email Guard, leave the first mobile-code prompt blank so the script can ask for the newly sent email code. Approve any genuine Steam mobile/email confirmation requested by Steam. If Steam blocks the sign-in, use Steam's own recovery/approval flow; this project does not bypass it.

Expected completion:

```text
Login saved locally. Your password was not saved.
```

The password is not stored. A refresh token is saved as `auth.json` inside the private Docker volume with mode `0600`. It is not put into the n8n export. Server administrators can still read Docker volumes, so treat backups as sensitive.

### 3.3 Start and check the helper

```bash
docker compose up -d
docker compose ps
docker compose exec steam-helper node src/cli.cjs check
```

A successful check returns:

```json
{"authenticated":true}
```

`healthy` only means that the HTTP process answers health checks. The separate `check` command validates Steam authentication/ownership access. For reauthentication, stop the helper first; see maintenance below.

## 4. Connect n8n to the helper

### 4.1 Find the correct n8n container

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}'
```

Find the main n8n editor/server container. Do **not** choose a task-runner container, database, or Redis. Replace `YOUR_N8N_CONTAINER` in the next command with the actual container name:

```bash
docker network connect steam-free-games YOUR_N8N_CONTAINER
```

If Docker says the endpoint already exists, the container is already attached. In queue mode, attach execution workers too, because HTTP Request nodes execute there.

### 4.2 Make the network connection persistent

The manual command above is useful for testing, but a recreated container loses that attachment. Back up your existing n8n Compose file, then **merge** this network declaration into it:

```yaml
services:
  app:
    networks:
      - default
      - steam-free-games

networks:
  steam-free-games:
    external: true
    name: steam-free-games
```

Replace `app` with your n8n service name. Keep all networks already required by your deployment; the `default` entry above is only an example. Do not replace the whole n8n Compose file with this snippet or create a duplicate `services:`/`networks:` key.

Redeploy n8n through its normal Compose or Coolify process. The helper's Compose project creates the external network first, so keep the helper started before deploying that n8n network configuration.

### 4.3 Optional connectivity check

```bash
docker exec YOUR_N8N_CONTAINER node -e "fetch('http://steam-helper:3000/health').then(async r => { console.log(r.status, await r.text()); }).catch(e => { console.error(e.message); process.exitCode = 1; })"
```

Expected: HTTP `200` with `{"ok":true}`. This checks the Docker connection; it does not grant licenses or expose an API key.

## 5. Import the workflow

1. Open n8n in your browser.
2. Create a new workflow.
3. Open the workflow menu, usually `…` near the workflow name.
4. Choose **Import from File** and select `workflows/steam-free-games.json` from your downloaded repository.
5. Keep the workflow inactive while configuring it. UI labels can vary between n8n versions; **Publish** and **Active/Activate** refer to the saved scheduled version.

The import contains these nodes:

| Node | Purpose |
| --- | --- |
| `01 - Every Hour` | Hourly schedule |
| `02 - Manual Test` | Manual execution |
| `03 - Run Steam Helper` | Authenticated HTTP request to your helper |
| `04 - Build Notifications` | Format results and suppress unchanged scheduled notifications |
| `05 - Has Photo?` | Choose a photo or plain-text notification |
| `06 - Telegram Photo` | Send photo + caption |
| `07 - Telegram Text` | Send text when no source image is available |

No real credentials, chat IDs, execution history, or personal server URLs are included.

## 6. Create the helper credential in n8n

1. Open **03 - Run Steam Helper**.
2. Under **Authentication**, select **Generic Credential Type**.
3. Under **Generic Auth Type**, select **Header Auth**.
4. In the credential selector, choose **Create New Credential**.
5. Give the credential a recognizable label, for example **Steam Helper — My Server**.
6. Fill in the credential fields exactly as below and save it:

| Credential field | Value |
| --- | --- |
| **Name** | `X-API-Key` |
| **Value** | Your generated key from step 3.1 |

The credential's *label* can be anything. The **Name field inside the credential must be `X-API-Key`** because that is the HTTP header the helper expects.

Return to the HTTP node and confirm:

| HTTP node field | Value |
| --- | --- |
| Method | `POST` |
| URL | `http://steam-helper:3000/v1/run` |
| Authentication | Generic Credential Type → Header Auth |
| Credential | Your saved helper credential |
| Send Body | On |
| Body Content Type | JSON |
| Specify Body | Using JSON |
| JSON Body | `{"dryRun":true}` |
| Timeout | `300000` milliseconds, already supplied by the import |

Do not use Basic Auth, Bearer Auth, or the Telegram token here. Do not paste a Steam refresh token into this credential. If n8n has no credential test endpoint for generic Header Auth, test the node after saving; a generic test result alone is not the helper connectivity test.

Official reference: [n8n HTTP Request credentials](https://docs.n8n.io/integrations/builtin/credentials/httprequest/).

## 7. Create the Telegram bot and credential

### 7.1 Create your bot

1. Open [the official BotFather](https://t.me/BotFather) in Telegram.
2. Press **Start**, then send `/newbot`.
3. Enter a display name, for example **Steam Free Games**.
4. Choose an available username ending in `bot`, such as your own unique `my_steam_alerts_bot`.
5. BotFather returns the bot's **token**. Store it privately.
6. Open the new bot using BotFather's link, press **Start**, and send a message such as `hello`.

The display name and username are not the token. Never commit the token. If it leaks, revoke/regenerate it through BotFather and update n8n.

### 7.2 Save the token in n8n

1. Open **06 - Telegram Photo**.
2. In **Credential to connect with**, choose **Create New Credential** of type **Telegram**.
3. Set its label to **Steam Free Games Telegram** or another clear name.
4. Paste the bot token into **Access Token**.
5. Save. If n8n offers a connection test, verify it succeeds.
6. Open **07 - Telegram Text** and select **the same credential**.

The Telegram credential needs **only the bot token**, not your personal Telegram password, phone number, or Steam password. Leave the API base URL at its default if that optional field is present.

Official references: [Telegram credentials in n8n](https://docs.n8n.io/integrations/builtin/credentials/telegram/) and [creating a bot](https://core.telegram.org/bots/features#creating-a-new-bot).

## 8. Find your Telegram chat ID

For a new bot and an n8n server reachable over HTTPS, you can use a temporary Telegram Trigger without giving your token to a third-party ID bot:

1. Create a **separate temporary workflow** in n8n.
2. Add **Telegram Trigger**.
3. Select the Telegram credential from step 7.
4. Choose the **Message** update/event.
5. Click **Listen for test event**, **Test step**, or the equivalent in your version.
6. Send a **new** `hello` message to your bot in Telegram after the trigger starts listening.
7. In the trigger output, switch to JSON and find:

```json
{
  "message": {
    "chat": {
      "id": 123456789
    }
  }
}
```

`123456789` is an example, not a value to copy. Use **`message.chat.id`**, not `message.message_id` or your bot's user ID. Group/channel IDs can be negative: keep the minus sign.

Stop the test and remove the temporary workflow when finished. A bot supports one webhook; don't run this temporary trigger with a bot already serving another production trigger. For an existing bot, reuse a previously verified chat ID instead. If testing requires a webhook URL, your n8n instance needs working public HTTPS; the main workflow itself sends messages and does not need a Telegram Trigger.

Return to the main workflow and replace `YOUR_CHAT_ID` in **both** Telegram nodes. For a channel, give the bot appropriate posting permissions; a private one-to-one chat is the simplest first test.

## 9. Test, then enable real claims

### 9.1 Dry run

Keep the body in **03** set to:

```json
{"dryRun":true}
```

Click **Execute workflow** from the beginning. Inspect the output of **03 - Run Steam Helper**:

```json
{
  "mode": "dry_run",
  "candidateCount": 0,
  "searchTotal": 0,
  "attempts": 0,
  "results": []
}
```

Counts depend on current offers. An empty `results` array means no notifications will be sent; that alone does not indicate Telegram failure. If offers exist, inspect their statuses and the reasons supplied.

To test Telegram independently when there are no candidates, temporarily disconnect the incoming wire to **07 - Telegram Text**, replace its Text expression with a fixed value such as `Steam bot connection test`, and execute that node. This sends a real test message. Restore its original expression `{{ $json.text }}` and reconnect it before saving. Keep the main workflow inactive during this edit.

### 9.2 Enable live claims

When you accept the experimental behavior and want it to attempt real grants, change the HTTP node's JSON body to:

```json
{"dryRun":false}
```

Save, then **Publish / Activate** the workflow. A manual run can test this path immediately; the schedule runs every hour after activation.

`claimed` is a confirmed result. `verification_pending` is **not** success. A paid base-game requirement is expected to block its DLC. See [the result reference](TROUBLESHOOTING.md#result-statuses).

For a replacement installation, disable your old Steam workflow before enabling this one. Do not run several helpers against the same account/data volume. The new helper does not uninstall or modify an older runner setup.

### 9.3 Notification behavior

- Photo + caption when a source image exists; otherwise plain text.
- Original price uses the Store response's currency; unavailable prices are labeled unavailable.
- Already-owned items are omitted.
- Identical status/reason notifications are suppressed for seven days after successful **scheduled** executions. A changed status/reason can notify immediately.
- Manual executions do not persist n8n workflow static data and can repeat notifications.
- A failed delivery fails the execution. Check n8n history; Telegram cannot deliver an error alert if Telegram itself is unavailable.

## 10. Configure failure alerts

1. Import `workflows/steam-error-alert.json` into a second n8n workflow.
2. Open **Telegram Error Alert**.
3. Select your existing Telegram credential.
4. Replace `YOUR_CHAT_ID` with the same destination chat ID.
5. Save that workflow.
6. Open the **main workflow → Settings → Error Workflow**.
7. Select **Steam Free Games - Error Alert**, save, and publish/activate the main workflow.

An Error Trigger is invoked by n8n when a linked automatic execution fails; it has no hourly schedule of its own. A manual Error Trigger example showing `Example Error Message` only tests delivery and is not a real Steam failure. For a real manual workflow error, inspect the main execution history.

Login/discovery/ownership failures can trigger the error workflow. Individual game errors, missing paid bases, and pending verification are result notifications instead. Keep your bot token out of any execution screenshot or report.

## 11. Maintenance

### Logs and authentication

```bash
docker compose logs --tail=100 steam-helper
docker compose exec steam-helper node src/cli.cjs check
docker stats --no-stream
```

The `check` command can refresh tokens. Do not run it concurrently with a helper run; disable the workflow and stop the service first if you need to run it as a one-off while diagnosing token problems.

### Sign in again

Pause the n8n workflow first, then:

```bash
docker compose stop steam-helper
docker compose run --rm steam-helper node src/cli.cjs login
docker compose up -d steam-helper
```

Re-enable the workflow when the service is healthy. Stopping the service prevents refresh-token rotation from racing with a new login.

### Update

Pause the workflow, then run from the repository directory:

```bash
git pull --ff-only
docker compose build
docker compose up -d
```

Check service health and re-enable scheduling. Existing n8n imports do not automatically change when the Git repository changes; read [CHANGELOG.md](../CHANGELOG.md) before replacing an imported workflow. Recheck dryRun and credential selections after reimporting.

### Backups and data deletion

The Compose project stores `auth.json` and the helper key in `steam_data`. Use your Docker host's private volume-backup procedure and keep the same Compose project identity during updates so it reuses the volume. Changing the directory/project name can select a different project-scoped volume.

`docker compose down` keeps the volume. **`docker compose down -v` deletes it** and requires a fresh key/login setup. Never include a volume backup, `.env`, auth file, cookies, or credential export in a public issue or commit.

### When reporting a problem

Include the project version, n8n version, architecture, result status, and a redacted error message. Do not include tokens or raw account responses. Use the repository's bug-report form and consult [troubleshooting](TROUBLESHOOTING.md) first.
