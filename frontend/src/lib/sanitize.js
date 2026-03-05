import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b", "strong", "i", "em", "u", "s", "p", "br",
  "ul", "ol", "li", "h1", "h2", "h3",
  "blockquote", "code",
];

export function sanitizeHtml(dirty) {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

export function isHtmlContent(str) {
  if (!str) return false;
  return /<[a-z][\s\S]*>/i.test(str);
}
