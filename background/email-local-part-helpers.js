(function attachEmailLocalPartHelpers(root, factory) {
  root.MultiPageEmailLocalPartHelpers = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createEmailLocalPartHelpersModule() {
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

  function pickRandomEnglishNamePrefix() {
    return ENGLISH_NAME_PREFIXES[Math.floor(Math.random() * ENGLISH_NAME_PREFIXES.length)] || 'james';
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

  function buildRandomNameDateTimeLocalPart(date = new Date()) {
    const dateTimeDigits = formatDateTimeDigits(date);
    if (!dateTimeDigits) {
      return '';
    }
    return `${pickRandomEnglishNamePrefix()}${dateTimeDigits}`;
  }

  return {
    buildRandomNameDateTimeLocalPart,
    formatDateTimeDigits,
    pickRandomEnglishNamePrefix,
  };
});
