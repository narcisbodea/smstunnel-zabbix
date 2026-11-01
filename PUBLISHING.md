# Publishing SMSTunnel for Zabbix

Nothing has been published yet. The order below matters: the zabbix.com listing and the media type's description link to the GitHub repository, so it has to exist first.

| Where | What it gives | Who can do it | Review |
| --- | --- | --- | --- |
| GitHub `narcisbodea/smstunnel-zabbix` | The home of the media type: README, file, releases | You (`gh` signed in as `narcisbodea`) | None |
| zabbix.com/integrations ("Propose integration") | A **Vendor** listing next to SMSEagle, Pushover, Telegram… | You, as NARBOWEB SRL (the form is for software vendors) | Not stated by Zabbix; plan for weeks, and a reply by email |
| zabbix/community-templates | Not for media types (templates only) | — | — |
| smstunnel.io integration page | The page in `site-page.md` | The site's owner | — |

## 1. GitHub repository

Before pushing, from this folder:

```bash
npm install
npm test                                  # YAML up to date + unit tests
git grep -n "sk_live_[A-Za-z0-9]" || echo "no keys in the repository"
```

Then create the repository, push, and publish the first release with the import file attached:

```bash
gh repo create narcisbodea/smstunnel-zabbix --public --source . --remote origin \
  --description "SMSTunnel for Zabbix: text alerts from your own Android phone and your own number (webhook media type)" \
  --homepage "https://smstunnel.io"
git push -u origin main
gh repo edit narcisbodea/smstunnel-zabbix \
  --add-topic zabbix --add-topic zabbix-webhook --add-topic zabbix-media-type --add-topic sms \
  --add-topic android --add-topic alerting --add-topic monitoring --add-topic smstunnel
gh release create v1.0.0 media_smstunnel.yaml --title "SMSTunnel for Zabbix 1.0.0" --notes-file CHANGELOG.md
```

The direct download link for users is then
`https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel.yaml`.

## 2. zabbix.com integrations page (Vendor listing)

Zabbix lists third-party media types on <https://www.zabbix.com/integrations> (Zabbix Share, `share.zabbix.com`, now redirects there). Vendor entries such as SMSEagle show "From the vendor", link to the vendor's GitHub repository, and carry Zabbix's note that vendor and community integrations are not verified by Zabbix.

Form: <https://www.zabbix.com/forms/integration_add> ("Propose integration"). Zabbix says it is "intended for software vendors interested in a technology partnership with Zabbix"; individual developers are sent to the community-templates repository instead. NARBOWEB SRL is the vendor of SMSTunnel, so this is the right form. Suggested answers:

| Field | Required | Suggested answer |
| --- | --- | --- |
| Company name | yes | NARBOWEB SRL |
| First name / Last name | yes | Narcis / Bodea |
| Job title | yes (list) | The title that fits (e.g. *Chief Executive Officer*) |
| Business email address | yes | contact@narboweb.ro |
| Phone number | yes | Your business number |
| Country / Territory | yes | Romania |
| Integration title | yes | SMSTunnel |
| Company description | yes | NARBOWEB SRL makes SMSTunnel (https://smstunnel.io), which lets people's own apps and tools send texts from their own Android phone and their own number. |
| Logo | optional, .svg or .png, up to 50 KB | `D:\ANDROID\smstunnel-landing\public\logo.svg` (8.3 KB) |
| Source | yes | https://github.com/narcisbodea/smstunnel-zabbix |
| Created | yes | The date of the v1.0.0 release (e.g. 2026-11) |
| Updated | no | Leave empty |
| Author | yes | NARBOWEB SRL (Narcis Bodea) |
| Compatibility | yes | Webhook media type. Needs an Android phone with the SMSTunnel app (Google Play) and an SMSTunnel account. |
| Zabbix versions | yes | 7.0, 7.2, 7.4 (tested on 7.0.32 and 7.4.16) |
| Integration description | yes | See below |
| Captcha, "Receive regular Zabbix news and updates" | captcha yes; the checkbox may be required | — |

Integration description (keep the wording: own phone, own number, one text per user):

> SMSTunnel for Zabbix texts each Zabbix user's own "Send to" number from your own Android phone and your own number. Zabbix hands every alert to your SMSTunnel account and the phone sends it from its own SIM, so the on-call person sees a number they know and can reply to. No GSM modem or serial port on the Zabbix server. Import one YAML file, put the API key in a secret macro, and give each user an SMSTunnel media with their number. Includes short, phone-sized templates for problems, updates and recoveries; SMSTunnel's error messages appear in the Action log, and busy moments are retried.

Zabbix does not say how long the review takes or what happens next; expect an email from their partner team. They may ask about a technology partnership.

## 3. Zabbix community templates: not the place

<https://github.com/zabbix/community-templates> takes **templates** only: one folder per template named `template_*`, a `7.0`-style version folder, MIT license (no third-party licenses). A media type is not a template, so there is no pull request to make there for this repository.

A template could go there later: for example one that watches the SMSTunnel phone itself (online, last seen) through the API, so Zabbix warns by email when the phone that sends the texts is offline. See the open questions in the hand-over notes.

## 4. smstunnel.io

`site-page.md` holds the text for an integration page (for example `https://smstunnel.io/integrations/zabbix/`). The site is maintained separately; hand the file to its owner. The dashboard has no *Zabbix* entry under **Apps → Add an app** yet, so the guide tells users to pick **Script or server**; a Zabbix entry with a link to the guide (like the Uptime Kuma one) would be a small follow-up there.

## 5. When Zabbix 8.0 LTS ships (planned for Q4 2026)

1. Run the end-to-end test with the 8.0 images: `ZBX_VERSION=8.0 ZBX_WEB_PORT=8580 docker compose -p smst-int-zabbix80 -f test/e2e/docker-compose.yml up -d`, then `node test/e2e/e2e.mjs --zabbix http://127.0.0.1:8580 …` (the `trunk-alpine` images can be used before the release).
2. Keep the file in the 7.0 export format: newer versions import it, and 7.0 LTS users can too.
3. Update "tested on" in the README and the Zabbix versions on the zabbix.com listing.

## Releasing a new version

1. Change `src/smstunnel.js` (and `src/mediatype.mjs`), update `version` in both, `package.json` and `CHANGELOG.md`.
2. `npm run build && npm test`, then the end-to-end test on 7.0 and the latest release.
3. Commit, tag and `gh release create vX.Y.Z media_smstunnel.yaml --notes-file CHANGELOG.md`.
