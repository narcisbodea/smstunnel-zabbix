// The "SMSTunnel" media type, minus its script (src/smstunnel.js). scripts/build.mjs turns both into the files
// users import, one per Zabbix export format. Field order follows Zabbix's own export, which is the same in both.

export const VERSION = '1.1.0';
// The date of this version. Zabbix 6.0 writes an export date under the version; 7.0 and later don't.
export const RELEASE_DATE = '2026-11-05';

const GUIDE = 'https://github.com/narcisbodea/smstunnel-zabbix';

// The menu paths of the 7.0 file are also the ones written in src/smstunnel.js (macrosMenu, usersMenu); the
// build swaps those two lines for each file's own.
export const TARGETS = [
  {
    file: 'media_smstunnel.yaml',
    exportVersion: '7.0',
    zabbix: 'Zabbix 7.0 and later',
    menu: {
      mediaTypes: 'Alerts > Media types',
      macros: 'Administration > Macros',
      users: 'Users > Users',
      actions: 'Alerts > Actions > Trigger actions',
    },
  },
  {
    file: 'media_smstunnel_6.0.yaml',
    exportVersion: '6.0',
    date: `${RELEASE_DATE}T00:00:00Z`,
    zabbix: 'Zabbix 6.0 LTS',
    menu: {
      mediaTypes: 'Administration > Media types',
      macros: 'Administration > General > Macros',
      users: 'Administration > Users',
      actions: 'Configuration > Actions > Trigger actions',
    },
  },
];

const description = (target) => `SMSTunnel for Zabbix ${VERSION} (${target.zabbix}): texts each user's "Send to" number from your own Android phone and your own number.

1. Install the SMSTunnel app on your Android phone and sign in: https://play.google.com/store/apps/details?id=io.smstunnel.app
2. In your SMSTunnel dashboard (https://dashboard.smstunnel.io/apps): Apps > Add an app > Zabbix > Create the key, and copy it.
3. ${target.menu.macros}: add {$SMSTUNNEL.API.KEY} with the key, type "Secret text".
4. ${target.menu.users} > the user > Media > Add: type SMSTunnel, "Send to" = the user's own number, e.g. +14155550123.
5. ${target.menu.actions}: send messages to those users through SMSTunnel.

Optional macros: {$SMSTUNNEL.DEVICE.ID} sends through one phone; {$SMSTUNNEL.COUNTRY.CODE} (e.g. 40) completes numbers written without + or 00.
Texts longer than max_length (320) are cut and end with "...".

Guide: ${GUIDE}`;

export const mediaType = (target = TARGETS[0]) => ({
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
  description: description(target),
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
});
