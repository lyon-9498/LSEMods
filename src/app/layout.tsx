import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { HashRedirect } from "@/components/HashRedirect";
import { Providers } from "@/components/Providers";
import { getMeta } from "@/lib/data";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "LSEmods",
    template: "%s · LSEmods",
  },
  description:
    "Unofficial LSE course catalogue and degree planner. Frontend-only — plan in your browser.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lsemods.com"),
};

const themeBoot = `(function(){try{var k='lsemods-theme';var t=localStorage.getItem(k);var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session: string | undefined;
  try {
    const meta = await getMeta();
    session = meta.session;
  } catch {
    session = undefined;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body
        className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable} antialiased`}
      >
        <Providers>
          <HashRedirect />
          <AppShell session={session}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
