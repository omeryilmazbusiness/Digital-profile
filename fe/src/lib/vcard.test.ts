import { expect, test } from "vitest";

import { attachmentDisposition, buildVCard, escapeText, foldLine } from "./vcard";

const octets = (s: string) => new TextEncoder().encode(s).length;

const contact = {
  givenName: "Momen Tawfiq",
  familyName: "Alkiswani",
  fullName: "Momen Tawfiq Alkiswani",
  organization: "Sheraton Makkah Jabal Al Kaaba",
  title: "Sales Manager, Travel Trade",
  phones: [{ e164: "+966500000000" }, { e164: "+966511111111", label: "WhatsApp" }],
  email: "momen@example.com",
  url: "https://example.com/momen",
  address: { street: "Ibrahim Al Khalil Street", city: "Makkah", country: "Saudi Arabia" },
};

test("writes a 3.0 card with CRLF line endings and the name parts", () => {
  const card = buildVCard(contact);
  expect(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
  expect(card.endsWith("END:VCARD\r\n")).toBe(true);
  expect(card).not.toMatch(/[^\r]\n/);
  expect(card).toContain("N:Alkiswani;Momen Tawfiq;;;\r\n");
  expect(card).toContain("FN:Momen Tawfiq Alkiswani\r\n");
  expect(card).toContain("TITLE:Sales Manager\\, Travel Trade\r\n");
});

test("labels a second number, such as WhatsApp", () => {
  const card = buildVCard(contact);
  expect(card).toContain("TEL;TYPE=CELL,VOICE:+966500000000\r\n");
  expect(card).toContain("item2.TEL:+966511111111\r\nitem2.X-ABLabel:WhatsApp\r\n");
});

test("escapes separators and line breaks", () => {
  expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  expect(buildVCard(contact)).toContain(
    "ADR;TYPE=WORK:;;Ibrahim Al Khalil Street;Makkah;;;Saudi Arabia",
  );
});

test("folds long lines at 75 octets without splitting a character", () => {
  const arabic = `FN:${"مؤمن توفيق الكسواني ".repeat(6)}`;
  const folded = foldLine(arabic).split("\r\n");
  expect(folded.length).toBeGreaterThan(1);
  for (const line of folded) expect(octets(line)).toBeLessThanOrEqual(75);
  expect(folded.slice(1).every((line) => line.startsWith(" "))).toBe(true);
  expect(folded.map((line, i) => (i === 0 ? line : line.slice(1))).join("")).toBe(arabic);
});

test("embeds the photo as base64 JPEG, folded", () => {
  const photo = "A".repeat(300);
  const card = buildVCard({ ...contact, photo });
  expect(card).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
  for (const line of card.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  expect(card.replace(/\r\n /g, "")).toContain(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}\r\n`);
});

test("names the download in ASCII with a UTF-8 alternative", () => {
  expect(attachmentDisposition("Momen Alkiswani.vcf")).toBe(
    `attachment; filename="Momen Alkiswani.vcf"; filename*=UTF-8''Momen%20Alkiswani.vcf`,
  );
  expect(attachmentDisposition("مؤمن.vcf")).toMatch(
    /^attachment; filename="contact\.vcf"; filename\*=UTF-8''%D9/,
  );
});
