// model.js — Random Forest inference untuk dataset Mendeley URL-only 41 fitur
// Pakai file model dari notebook: artifacts/random_forest_model.json
// Simpel: rename random_forest_model.json -> forest.json, lalu taruh sebelahan dengan file ini.

const SPECIAL_CHARS_PATTERN = /[^A-Za-z0-9.\-/?:=&_%#@$!]/g;
const REPEATED_DIGITS_PATTERN = /(\d)\1+/;

let _model = null;

function shannonEntropy(text) {
  text = String(text || "");
  if (!text) return 0;

  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);

  const length = text.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function countMatches(text, regex) {
  return (String(text || "").match(regex) || []).length;
}

function countChar(text, ch) {
  return [...String(text || "")].filter(c => c === ch).length;
}

function countSpecialChars(text) {
  return countMatches(text, SPECIAL_CHARS_PATTERN);
}

function hasSpecialChars(text) {
  return countSpecialChars(text) > 0 ? 1 : 0;
}

function hasDigits(text) {
  return /\d/.test(String(text || "")) ? 1 : 0;
}

function countDigits(text) {
  return countMatches(text, /\d/g);
}

function hasRepeatedDigits(text) {
  return REPEATED_DIGITS_PATTERN.test(String(text || "")) ? 1 : 0;
}

function stripPortUserinfo(host) {
  host = String(host || "").toLowerCase().trim();
  if (host.includes("@")) host = host.split("@").pop();
  if (host.includes(":")) host = host.split(":")[0];
  return host;
}

function splitDomainParts(host) {
  host = stripPortUserinfo(host);
  const parts = host.split(".").filter(Boolean);

  let registeredDomain;
  let subdomains;

  if (parts.length <= 2) {
    registeredDomain = host;
    subdomains = [];
  } else {
    registeredDomain = parts.slice(-2).join(".");
    subdomains = parts.slice(0, -2);
  }

  return {
    domain: registeredDomain,
    subdomains,
    subdomainText: subdomains.join("."),
  };
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getParsedPathLikePython(rawUrl, parsed) {
  let path = parsed.pathname || "";

  // JS URL memberi pathname "/" untuk URL tanpa path.
  // Python urlparse memberi path kosong untuk "https://example.com".
  const withoutScheme = rawUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  const beforeQueryHash = withoutScheme.split(/[?#]/)[0];
  const hasPathSlashAfterHost = beforeQueryHash.includes("/");

  if (path === "/" && !hasPathSlashAfterHost) return "";
  return path;
}

function extractFeatureObject(url) {
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("URL harus string dan tidak boleh kosong.");
  }

  const rawUrl = url.trim();
  const parseTarget = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl)
    ? rawUrl
    : "http://" + rawUrl;

  let parsed;
  try {
    parsed = new URL(parseTarget);
  } catch {
    throw new Error("Format URL tidak valid.");
  }

  const host = stripPortUserinfo(parsed.hostname);
  const { domain, subdomains, subdomainText } = splitDomainParts(host);

  const path = getParsedPathLikePython(rawUrl, parsed);
  const query = parsed.search ? parsed.search.slice(1) : "";
  const fragment = parsed.hash ? parsed.hash.slice(1) : "";

  const subdomainLengths = subdomains.map(s => s.length);
  const subdomainDotCounts = subdomains.map(s => countChar(s, "."));
  const subdomainHyphenCounts = subdomains.map(s => countChar(s, "-"));

  return {
    url_length: rawUrl.length,
    number_of_dots_in_url: countChar(rawUrl, "."),
    having_repeated_digits_in_url: hasRepeatedDigits(rawUrl),
    number_of_digits_in_url: countDigits(rawUrl),
    number_of_special_char_in_url: countSpecialChars(rawUrl),
    number_of_hyphens_in_url: countChar(rawUrl, "-"),
    number_of_underline_in_url: countChar(rawUrl, "_"),
    number_of_slash_in_url: countChar(rawUrl, "/") + countChar(rawUrl, "\\"),
    number_of_questionmark_in_url: countChar(rawUrl, "?"),
    number_of_equal_in_url: countChar(rawUrl, "="),
    number_of_at_in_url: countChar(rawUrl, "@"),
    number_of_dollar_sign_in_url: countChar(rawUrl, "$"),
    number_of_exclamation_in_url: countChar(rawUrl, "!"),
    number_of_hashtag_in_url: countChar(rawUrl, "#"),
    number_of_percent_in_url: countChar(rawUrl, "%"),

    domain_length: domain.length,
    number_of_dots_in_domain: countChar(domain, "."),
    number_of_hyphens_in_domain: countChar(domain, "-"),
    having_special_characters_in_domain: hasSpecialChars(domain),
    number_of_special_characters_in_domain: countSpecialChars(domain),
    having_digits_in_domain: hasDigits(domain),
    number_of_digits_in_domain: countDigits(domain),
    having_repeated_digits_in_domain: hasRepeatedDigits(domain),

    number_of_subdomains: subdomains.length,
    having_dot_in_subdomain: subdomainText.includes(".") ? 1 : 0,
    having_hyphen_in_subdomain: subdomainText.includes("-") ? 1 : 0,
    average_subdomain_length: average(subdomainLengths),
    average_number_of_dots_in_subdomain: average(subdomainDotCounts),
    average_number_of_hyphens_in_subdomain: average(subdomainHyphenCounts),
    having_special_characters_in_subdomain: hasSpecialChars(subdomainText),
    number_of_special_characters_in_subdomain: countSpecialChars(subdomainText),
    having_digits_in_subdomain: hasDigits(subdomainText),
    number_of_digits_in_subdomain: countDigits(subdomainText),
    having_repeated_digits_in_subdomain: hasRepeatedDigits(subdomainText),

    having_path: path && path !== "/" ? 1 : 0,
    path_length: path.length,
    having_query: query ? 1 : 0,
    having_fragment: fragment ? 1 : 0,
    having_anchor: rawUrl.includes("#") || fragment ? 1 : 0,
    entropy_of_url: shannonEntropy(rawUrl),
    entropy_of_domain: shannonEntropy(domain),
  };
}

function extractFeatures(url, featureNames) {
  const featureObject = extractFeatureObject(url);
  return featureNames.map(name => {
    const value = featureObject[name];
    return Number.isFinite(value) ? value : NaN;
  });
}

async function loadModelAssets() {
  if (_model) return _model;

  const modelUrl =
    typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL("forest.json")
      : "./forest.json";

  const resp = await fetch(modelUrl);
  if (!resp.ok) throw new Error(`Gagal load model: ${resp.status} ${resp.statusText}`);

  _model = await resp.json();
  if (!_model.feature_names || !_model.forest || !_model.forest.trees) {
    throw new Error("forest.json bukan format export Mendeley v3. Pakai artifacts/random_forest_model.json lalu rename jadi forest.json.");
  }

  return _model;
}

function predictTreeProba(tree, row) {
  let node = 0;

  while (tree.children_left[node] !== -1) {
    const featureIdx = tree.feature[node];
    const threshold = tree.threshold[node];
    const featureValue = Math.fround(row[featureIdx]);

    node = featureValue <= threshold
      ? tree.children_left[node]
      : tree.children_right[node];
  }

  const value = tree.value[node].map(Number);
  const total = value.reduce((a, b) => a + b, 0);

  if (!total) return value.map(() => 1 / value.length);
  return value.map(v => v / total);
}

function getClassIndex(classes, target) {
  return classes.findIndex(c => Number(c) === Number(target));
}

async function predictURL(url) {
  const model = await loadModelAssets();

  const featureNames = model.feature_names;
  const raw = extractFeatures(url, featureNames);
  const statistics = model.imputer?.statistics || [];

  const row = raw.map((value, idx) => {
    if (Number.isFinite(value)) return value;
    const fallback = Number(statistics[idx]);
    return Number.isFinite(fallback) ? fallback : 0;
  });

  const classes = model.classes || [0, 1];
  const sums = new Array(classes.length).fill(0);

  for (const tree of model.forest.trees) {
    const proba = predictTreeProba(tree, row);
    for (let i = 0; i < sums.length; i++) sums[i] += proba[i] || 0;
  }

  const probabilities = sums.map(v => v / model.forest.trees.length);

  const safeIndex = getClassIndex(classes, model.safe_label ?? 0);
  const phishingIndex = getClassIndex(classes, model.phishing_label ?? 1);

  if (safeIndex < 0 || phishingIndex < 0) {
    throw new Error(`Label class tidak cocok. classes=${JSON.stringify(classes)}`);
  }

  const safeProbability = probabilities[safeIndex];
  const phishingProbability = probabilities[phishingIndex];
  const threshold = Number(model.phishing_threshold ?? 0.5);
  const isPhishing = phishingProbability >= threshold;

  return {
    label: isPhishing ? "phishing" : "safe",
    confidence: Math.round((isPhishing ? phishingProbability : safeProbability) * 10000) / 10000,
    phishingProbability: Math.round(phishingProbability * 10000) / 10000,
    safeProbability: Math.round(safeProbability * 10000) / 10000,
    threshold,
    features: describeFeaturesForUI(extractFeatureObject(url)),
  };
}

function describeFeaturesForUI(f) {
  return {
    "URL sangat panjang": f.url_length >= 75,
    "Banyak digit di URL": f.number_of_digits_in_url >= 8,
    "Ada digit berulang": f.having_repeated_digits_in_url === 1,
    "Banyak karakter spesial": f.number_of_special_char_in_url >= 6,
    "Ada simbol @": f.number_of_at_in_url > 0,
    "Banyak slash": f.number_of_slash_in_url >= 5,
    "Domain memakai tanda -": f.number_of_hyphens_in_domain > 0,
    "Domain mengandung angka": f.having_digits_in_domain === 1,
    "Subdomain banyak": f.number_of_subdomains >= 2,
    "Ada query parameter": f.having_query === 1,
    "Entropy URL tinggi": f.entropy_of_url >= 4.5,
  };
}
