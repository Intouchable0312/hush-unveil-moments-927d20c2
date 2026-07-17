import { useEffect, useMemo, useRef, useState } from "react";
import { AsYouType, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { ChevronDown, Search } from "lucide-react";

const COUNTRIES: { code: CountryCode; flag: string; name: string }[] = [
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "BE", flag: "🇧🇪", name: "Belgique" },
  { code: "CH", flag: "🇨🇭", name: "Suisse" },
  { code: "LU", flag: "🇱🇺", name: "Luxembourg" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "US", flag: "🇺🇸", name: "États-Unis" },
  { code: "GB", flag: "🇬🇧", name: "Royaume-Uni" },
  { code: "DE", flag: "🇩🇪", name: "Allemagne" },
  { code: "ES", flag: "🇪🇸", name: "Espagne" },
  { code: "IT", flag: "🇮🇹", name: "Italie" },
  { code: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "NL", flag: "🇳🇱", name: "Pays-Bas" },
  { code: "IE", flag: "🇮🇪", name: "Irlande" },
  { code: "PL", flag: "🇵🇱", name: "Pologne" },
  { code: "RO", flag: "🇷🇴", name: "Roumanie" },
  { code: "MA", flag: "🇲🇦", name: "Maroc" },
  { code: "DZ", flag: "🇩🇿", name: "Algérie" },
  { code: "TN", flag: "🇹🇳", name: "Tunisie" },
  { code: "SN", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "AU", flag: "🇦🇺", name: "Australie" },
  { code: "BR", flag: "🇧🇷", name: "Brésil" },
  { code: "MX", flag: "🇲🇽", name: "Mexique" },
  { code: "JP", flag: "🇯🇵", name: "Japon" },
];

type Props = {
  value: string; // E.164 (+33...)
  onChange: (v: string) => void;
  className?: string;
};

export function PhoneInput({ value, onChange, className }: Props) {
  const [country, setCountry] = useState<CountryCode>("FR");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [display, setDisplay] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const info = useMemo(() => COUNTRIES.find((c) => c.code === country)!, [country]);
  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase())),
    [q]
  );

  const handleType = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const formatter = new AsYouType(country);
    const formatted = formatter.input(digits);
    setDisplay(formatted);
    const nb = formatter.getNumber();
    onChange(nb ? nb.number : "+" + getCountryCallingCode(country) + digits);
  };

  const pickCountry = (c: CountryCode) => {
    setCountry(c);
    setOpen(false); setQ("");
    // reformat existing digits under new country
    const digits = display.replace(/\D/g, "");
    const formatter = new AsYouType(c);
    const formatted = formatter.input(digits);
    setDisplay(formatted);
    const nb = formatter.getNumber();
    onChange(nb ? nb.number : "+" + getCountryCallingCode(c) + digits);
  };

  return (
    <div ref={rootRef} className={`relative flex items-stretch rounded-2xl border border-border bg-card ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-l-2xl border-r border-border px-3 py-3 text-sm hover:bg-secondary"
      >
        <span className="text-lg leading-none">{info.flag}</span>
        <span className="tabular-nums text-muted-foreground">+{getCountryCallingCode(country)}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      <input
        type="tel"
        inputMode="tel"
        placeholder="Téléphone"
        className="min-w-0 flex-1 bg-transparent px-4 py-3 tabular-nums outline-none"
        value={display}
        onChange={(e) => handleType(e.target.value)}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input autoFocus placeholder="Rechercher un pays" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                onClick={() => pickCountry(c.code)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary ${c.code === country ? "bg-secondary" : ""}`}
              >
                <span className="text-lg">{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground">+{getCountryCallingCode(c.code)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
