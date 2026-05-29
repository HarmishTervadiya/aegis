import { Link, useLocation }       from "react-router-dom";
import { WalletMultiButton }       from "@solana/wallet-adapter-react-ui";

const links = [
  { to: "/",          label: "Dashboard" },
  { to: "/deposit",   label: "Deposit"   },
  { to: "/portfolio", label: "Portfolio" },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-primary font-semibold tracking-tight">
            Aegis
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`
                  px-3 py-1.5 rounded-md text-sm transition-colors
                  ${pathname === to
                    ? "text-primary bg-bg"
                    : "text-secondary hover:text-primary"}
                `}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <WalletMultiButton />
      </div>
    </nav>
  );
}
