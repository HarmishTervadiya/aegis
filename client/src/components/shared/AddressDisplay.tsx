import { useState } from "react";
import { truncateAddress } from "../../lib/format";

export default function AddressDisplay({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="font-mono text-sm text-secondary hover:text-primary transition-colors"
      title={address}
    >
      {copied ? "Copied!" : truncateAddress(address)}
    </button>
  );
}
