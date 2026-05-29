import { useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";

interface Props {
  onClick: () => Promise<string | void>; // returns tx signature or void
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function TxButton({
  onClick,
  children,
  disabled,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const sig = await onClick();
      if (sig) {
        toast.success(
          <span>
            Transaction confirmed.{" "}
            <a
              href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View
            </a>
          </span>,
        );
      }
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || "Transaction failed";
      if (msg.includes("custom program error: 0x")) {
        const code = msg.match(/custom program error: (0x[0-9a-fA-F]+)/)?.[1];
        msg = `Contract Error ${code}. Check program logs.`;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={disabled || loading}
      className={`
        flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium text-sm
        bg-purple text-bg
        hover:bg-purple/90
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-150
        ${className || ""}
      `}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="30 70"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
