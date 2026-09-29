import type { WatchOption } from "@canape/shared";
import {
  canOpenOnTv,
  netflixDialBody,
  openOnTv,
  opensTitleOnTv,
  probeSamsungTv,
  scanForTvs,
  TvError,
  youtubeDialBody,
} from "./samsung";

const tv = { ip: "192.168.1.41", name: '55" QLED', model: "TQ55Q7FAAUXXC" };

const option = (patch: Partial<WatchOption>): WatchOption => ({
  provider: { id: 8, name: "Netflix", logoUrl: null },
  type: "subscription",
  link: "https://www.netflix.com/title/80057281",
  linkKind: "direct",
  platform: "netflix",
  ...patch,
});

const reply = (status: number, body: unknown = "") =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

describe("DIAL bodies", () => {
  it("builds Netflix's launch string from a title or watch link", () => {
    expect(netflixDialBody("https://www.netflix.com/title/80057281")).toBe(
      "m=https://www.netflix.com/watch/80057281&source_type=4",
    );
    expect(netflixDialBody("https://www.netflix.com/fr/watch/81234567?trackId=1")).toBe(
      "m=https://www.netflix.com/watch/81234567&source_type=4",
    );
    expect(netflixDialBody("https://www.netflix.com/search?q=dune")).toBe("");
  });

  it("extracts the YouTube video id", () => {
    expect(youtubeDialBody("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("v=dQw4w9WgXcQ");
    expect(youtubeDialBody("https://youtu.be/dQw4w9WgXcQ")).toBe("v=dQw4w9WgXcQ");
  });

  it("only promises the exact title for direct links of DIAL apps", () => {
    expect(opensTitleOnTv(option({}))).toBe(true);
    expect(opensTitleOnTv(option({ linkKind: "search", link: "https://www.netflix.com/search?q=x" }))).toBe(false);
    expect(opensTitleOnTv(option({ platform: "prime", link: "https://www.primevideo.com/detail/x" }))).toBe(false);
    expect(canOpenOnTv("prime")).toBe(true);
    expect(canOpenOnTv("canal")).toBe(false);
    expect(canOpenOnTv(null)).toBe(false);
  });
});

describe("openOnTv", () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it("sends Netflix titles through DIAL", async () => {
    fetchMock.mockResolvedValue(reply(201));

    expect(await openOnTv(tv, option({}))).toBe("title");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.1.41:8080/ws/app/Netflix");
    expect(init.body).toBe("m=https://www.netflix.com/watch/80057281&source_type=4");
  });

  it("opens other platforms' app through the TV API", async () => {
    fetchMock.mockResolvedValue(reply(200));

    expect(await openOnTv(tv, option({ platform: "prime", link: "https://www.primevideo.com/detail/x" }))).toBe("app");

    expect(fetchMock.mock.calls[0][0]).toBe("http://192.168.1.41:8001/api/v2/applications/3201910019365");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("tries the next app id when the first generation isn't installed", async () => {
    fetchMock.mockResolvedValueOnce(reply(404)).mockResolvedValueOnce(reply(200));

    await openOnTv(tv, option({ platform: "prime", link: "x" }));

    expect(fetchMock.mock.calls[1][0]).toBe("http://192.168.1.41:8001/api/v2/applications/3201512006785");
  });

  it("reports an unreachable TV", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(openOnTv(tv, option({}))).rejects.toEqual(new TvError("unreachable"));
  });

  it("refuses platforms it can't open", async () => {
    await expect(openOnTv(tv, option({ platform: "canal" }))).rejects.toEqual(new TvError("unsupported"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("discovery", () => {
  it("reads the TV name and model, decoding HTML entities", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(reply(200, { device: { name: "55&quot; QLED", modelName: "TQ55Q7FAAUXXC", OS: "Tizen" } }));
    expect(await probeSamsungTv("192.168.1.41")).toEqual(tv);
  });

  it("scans the phone's /24 network", async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.startsWith("http://192.168.1.41:")
        ? reply(200, { device: { name: "TV", modelName: "M", OS: "Tizen" } })
        : Promise.reject(new Error("timeout")),
    ) as unknown as typeof fetch;

    const found = await scanForTvs("192.168.1.102");

    expect(found).toEqual([{ ip: "192.168.1.41", name: "TV", model: "M" }]);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(254);
  });
});
