# Publishing SMSTunnel for Zabbix

## Where it is published

| Where | State | What's next |
| --- | --- | --- |
| GitHub `narcisbodea/smstunnel-zabbix` | Public since 1 November 2026, with release v1.0.0 (`media_smstunnel.yaml`) | Release v1.1.0, with both files (below) |
| smstunnel.io/integrations/zabbix/ | Live since 1.0.0 | The 1.1.0 changes, listed at the top of `site-page.md` |
| Dashboard, **Apps → Add an app → Zabbix** | Live; it gives the 7.0 steps and the 7.0 download | Add the 6.0 file and 6.0's menu paths after the release (below) |
| zabbix.com/integrations | Not submitted | The owner sends the form: everything to paste is in [`LISTING.md`](LISTING.md) |
| Zabbix's own repository (ships with Zabbix) | Not asked | Only through Zabbix's Integration Team; see [Shipping with Zabbix](#shipping-with-zabbix) |
| zabbix/community-templates | Not used | Meant for individuals' templates; see [Shipping with Zabbix](#shipping-with-zabbix) |

## Release v1.1.0

Everything is committed on `main`; nothing has been pushed. On 5 November 2026 the end-to-end test passed 34 of 34 on Zabbix 6.0.49, 7.0.32, 7.4.16 and 8.0.0, against a local SMSTunnel test server built from 17acebf. From this folder:

```bash
npm install
npm test                                                     # both files up to date, 36 unit tests
git grep -n "sk_live_[A-Za-z0-9]" || echo "no keys in the repository"
git push origin main
gh release create v1.1.0 media_smstunnel.yaml media_smstunnel_6.0.yaml --target main \
  --title "SMSTunnel for Zabbix 1.1.0" --notes-file release-notes/v1.1.0.md
```

The download links are then:

- https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel.yaml (Zabbix 7.0 and later)
- https://github.com/narcisbodea/smstunnel-zabbix/releases/latest/download/media_smstunnel_6.0.yaml (Zabbix 6.0 LTS)

The asset names must stay exactly these. The README, the site, the dashboard and the zabbix.com listing all use them.

## Dashboard, after the release

`smstunnel-app/apps/dashboard/src/pages/apps/setups.ts` links only to `media_smstunnel.yaml`, and the Zabbix steps in `src/locales/en.json` and `ro.json` (`appKinds.zabbix.setup`) give 7.0's menus only. Suggested change, once v1.1.0 is out (the 6.0 link doesn't work before then):

- `setups.ts`: a second link in the `import` step, to `${GITHUB}/smstunnel-zabbix/releases/latest/download/media_smstunnel_6.0.yaml`, with the text `appKinds.zabbix.setup.download60`.
- `en.json`:
  - `import`: "Download the media type. In Zabbix, open Alerts, Media types (6.0: Administration, Media types), click Import and choose the file."
  - `download60`: "For Zabbix 6.0: media_smstunnel_6.0.yaml"
  - `macro`: "Open Administration, Macros (6.0: Administration, General, Macros) and add the macro {$SMSTUNNEL.API.KEY} with this value. Set its type to Secret text and click Update:"
  - `test`: "In Alerts, Media types (6.0: Administration, Media types), click Test in the SMSTunnel row. Put your number in send_to and the key in api_key (the test doesn't fill in macros), then click Test."
  - `users`: "Give each user their number in Users, Users, Media (6.0: Administration, Users), Type SMSTunnel, and send to them from a trigger action."
- `ro.json`:
  - `import`: "Descarcă media type-ul. În Zabbix, deschide Alerts, Media types (6.0: Administration, Media types), apasă Import și alege fișierul."
  - `download60`: "Pentru Zabbix 6.0: media_smstunnel_6.0.yaml"
  - The other three steps take the same bracketed 6.0 paths.
- `prompts.ts`, the Zabbix lines: "Zabbix 7.0 or later" becomes "Zabbix 7.0 or later, or media_smstunnel_6.0.yaml for Zabbix 6.0 (Administration, Media types)".

## zabbix.com integrations page

[`LISTING.md`](LISTING.md) has every field of the "Propose integration" form (https://www.zabbix.com/forms/integration_add) ready to paste, the logo in [`listing/`](listing/), and what happens next. In short:

- There is no partner status, fee or account to set up. Only a business phone number is missing from the texts.
- Zabbix states no review time; recent vendor entries appeared after about 2 to 5 weeks.
- The entry will be a "From the vendor" listing like SMSEagle's, with Zabbix's note that vendor integrations are not verified by Zabbix.

## Shipping with Zabbix

The question is whether the media type can go into Zabbix's own repository (`templates/media/`, and the default data of new installations), so that it ships with Zabbix. It can't be done by sending code today. Checked on 5 November 2026:

1. **No pull requests.**
   - The GitHub mirror (github.com/zabbix/zabbix) has merged none of its 189 pull requests. One of the repository's contributors answered one of them with "PR is ignoring. Please open ticket here https://support.zabbix.com".
   - git.zabbix.com has no sign-up for outsiders.
   - The old contributor route was ZBXCTR tickets with `contrib/ZBXCTR-…` branches. It is being retired: "we are retiring ZBXCTR project … please create a ZBXNEXT ticket" (ZBXCTR-5, 12 June 2025). zabbix.com/developers still describes it.
2. **A ZBXNEXT feature request is the way in.** You open one on support.zabbix.com (it needs an account) and ask the Integration Team to add an SMSTunnel media type. A Zabbix engineer then writes or rewrites it, on Zabbix's shared webhook classes, for the branches in support.
   - The last vendor-written media types were SIGNL4 and iLert in 2020. Since September 2020, every change under `templates/media` was made by Zabbix staff.
   - Recent vendor requests got no code accepted. All Quiet's ZBXNEXT-9940 (April 2025) is still open, and All Quiet has only a vendor listing. Plivo and Twilio's ZBXNEXT-10099 was closed "Won't fix" in November 2025, with a pointer to community-templates.
3. **A contributor licence agreement**, if Zabbix takes code from NARBOWEB:
   - a corporate CLA (CCLA), signed by hand by someone who can sign for the company;
   - an individual CLA (ICLA) for each person who wrote code, after registering on support.zabbix.com for a Zabbix account ID.
   - The original goes by post or courier, and a scan to contribution@zabbix.com. Digital signatures aren't accepted.
   - Both CLAs say "each of Your Contributions is Your original creation". Zabbix has no written policy on AI-assisted contributions (none in the repository, the guidelines, the CLAs or the forum rules that could be read). The media type was largely written with an AI assistant, so decide on that wording before signing.
4. **What shipping would give:**
   - new installations of Zabbix get it in their default media types (32 webhooks today);
   - upgraded installations don't, and import it as now.
   - Zabbix credits outside authors by handle in its ChangeLog, but not in the media type's README.
   - New media types do reach supported LTS branches, not only the next major version. 6.0 is in limited support now, so it would be 7.0 LTS and 8.0 LTS.

**Recommended:** the vendor listing first. A ZBXNEXT request can follow once the listing is live, linking to it and to this repository; votes on the ticket help. Nothing has been opened.

**community-templates** (github.com/zabbix/community-templates) is for individuals, MIT only, and its guidelines describe templates. Its automated checks also know a `mediatype_…` folder, and Zabbix sent one webhook author there, but no media type has been merged yet. A vendor listing suits NARBOWEB better.

## Zabbix 8.0 LTS

Zabbix 8.0.0 came out on 5 November 2026, and the end-to-end test passes on it (34 of 34). To run it again: `ZBX_VERSION=8.0 ZBX_WEB_PORT=8580 docker compose -p smst-int-zabbix80 -f test/e2e/docker-compose.yml up -d`, then `node test/e2e/e2e.mjs --zabbix http://127.0.0.1:8580 … --server-container smst-int-zabbix80-server-1`. Keep `media_smstunnel.yaml` in the 7.0 export format: 7.0 LTS and every newer version import it.

## Releasing a new version

1. Change `src/smstunnel.js` and `src/mediatype.mjs`. Update `VERSION` and `RELEASE_DATE` in `src/mediatype.mjs` (the date is the 6.0 file's export date), `version` in `src/smstunnel.js`, and `package.json`.
2. Write the `CHANGELOG.md` entry and `release-notes/vX.Y.Z.md`.
3. Run `npm run build && npm test`.
4. Run `test/offline/check-with-zabbix.php` against the latest 6.0, 7.0 and 8.0 releases (see the README's Development section). Run the end-to-end test on 6.0, 7.0 and the latest release.
5. Commit, push, and run `gh release create vX.Y.Z media_smstunnel.yaml media_smstunnel_6.0.yaml --notes-file release-notes/vX.Y.Z.md`.
