import type { Metadata } from "next";
import type { ReactNode } from "react";

import type { CollectionResponse, ItemResponse } from "@/lib/api";
import {
  buildApiAssetUrl,
  buildSiteUrl,
  fetchApiJson
} from "@/lib/server-metadata";

type Props = {
  children: ReactNode;
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const encodedCollectionId = encodeURIComponent(params.id);
  const [collection, firstItem] = await Promise.all([
    fetchApiJson<CollectionResponse>(`/public/collections/${encodedCollectionId}`),
    fetchApiJson<ItemResponse[]>(`/public/collections/${encodedCollectionId}/items?limit=1`)
  ]);

  const title = collection?.name
    ? `${collection.name} | Antique Catalogue`
    : "Public Collection | Antique Catalogue";
  const description =
    collection?.description?.trim() || "Explore this public collection on Antique Catalogue.";

  const pageUrl = buildSiteUrl(`/explore/${encodedCollectionId}`);
  const primaryImageId = firstItem?.[0]?.primary_image_id ?? null;
  const imageUrl =
    (primaryImageId ? buildApiAssetUrl(`/images/${primaryImageId}/medium.jpg`) : null) ??
    buildSiteUrl("/logo.png") ??
    undefined;

  return {
    title,
    description,
    alternates: pageUrl ? { canonical: pageUrl } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: pageUrl ?? undefined,
      images: imageUrl ? [{ url: imageUrl }] : undefined
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined
    }
  };
}

export default function PublicCollectionLayout({ children }: Props) {
  return children;
}
