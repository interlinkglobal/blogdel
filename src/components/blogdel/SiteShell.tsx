import { Link, useNavigate } from "@tanstack/react-router";
import { Download, Menu, Monitor, Moon, Search, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ThemeMode = "light" | "dark" | "system";
const THEME_KEY = "blogdel-theme";

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1a1a1a" : "#ffffff");
}

function useThemeMode() {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const initial: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    applyTheme(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(THEME_KEY) || "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
    applyTheme(mode);
  };
  return { theme, setTheme };
}

const NAV = [
  { slug: "technology", label: "Technology" },
  { slug: "health", label: "Health" },
  { slug: "sports", label: "Sports" },
  { slug: "politics", label: "Politics" },
  { slug: "entertainment", label: "Entertainment" },
  { slug: "business", label: "Business" },
  { slug: "science", label: "Science" },
  { slug: "education", label: "Education" },
  { slug: "food", label: "Food" },
  { slug: "history", label: "History" },
];

export function SiteHeader() {
  const { canInstall, installed, install } = usePwaInstall();
  const { theme, setTheme } = useThemeMode();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    setSearchQuery(initial);
    if (initial) requestAnimationFrame(() => searchInput.current?.focus());
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const navigateSearch = (value: string) => {
    const q = value.trim();
    navigate({
      to: "/blogs",
      search: q ? ({ q } as any) : ({} as any),
      replace: true,
    });
  };

  const updateSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigateSearch(value), 140);
  };

  const clearSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchQuery("");
    navigateSearch("");
    requestAnimationFrame(() => searchInput.current?.focus());
  };

  const clearHeaderSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchQuery("");
  };

  const handleInstall = async () => {
    const result = await install();
    if (result === "accepted") {
      toast.success("Blogdel installed.");
      return;
    }
    if (result === "dismissed") return;
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isAppleMobile) {
      toast("Install Blogdel from Safari", { description: "Tap Share, then Add to Home Screen." });
    } else {
      toast("Installation is not available yet", {
        description: "Your browser may already have Blogdel installed or may not support app installation.",
      });
    }
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between border-b border-border">
          <Link to="/" onClick={clearHeaderSearch} className="headline inline-flex items-center gap-2 text-3xl md:text-4xl" aria-label="Blogdel home">
            <img src="/blogdel-512x512.png" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain dark:invert md:h-9 md:w-9" />
            <span>Blogdel</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center border border-border bg-card transition-colors hover:border-foreground" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetHeader><SheetTitle className="headline text-3xl">Blogdel</SheetTitle></SheetHeader>
              <div className="mt-8">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Theme</div>
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5">
                  {([
                    ["light", "Light", Sun],
                    ["dark", "Dark", Moon],
                    ["system", "System", Monitor],
                  ] as const).map(([mode, label, Icon]) => (
                    <button key={mode} type="button" onClick={() => setTheme(mode)}
                      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${theme === mode ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                      aria-pressed={theme === mode}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>
              <nav className="mt-8 flex flex-col gap-1 text-base">
                <Link to="/blogs" onClick={clearHeaderSearch} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted/70">All articles</Link>
                <Link to="/about" className="rounded-lg px-3 py-2 transition-colors hover:bg-muted/70">About</Link>
                <Link to="/disclosure" className="rounded-lg px-3 py-2 transition-colors hover:bg-muted/70">AI disclosure</Link>
              </nav>
              {!installed && (
                <button type="button" onClick={handleInstall}
                  className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground">
                  <Download className="h-4 w-4" />{canInstall ? "Install Blogdel" : "Install app"}
                </button>
              )}
            </SheetContent>
          </Sheet>
        </div>

        <nav className="-mx-1 flex gap-2 overflow-x-auto border-b border-border px-1 py-3 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link to="/blogs" onClick={clearHeaderSearch} className="shrink-0 rounded-full border border-border bg-card px-3 py-2 font-medium hover:border-foreground">All</Link>
          {NAV.map((n) => (
            <Link key={n.slug} to="/blogs" search={{ category: n.slug } as any} onClick={clearHeaderSearch}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>

        <form
          className="flex gap-2 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchTimer.current) clearTimeout(searchTimer.current);
            navigateSearch(searchQuery);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search Blogdel</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInput}
              type="text"
              value={searchQuery}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder="Search article titles"
              autoComplete="off"
              className="h-10 w-full border border-border bg-card pl-9 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-foreground transition-opacity hover:opacity-60"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <button type="submit"
            className="h-10 shrink-0 border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground">Search</button>
        </form>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="headline text-2xl text-foreground">Blogdel</div>
            <p className="mt-2 max-w-md">Autonomous reporting and analysis from Interlink Media.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/disclosure" className="hover:text-foreground">AI disclosure</Link>
            <Link to="/blogs" className="hover:text-foreground">All articles</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-5 md:py-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
