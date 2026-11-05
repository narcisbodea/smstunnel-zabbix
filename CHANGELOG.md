# Changelog

## 1.1.0 (November 2026)

Zabbix 6.0 LTS joins 7.0 LTS and later.

- **Zabbix 6.0 LTS:** a second file, `media_smstunnel_6.0.yaml`, in Zabbix 6.0's export format. It is the same media type as `media_smstunnel.yaml`: the same script, parameters, message templates, retries (5 attempts, 30 s apart) and checks. Only its export version and date, and the menu paths in its words, differ.
- The error messages and the media type's description name the menus of the Zabbix version they are for: on 6.0 that is Administration → Media types, Administration → General → Macros, Administration → Users and Configuration → Actions.
- The key comes from your dashboard's own Zabbix entry: **Apps → Add an app → Zabbix → Create the key**.
- Certificates are checked on Zabbix 6.0.47 and later too, as on 7.0.28+, 7.4.12+ and 8.0. Earlier releases don't check certificates for any webhook.
- Tested end to end on Zabbix 6.0.49, 7.0.32, 7.4.16 and 8.0.0 (Zabbix 8.0 LTS), 34 checks each. Zabbix's own import and export code accepts the files and writes them back unchanged: `media_smstunnel_6.0.yaml` in 6.0.49, and both files in 7.0.32 and 8.0.0.
- Development:
  - `test/offline/check-with-zabbix.php` runs a file through a Zabbix release's own import and export code, without a server.
  - The end-to-end test also runs on Zabbix 6.0. It takes the token in the request and sends values through the trapper port.
  - The end-to-end test reads only `*_test` databases.

## 1.0.0 (November 2026)

First version of SMSTunnel for Zabbix: a webhook media type that texts each Zabbix user's own "Send to" number from your own Android phone and your own number.

- One text per alert through `POST /api/v1/sms/send`, with the key from the secret global macro `{$SMSTUNNEL.API.KEY}`.
- Optional macros `{$SMSTUNNEL.DEVICE.ID}` and `{$SMSTUNNEL.COUNTRY.CODE}`; optional `http_proxy` parameter.
- Short message templates for trigger problems, updates and recoveries, and for discovery, autoregistration, internal and service events. Texts are cut at `max_length` (320) with `...`.
- SMSTunnel's own error messages in the Action log, with what to check; 429, 5xx and lost connections are retried (5 attempts, 30 s apart).
- Certificate checks through `{$HTTP.TLS.VERIFY:"SMSTunnel"}`, like Zabbix's own media types (Zabbix 7.0.28+ / 7.4.12+).
- Zabbix 7.0 export format; tested on Zabbix 7.0.32, 7.4.16 and 8.0.0rc3.
