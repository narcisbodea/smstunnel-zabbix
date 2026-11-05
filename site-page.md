# smstunnel.io page: SMSTunnel for Zabbix

The words for the page on smstunnel.io. It has been live since 1.0.0 at https://smstunnel.io/integrations/zabbix/ (`src/pages/integrations/zabbix.astro` in the landing repository). Another agent owns the site; this file only holds the words and the list of images. Screenshots are in `D:\ANDROID\integrari\zabbix-screens\`.

## Changes for 1.1.0

Apply these once the v1.1.0 release is published. The 6.0 download link below doesn't work before then.

1. **Versions everywhere:** "Zabbix 7.0 LTS and later" becomes "Zabbix 6.0 LTS, 7.0 LTS and later". This covers the meta description, the hero's small print, the intro of the setup steps and the FAQ (texts below).
2. **A second download** under the main button: "For Zabbix 6.0 LTS: media_smstunnel_6.0.yaml". The link is https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel_6.0.yaml.
3. **The 6.0 menu paths** in the setup steps, in brackets after the 7.0 ones (as in the README): see "How it works" below.
4. **Certificates:** "checked on 7.0.28+ and 7.4.12+" becomes "checked on 6.0.47+, 7.0.28+, 7.4.12+ and 8.0".
5. **The AI prompt** on the page: take the new install, macro, users and actions lines from the README's "Build it with an AI assistant".
6. **Zabbix 8.0 LTS** came out on 5 November 2026. Write "8.0 LTS" where the page says "8.0" or "8.0 release candidate", and "tested end to end on 6.0.49, 7.0.32, 7.4.16 and 8.0.0" where it lists the tested versions.

---

## Meta

- **Title:** Zabbix SMS alerts from your own phone | SMSTunnel
- **Description:** Text Zabbix alerts to each user's own number from your own Android phone and your own number. A webhook media type for Zabbix 6.0 LTS, 7.0 LTS and later: no GSM modem, no serial port.

## Hero

**SMSTunnel for Zabbix**

Replace your GSM modem with your own Android phone. Zabbix hands each alert to your SMSTunnel account and your phone sends it from its own SIM, to each user's own number. The on-call person sees a number they know and can reply to it.

Buttons:
- **Get it on Google Play** (badge, https://play.google.com/store/apps/details?id=io.smstunnel.app)
- **Download the media type** (https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel.yaml)
- **Setup guide on GitHub** (https://github.com/narcisbodea/smstunnel-zabbix)

Under the buttons: "For Zabbix 6.0 LTS: [media_smstunnel_6.0.yaml](https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel_6.0.yaml)"

Small print: Zabbix 6.0 LTS, 7.0 LTS, 7.2, 7.4 and 8.0 LTS · webhook media type · free and open source (MIT)

## What you get (three cards)

1. **One text per alert, to each user's own number**
   Every Zabbix user gets an SMSTunnel media with their number in "Send to". Actions send to users and user groups as usual.
   Image: `05-user-media.png`

2. **Short texts made for a phone**
   Ready templates for problems, updates and recoveries, and for discovery, autoregistration, internal and service events. Long texts are cut at 320 characters.
   Image: `09-message-templates.png` (and the example text below)

3. **Clear errors, sensible retries**
   A wrong key or a wrong number shows SMSTunnel's own words in Zabbix. A busy moment or a short outage is retried for about two minutes. If your phone is offline, the text waits and goes out when it is back.
   Image: `08-error-bad-key.png` or `07-action-log.png`

Example text (show it as a phone screen or a code block):

```
PROBLEM: High CPU utilization (over 90% for 5m)
Host: web-01
Severity: High
Data: Current utilization: 97.3 %
Started: 2026.11.01 10:00:00
ID: 123456
```

## How it works (four steps)

Above the steps: "The menu paths are the same in Zabbix 7.0, 7.2, 7.4 and 8.0. Zabbix 6.0 has some of them elsewhere; they're in brackets."

1. **Install the SMSTunnel app** on your Android phone and sign in. Your phone shows up under **Phones** in your dashboard.
2. **Create a key:** in your dashboard, **Apps → Add an app → Zabbix → Create the key**, and copy it.
3. **Import the media type** in Zabbix. Go to **Alerts → Media types → Import** (6.0: **Administration → Media types → Import**) and pick `media_smstunnel.yaml` (6.0: `media_smstunnel_6.0.yaml`). Then put the key in the global macro `{$SMSTUNNEL.API.KEY}`: **Administration → Macros** (6.0: **Administration → General → Macros**), type **Secret text**.
4. **Give each user their number:** **Users → Users → Media → Add** (6.0: **Administration → Users**), type *SMSTunnel*, their number in **Send to**. Point an action at SMSTunnel and you're done. The **Test** button on the media type sends a test text right away.

Images for the steps: `02-import.png`, `03-secret-macro.png`, `04-test-ok.png`

## Why your own phone

- **No modem on the Zabbix server.** Zabbix's built-in SMS needs a GSM modem on a serial port of the server. SMSTunnel needs only HTTPS, so it works the same in a VM, in Docker or in the cloud.
- **A number people know.** Alerts come from your own number, so they stand out and people can reply or call back.
- **Your own SIM and plan.** Texts go out on the plan you already pay for.
- **You stay in control.** Delete the key under Apps and Zabbix can't send anymore. The key lives in a secret macro, hidden in Zabbix and left out of exports.

## Screenshots (gallery)

| File | Caption |
| --- | --- |
| `01-media-types-list.png` | SMSTunnel next to Zabbix's built-in SMS type, which needs a GSM modem |
| `02-import.png` | Importing media_smstunnel.yaml |
| `03-secret-macro.png` | The API key in a secret global macro |
| `04-test-ok.png` | The Test button: "Media type test successful" |
| `05-user-media.png` | A user's own number in "Send to" |
| `06-media-type-form.png` | The parameters of the media type |
| `07-action-log.png` | Sent texts, and the failures explained, in the Action log |
| `08-error-bad-key.png` | A wrong key: SMSTunnel's message in Monitoring → Problems |
| `09-message-templates.png` | Templates for every kind of event |
| `10-options.png` | 5 attempts, 30 seconds apart |
| `11-zabbix-7.4-media-types.png` | The same file in Zabbix 7.4 |
| `12-zabbix-8.0rc-media-types.png` | And in the Zabbix 8.0 release candidate |

Screenshots were taken in a local test setup (Zabbix in Docker, a local SMSTunnel test server). In `04-test-ok.png` the key is masked and the two rows that point at the local test server (server_url, tls_verify) are hidden; `06-media-type-form.png` shows the parameters as shipped. There are no Zabbix 6.0 screenshots yet.

## FAQ

**Which Zabbix versions?**
Zabbix 6.0 LTS, 7.0 LTS and later (7.2, 7.4 and 8.0 LTS). Import `media_smstunnel.yaml` on 7.0 and later and `media_smstunnel_6.0.yaml` on 6.0; both hold the same media type. Tested end to end on 6.0.49, 7.0.32, 7.4.16 and 8.0.0. Certificates are checked on 6.0.47+, 7.0.28+, 7.4.12+ and 8.0.

**Can several people get the alert?**
Yes. Each user gets their own text on their own number; one SMSTunnel media per number.

**What if my phone is offline?**
The text waits in your account and goes out when the phone is back online. Zabbix shows the alert as sent.

**What if SMSTunnel is busy or can't be reached?**
Zabbix tries again: 5 attempts, 30 seconds apart. SMSTunnel allows about 30 texts a minute.

**Where does Zabbix keep the key?**
In a global macro of type Secret text (or a Vault secret): hidden in the frontend and left out of exports.

**Does the Zabbix server need internet access?**
It needs to reach https://smstunnel.io on port 443, directly or through an HTTP proxy. Zabbix proxies don't send alerts, so only the server needs it.

**Can I send through a particular phone?**
Yes: put the phone's ID (from **Phones** in your dashboard) in the macro `{$SMSTUNNEL.DEVICE.ID}`.

**I upgraded Zabbix from 6.0 to 7.0. What now?**
The media type comes along and keeps working. Import `media_smstunnel.yaml` with **Update existing** ticked so that its messages name 7.0's menus.

## Build it with an AI assistant

Show the prompt from the README's "Build it with an AI assistant" section in a copyable code block. Put this line above it: "Paste this into Claude, ChatGPT, Cursor or Copilot and replace the part in brackets. Never paste your API key into the chat: the prompt doesn't need it."

## Footer line

Zabbix is a trademark of Zabbix LLC. SMSTunnel for Zabbix is not affiliated with, endorsed by, or sponsored by Zabbix LLC.
