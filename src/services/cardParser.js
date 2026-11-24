/**
 * Pure In-App Business Card Entity Classification Engine (JavaScript)
 * 100% Offline, On-Device, Instant 0ms Parser.
 * Ported directly from the production heuristic pipeline.
 */

const COMMON_JOB_TITLES = [
  // C-Level & Executives
  "chief executive officer", "ceo", "chief technology officer", "cto",
  "chief financial officer", "cfo", "chief operating officer", "coo",
  "chief marketing officer", "cmo", "chief product officer", "cpo",
  "chief information officer", "cio", "president", "vice president", "vp",
  "founder", "co-founder", "managing director", "executive director", "general manager",
  "partner", "managing partner", "principal", "board member", "chairman", "chairwoman",
  
  // Tech, Engineering & Design
  "software engineer", "senior software engineer", "full stack developer", "frontend developer",
  "backend developer", "mobile developer", "ios developer", "android developer",
  "software architect", "solutions architect", "cloud architect", "systems engineer",
  "product designer", "ui/ux designer", "lead designer", "creative director", "art director",
  "product manager", "senior product manager", "head of product", "head of engineering",
  "data scientist", "machine learning engineer", "ai researcher", "devops engineer",
  "qa engineer", "tech lead", "technical lead", "engineering manager",
  
  // Business, Sales, Marketing & Operations
  "business development", "account executive", "sales manager", "sales director",
  "marketing director", "marketing manager", "growth marketer", "digital strategist",
  "brand strategist", "operations manager", "head of operations", "project manager",
  "scrum master", "consultant", "senior consultant", "advisor", "specialist",
  "financial analyst", "attorney", "legal counsel", "general counsel", "associate", "staff"
];

const COMPANY_SUFFIXES = [
  /\binc\.?\b/i, /\bllc\.?\b/i, /\bltd\.?\b/i, /\bcorp\.?\b/i, /\bcorporation\b/i,
  /\bco\.?\b/i, /\bcompany\b/i, /\bgroup\b/i, /\blabs\b/i, /\bstudio\b/i, /\bstudios\b/i,
  /\btechnologies\b/i, /\btech\b/i, /\bsolutions\b/i, /\bholdings\b/i, /\bcapital\b/i,
  /\benterprises\b/i, /\bgmbh\b/i, /\bag\b/i, /\bs\.a\.\b/i, /\bplc\b/i, /\bpty\b/i,
  /\bagency\b/i, /\bpartners\b/i, /\bassociates\b/i
];

const ADDRESS_INDICATORS = [
  /\bstreet\b/i, /\bst\.?\b/i, /\bavenue\b/i, /\bave\.?\b/i, /\bboulevard\b/i, /\bblvd\.?\b/i,
  /\broad\b/i, /\brd\.?\b/i, /\bdrive\b/i, /\bdr\.?\b/i, /\blane\b/i, /\bln\.?\b/i,
  /\bway\b/i, /\bsuite\b/i, /\bste\.?\b/i, /\bfloor\b/i, /\bfl\.?\b/i, /\bbuilding\b/i,
  /\bbldg\.?\b/i, /\bhighway\b/i, /\bhwy\.?\b/i, /\bpkway\b/i, /\bparkway\b/i,
  /\bzip\b/i, /\bpostal\b/i, /\bca\b/i, /\bny\b/i, /\btx\b/i, /\bfl\b/i, /\bil\b/i,
  /\busa\b/i, /\bunited states\b/i, /\bcanada\b/i, /\buk\b/i, /\bgermany\b/i, /\bfrance\b/i,
  /\blao pdr\b/i, /\bthailand\b/i, /\bsingapore\b/i, /\bvietnam\b/i, /\bjapan\b/i
];

export function cleanTextLines(rawText) {
  if (!rawText) return [];
  const lines = [];
  for (const rawLine of rawText.split("\n")) {
    const line = rawLine.trim();
    if (line.length > 1 && !/^[^a-zA-Z0-9]+$/.test(line)) {
      lines.push(line);
    }
  }
  return lines;
}

export function extractEmails(text) {
  if (!text) return [];
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(pattern) || [];
  const seen = new Set();
  const emails = [];
  for (const m of matches) {
    const clean = m.toLowerCase().replace(/^[.,;:()[\]"']+|[.,;:()[\]"']+$/g, "");
    if (!seen.has(clean)) {
      seen.add(clean);
      emails.push(clean);
    }
  }
  return emails;
}

export function extractPhones(text) {
  if (!text) return [];
  const allCandidates = [];

  // Prefixed matches like Tel:, Mob:, Phone:
  const prefixRegex = /(?:tel|phone|ph|mobile|mob|cell|direct|dir|fax|call|t|m)\s*[:.-]?\s*([+\d().\s-]{7,25})/gi;
  let match;
  while ((match = prefixRegex.exec(text)) !== null) {
    if (match[1]) allCandidates.push(match[1]);
  }

  // Standard phone pattern
  const phonePattern = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{1,5})?/g;
  const genericMatches = text.match(phonePattern) || [];
  for (const cand of genericMatches) {
    const digitsOnly = cand.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      allCandidates.push(cand.trim());
    }
  }

  const cleanedPhones = [];
  const seen = new Set();
  for (const cand of allCandidates) {
    const clean = cand.replace(/[\r\n]+/g, " ").replace(/^[ .,;:()[\]"'-]+|[ .,;:()[\]"'-]+$/g, "");
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 7 && !seen.has(digits)) {
      seen.add(digits);
      cleanedPhones.push(clean);
    }
  }
  return cleanedPhones;
}

export function extractWebsites(text, emails = []) {
  if (!text) return [];
  let textWithoutEmails = text;
  for (const email of emails) {
    textWithoutEmails = textWithoutEmails.split(email).join(" ");
  }

  const pattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|org|net|io|co|ai|app|dev|me|biz|info|tech|agency|design|cloud|us|uk|de|fr|ca|au|in|jp|cn|th|la|sg)[a-zA-Z0-9\/._~%+-]*)/gi;
  const matches = [];
  let m;
  while ((m = pattern.exec(textWithoutEmails)) !== null) {
    if (m[1]) matches.push(m[1]);
  }

  const websites = [];
  const seen = new Set();
  for (const domain of matches) {
    const clean = domain.toLowerCase().replace(/^[.,;:()[\]"' ]+|[.,;:()[\]"' ]+$/g, "");
    if (["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(clean)) {
      continue;
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        websites.push(`https://${clean}`);
      } else {
        websites.push(clean);
      }
    }
  }
  return websites;
}

export function extractJobTitle(lines) {
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const title of COMMON_JOB_TITLES) {
      const reg = new RegExp(`\\b${title}\\b`, "i");
      if (reg.test(lower)) {
        return line.trim();
      }
    }
  }
  return "";
}

export function extractCompany(lines, emails = [], websites = [], jobTitle = "") {
  // 1. Explicit legal suffixes
  for (const line of lines) {
    if (line === jobTitle) continue;
    for (const suffix of COMPANY_SUFFIXES) {
      if (suffix.test(line)) {
        return line.split("|")[0].split("•")[0].trim();
      }
    }
  }

  // 2. Corporate website or email domain
  for (const site of websites) {
    const m = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+)\./i.exec(site);
    if (m && m[1]) {
      const domainName = m[1].charAt(0).toUpperCase() + m[1].slice(1);
      if (!["cardr", "linkedin", "github", "twitter", "facebook", "instagram"].includes(domainName.toLowerCase())) {
        for (const line of lines) {
          if (line.toLowerCase().includes(domainName.toLowerCase()) && line !== jobTitle) {
            return line.trim();
          }
        }
        return `${domainName} Inc.`;
      }
    }
  }

  // 3. Fallback: non-name header lines
  for (const line of lines.slice(0, 3)) {
    if (line !== jobTitle && line.length > 3 && !/[@\d]/.test(line)) {
      const words = line.split(/\s+/);
      if (words.length >= 1 && words.length <= 4) {
        return line.trim();
      }
    }
  }

  return "";
}

export function extractAddress(lines) {
  const addressLines = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasIndicator = ADDRESS_INDICATORS.some((ind) => ind.test(lower));
    const hasDigits = /\d+/.test(line);

    if (hasIndicator || (hasDigits && /\b\d{5}(?:-\d{4})?\b/.test(line))) {
      if (!/[@]|(?:tel|phone|ph|mobile|cell|fax):/i.test(lower)) {
        addressLines.push(line.trim());
      }
    }
  }
  return addressLines.length > 0 ? addressLines.join(", ") : "";
}

export function extractName(lines, jobTitle = "", company = "", emails = []) {
  const emailNameHints = [];
  for (const email of emails) {
    const prefix = email.split("@")[0];
    const parts = prefix.split(/[._-]/);
    for (const p of parts) {
      if (p.length > 1) emailNameHints.push(p.toLowerCase());
    }
  }

  for (const line of lines.slice(0, 5)) {
    if (line === jobTitle || line === company) continue;
    if (/[@\d\/\\:]/.test(line)) continue;

    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      const isTitleCase = words.every((w) => /^[A-Z]/.test(w));
      const matchesEmailHint = emailNameHints.some((h) => line.toLowerCase().includes(h));

      if (isTitleCase || matchesEmailHint) {
        return line.trim();
      }
    }
  }

  for (const line of lines.slice(0, 3)) {
    if (line !== jobTitle && line !== company) {
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length === 2 || words.length === 3) {
        return line.trim();
      }
    }
  }

  return "";
}

/**
 * Main On-Device Card Parsing Function
 * Takes raw OCR text and extracts a clean, structured Business Card contact.
 */
export function parseBusinessCardText(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      full_name: "",
      job_title: "",
      company: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      notes: "",
      raw_text: "",
      source: "on_device_mlkit",
    };
  }

  const lines = cleanTextLines(rawText);
  const emails = extractEmails(rawText);
  const phones = extractPhones(rawText);
  const websites = extractWebsites(rawText, emails);
  const jobTitle = extractJobTitle(lines);
  const company = extractCompany(lines, emails, websites, jobTitle);
  const address = extractAddress(lines);
  const fullName = extractName(lines, jobTitle, company, emails);

  return {
    full_name: fullName || (lines[0] ? lines[0] : "New Contact"),
    job_title: jobTitle,
    company: company,
    phone: phones[0] || "",
    additional_phones: phones.slice(1),
    email: emails[0] || "",
    additional_emails: emails.slice(1),
    website: websites[0] || "",
    address: address,
    notes: `Scanned on device`,
    raw_text: rawText,
    source: "on_device_mlkit",
  };
}
