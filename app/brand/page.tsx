import type { Metadata } from "next";
import { BrandSpec } from "@/components/brand-spec";

export const metadata: Metadata = {
  title: "Brand spec — Breachboard",
  description: "Living brand spec for Breachboard.",
};

export default function BrandPage() {
  return <BrandSpec />;
}
