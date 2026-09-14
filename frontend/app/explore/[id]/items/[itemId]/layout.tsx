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

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string; itemId: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const encodedCollectionId = encodeURIComponent(resolvedParams.id);
  const encodedItemId = encodeURIComponent(resolvedParams.itemId);

  const [collection, item] = await Promise.all([
    fetchApiJson<CollectionResponse>(`/public/collections/${encodedCollectionId}`),
    fetchApiJson<ItemResponse>(
      `/public/collections/${encodedCollectionId}/items/${encodedItemId}`
    )
  ]);

  const itemName = item?.name ?? "Public item";
  const collectionName = collection?.name ?? "Antique Catalogue";
  const title = `${itemName} | ${collectionName}`;
  const description =
    item?.notes?.trim() || `View this public item from ${collectionName} on Antique Catalogue.`;

  const pageUrl = await buildSiteUrl(
    `/explore/${encodedCollectionId}/items/${encodedItemId}`
  );
  const primaryImageId = item?.primary_image_id ?? null;
  const imageUrl =
    (primaryImageId ? await buildApiAssetUrl(`/images/${primaryImageId}/medium.jpg`) : null) ??
    await buildSiteUrl("/logo.png") ??
    undefined;

  return {
    title,
    description,
    alternates: pageUrl ? { canonical: pageUrl } : undefined,
    openGraph: {
      type: "article",
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

export default function PublicItemLayout({ children }: Props) {
  return children;
}
