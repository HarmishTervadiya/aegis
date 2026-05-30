import { Link, useLocation } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/deposit", label: "Deposit" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/activity", label: "Activity" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { publicKey } = useWallet();
  const { authed, checking, login, logout } = useAuth();
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    const key = publicKey?.toBase58() ?? null;

    // Wait until the cookie validity check resolves before acting
    if (checking) return;

    if (key && key !== prevKey.current && !authed) {
      // Wallet just connected — sign-in automatically
      login();
    }

    if (!key && prevKey.current) {
      // Wallet disconnected — clear cookie
      logout();
    }

    prevKey.current = key;
  }, [publicKey, authed, login, logout]);

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-primary font-semibold tracking-tight">
            Aegis
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ to, label }) => {
              const isActive = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`
                    relative px-3 py-1.5 text-sm transition-colors duration-150
                    ${isActive ? "text-primary" : "text-secondary hover:text-primary"}
                  `}
                >
                  {label}
                  {/* Smooth underline indicator for active route */}
                  <span
                    className={`
                      absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-purple
                      transition-all duration-200
                      ${isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}
                    `}
                    style={{ transformOrigin: "center" }}
                  />
                </Link>
              );
            })}
          </div>
        </div>
        <WalletMultiButton />
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-3 gap-4 border-t border-border/50">
        {links.map(({ to, label }) => {
          const isActive = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`
                whitespace-nowrap px-3 py-1.5 text-sm rounded-full transition-colors duration-150
                ${
                  isActive
                    ? "bg-purple/10 text-primary"
                    : "text-secondary hover:text-primary"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
