export default function(urlString : string) : boolean {
  try {
    const url = new URL(urlString);
    return /(\.|^)nhentai\.net$/i.test(url.hostname) && /^\/g\/\d+\/?$/i.test(url.pathname);
  } catch (e) {
    return false;
  }
}