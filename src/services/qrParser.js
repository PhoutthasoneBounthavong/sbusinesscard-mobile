/**
 * High-performance QR Code Contact Data Parser.
 * Supports:
 * - RFC 6350 / vCard 2.1, 3.0, 4.0 (BEGIN:VCARD ... END:VCARD)
 * - NTT Docomo MECARD format (MECARD:N:Name;TEL:123;EMAIL:abc@def.com;;)
 * - BIZCARD format (BIZCARD:N:First;X:Last;T:Title;C:Company;B:Phone;E:Email;;)
 * - URLs (http://, https://, LinkedIn, Cardr, digital card links)
 * - mailto: and tel: URIs
 */

export function parseQrContact(qrData) {
  if (!qrData || typeof qrData !== "string") return null;
  const raw = qrData.trim();

  // 1. RFC 6350 vCard (Standard business card QR)
  if (raw.toUpperCase().includes("BEGIN:VCARD")) {
    const card = {
      full_name: "",
      job_title: "",
      company: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      notes: "Scanned from QR Code (vCard)",
    };

    const lines = raw.split(/\r\n|\r|\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const upper = line.toUpperCase();

      if (upper.startsWith("FN:") || upper.startsWith("FN;")) {
        card.full_name = line.substring(line.indexOf(":") + 1).replace(/\\,/g, ",").trim();
      } else if (!card.full_name && (upper.startsWith("N:") || upper.startsWith("N;"))) {
        const parts = line.substring(line.indexOf(":") + 1).split(";");
        const lastName = (parts[0] || "").trim();
        const firstName = (parts[1] || "").trim();
        card.full_name = `${firstName} ${lastName}`.trim();
      } else if (upper.startsWith("TITLE:") || upper.startsWith("TITLE;")) {
        card.job_title = line.substring(line.indexOf(":") + 1).replace(/\\,/g, ",").trim();
      } else if (upper.startsWith("ORG:") || upper.startsWith("ORG;")) {
        const orgParts = line.substring(line.indexOf(":") + 1).split(";");
        card.company = (orgParts[0] || "").replace(/\\,/g, ",").trim();
      } else if (upper.startsWith("TEL") && line.includes(":")) {
        if (!card.phone) {
          card.phone = line.substring(line.indexOf(":") + 1).trim();
        }
      } else if (upper.startsWith("EMAIL") && line.includes(":")) {
        if (!card.email) {
          card.email = line.substring(line.indexOf(":") + 1).trim();
        }
      } else if (upper.startsWith("URL") && line.includes(":")) {
        if (!card.website) {
          card.website = line.substring(line.indexOf(":") + 1).trim();
        }
      } else if (upper.startsWith("ADR") && line.includes(":")) {
        const adrParts = line
          .substring(line.indexOf(":") + 1)
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        card.address = adrParts.join(", ").replace(/\\,/g, ",");
      }
    }

    if (card.full_name || card.phone || card.email || card.company) {
      return card;
    }
  }

  // 2. NTT Docomo MECARD format: MECARD:N:John Doe;TEL:123456789;EMAIL:john@example.com;;
  if (raw.toUpperCase().startsWith("MECARD:")) {
    const card = {
      full_name: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      company: "",
      job_title: "",
      notes: "Scanned from QR Code (MECARD)",
    };
    const body = raw.substring(7);
    const tokens = body.split(";");
    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (upper.startsWith("N:")) card.full_name = token.substring(2).trim();
      if (upper.startsWith("TEL:")) {
        if (!card.phone) card.phone = token.substring(4).trim();
      }
      if (upper.startsWith("EMAIL:")) {
        if (!card.email) card.email = token.substring(6).trim();
      }
      if (upper.startsWith("URL:")) {
        if (!card.website) card.website = token.substring(4).trim();
      }
      if (upper.startsWith("ADR:")) card.address = token.substring(4).trim();
      if (upper.startsWith("ORG:")) card.company = token.substring(4).trim();
    }
    if (card.full_name || card.phone || card.email) return card;
  }

  // 3. BIZCARD format: BIZCARD:N:First;X:Last;T:Title;C:Company;B:Phone;E:Email;;
  if (raw.toUpperCase().startsWith("BIZCARD:")) {
    const card = {
      full_name: "",
      job_title: "",
      company: "",
      phone: "",
      email: "",
      website: "",
      notes: "Scanned from QR Code (BIZCARD)",
    };
    let firstName = "";
    let lastName = "";
    const body = raw.substring(8);
    const tokens = body.split(";");
    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (upper.startsWith("N:")) firstName = token.substring(2).trim();
      if (upper.startsWith("X:")) lastName = token.substring(2).trim();
      if (upper.startsWith("T:")) card.job_title = token.substring(2).trim();
      if (upper.startsWith("C:")) card.company = token.substring(2).trim();
      if (upper.startsWith("B:") || upper.startsWith("M:")) {
        if (!card.phone) card.phone = token.substring(2).trim();
      }
      if (upper.startsWith("E:")) {
        if (!card.email) card.email = token.substring(2).trim();
      }
    }
    card.full_name = `${firstName} ${lastName}`.trim();
    if (card.full_name || card.phone || card.email) return card;
  }

  // 4. Web Link (Digital Business Card or Website QR)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    // Try to extract an intelligent title from the URL
    let domainName = "";
    try {
      const urlObj = new URL(raw);
      domainName = urlObj.hostname.replace(/^www\./, "");
    } catch (e) {
      domainName = raw;
    }

    return {
      full_name: domainName || "Digital Contact",
      website: raw,
      notes: `Scanned from QR Link: ${raw}`,
    };
  }

  // 5. mailto: URI
  if (raw.toLowerCase().startsWith("mailto:")) {
    const email = raw.substring(7).split("?")[0].trim();
    return {
      full_name: "Contact",
      email: email,
      notes: "Scanned from QR email link",
    };
  }

  // 6. tel: URI
  if (raw.toLowerCase().startsWith("tel:")) {
    const phone = raw.substring(4).trim();
    return {
      full_name: "Contact",
      phone: phone,
      notes: "Scanned from QR phone link",
    };
  }

  return null;
}
