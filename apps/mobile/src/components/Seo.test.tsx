import React from "react";
import { Platform } from "react-native";
import { Seo } from "./Seo";

jest.mock("expo-router", () => ({
  usePathname: jest.fn(() => "/discover"),
}));

jest.mock("expo-router/head", () => {
  return function MockHead({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
});

interface TagProps {
  name?: string;
  property?: string;
  content?: string;
  children?: React.ReactNode;
  type?: string;
}

describe("Seo component", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it("returns null on native platforms (ios/android)", () => {
    Platform.OS = "ios";
    const result = Seo({ title: "Test", description: "Test desc" });
    expect(result).toBeNull();
  });

  it("renders Head elements on web platform", () => {
    Platform.OS = "web";
    const result = Seo({
      title: "Films populaires",
      description: "Découvrez les meilleurs films",
      image: "https://example.com/poster.jpg",
      type: "video.movie",
      jsonLd: { "@type": "Movie", name: "Inception" },
    });

    expect(result).not.toBeNull();
    const element = result as React.ReactElement<{ children: React.ReactNode[] }>;
    const children = React.Children.toArray(element.props.children) as Array<React.ReactElement<TagProps>>;

    // Title tag
    const titleTag = children.find((c) => c.type === "title");
    expect(titleTag?.props.children).toBe("Films populaires · Canapé");

    // Description meta
    const descMeta = children.find((c) => c.props.name === "description");
    expect(descMeta?.props.content).toBe("Découvrez les meilleurs films");

    // OG type
    const ogTypeMeta = children.find((c) => c.props.property === "og:type");
    expect(ogTypeMeta?.props.content).toBe("video.movie");

    // OG image
    const ogImageMeta = children.find((c) => c.props.property === "og:image");
    expect(ogImageMeta?.props.content).toBe("https://example.com/poster.jpg");

    // Robots meta (index by default)
    const robotsMeta = children.find((c) => c.props.name === "robots");
    expect(robotsMeta?.props.content).toBe("index, follow, max-image-preview:large");

    // JSON-LD
    const jsonLdTag = children.find((c) => c.type === "script" && c.props.type === "application/ld+json");
    expect(jsonLdTag).toBeDefined();
    const parsedLd = JSON.parse(jsonLdTag?.props.children as string);
    expect(parsedLd["@type"]).toBe("Movie");
    expect(parsedLd.name).toBe("Inception");
  });

  it("renders noindex directive when requested", () => {
    Platform.OS = "web";
    const result = Seo({
      title: "Mes favoris",
      description: "Liste privée",
      noindex: true,
    });

    const element = result as React.ReactElement<{ children: React.ReactNode[] }>;
    const children = React.Children.toArray(element.props.children) as Array<React.ReactElement<TagProps>>;

    const robotsMeta = children.find((c) => c.props.name === "robots");
    expect(robotsMeta?.props.content).toBe("noindex, follow");
  });

  it("wraps jsonLd array in @graph", () => {
    Platform.OS = "web";
    const result = Seo({
      description: "Test graph",
      jsonLd: [
        { "@type": "BreadcrumbList", itemListElement: [] },
        { "@type": "Movie", name: "Dune" },
      ],
    });

    const element = result as React.ReactElement<{ children: React.ReactNode[] }>;
    const children = React.Children.toArray(element.props.children) as Array<React.ReactElement<TagProps>>;

    const jsonLdTag = children.find((c) => c.type === "script" && c.props.type === "application/ld+json");
    const parsedLd = JSON.parse(jsonLdTag?.props.children as string);
    expect(parsedLd["@context"]).toBe("https://schema.org");
    expect(parsedLd["@graph"]).toHaveLength(2);
  });
});
