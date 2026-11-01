# SMSTunnel for Zabbix

A Zabbix webhook media type that texts each Zabbix user's own number from **your own Android phone**, from **your own number**, with **[SMSTunnel](https://smstunnel.io)**.

**Replace your GSM modem with your own Android phone.** Zabbix hands each alert to your SMSTunnel account and your phone sends it from its own SIM, so the on-call person sees a number they know and can reply to. There is no modem to plug into the Zabbix server, no serial port and no SMS provider contract: it works the same on bare metal, in a VM, in Docker or in the cloud.

Your phone needs the SMSTunnel app from Google Play:

<a href="https://play.google.com/store/apps/details?id=io.smstunnel.app"><img src="https://smstunnel.io/google-play-badge.png" alt="Get it on Google Play" height="56"></a>

- **One text per alert and per person**, to the number in each Zabbix user's **Send to** field: everyone gets their own text on their own number.
- Short, phone-sized texts for problems, updates and recoveries (and for discovery, autoregistration, internal and service events).
- The API key sits in a **secret macro**, never in the media type.
- Failures show SMSTunnel's own words in Zabbix's **Action log**. Busy or unreachable moments are retried; if your phone is offline, the text waits and goes out when the phone is back online.

Works with **Zabbix 7.0 LTS and later**: tested end to end on 7.0.32, 7.4.16 and the 8.0.0rc3 release candidate. The file is in the 7.0 export format, which 7.2, 7.4 and 8.0 import as well.

## Contents

- [Setup](#setup)
- [Parameters and macros](#parameters-and-macros)
- [Message templates](#message-templates)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [Security notes](#security-notes)
- [Build it with an AI assistant](#build-it-with-an-ai-assistant)
- [Responsible use](#responsible-use)
- [Development](#development)

## Setup

The menu paths are the same in Zabbix 7.0, 7.2, 7.4 and 8.0.

### 1. Your phone and an API key

1. Install the [SMSTunnel app from Google Play](https://play.google.com/store/apps/details?id=io.smstunnel.app) on your Android phone and sign in. Sign in at [smstunnel.io](https://smstunnel.io) on your computer with the same account: the phone appears under **Phones** (you can also link it with the QR code from **Phones → Add phone**).
2. In your [SMSTunnel dashboard](https://dashboard.smstunnel.io/apps), open **Apps → Add an app**, pick **Script or server**, name it *Zabbix* and click **Create the key**. Copy the key: it is shown only once. It can send texts and look up whether they went out (leave **Can also read received texts** off; Zabbix doesn't need it).

The Zabbix server (not a Zabbix proxy) sends the alerts, so it needs to reach `https://smstunnel.io` on port 443, directly or through an HTTP proxy (see `http_proxy` below).

### 2. Import the media type

1. Download [`media_smstunnel.yaml`](media_smstunnel.yaml).
2. In Zabbix, go to **Alerts → Media types** and click **Import** (top right).
3. Choose the file and click **Import**. A media type named **SMSTunnel** appears in the list.

### 3. Put the API key in a secret macro

1. Go to **Administration → Macros**.
2. Add the macro `{$SMSTUNNEL.API.KEY}`, paste the key as its value, and set the type next to the value to **Secret text**.
3. Click **Update**.

A secret macro is hidden in the frontend once saved and is not part of any export. If you keep secrets in HashiCorp Vault or CyberArk, choose **Vault secret** instead and enter the secret's path.

### 4. Test it

1. Back in **Alerts → Media types**, click **Test** in the SMSTunnel row.
2. Replace `{ALERT.SENDTO}` in **send_to** with your own number, for example `+14155550123`.
3. **api_key** reads `{$SMSTUNNEL.API.KEY}`: the Test window doesn't fill in macros, so paste the key there. What you type is used for this test only and is not saved.
4. Click **Test**. You get *Media type test successful* and your phone sends: *Test from Zabbix: SMSTunnel is set up, and your own phone sent this text.*

If you click **Test** with the macro still in **api_key**, the answer reminds you of this. Real alerts do fill in the macro.

You can also type a **subject** and **message** of your own instead of `{ALERT.SUBJECT}` and `{ALERT.MESSAGE}`.

### 5. Give each user their own number

1. Go to **Users → Users** and open a user.
2. On the **Media** tab click **Add**, choose **Type: SMSTunnel** and put the user's own number in **Send to**, in international format (`+14155550123`).
3. Keep **When active** and **Use if severity** as you want them, click **Add**, then **Update**.

One number per media: for a second number, add a second SMSTunnel media. The user also needs at least read permission to the hosts whose problems they should hear about (through their user group).

### 6. Send alerts with an action

1. Go to **Alerts → Actions → Trigger actions** and create an action (or edit one, such as *Report problems to Zabbix administrators*).
2. On **Operations**, add an operation: **Send to users** or **Send to user groups**, **Send only to: SMSTunnel**.
3. Add **Recovery operations** and **Update operations** (*Notify all involved*) if you want those texts too.
4. Leave **Custom message** off to use the templates below. Click **Add** or **Update**, and check that the action is enabled.

When a problem starts, every user in the operation gets a text on their own number. See what was sent in **Reports → Action log**, or in the **Actions** column of **Monitoring → Problems**.

## Parameters and macros

| Parameter | Value | What it does |
| --- | --- | --- |
| `api_key` | `{$SMSTUNNEL.API.KEY}` | Your SMSTunnel API key, from the secret global macro. Sent as the `X-API-Key` header. |
| `send_to` | `{ALERT.SENDTO}` | The user's **Send to**: one phone number. Spaces, dots, dashes and brackets are fine. |
| `subject` | `{ALERT.SUBJECT}` | First line of the text. |
| `message` | `{ALERT.MESSAGE}` | The rest of the text. |
| `max_length` | `320` | Longer texts are cut and end with `...` (plain dots keep the text in the 160-character SMS alphabet). Up to 1600. |
| `device_id` | `{$SMSTUNNEL.DEVICE.ID}` | Optional: send through one particular phone, when your account has several. Copy its ID from **Phones** in your dashboard. If the macro isn't defined, your linked phone sends the text. |
| `default_country_code` | `{$SMSTUNNEL.COUNTRY.CODE}` | Optional: a calling code such as `40` or `+44`. It completes numbers written without `+` or `00` and takes precedence over the phone's own setting. International numbers don't need it. |
| `tls_verify` | `{$HTTP.TLS.VERIFY:"SMSTunnel"}` | Certificate check, the same switch Zabbix's own media types use: `full` (default when the macro isn't defined), `peer` (skip the host name check) or `none`. |

Optional parameters you can add yourself on the media type's form:

| Parameter | What it does |
| --- | --- |
| `http_proxy` | A proxy for the requests, e.g. `http://proxy.example.com:3128` (`HTTPProxy` works too). |
| `server_url` | Another SMSTunnel address, for testing only. The default is `https://smstunnel.io`. |

Options tab: **Attempts 5**, **Attempt interval 30s**, timeout 30 s. A busy moment (429, SMSTunnel allows about 30 texts a minute) or a short outage (5xx, no connection) is tried again for about two minutes.

Undefined optional macros are simply skipped. Keeping these settings in macros means a later import of a new version of the media type does not erase them.

## Message templates

The media type brings templates for every kind of event, written to be read on a phone. With typical values a text fits in one SMS:

```text
PROBLEM: High CPU utilization (over 90% for 5m)
Host: web-01
Severity: High
Data: Current utilization: 97.3 %
Started: 2026.11.01 10:00:00
ID: 123456
```

```text
UPDATED: High CPU utilization (over 90% for 5m)
Ana Pop (ana) acknowledged problem at 10:05:00
On it
Host: web-01
Status: PROBLEM, open for 5m
ID: 123456
```

```text
RESOLVED: High CPU utilization (over 90% for 5m)
Host: web-01
Duration: 12m 30s
Resolved: 2026.11.01 10:12:30
ID: 123456
```

| Event | Subject | Message |
| --- | --- | --- |
| Trigger problem | `PROBLEM: {EVENT.NAME}` | Host, severity, operational data, start time, event ID |
| Trigger recovery | `RESOLVED: {EVENT.NAME}` | Host, duration, recovery time, event ID |
| Trigger update | `UPDATED: {EVENT.NAME}` | Who did what, the comment, host, status and age, event ID |
| Discovery | `DISCOVERY: {DISCOVERY.DEVICE.STATUS} {DISCOVERY.DEVICE.IPADDRESS}` | Rule, DNS name, service |
| Autoregistration | `NEW HOST: {HOST.HOST}` | IP and port |
| Internal problem / recovery | `INTERNAL PROBLEM: …` / `INTERNAL RESOLVED: …` | Host, time or duration, event ID |
| Service problem / recovery / update | `SERVICE PROBLEM: {SERVICE.NAME}` … | Problem name, severity, times |

The text is the subject, a line break, then the message. Lines such as `Data:` whose macro resolved to nothing are left out, and so are extra blank lines. Edit the templates on the media type's **Message templates** tab, or tick **Custom message** in an action operation. To put a link to the problem in the text, add a line like `{$ZABBIX.URL}/tr_events.php?triggerid={TRIGGER.ID}&eventid={EVENT.ID}` and define `{$ZABBIX.URL}` (a long link takes a good part of one SMS).

Zabbix itself decides two things worth knowing: *Notify all involved* does not text the user who made the update, and `{USER.FULLNAME}` reads "Inaccessible user" to recipients who aren't allowed to see other users.

## Troubleshooting

Look in **Reports → Action log** (column *Info*), or in **Monitoring → Problems**: click the problem's icon in the **Actions** column and point at the red **i** next to *Failed*. Every message starts with `SMSTunnel:`.

| What Zabbix shows | What to do |
| --- | --- |
| `no API key. Add the global macro {$SMSTUNNEL.API.KEY} …` | Add the macro in **Administration → Macros** (the name must match exactly). In the Test window, paste the key into **api_key**. |
| `the API key was not accepted (HTTP 401: Invalid or expired API key) …` | The key is wrong or was deleted. Create a new one under **Apps** in your dashboard and update the macro. Alerts made before the fix keep the old key for their retries; new alerts use the new key. |
| `the text was refused (HTTP 403: … [PERMISSION_REQUIRED])` | The key can't send texts. Create a key under **Apps → Add an app**. Other 403 messages explain a plan or account limit. |
| `"Send to" is not a phone number (…)` / `the text was not accepted (HTTP 400: Phone number must …)` | Fix the user's **Send to**: one number in international format, e.g. `+14155550123`. |
| `"Send to" holds more than one number (…)` | Use one SMSTunnel media per number on the user's **Media** tab. |
| `too many texts in a short time (HTTP 429 …)` | SMSTunnel allows about 30 texts a minute. Zabbix retries on its own; if it happens often, cut alert noise (trigger dependencies, longer escalation steps). |
| `the service could not take the text right now (HTTP 5xx …)` / `could not reach https://smstunnel.io (cannot get URL: …)` | Retried on its own. If it keeps failing, check that the Zabbix server can reach `smstunnel.io:443` (DNS, firewall, `http_proxy`). |
| `the certificate of https://smstunnel.io was not accepted (cannot get URL: SSL certificate problem: …)` | The Zabbix server has no CA bundle, or a TLS-inspecting proxy re-signs traffic. Install the `ca-certificates` package or add your proxy's CA to the system store. As a last resort, set the global macro `{$HTTP.TLS.VERIFY:"SMSTunnel"}` to `peer` or `none`. This one is not retried. |
| `the text is empty …` | The action's custom message has no subject and no message. |
| The alert says *Sent* but no text arrived | Open the SMSTunnel app on the phone and check it is signed in and online. A text for an offline phone waits and goes out when the phone is back; the dashboard shows each text's status. |
| Nothing in the action log | Check that the action is enabled and its conditions match, that the user's SMSTunnel media is enabled for that severity and time, that the user can read the host, and that the media type is enabled. |

For more detail, raise the alerter log level on the Zabbix server for a few minutes (`zabbix_server -R log_level_increase=alerter`) and look for lines starting with `[ SMSTunnel ]`. They never contain the key, and phone numbers are shortened. At that debug level Zabbix itself also writes each webhook's parameters to the log, the key included (`In zbx_es_execute() param:`), so lower it again afterwards (`zabbix_server -R log_level_decrease=alerter`) and don't share that log.

## Updating

Import the new `media_smstunnel.yaml` the same way, with **Update existing** ticked for media types. Your macros (key, phone ID, country code) stay as they are. The parameters and message templates are replaced with the new version's, so note any template you changed before you import.

To remove it: delete the SMSTunnel media type, the `{$SMSTUNNEL.*}` macros, and the key under **Apps** in your dashboard.

## Security notes

- The key is in a **Secret text** (or Vault) macro: hidden in the frontend, left out of exports, never written into the media type.
- Deleting the key under **Apps** in your dashboard cuts Zabbix off at once. A key made with **Apps → Add an app** can send texts and check their status; it reads received texts only if you allowed that.
- The script never logs the key and never puts it in an error message. At debug level it logs the length of the text and a shortened number.
- Zabbix itself handles the resolved key in two places, as it does for every webhook: it keeps each alert's parameters in its database (the `alerts` table; the frontend and the API don't show them), and at DebugLevel 4 it writes them to the server log. Keep the default log level, treat database access and backups as sensitive, and replace the key if they leak.
- Certificates are checked (`full`) on Zabbix 7.0.28+ and 7.4.12+. Older Zabbix releases don't check certificates for any webhook; upgrading is the fix.

## Build it with an AI assistant

Paste this prompt into Claude, ChatGPT, Cursor or Copilot and replace the part in brackets. Never paste your API key into the chat: the prompt doesn't need it.

```text
Help me set up Zabbix alerts by text message with SMSTunnel.

About SMSTunnel (https://smstunnel.io): my own apps and tools hand text messages (SMS) to my
SMSTunnel account, and my own Android phone sends them from my own number, on my own SIM and plan.
The phone runs the SMSTunnel app from Google Play
(https://play.google.com/store/apps/details?id=io.smstunnel.app), signed in to my account.

What I want: [describe what should send a text, to whom, and when]

How the Zabbix integration works ("SMSTunnel for Zabbix", https://github.com/narcisbodea/smstunnel-zabbix):
- Install: Alerts > Media types > Import > media_smstunnel.yaml (Zabbix 7.0 or later). It adds a
  webhook media type "SMSTunnel".
- The API key goes into the global macro {$SMSTUNNEL.API.KEY}, type "Secret text"
  (Administration > Macros). Optional macros: {$SMSTUNNEL.DEVICE.ID} (send through one phone) and
  {$SMSTUNNEL.COUNTRY.CODE} (e.g. 40; completes numbers written without + or 00 and takes
  precedence over the phone's own setting).
- Each Zabbix user gets a media of type SMSTunnel with one phone number in "Send to"
  (Users > Users > Media). One text per alert and per media; several numbers = several media.
- Actions (Alerts > Actions > Trigger actions) send to users or user groups through SMSTunnel.
  The text is {ALERT.SUBJECT} + a line break + {ALERT.MESSAGE}, cut at max_length (320) with "...".
- Media type options: 5 attempts, 30 s apart. Errors show in Reports > Action log.

SMSTunnel API facts (if you call it directly, e.g. from a script):
- POST https://smstunnel.io/api/v1/sms/send, headers "X-API-Key: <key>" and
  "Content-Type: application/json", body {"to": "+14155550123", "message": "...",
  "deviceId": "optional", "defaultCountryCode": "optional, e.g. +40"}.
- One recipient per call: loop to text several people.
- Sign-in codes go to POST /api/v1/sms/send-2fa instead: the text must contain the code as 4 to 10
  digits on their own (482913 or 123-456), max 320 characters; otherwise 400 "No valid
  verification code found". Not for alerts.
- Texts up to 1600 characters; about 30 send requests a minute.
- Errors are JSON {"message", "error", "statusCode"}, sometimes with "code": 401 bad key;
  403 missing permission or plan (e.g. code PERMISSION_REQUIRED); 429 too many requests (wait and
  retry); 5xx server problem (retry later). If my phone is offline, the text waits and goes out
  when the phone is back online.

Rules for your answer:
- Keep the API key in a Zabbix secret macro, a vault, or an environment variable. Never put it in
  source code, templates, exports, client-side code or this chat, and never ask me for it.
- Phone numbers must be in international format (+ and the country code); validate them.
- Handle errors: show or log SMSTunnel's error message, retry only 429 and 5xx.
- Help me test with my own number first.
- Only send texts people expect from me (alerts to my own team, on-call staff). No unsolicited texts.
```

## Responsible use

Send only texts that people expect from you, such as alerts to yourself, your team and your on-call staff. Unsolicited messages from a personal SIM break most carriers' terms of service. Make sure your use complies with your carrier's terms and with local regulations (in the EU, that includes GDPR and the ePrivacy rules on electronic communications).

## Development

The script is [`src/smstunnel.js`](src/smstunnel.js) (plain ES5, for Zabbix's Duktape engine); the media type's other fields are in [`src/mediatype.mjs`](src/mediatype.mjs). `npm run build` writes `media_smstunnel.yaml` from both, in the same style as Zabbix's own export.

```bash
npm install
npm test        # checks the YAML is up to date, then runs the unit tests
```

The end-to-end test runs the media type in a real Zabbix (server, web and PostgreSQL in Docker) against a local SMSTunnel test server, never against smstunnel.io:

```bash
ZBX_VERSION=7.0 ZBX_WEB_PORT=8571 docker compose -p smst-int-zabbix70 -f test/e2e/docker-compose.yml up -d
node test/e2e/e2e.mjs --zabbix http://127.0.0.1:8571 --key-file key.json \
  --api-url http://host.docker.internal:3101 --server-container smst-int-zabbix70-server-1
docker compose -p smst-int-zabbix70 -f test/e2e/docker-compose.yml down -v
```

It imports the file (and checks that Zabbix exports it back unchanged), fires real problems, an update and a recovery to two users, makes the first try fail with a 503 to see the retry, and checks a wrong key, a wrong number and a "Send to" with two numbers. With `--tls-check` it also checks certificate handling against public test hosts (with a dummy key); `--import-only` stops after the import checks. Use `ZBX_VERSION=7.4` for the latest release, or `ZBX_TAG=trunk-alpine` for Zabbix's development build. The test refuses to run against `smstunnel.io`.

## License

[MIT](LICENSE) © NARBOWEB SRL.

Zabbix is a trademark of Zabbix LLC. SMSTunnel for Zabbix is not affiliated with, endorsed by, or sponsored by Zabbix LLC.
