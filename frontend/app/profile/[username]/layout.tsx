import type { Metadata } from "next";
import type { ReactNode } from "react";

import type { PublicProfileResponse } from "@/lib/api";
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
  params: { username: string };
}): Promise<Metadata> {
  const encodedUsername = encodeURIComponent(params.username);
  const profile = await fetchApiJson<PublicProfileResponse>(
    `/profiles/${encodedUsername}`
  );

  const username = profile?.username ?? params.username;
  const title = `@${username} | Antique Catalogue`;
  const description = profile
    ? `View @${username}'s public archive with ${profile.public_collection_count} collections and ${profile.public_item_count} items.`
    : `View @${username}'s public archive on Antique Catalogue.`;

  const pageUrl = buildSiteUrl(`/profile/${encodeURIComponent(username)}`);
  const avatarUrl =
    profile?.has_avatar && profile.id
      ? buildApiAssetUrl(`/avatars/${profile.id}/medium.jpg`)
      : null;
  const imageUrl = avatarUrl ?? buildSiteUrl("/logo.png") ?? undefined;

  return {
    title,
    description,
    alternates: pageUrl ? { canonical: pageUrl } : undefined,
    openGraph: {
      type: "profile",
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

export default function PublicProfileLayout({ children }: Props) {
  return children;
}
