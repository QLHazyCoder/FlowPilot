(function attachEmailLocalPartHelpers(root, factory) {
  root.MultiPageEmailLocalPartHelpers = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createEmailLocalPartHelpersModule(root = globalThis) {
  const ENGLISH_NAME_PREFIXES = [
    'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
    'thomas', 'charles', 'mary', 'patricia', 'jennifer', 'linda', 'elizabeth',
    'barbara', 'susan', 'jessica', 'sarah', 'karen', 'daniel', 'matthew',
    'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kevin',
    'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
    'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin',
    'scott', 'brandon', 'benjamin', 'samuel', 'gregory', 'alexander', 'patrick',
    'frank', 'raymond', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'henry',
    'douglas', 'peter', 'adam', 'zachary', 'nathan', 'walter', 'harold', 'kyle',
    'carl', 'arthur', 'gerald', 'roger', 'alice', 'emma', 'olivia', 'sophia',
    'isabella', 'mia', 'amelia', 'harper', 'evelyn', 'abigail', 'emily', 'ella',
    'scarlett', 'grace', 'chloe', 'victoria', 'riley', 'aria', 'lily', 'nora',
  ];

  const RANDOM_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const FAMILY_NAME_PARTS = [
    'smith', 'johnson', 'brown', 'miller', 'wilson', 'moore', 'taylor',
    'anderson', 'thomas', 'jackson', 'white', 'harris', 'martin', 'lee',
    'walker', 'young', 'allen', 'king', 'wright', 'scott', 'green', 'baker',
    'adams', 'nelson', 'carter', 'mitchell', 'perez', 'roberts', 'turner',
  ];

  function getRandomInt(maxExclusive) {
    const max = Math.floor(Number(maxExclusive));
    if (!Number.isFinite(max) || max <= 0) return 0;
    const cryptoApi = root.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function pickRandomEnglishNamePrefix() {
    return ENGLISH_NAME_PREFIXES[getRandomInt(ENGLISH_NAME_PREFIXES.length)] || 'james';
  }

  function pickRandomFamilyNamePart() {
    return FAMILY_NAME_PARTS[getRandomInt(FAMILY_NAME_PARTS.length)] || 'smith';
  }

  function formatDateTimeDigits(date = new Date()) {
    const current = new Date(date);
    if (Number.isNaN(current.getTime())) {
      return '';
    }
    const year = String(current.getFullYear());
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const hour = String(current.getHours()).padStart(2, '0');
    const minute = String(current.getMinutes()).padStart(2, '0');
    const second = String(current.getSeconds()).padStart(2, '0');
    const millisecond = String(current.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}${hour}${minute}${second}${millisecond}`;
  }

  function buildRandomAlphaNumericSuffix(length = 4) {
    const size = Math.max(0, Math.floor(Number(length) || 0));
    const chars = [];
    for (let index = 0; index < size; index += 1) {
      chars.push(RANDOM_SUFFIX_CHARS[getRandomInt(RANDOM_SUFFIX_CHARS.length)] || 'a');
    }
    return chars.join('');
  }

  function buildRandomNameDateTimeLocalPart(date = new Date(), options = {}) {
    const dateTimeDigits = formatDateTimeDigits(date);
    if (!dateTimeDigits) {
      return '';
    }
    const suffixLength = Number.isFinite(Number(options.suffixLength))
      ? Math.max(0, Math.floor(Number(options.suffixLength)))
      : 4;
    return `${pickRandomEnglishNamePrefix()}${dateTimeDigits}${buildRandomAlphaNumericSuffix(suffixLength)}`;
  }

  function buildNaturalEmailLocalPart(options = {}) {
    const first = pickRandomEnglishNamePrefix();
    const last = pickRandomFamilyNamePart();
    const separators = ['', '.', '_'];
    const separator = separators[getRandomInt(separators.length)] || '';
    const suffixLength = Number.isFinite(Number(options.suffixLength))
      ? Math.max(0, Math.floor(Number(options.suffixLength)))
      : 3;
    const suffix = buildRandomAlphaNumericSuffix(suffixLength);
    return `${first}${separator}${last}${suffix}`;
  }

  return {
    buildNaturalEmailLocalPart,
    buildRandomAlphaNumericSuffix,
    buildRandomNameDateTimeLocalPart,
    formatDateTimeDigits,
    pickRandomFamilyNamePart,
    pickRandomEnglishNamePrefix,
  };
});
