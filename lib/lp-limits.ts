// Largest menu PDF anyone can import (try-it page and dashboard). Over ~4 MB it's uploaded to storage first,
// since requests to our functions are capped at about 4.5 MB, and Claude reads it from a link.
export const PDF_MAX = 32 * 1024 * 1024;
export const PDF_DIRECT_MAX = 3.5 * 1024 * 1024;
export const LP_PDF_MAX = PDF_MAX;
