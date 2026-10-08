"use client";
import { firebase } from "@/lib/firebase/client";
export async function downloadReceipt(id: string) {
  const token = await firebase()?.auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to download your receipt.");
  const res = await fetch(`/api/rides/${encodeURIComponent(id)}/receipt`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Receipt download failed. Please try again.");
  const url = URL.createObjectURL(await res.blob()),
    link = document.createElement("a");
  link.href = url;
  link.download = `safar-TEST-${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
