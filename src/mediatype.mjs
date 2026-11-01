// The "SMSTunnel" media type, minus its script (src/smstunnel.js). scripts/build.mjs turns both into
// media_smstunnel.yaml, the file users import. Field order follows Zabbix's own export.

export const VERSION = '1.0.0';
export const EXPORT_VERSION = '7.0';

const GUIDE = 'https://github.com/narcisbodea/smstunnel-zabbix';

export const mediaType = {
  name: 'SMSTunnel',
  type: 'WEBHOOK',
  // Sorted by name, as Zabbix exports them. server_url and http_proxy are optional extras you add yourself.
  parameters: [
    { name: 'api_key', value: '{$SMSTUNNEL.API.KEY}' },
    { name: 'default_country_code', value: '{$SMSTUNNEL.COUNTRY.CODE}' },
    { name: 'device_id', value: '{$SMSTUNNEL.DEVICE.ID}' },
    { name: 'max_length', value: '320' },
    { name: 'message', value: '{ALERT.MESSAGE}' },
    { name: 'send_to', value: '{ALERT.SENDTO}' },
    { name: 'subject', value: '{ALERT.SUBJECT}' },
    { name: 'tls_verify', value: '{$HTTP.TLS.VERIFY:"SMSTunnel"}' },
  ],
  // Five tries, 30 s apart: rides out a short outage and SMSTunnel's 30-texts-a-minute limit.
  attempts: '5',
  attempt_interval: '30s',
  description: `SMSTunnel for Zabbix ${VERSION}: texts each user's "Send to" number from your own Android phone and your own number.

1. Install the SMSTunnel app on your Android phone and sign in: https://play.google.com/store/apps/details?id=io.smstunnel.app
2. In your SMSTunnel dashboard (https://dashboard.smstunnel.io/apps): Apps > Add an app, then copy the key.
3. Administration > Macros: add {$SMSTUNNEL.API.KEY} with the key, type "Secret text".
4. Users > Users > the user > Media > Add: type SMSTunnel, "Send to" = the user's own number, e.g. +14155550123.
5. Alerts > Actions > Trigger actions: send messages to those users through SMSTunnel.

Optional macros: {$SMSTUNNEL.DEVICE.ID} sends through one phone; {$SMSTUNNEL.COUNTRY.CODE} (e.g. 40) completes numbers written without + or 00.
Texts longer than max_length (320) are cut and end with "...".

Guide: ${GUIDE}`,
  message_templates: [
    {
      event_source: 'TRIGGERS',
      operation_mode: 'PROBLEM',
      subject: 'PROBLEM: {EVENT.NAME}',
      message: `Host: {HOST.NAME}
Severity: {EVENT.SEVERITY}
Data: {EVENT.OPDATA}
Started: {EVENT.DATE} {EVENT.TIME}
ID: {EVENT.ID}`,
    },
    {
      event_source: 'TRIGGERS',
      operation_mode: 'RECOVERY',
      subject: 'RESOLVED: {EVENT.NAME}',
      message: `Host: {HOST.NAME}
Duration: {EVENT.DURATION}
Resolved: {EVENT.RECOVERY.DATE} {EVENT.RECOVERY.TIME}
ID: {EVENT.ID}`,
    },
    {
      event_source: 'TRIGGERS',
      operation_mode: 'UPDATE',
      subject: 'UPDATED: {EVENT.NAME}',
      message: `{USER.FULLNAME} {EVENT.UPDATE.ACTION} problem at {EVENT.UPDATE.TIME}
{EVENT.UPDATE.MESSAGE}
Host: {HOST.NAME}
Status: {EVENT.STATUS}, open for {EVENT.AGE}
ID: {EVENT.ID}`,
    },
    {
      event_source: 'DISCOVERY',
      operation_mode: 'PROBLEM',
      subject: 'DISCOVERY: {DISCOVERY.DEVICE.STATUS} {DISCOVERY.DEVICE.IPADDRESS}',
      message: `Rule: {DISCOVERY.RULE.NAME}
DNS: {DISCOVERY.DEVICE.DNS}
Service: {DISCOVERY.SERVICE.NAME} {DISCOVERY.SERVICE.PORT} {DISCOVERY.SERVICE.STATUS}`,
    },
    {
      event_source: 'AUTOREGISTRATION',
      operation_mode: 'PROBLEM',
      subject: 'NEW HOST: {HOST.HOST}',
      message: `IP: {HOST.IP}
Port: {HOST.PORT}`,
    },
    {
      event_source: 'INTERNAL',
      operation_mode: 'PROBLEM',
      subject: 'INTERNAL PROBLEM: {EVENT.NAME}',
      message: `Host: {HOST.NAME}
Started: {EVENT.DATE} {EVENT.TIME}
ID: {EVENT.ID}`,
    },
    {
      event_source: 'INTERNAL',
      operation_mode: 'RECOVERY',
      subject: 'INTERNAL RESOLVED: {EVENT.NAME}',
      message: `Host: {HOST.NAME}
Duration: {EVENT.DURATION}
ID: {EVENT.ID}`,
    },
    {
      event_source: 'SERVICE',
      operation_mode: 'PROBLEM',
      subject: 'SERVICE PROBLEM: {SERVICE.NAME}',
      message: `{EVENT.NAME}
Severity: {EVENT.SEVERITY}
Started: {EVENT.DATE} {EVENT.TIME}`,
    },
    {
      event_source: 'SERVICE',
      operation_mode: 'RECOVERY',
      subject: 'SERVICE RESOLVED: {SERVICE.NAME}',
      message: `{EVENT.NAME}
Duration: {EVENT.DURATION}
Resolved: {EVENT.RECOVERY.DATE} {EVENT.RECOVERY.TIME}`,
    },
    {
      event_source: 'SERVICE',
      operation_mode: 'UPDATE',
      subject: 'SERVICE UPDATED: {SERVICE.NAME}',
      message: `Now {EVENT.UPDATE.SEVERITY}, open for {EVENT.AGE}
{EVENT.NAME}`,
    },
  ],
};
