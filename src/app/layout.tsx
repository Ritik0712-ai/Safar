import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import { DriverLocationProvider } from "@/components/location-provider";
import "./globals.css";
const inter = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2",
      weight: "600",
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Safar — Your city. Your journey.",
    template: "%s | Safar",
  },
  description:
    "A considered way to move through Bengaluru. Book an Economy ride, track your journey, and travel with a fixed fare. Controlled test-payment release.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AuthProvider>
          <DriverLocationProvider>{children}</DriverLocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
