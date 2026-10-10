/** What goes on a contact card. */
export interface VCardContact {
  givenName: string;
  familyName: string;
  fullName: string;
  organization?: string;
  title?: string;
  /** E.164 numbers; a label such as "WhatsApp" names the number in the address book. */
  phones: readonly { e164: string; label?: string }[];
  email?: string;
  url?: string;
  address?: { street: string; city: string; postalCode?: string; country: string };
  note?: string;
  /** Base64 JPEG. */
  photo?: string;
}

const MAX_OCTETS = 75;
const encoder = new TextEncoder();

/** Escapes a text value: backslash, comma, semicolon and line breaks. */
export function escapeText(value: string): string {
  return value.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line at 75 octets (RFC 6350 §3.2), continuation lines starting with a
 * space. Never splits a UTF-8 character, so Arabic names survive every importer.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  // The leading space of a continuation line counts toward its limit.
  let limit = MAX_OCTETS;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/**
 * A vCard 3.0 — the version iOS and Android both import with the photo — UTF-8 with CRLF
 * line endings.
 */
export function buildVCard(contact: VCardContact): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeText(contact.familyName)};${escapeText(contact.givenName)};;;`,
    `FN:${escapeText(contact.fullName)}`,
  ];
  if (contact.organization) lines.push(`ORG:${escapeText(contact.organization)}`);
  if (contact.title) lines.push(`TITLE:${escapeText(contact.title)}`);
  contact.phones.forEach((phone, i) => {
    if (phone.label) {
      // Apple's item grouping is how a custom label reaches the address book.
      lines.push(`item${i + 1}.TEL:${phone.e164}`, `item${i + 1}.X-ABLabel:${phone.label}`);
    } else {
      lines.push(`TEL;TYPE=CELL,VOICE:${phone.e164}`);
    }
  });
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${contact.email}`);
  if (contact.url) lines.push(`URL:${contact.url}`);
  if (contact.address) {
    const { street, city, postalCode = "", country } = contact.address;
    const parts = ["", "", street, city, "", postalCode, country].map(escapeText);
    lines.push(`ADR;TYPE=WORK:${parts.join(";")}`);
  }
  if (contact.note) lines.push(`NOTE:${escapeText(contact.note)}`);
  if (contact.photo) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${contact.photo}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Content-Disposition for a download, with an RFC 6266 UTF-8 name for non-ASCII names. */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  const fallback = /\w/.test(ascii.replace(/\.[^.]*$/, "")) ? ascii : "contact.vcf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
