# smstunnel.io page: SMSTunnel for Zabbix

Content for a page on smstunnel.io (suggested path: `/integrations/zabbix/`). Another agent owns the site; this file only holds the words and the list of images. Screenshots are in `D:\ANDROID\integrari\zabbix-screens\`.

Status: built and tested locally on Zabbix 7.0.32 and 7.4.16, **not published yet**. The download link below works once the GitHub repository and its first release exist (see `PUBLISHING.md`); until then, show "Coming soon" instead of the download button.

---

## Meta

- **Title:** Zabbix SMS alerts from your own phone | SMSTunnel
- **Description:** Text Zabbix alerts to each user's own number from your own Android phone and your own number. A webhook media type for Zabbix 7.0 LTS and later: no GSM modem, no serial port.

## Hero

**SMSTunnel for Zabbix**

Replace your GSM modem with your own Android phone. Zabbix hands each alert to your SMSTunnel account and your phone sends it from its own SIM, to each user's own number. The on-call person sees a number they know and can reply to it.

Buttons: **Get it on Google Play** (badge, https://play.google.com/store/apps/details?id=io.smstunnel.app) · **Download the media type** (https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel.yaml) · **Setup guide on GitHub** (https://github.com/narcisbodea/smstunnel-zabbix)

Small print under the buttons: Zabbix 7.0 LTS, 7.2 and 7.4 · webhook media type · free and open source (MIT)

## What you get (three cards)

1. **One text per alert, to each user's own number**
   Every Zabbix user gets an SMSTunnel media with their number in "Send to". Actions send to users and user groups as usual.
   Image: `05-user-media.png`

2. **Short texts made for a phone**
   Ready templates for problems, updates and recoveries, and for discovery, autoregistration, internal and service events. Long texts are cut at 320 characters.
   Image: `08-phone-texts.png` (or the example below as text)

3. **Clear errors, sensible retries**
   A wrong key or a wrong number shows SMSTunnel's own words in the Action log. A busy moment or a short outage is retried for about two minutes. If your phone is offline, the text waits and goes out when it is back.
   Image: `07-action-log.png`

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

1. **Install the SMSTunnel app** on your Android phone and sign in. Your phone shows up under **Phones** in your dashboard.
2. **Create a key:** in your dashboard, **Apps → Add an app → Script or server**, name it *Zabbix*, **Create the key**.
3. **Import the media type** in Zabbix: **Alerts → Media types → Import**, then put the key in the global macro `{$SMSTUNNEL.API.KEY}` (**Administration → Macros**, type **Secret text**).
4. **Give each user their number:** **Users → Users → Media → Add**, type *SMSTunnel*, their number in **Send to**. Point an action at SMSTunnel and you're done. The **Test** button on the media type sends a test text right away.

Image for the steps: `02-import.png`, `03-secret-macro.png`, `04-test-ok.png`

## Why your own phone

- **No modem on the Zabbix server.** Zabbix's built-in SMS needs a GSM modem on a serial port of the server. SMSTunnel needs only HTTPS, so it works the same in a VM, in Docker or in the cloud.
- **A number people know.** Alerts come from your own number, so they stand out and people can reply or call back.
- **Your own SIM and plan.** Texts go out on the plan you already pay for.
- **You stay in control.** Delete the key under Apps and Zabbix can't send anymore. The key lives in a secret macro, hidden in Zabbix and left out of exports.

## Screenshots (gallery)

| File | Caption |
| --- | --- |
| `01-media-types-list.png` | The SMSTunnel media type in Alerts → Media types |
| `02-import.png` | Importing media_smstunnel.yaml |
| `03-secret-macro.png` | The API key in a secret global macro |
| `04-test-ok.png` | The Test button: "Media type test successful" |
| `05-user-media.png` | A user's own number in "Send to" |
| `06-media-type-form.png` | The parameters of the media type |
| `07-action-log.png` | Sent texts, and a wrong number explained, in the Action log |
| `08-error-bad-key.png` | A wrong key: SMSTunnel's message in Zabbix |

(Use the files that exist in the screenshot folder; names may differ slightly.)

## FAQ

**Which Zabbix versions?**
Zabbix 7.0 LTS and later (7.2, 7.4; tested on 7.0.32 and 7.4.16). Certificates are checked on 7.0.28+ and 7.4.12+.

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

## Build it with an AI assistant

Show the prompt from the README's "Build it with an AI assistant" section in a copyable code block, with this line above it: "Paste this into Claude, ChatGPT, Cursor or Copilot and replace the part in brackets. Never paste your API key into the chat: the prompt doesn't need it."

## Footer line

Zabbix is a trademark of Zabbix LLC. SMSTunnel for Zabbix is not affiliated with, endorsed by, or sponsored by Zabbix LLC.
