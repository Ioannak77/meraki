"use client";

import { GroceriesView } from "@/components/groceries/Groceries";
import { useGroceries } from "@/lib/groceriesStore";
import { useNow } from "@/lib/useNow";

export default function GroceriesPage() {
  const { ready } = useGroceries();
  const now = useNow();
  if (!ready) return null;
  return <GroceriesView now={now} />;
}
