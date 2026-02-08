"use client";

import * as React from "react";

import { AuthProvider } from "@/components/auth-provider";

export const AppProviders = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return <AuthProvider>{children}</AuthProvider>;
};
