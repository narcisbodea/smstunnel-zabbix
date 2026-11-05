/*
 * SMSTunnel for Zabbix 1.1.0: the webhook script of the "SMSTunnel" media type.
 *
 * Sends each alert as a text to the user's "Send to" number, from your own Android phone and your own
 * number, through your SMSTunnel account (https://smstunnel.io). One text per alert, one recipient per call.
 *
 * Zabbix runs this in its JavaScript engine (Duktape, ES5): no let, arrow functions or template strings.
 * media_smstunnel.yaml (Zabbix 7.0 and later) and media_smstunnel_6.0.yaml (Zabbix 6.0 LTS) carry the same
 * script; only the two menu paths below differ.
 * Source and guide: https://github.com/narcisbodea/smstunnel-zabbix (MIT License).
 */
var SMSTunnel = {
	version: '1.1.0',
	// Where the error messages send people in the Zabbix menu.
	macrosMenu: 'Administration > Macros',
	usersMenu: 'Users > Users',
	defaultServerUrl: 'https://smstunnel.io',
	sendPath: '/api/v1/sms/send',
	defaultMaxLength: 320,
	apiMaxLength: 1600,
	testText: 'Test from Zabbix: SMSTunnel is set up, and your own phone sent this text.',
	secret: '',

	// Zabbix passes a macro it could not resolve as written, e.g. {$SMSTUNNEL.DEVICE.ID} or {ALERT.SENDTO}.
	isUnresolved: function (text) {
		return /^\{\$[^{}]+\}$/.test(text) || /^\{[A-Z][A-Z0-9_.]*\}$/.test(text);
	},

	// A parameter, trimmed: '' when it is missing, empty or an unresolved macro.
	param: function (params, name) {
		var raw = params[name], text;

		if (raw === undefined || raw === null) {
			return '';
		}

		text = String(raw).trim();

		return SMSTunnel.isUnresolved(text) ? '' : text;
	},

	parseParams: function (value) {
		var params;

		try {
			params = JSON.parse(value);
		}
		catch (error) {
			throw 'the webhook parameters are not valid JSON.';
		}

		if (params === null || typeof params !== 'object') {
			throw 'the webhook parameters are missing.';
		}

		return params;
	},

	apiKey: function (params) {
		var key = SMSTunnel.param(params, 'api_key');

		if (key === '' || /^<.*>$/.test(key)) {
			throw 'no API key. Add the global macro {$SMSTUNNEL.API.KEY} (' + SMSTunnel.macrosMenu + ', type "Secret text")'
				+ ' with the key from your SMSTunnel dashboard (Apps > Add an app > Zabbix). In the Test window you can'
				+ ' type the key into api_key instead.';
		}

		if (/[\r\n]/.test(key)) {
			throw 'the API key has a line break in it. Paste it again on one line.';
		}

		return key;
	},

	recipient: function (params) {
		var raw = (params.send_to === undefined || params.send_to === null) ? '' : String(params.send_to).trim(),
			number;

		if (raw === '' || raw === '{ALERT.SENDTO}') {
			throw 'no phone number. Give the user an SMSTunnel media with their number in "Send to"'
				+ ' (' + SMSTunnel.usersMenu + ' > the user > Media). In the Test window, type a number such as'
				+ ' +14155550123 into send_to.';
		}

		if (/[,;]/.test(raw)) {
			throw '"Send to" holds more than one number (' + raw + '). Add one SMSTunnel media per number:'
				+ ' each one gets its own text.';
		}

		// Spaces, dots, dashes, slashes and brackets are only there for reading.
		number = raw.replace(/[\s().\/\-]/g, '');

		if (!/^(\+|00)?[0-9]{6,15}$/.test(number)) {
			throw '"Send to" is not a phone number (' + raw + '). Use the international format, e.g. +14155550123.';
		}

		return number;
	},

	countryCode: function (params) {
		var code = SMSTunnel.param(params, 'default_country_code').replace(/\s+/g, '');

		if (code !== '' && !/^(\+|00)?[1-9][0-9]{0,3}$/.test(code)) {
			throw 'the country code "' + code + '" ({$SMSTUNNEL.COUNTRY.CODE}) is not a calling code.'
				+ ' Use digits such as 40, +40 or 0040.';
		}

		return code;
	},

	serverUrl: function (params) {
		var url = (SMSTunnel.param(params, 'server_url') || SMSTunnel.defaultServerUrl).replace(/\/+$/, '');

		if (!/^https?:\/\/[^\s\/?#]+/i.test(url)) {
			throw 'server_url "' + url + '" is not a web address such as https://smstunnel.io.';
		}

		return url;
	},

	// Same switch as Zabbix 7.0's own media types: {$HTTP.TLS.VERIFY} = none, peer or full (the default).
	// Zabbix 6.0.47+, 7.0.28+, 7.4.12+ and 8.0 check the certificate with these options; older releases ignore
	// them and check nothing.
	tlsOptions: function (params, url) {
		var mode = (params.tls_verify === undefined || params.tls_verify === null)
			? '' : String(params.tls_verify).trim().toLowerCase();

		if (mode !== 'none' && mode !== 'peer') {
			mode = 'full';
		}

		if (mode !== 'none' && !/^https:\/\//i.test(url)) {
			throw 'server_url ' + url + ' uses plain HTTP while TLS verification is on. Use an https:// address,'
				+ ' or set the macro {$HTTP.TLS.VERIFY:"SMSTunnel"} to none (for a local test server only).';
		}

		return {SSLVerifyPeer: mode !== 'none', SSLVerifyHost: mode === 'full'};
	},

	maxLength: function (params) {
		var length = parseInt(SMSTunnel.param(params, 'max_length'), 10);

		if (isNaN(length)) {
			return SMSTunnel.defaultMaxLength;
		}

		return Math.max(20, Math.min(SMSTunnel.apiMaxLength, length));
	},

	// Drops trailing spaces, extra blank lines, and lines such as "Data:" whose macro gave nothing.
	tidy: function (text) {
		var lines = String(text).replace(/\r\n?/g, '\n').split('\n'),
			kept = [],
			line,
			i;

		for (i = 0; i < lines.length; i++) {
			line = lines[i].replace(/[ \t]+$/, '');

			if (/^[^:]{1,40}:\s*(\*UNKNOWN\*)?$/.test(line)) {
				continue;
			}

			kept.push(line);
		}

		return kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
	},

	// Cuts a long text and ends it with "..." (plain dots keep the text in the 160-character SMS alphabet).
	shorten: function (text, maxLength) {
		var cut, code;

		if (text.length <= maxLength) {
			return text;
		}

		cut = maxLength - 3;
		code = text.charCodeAt(cut - 1);

		// Don't split an emoji (a UTF-16 surrogate pair) in half.
		if (code >= 0xD800 && code <= 0xDBFF) {
			cut--;
		}

		return text.substring(0, cut).replace(/\s+$/, '') + '...';
	},

	composeText: function (params, maxLength) {
		var subject = (params.subject === undefined || params.subject === null) ? '' : String(params.subject),
			message = (params.message === undefined || params.message === null) ? '' : String(params.message),
			testWindow = false,
			text;

		// The Test window passes {ALERT.SUBJECT} and {ALERT.MESSAGE} as written.
		if (subject.trim() === '{ALERT.SUBJECT}') {
			subject = '';
			testWindow = true;
		}

		if (message.trim() === '{ALERT.MESSAGE}') {
			message = '';
			testWindow = true;
		}

		subject = SMSTunnel.tidy(subject);
		message = SMSTunnel.tidy(message);

		if (subject !== '' && message !== '' && message.indexOf(subject) !== 0) {
			text = subject + '\n' + message;
		}
		else {
			text = message || subject;
		}

		if (text === '') {
			if (!testWindow) {
				throw 'the text is empty: the message template of the action gave no subject and no message.';
			}

			text = SMSTunnel.testText;
		}

		return SMSTunnel.shorten(text, maxLength);
	},

	describe: function (error) {
		if (error !== null && typeof error === 'object' && typeof error.message === 'string') {
			return error.message;
		}

		return String(error);
	},

	// Never let the key reach the action log or the server log.
	scrub: function (text) {
		var secret = SMSTunnel.secret;

		text = String(text);

		return (secret.length >= 6) ? text.split(secret).join('[API key]') : text;
	},

	mask: function (number) {
		return (number.length > 7) ? number.substring(0, 4) + '...' + number.substring(number.length - 3) : '...';
	},

	parseAnswer: function (raw) {
		if (typeof raw !== 'string' || raw === '') {
			return null;
		}

		try {
			return JSON.parse(raw);
		}
		catch (error) {
			return null;
		}
	},

	header: function (request, name) {
		var headers, key;

		try {
			headers = request.getHeaders();
		}
		catch (error) {
			return '';
		}

		for (key in headers) {
			if (Object.prototype.hasOwnProperty.call(headers, key) && key.toLowerCase() === name) {
				return String(headers[key]);
			}
		}

		return '';
	},

	// The words of an SMSTunnel error body: {"message": "..." or [...], "error": "...", "code": "..."}.
	errorDetail: function (answer, raw) {
		var text = '',
			words;

		if (answer !== null && typeof answer === 'object') {
			words = Array.isArray(answer.message) ? answer.message.join('; ') : answer.message;

			if (typeof words === 'string' && words !== '') {
				text = words;
			}
			else if (typeof answer.error === 'string') {
				text = answer.error;
			}

			if (typeof answer.code === 'string' && answer.code !== '') {
				text += (text !== '' ? ' ' : '') + '[' + answer.code + ']';
			}
		}
		else if (typeof raw === 'string') {
			// A proxy's HTML error page, for instance.
			text = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
		}

		text = text.replace(/^[A-Za-z]+Exception:\s*/, '');

		return (text.length > 200) ? text.substring(0, 197) + '...' : text;
	},

	// 429, 5xx and network errors pass: Zabbix sends the alert again as set by Attempts and Attempt interval.
	retryLater: function (text) {
		return text + ' Zabbix retries as set on the Options tab of the media type (Attempts, Attempt interval).';
	},

	// A certificate problem won't go away on a retry; a lost connection may.
	unreachable: function (url, detail) {
		if (/SSL|TLS|certificate/i.test(detail)) {
			return 'the certificate of ' + url + ' was not accepted (' + detail + '). Install the CA certificates'
				+ ' (ca-certificates) on the Zabbix server, or add the CA of a proxy that re-signs HTTPS. The macro'
				+ ' {$HTTP.TLS.VERIFY:"SMSTunnel"} (peer or none) relaxes the check.';
		}

		return SMSTunnel.retryLater('could not reach ' + url + ' (' + detail + ').');
	},

	failure: function (status, answer, raw, request) {
		var detail = SMSTunnel.errorDetail(answer, raw),
			what = 'HTTP ' + status + (detail !== '' ? ': ' + detail : ''),
			wait;

		if (status === 401) {
			return 'the API key was not accepted (' + what + '). Check the macro {$SMSTUNNEL.API.KEY}'
				+ ' (' + SMSTunnel.macrosMenu + ') against Apps in your SMSTunnel dashboard.';
		}

		if (status === 403) {
			return 'the text was refused (' + what + ').'
				+ ((answer && answer.code === 'PERMISSION_REQUIRED') ? ' Use an API key that can send texts.' : '');
		}

		if (status === 400 || status === 422) {
			return 'the text was not accepted (' + what + ').'
				+ (/phone|number|recipient/i.test(detail) ? ' Check the number in "Send to".' : '');
		}

		if (status === 404) {
			return 'not found (' + what + '). If {$SMSTUNNEL.DEVICE.ID} is set, check it against Phones in your'
				+ ' SMSTunnel dashboard.';
		}

		if (status === 429) {
			wait = parseInt(SMSTunnel.header(request, 'retry-after'), 10);

			return SMSTunnel.retryLater('too many texts in a short time (' + what
				+ (isNaN(wait) ? '' : ', wait ' + wait + ' s') + ').');
		}

		if (status === 408 || status >= 500) {
			return SMSTunnel.retryLater('the service could not take the text right now (' + what + ').');
		}

		if (status >= 200 && status < 300) {
			return 'the answer (' + what + ') did not confirm the text.';
		}

		return 'unexpected answer (' + what + ').';
	},

	send: function (config) {
		var request = new HttpRequest(config.tlsOptions),
			body = {to: config.to, message: config.text},
			raw,
			status,
			answer,
			data;

		if (config.deviceId !== '') {
			body.deviceId = config.deviceId;
		}

		if (config.countryCode !== '') {
			body.defaultCountryCode = config.countryCode;
		}

		if (config.proxy !== '') {
			request.setProxy(config.proxy);
		}

		request.addHeader('Content-Type: application/json');
		request.addHeader('Accept: application/json');
		request.addHeader('User-Agent: smstunnel-zabbix/' + SMSTunnel.version);
		request.addHeader('X-API-Key: ' + config.apiKey);

		Zabbix.log(4, '[ SMSTunnel ] Sending a text of ' + config.text.length + ' characters to '
			+ SMSTunnel.mask(config.to) + ' through ' + config.url);

		try {
			raw = request.post(config.url + SMSTunnel.sendPath, JSON.stringify(body));
		}
		catch (error) {
			throw SMSTunnel.unreachable(config.url, SMSTunnel.describe(error));
		}

		status = request.getStatus();
		answer = SMSTunnel.parseAnswer(raw);

		Zabbix.log(4, '[ SMSTunnel ] HTTP ' + status + ' from SMSTunnel');

		if (status < 200 || status >= 300 || answer === null || typeof answer !== 'object' || answer.success !== true) {
			throw SMSTunnel.failure(status, answer, raw, request);
		}

		data = (answer.data !== null && typeof answer.data === 'object') ? answer.data : {};

		if (answer.queued === true || data.queued === true) {
			return {
				status: 'queued',
				to: config.to,
				messageId: String(answer.messageId || data.messageId || ''),
				note: 'Your phone is offline right now: it sends the text when it is back online.'
			};
		}

		return {status: 'sent', to: config.to, messageId: String(answer.messageId || data.messageId || '')};
	},

	run: function (value) {
		var params = SMSTunnel.parseParams(value),
			config = {},
			url;

		config.apiKey = SMSTunnel.apiKey(params);
		SMSTunnel.secret = config.apiKey;
		config.to = SMSTunnel.recipient(params);
		config.text = SMSTunnel.composeText(params, SMSTunnel.maxLength(params));
		config.countryCode = SMSTunnel.countryCode(params);
		config.deviceId = SMSTunnel.param(params, 'device_id');
		config.proxy = SMSTunnel.param(params, 'http_proxy') || SMSTunnel.param(params, 'HTTPProxy');
		url = SMSTunnel.serverUrl(params);
		config.tlsOptions = SMSTunnel.tlsOptions(params, url);
		config.url = url;

		return SMSTunnel.send(config);
	}
};

try {
	return JSON.stringify(SMSTunnel.run(value));
}
catch (error) {
	var reason = SMSTunnel.scrub('SMSTunnel: ' + SMSTunnel.describe(error));

	Zabbix.log(3, '[ SMSTunnel ] ' + reason);

	throw reason;
}
