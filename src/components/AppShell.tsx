"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  HeartHandshake,
  MessagesSquare,
  Info,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/builder", label: "Course Builder", icon: CalendarRange },
  { href: "/community", label: "Community", icon: MessagesSquare },
  { href: "/support", label: "Support us", icon: HeartHandshake },
];

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: string;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-night">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mint focus:px-3 focus:py-2 focus:text-mint-fg"
      >
        Skip to content
      </a>

      <header className="band-grid sticky top-0 z-40 text-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 lg:h-16 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
                  active(href)
                    ? "bg-white/14 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/about"
              aria-current={active("/about") ? "page" : undefined}
              className={cn(
                "ml-1 inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm",
                active("/about")
                  ? "bg-white/14 text-white"
                  : "text-white/70 hover:text-white",
              )}
            >
              <Info className="size-4" aria-hidden />
              About
            </Link>
          </nav>
          <div className="flex items-center gap-1">
            {session ? (
              <p className="hidden font-data text-xs text-white/70 tabular sm:block">{session}</p>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-6 lg:px-8 lg:pb-8">
        {children}
      </main>

      <footer className="footer-pad w-full border-t border-line bg-surface px-4 pt-5 text-sm text-muted lg:px-8 lg:pb-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-semibold text-night">Disclaimer:</span> LSEmods is unofficial
            and not affiliated with LSE or LSESU. Details here can be incomplete or out of date —
            always check the{" "}
            <a
              className="text-violet underline underline-offset-2 hover:text-indigo"
              href="https://www.lse.ac.uk/resources/calendar"
              target="_blank"
              rel="noreferrer"
            >
              official LSE Calendar
            </a>{" "}
            before you choose modules.
          </p>
          <Link
            href="/about"
            className="inline-flex min-h-11 shrink-0 items-center text-violet underline underline-offset-2 hover:text-indigo"
          >
            About &amp; sources
          </Link>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 w-full border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Mobile"
      >
        <ul className="grid w-full grid-cols-4">
          {links.map(({ href, label, icon: Icon }) => {
            const short =
              href === "/builder"
                ? "Builder"
                : href === "/support"
                  ? "Support"
                  : label;
            return (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                    active(href) ? "text-indigo" : "text-muted",
                  )}
                  aria-current={active(href) ? "page" : undefined}
                  aria-label={label}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="max-w-full truncate" aria-hidden>
                    {short}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
