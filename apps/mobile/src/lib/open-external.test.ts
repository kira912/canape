import { isWebLink } from "./open-external";

describe("isWebLink", () => {
  it.each(["https://www.netflix.com/title/80100172", "HTTPS://tv.apple.com/fr/search?term=x"])("accepts %s", (url) => {
    expect(isWebLink(url)).toBe(true);
  });

  it.each([
    "javascript:alert(document.cookie)",
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "intent://scan/#Intent;scheme=zxing;end",
    "http://example.com",
    "https:/evil",
    "",
  ])("refuses %s", (url) => {
    expect(isWebLink(url)).toBe(false);
  });
});
