# SMSTunnel on zabbix.com/integrations: the listing

This file holds everything Zabbix's "Propose integration" form asks for, ready to paste. Nothing has been sent to Zabbix yet. The form and the listings were checked on 5 November 2026.

## Before you submit

- [ ] The **v1.1.0 release** is published on GitHub with both files, `media_smstunnel.yaml` and `media_smstunnel_6.0.yaml`. The texts below mention Zabbix 6.0 and the 6.0 file.
- [ ] You have the **business phone number** you want Zabbix to call. It isn't on smstunnel.io, so it isn't filled in below.

## The form

**URL:** https://www.zabbix.com/forms/integration_add ("Propose integration")

- It is one page in two parts, "Contact Information" and "Integration Details", followed by a reCAPTCHA and **Submit Form**. You don't need an account.
- Zabbix says the form is "intended for software vendors interested in a technology partnership with Zabbix". NARBOWEB SRL makes SMSTunnel, so this is the right form.
- The page checks nothing in the browser. The limits below are the fields' own maximum lengths, and every text here fits within them.

| Field | Required | Limit | Enter |
| --- | --- | --- | --- |
| Company name | yes | 50 | `NARBOWEB SRL` |
| First name | yes | 35 | `Narcis` |
| Last name | yes | 35 | `Bodea` |
| Job title | yes | list | **Chief Executive Officer**, or the entry that fits you. The other choices are Member of the board, CIO, CTO, COO, System administrator, DevOps, Technical engineer, IT project manager, a few business roles and Other. |
| Business email address | yes | 50 | `contact@narboweb.ro`, or `support@smstunnel.io` (the address on smstunnel.io) if that's the inbox you read. Zabbix replies there. |
| Phone number | yes | 35 | Your business number, in international format (`+40 …`) |
| Country / Territory | yes | list | **Romania**. The form picks it from your location. |
| Integration title | yes | 255 | `SMSTunnel` |
| Company description | yes | 500 | The text under [Company description](#company-description) |
| Logo | yes | .svg, .png or .jpg, up to 50 KB | [`listing/smstunnel-logo.svg`](listing/smstunnel-logo.svg); see [Logo](#logo) |
| Source | yes | 500 | `https://github.com/narcisbodea/smstunnel-zabbix` |
| Created | yes | date | `2026-11-01` (the date of release v1.0.0) |
| Updated | no | date | The date of release v1.1.0 |
| Author | yes | 255 | `NARBOWEB SRL` (the copyright holder in LICENSE) |
| Compatibility | yes | 500 | The text under [Compatibility](#compatibility) |
| Zabbix versions | yes | 255 | The text under [Zabbix versions](#zabbix-versions) |
| Integration description | yes | 2000 | The text under [Integration description](#integration-description) |
| Captcha | yes | | Tick it |
| Receive regular Zabbix news and updates | no | | Up to you |

### Company description

The form asks for "a short 1-2 sentence overview of the company or integration" (236 characters):

```text
SMSTunnel, made by NARBOWEB SRL, lets your own apps and tools send texts from your own Android phone and your own number. Zabbix hands each alert to your SMSTunnel account, and your phone sends it from its own SIM to each user's number.
```

### Compatibility

The form asks which "vendor software products and versions are supported by the integration" (316 characters):

```text
SMSTunnel (https://smstunnel.io): the SMSTunnel app for Android from Google Play, signed in to an SMSTunnel account, and an API key from the SMSTunnel dashboard (Apps > Add an app > Zabbix). The Zabbix server needs to reach https://smstunnel.io on port 443, directly or through an HTTP proxy. No GSM modem is needed.
```

### Zabbix versions

The field is free text (113 characters):

```text
6.0 LTS, 7.0 LTS, 7.2, 7.4 and 8.0 LTS (media_smstunnel_6.0.yaml for 6.0, media_smstunnel.yaml for 7.0 and later)
```

### Integration description

The form asks for "the key features, functionality, configuration details, and/or installation steps" (1,561 characters):

```text
SMSTunnel for Zabbix is a webhook media type that texts each Zabbix user's own number from your own Android phone and your own number. Zabbix hands every alert to your SMSTunnel account, and the SMSTunnel app on your phone sends it from its own SIM, so the on-call person sees a number they know and can reply to. There is no GSM modem or serial port on the Zabbix server: it works the same on bare metal, in a VM, in Docker or in the cloud.

Features:
- One text per alert and per person, to the number in each user's "Send to".
- Short, phone-sized templates for problems, updates and recoveries, and for discovery, autoregistration, internal and service events. Long texts are cut at 320 characters.
- The API key stays in a secret global macro, never in the media type or in exports.
- SMSTunnel's own error messages show in the Action log. Busy moments and short outages are retried (5 attempts, 30 seconds apart); if the phone is offline, the text goes out when it is back.
- Certificates are checked, with the {$HTTP.TLS.VERIFY} switch.

Setup:
1. Install the SMSTunnel app from Google Play and sign in.
2. In your SMSTunnel dashboard: Apps > Add an app > Zabbix > Create the key.
3. In Zabbix, import media_smstunnel.yaml (7.0 and later) or media_smstunnel_6.0.yaml (6.0) under Media types.
4. Add the global macro {$SMSTUNNEL.API.KEY} with the key, type Secret text.
5. Give each user an SMSTunnel media with their number in "Send to", and send to them from an action.

Free and open source (MIT). Guide: https://github.com/narcisbodea/smstunnel-zabbix
```

## Logo

- **Upload this:** [`listing/smstunnel-logo.svg`](listing/smstunnel-logo.svg) (7 KB). It is the SMSTunnel icon from `D:\ANDROID\identitate\SMS.svg` with Inkscape's editor data removed. It draws the same pixels as the original and is well under the 50 KB limit.
- **If the SVG is refused:** [`listing/smstunnel-logo.png`](listing/smstunnel-logo.png), 512 × 512 PNG (27 KB), the same picture.
- **Shape:** the icon is square. Zabbix shows a logo in a box of at most 180 × 72 px on the integration's page and 136 × 40 px on the catalogue's cards, so the icon appears at 72 × 72 and 40 × 40, with the name "SMSTunnel" written next to it. SMSTunnel has no wide logo (icon plus name). If one is made later, it would fill those boxes better.

## What happens next

- After **Submit Form**, Zabbix shows: "Thank you for submitting your integration proposal. We will consider your proposal shortly." That is all it promises. Zabbix doesn't say who replies or when.
- **How long it takes:** about 2 to 5 weeks, judging by recent vendor entries. The gaps between each vendor's "Created" date and its first appearance in web-archive copies of the catalogue were 14 to 33 days (Pushinator), at most 14 days (CloudAware) and 3 to 34 days (ITOC360). No vendor has written publicly about it.
- **Partner status isn't needed.** Most vendors in the catalogue aren't Zabbix partners: SMSEagle, Pushinator, CloudAware and others are listed as "Vendor" with no partner page. Zabbix may offer its **Integration Partners** tier, which needs a website registration, a specific agreement and a contact person for joint promotion, and has no fee and no certification. It's optional.
- **What the entry shows:**
  - Zabbix's own page "Zabbix + SMSTunnel", in categories Zabbix chooses (most likely Notifications & Alerting);
  - the logo and the company description;
  - a "From the vendor" row with a blue **Vendor** badge, linked to the GitHub repository;
  - the details from the form: Source, Created, Updated, Author, Compatibility and Zabbix versions;
  - the repository's last commit date;
  - Zabbix's note: "Vendor and Community integrations are created by third parties and are not verified by Zabbix."
- **Later:** the entry has a "+ Propose new article" link (to the same form), which can add https://smstunnel.io/integrations/zabbix/ under "Articles and documentation". Zabbix has no form for changing an entry; for a new version, reply to Zabbix's email or send the form again with the new "Updated" date.

## Where these facts come from

- The form: https://www.zabbix.com/forms/integration_add (field names, required marks, limits and texts, read from the page's HTML on 5 November 2026).
- Listing pages: https://www.zabbix.com/integrations/smseagle, /pushinator and /cloudaware.
- Partner tiers: https://www.zabbix.com/partners and the partner brochure (https://assets.zabbix.com/files/Brochures/Zabbix_Partners_brochure.pdf, page 4).
- share.zabbix.com now redirects to https://www.zabbix.com/integrations.
