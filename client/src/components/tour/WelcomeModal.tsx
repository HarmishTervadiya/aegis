import { useState, useEffect } from "react";
import { useTourStore } from "../../stores/tourStore";

const SLIDES = [
  {
    title: "Welcome to Aegis",
    subtitle: "Autonomous DeFi Yield Optimization",
    body: "Aegis monitors MarginFi and Kamino USDC lending pools in real time and automatically moves your funds to capture the best yield, all on-chain, all non-custodial.",
  },
  {
    title: "How Automated Yield Works",
    subtitle: "Set it. Forget it. Earn.",
    body: "You deposit USDC and configure two triggers: a Defense threshold (to protect from liquidity risk) and an Offense threshold (to chase higher yield). Aegis's crank fires automatically when either condition is met, no manual action needed.",
  },
  {
    title: "Ready to Get Started?",
    subtitle: "Your first deposit takes under a minute",
    body: "Head to the Deposit page to mint test USDC, initialize your vault, and activate your first automated trigger. Let's take a quick tour of the platform first!",
  },
];

export default function WelcomeModal() {
  const { hasSeenTour, skip, start, active } = useTourStore();
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasSeenTour) {
      // Small delay so the page renders before the modal pops
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [hasSeenTour]);

  if (hasSeenTour || active || !visible) return null;

  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  const handleNext = () => {
    if (isLast) {
      console.log("[WelcomeModal] isLast is true, calling start()");
      setVisible(false);
      setTimeout(() => start(), 300);
    } else {
      setSlide((s) => s + 1);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    skip();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-purple via-marginfi to-kamino" />

        <div className="p-8">

          {/* Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-primary mb-1">
              {current.title}
            </h2>
            <p className="text-sm text-purple mb-4">{current.subtitle}</p>
            <p className="text-sm text-secondary leading-relaxed">{current.body}</p>
          </div>

          {/* Slide dots */}
          <div className="flex justify-center gap-2 mb-8">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === slide ? "w-8 bg-purple" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-muted hover:text-secondary transition-colors"
            >
              Skip tutorial
            </button>

            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-purple text-bg text-sm font-medium rounded-lg hover:bg-purple/80 transition-colors"
            >
              {isLast ? "Start Tour" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
