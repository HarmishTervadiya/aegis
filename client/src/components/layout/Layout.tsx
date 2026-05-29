import type { ReactNode } from "react";
import Navbar        from "./Navbar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-primary">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
