<?php
/*
 * Checks a media type file with Zabbix's own frontend code, without a Zabbix server or a database:
 *
 *   1. the import, step by step as configuration.import does it: the YAML reader, the import schema of that
 *      Zabbix version (strict), the constant and default converters, the normalizer and the data adapter;
 *   2. the field rules of mediatype.create (CMediatype::validateCreate and validateByType), all but the one
 *      database query (is the name already taken?);
 *   3. the export: what configuration.export writes for the imported media type (export builder and YAML
 *      writer), compared byte for byte with the file (6.0's export date aside, which is the time of export).
 *
 *   php -d extension_dir=<php>/ext -d extension=mbstring test/offline/check-with-zabbix.php <zabbix>/ui <file.yaml>
 *   ... --expect-unsupported   the import must be refused (for example the 7.0 file in Zabbix 6.0)
 *
 * <zabbix> is the source of the Zabbix release to check against, for instance
 * `git clone --depth 1 --branch 6.0.49 https://github.com/zabbix/zabbix.git` (only ui/ is read). PHP 7.4 to 8.3.
 * Exits 0 when every step passes. It reads files only; nothing is sent anywhere.
 */

error_reporting(E_ALL);
date_default_timezone_set('UTC');

$args = [];
$options = [];
foreach (array_slice($argv, 1) as $arg) {
	if (strpos($arg, '--') === 0) {
		$options[] = $arg;
	}
	else {
		$args[] = $arg;
	}
}
[$ui, $file] = $args + [null, null];
$expect_unsupported = in_array('--expect-unsupported', $options, true);

if ($ui === null || $file === null || !is_file($ui.'/include/defines.inc.php') || !is_file($file)) {
	fwrite(STDERR, "usage: php check-with-zabbix.php <zabbix source>/ui <media type file> [--expect-unsupported]\n");
	exit(2);
}

$ui = realpath($ui);
$source = file_get_contents($file);

// The parts of Zabbix's frontend bootstrap that need neither a web server nor a database.
require $ui.'/include/defines.inc.php';
require $ui.'/include/func.inc.php';
require $ui.'/include/gettextwrapper.inc.php';
require $ui.'/vendor/autoload.php';

$classes = [];
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ui.'/include/classes',
	FilesystemIterator::SKIP_DOTS
));
foreach ($files as $path) {
	if ($path->getExtension() === 'php') {
		$classes[$path->getBasename('.php')] = $path->getPathname();
	}
}
spl_autoload_register(function ($class) use ($classes) {
	if (array_key_exists($class, $classes)) {
		require $classes[$class];
	}
});

// No connection: DB::getSchema() reads include/schema.inc.php only.
$DB = ['TYPE' => ZBX_DB_POSTGRESQL, 'DB' => null];

// Zabbix 8.0 also reads its feature flags (zabbix.conf.php); take the defaults it starts from.
$defaults = new CConfigFile('');
if (method_exists($defaults, 'setDefaults')) {
	$set_defaults = new ReflectionMethod($defaults, 'setDefaults');
	$set_defaults->setAccessible(true);
	$set_defaults->invoke($defaults);
	if (array_key_exists('ZBX_FEATURE_FLAGS', $defaults->config)) {
		$ZBX_FEATURE_FLAGS = $defaults->config['ZBX_FEATURE_FLAGS'];
	}
}

$failed = 0;

function check(string $name, callable $step) {
	global $failed;

	try {
		$result = $step();
		echo 'PASS  '.$name."\n";

		return $result;
	}
	catch (Throwable $e) {
		$failed++;
		echo 'FAIL  '.$name.': '.$e->getMessage()."\n";

		return null;
	}
}

// A PHP array literal from a Zabbix source file: the first "[...]" after $prefix, after $anchor. The two eval()
// calls below run such literals (the rules of mediatype.create and the fields configuration.export reads) from
// the Zabbix source given on the command line, the same code that Zabbix release runs, so this check uses
// Zabbix's own rules rather than a copy of them. Point it only at a Zabbix source you trust.
function array_literal(string $php, string $anchor, string $prefix): string {
	$start = strpos($php, $anchor);
	$start = ($start === false) ? false : strpos($php, $prefix, $start);

	if ($start === false) {
		throw new Exception('cannot find '.$prefix.' after '.$anchor);
	}

	$start = strpos($php, '[', $start + strlen($prefix) - 1);
	$depth = 0;

	for ($i = $start, $n = strlen($php); $i < $n; $i++) {
		if ($php[$i] === '[') {
			$depth++;
		}
		elseif ($php[$i] === ']' && --$depth == 0) {
			return substr($php, $start, $i - $start + 1);
		}
	}

	throw new Exception('unterminated array after '.$prefix);
}

echo 'Zabbix '.ZABBIX_VERSION.' frontend code (export version '.ZABBIX_EXPORT_VERSION.'), PHP '.PHP_VERSION
	.', file '.basename($file)."\n";

// 1. Import, as CConfiguration::import() does it. Zabbix 7.2 renamed CXmlValidator to CImportValidator.
$format = CImportReaderFactory::YAML;
$validator_factory = new CImportValidatorFactory($format);
$validator_class = class_exists('CImportValidator') ? 'CImportValidator' : 'CXmlValidator';

if ($expect_unsupported) {
	try {
		$data = CImportReaderFactory::getReader($format)->read($source);
		(new $validator_class($validator_factory, $format))->setStrict(true)->validate($data, '/');
		echo 'FAIL  the import was expected to be refused, but it passed'."\n";
		exit(1);
	}
	catch (Throwable $e) {
		echo 'PASS  the import is refused: '.$e->getMessage()."\n";
		exit(0);
	}
}

$data = check('YAML reader (Symfony YAML, as bundled with this Zabbix)', function () use ($format, $source) {
	return CImportReaderFactory::getReader($format)->read($source);
});

$file_version = $data === null ? null : $data['zabbix_export']['version'];

$data = $data === null ? null : check('import schema '.$file_version.', strict', function () use ($data, $validator_factory, $format, $validator_class) {
	return (new $validator_class($validator_factory, $format))->setStrict(true)->validate($data, '/');
});

// An older export format goes through Zabbix's converters, version by version, as in CConfiguration::import().
if ($data !== null && $file_version !== ZABBIX_EXPORT_VERSION) {
	$data = check('converted from '.$file_version.' to '.ZABBIX_EXPORT_VERSION.' by this Zabbix', function () use ($data, $validator_factory, $format, $classes, $validator_class) {
		$versions = method_exists('CImportConverterFactory', 'getSequentialVersions')
			? CImportConverterFactory::getSequentialVersions()
			: eval('return '.array_literal(file_get_contents($classes['CConfiguration']), 'function import(',
				'foreach ('
			).';');
		$converter_factory = new CImportConverterFactory();
		$validator = new $validator_class($validator_factory, $format);

		foreach ($versions as $version) {
			if ($data['zabbix_export']['version'] === $version) {
				$data = $converter_factory->getObject($version)->convert($data);
				$data = $validator->setStrict(false)->validate($data, '/');
			}
		}

		return $data;
	});
}

$mediatypes = $data === null ? null : check('converters, normalizer and data adapter', function () use ($data, $validator_factory) {
	$schema = $validator_factory->getObject(ZABBIX_EXPORT_VERSION)->getSchema();
	$data = (new CConstantImportConverter($schema))->convert($data);
	$data = (new CDefaultImportConverter($schema))->convert($data);
	$data = (new CImportDataNormalizer($schema))->normalize($data);

	$adapter = new CImportDataAdapter();
	$adapter->load($data);
	$mediatypes = $adapter->getMediaTypes();

	if (count($mediatypes) != 1) {
		throw new Exception(count($mediatypes).' media types in the file, 1 expected');
	}

	return $mediatypes;
});

if ($mediatypes === null) {
	exit(1);
}

$m = $mediatypes[0];
printf("      %s, type %s, %d parameters, %d message templates, %s attempts every %s, timeout %s, script of %d characters\n",
	$m['name'], $m['type'], count($m['parameters']), count($m['message_templates']), $m['maxattempts'],
	$m['attempt_interval'], $m['timeout'], mb_strlen($m['script'])
);

// 2. The field rules of mediatype.create: written inside validateCreate() up to 7.0, in getValidationRules() from
// 7.2, where validateByType() also takes the names of the checked fields.
$api_php = file_get_contents($classes['CMediatype']);
$rules_method = method_exists('CMediatype', 'getValidationRules')
	? new ReflectionMethod('CMediatype', 'getValidationRules')
	: null;
$rules = null;

$mediatypes = check('mediatype.create field rules (CMediatype::validateCreate)', function () use ($mediatypes, $api_php, $rules_method, &$rules) {
	if ($rules_method !== null) {
		$rules_method->setAccessible(true);
		$rules = $rules_method->invoke(null);
	}
	else {
		$rules = eval('return '.array_literal($api_php, 'function validateCreate', '$api_input_rules = ').';');
	}

	if (!CApiInputValidator::validate($rules, $mediatypes, '/', $error)) {
		throw new Exception($error);
	}

	return $mediatypes;
});

if ($mediatypes !== null) {
	check('webhook field rules (CMediatype::validateByType)', function () use (&$mediatypes, $rules_method, $rules) {
		$method = new ReflectionMethod('CMediatype', 'validateByType');
		$method->setAccessible(true);
		$method->invokeArgs(null, $rules_method !== null
			? [array_keys($rules['fields']), &$mediatypes]
			: [&$mediatypes]
		);
	});
}
else {
	exit(1);
}

// 3. Export: the row API::MediaType()->get() returns after the import, through the export builder and writer.
$export_php = file_get_contents($classes['CConfigurationExport']);

check('export (CConfigurationExportBuilder + CYamlExportWriter) gives back the file', function () use ($mediatypes, $export_php, $source) {
	$fields = eval('return '.array_literal($export_php, 'function gatherMediaTypes', "'output' => ").';');
	$defaults = DB::getDefaults('media_type');
	$rows = [];

	foreach ($mediatypes as $mediatype) {
		$row = [];

		foreach ($fields as $field) {
			if ($field === 'parameters') {
				$row['parameters'] = [];

				foreach ($mediatype['parameters'] as $parameter) {
					$row['parameters'][] = ['name' => (string) $parameter['name'],
						'value' => (string) $parameter['value']
					];
				}
			}
			else {
				$row[$field] = (string) (array_key_exists($field, $mediatype) ? $mediatype[$field] : $defaults[$field]);
			}
		}

		$row['message_templates'] = [];

		foreach ($mediatype['message_templates'] as $template) {
			$row['message_templates'][] = [
				'eventsource' => (string) $template['eventsource'],
				'recovery' => (string) $template['recovery'],
				'subject' => (string) $template['subject'],
				'message' => (string) $template['message']
			];
		}

		$rows[] = $row;
	}

	$schema = (new CImportValidatorFactory(CExportWriterFactory::YAML))->getObject(ZABBIX_EXPORT_VERSION)->getSchema();
	$builder = new CConfigurationExportBuilder();
	$builder->buildMediaTypes($schema['rules']['media_types'], $rows);
	$export = CExportWriterFactory::getWriter(CExportWriterFactory::YAML)->write($builder->getExport());

	// 6.0 writes the time of the export as its date; compare everything else. A converted file comes back in this
	// Zabbix's own export version, so the version line is left out of the comparison too.
	$undated = function (string $yaml) use ($source): string {
		$yaml = preg_replace("/^  date: '[^']*'\n/m", '', str_replace("\r\n", "\n", $yaml));

		return (strpos($source, "  version: '".ZABBIX_EXPORT_VERSION."'\n") === false)
			? preg_replace("/^  version: '[^']*'\n/m", '', $yaml)
			: $yaml;
	};

	if ($undated($export) !== $undated($source)) {
		$ours = explode("\n", $undated($source));
		$theirs = explode("\n", $undated($export));

		for ($i = 0; $i < max(count($ours), count($theirs)); $i++) {
			if (($ours[$i] ?? null) !== ($theirs[$i] ?? null)) {
				throw new Exception(sprintf('line %d differs: file %s, export %s', $i + 1,
					json_encode($ours[$i] ?? null), json_encode($theirs[$i] ?? null)
				));
			}
		}
	}

	echo '      byte-identical'.(preg_match("/^  date: /m", $export) ? ' apart from the export date ('
		.(preg_match("/^  date: /m", $source) ? 'the file has one too' : 'the file has none').')' : '')."\n";
});

exit($failed ? 1 : 0);
