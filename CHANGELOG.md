# Changelog

## 1.0.0 (November 2026)

First version of SMSTunnel for Zabbix: a webhook media type that texts each Zabbix user's own "Send to" number from your own Android phone and your own number.

- One text per alert through `POST /api/v1/sms/send`, with the key from the secret global macro `{$SMSTUNNEL.API.KEY}`.
- Optional macros `{$SMSTUNNEL.DEVICE.ID}` and `{$SMSTUNNEL.COUNTRY.CODE}`; optional `http_proxy` parameter.
- Short message templates for trigger problems, updates and recoveries, and for discovery, autoregistration, internal and service events. Texts are cut at `max_length` (320) with `...`.
- SMSTunnel's own error messages in the Action log, with what to check; 429, 5xx and lost connections are retried (5 attempts, 30 s apart).
- Certificate checks through `{$HTTP.TLS.VERIFY:"SMSTunnel"}`, like Zabbix's own media types (Zabbix 7.0.28+ / 7.4.12+).
- Zabbix 7.0 export format; tested on Zabbix 7.0.32, 7.4.16 and 8.0.0rc3.
