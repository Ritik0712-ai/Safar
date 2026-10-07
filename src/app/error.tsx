"use client";
import { Brand, Button, Banner } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="notice" id="main">
      <Brand />
      <h1>Let’s try that again.</h1>
      <Banner kind="error">
        This page could not load. Your saved rides and payments remain recorded.
      </Banner>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
