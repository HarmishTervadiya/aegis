import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useTourStore, TOTAL_STEPS } from "../../stores/tourStore";
import { TOUR_STEPS } from "./tourSteps";

interface TooltipPos {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

function getPosition(el: Element, position: string): TooltipPos {
  const rect = el.getBoundingClientRect();
  const GAP = 16;
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 180;

  switch (position) {
    case "bottom":
      return {
        top: rect.bottom + GAP + window.scrollY,
        left: Math.min(
          Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 8),
          window.innerWidth - TOOLTIP_W - 8,
        ),
        arrowSide: "top",
      };
    case "top":
      return {
        top: rect.top - TOOLTIP_H - GAP + window.scrollY,
        left: Math.min(
          Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 8),
          window.innerWidth - TOOLTIP_W - 8,
        ),
        arrowSide: "bottom",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 - TOOLTIP_H / 2 + window.scrollY,
        left: rect.right + GAP,
        arrowSide: "left",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 - TOOLTIP_H / 2 + window.scrollY,
        left: rect.left - TOOLTIP_W - GAP,
        arrowSide: "right",
      };
    default:
      return { top: rect.bottom + GAP + window.scrollY, left: rect.left, arrowSide: "top" };
  }
}

export default function TourTooltip() {
  const { active, step, next, skip } = useTourStore();
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const currentStep = TOUR_STEPS[step];

  const reposition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.id}"]`);
    setTargetEl(el);
    if (el) {
      setPos(getPosition(el, currentStep.position));
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setPos(null);
    }
  }, [currentStep]);

  // Navigate to correct page when step changes
  useEffect(() => {
    if (!active || !currentStep) return;
    if (location.pathname !== currentStep.page) {
      navigate(currentStep.page);
    }
  }, [active, step, currentStep?.page]);

  // Reposition after navigation settles
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(reposition, 350);
    return () => clearTimeout(t);
  }, [active, step, location.pathname, reposition]);

  // Reposition on resize
  useEffect(() => {
    if (!active) return;
    const observer = new ResizeObserver(reposition);
    observer.observe(document.body);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  }, [active, reposition]);

  // Highlight target element
  useEffect(() => {
    if (targetEl) {
      (targetEl as HTMLElement).style.position = "relative";
      (targetEl as HTMLElement).style.zIndex = "51";
      (targetEl as HTMLElement).style.boxShadow = "0 0 0 4px rgba(167,139,250,0.4)";
      (targetEl as HTMLElement).style.borderRadius = "12px";
      return () => {
        (targetEl as HTMLElement).style.position = "";
        (targetEl as HTMLElement).style.zIndex = "";
        (targetEl as HTMLElement).style.boxShadow = "";
        (targetEl as HTMLElement).style.borderRadius = "";
      };
    }
  }, [targetEl]);

  if (!active || !currentStep || !pos) return null;

  const arrowStyles: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-border",
    bottom: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-border",
    left: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-border",
    right: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-border",
  };

  return createPortal(
    <>
      {/* Dimming overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 pointer-events-none" />

      {/* Tooltip card */}
      <div
        className="fixed z-50 w-80 bg-surface border border-purple/40 rounded-xl shadow-2xl p-5"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-0 h-0 border-8 ${arrowStyles[pos.arrowSide]}`}
          style={{ borderColor: "transparent" }}
        />

        {/* Step counter */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-purple font-medium tracking-wide uppercase">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          {/* Progress bar */}
          <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-purple rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <h3 className="text-base font-semibold text-primary mb-1.5">
          {currentStep.title}
        </h3>
        <p className="text-sm text-secondary leading-relaxed mb-5">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={skip}
            className="text-xs text-muted hover:text-secondary transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 bg-purple text-bg text-sm font-medium rounded-lg hover:bg-purple/80 transition-colors"
          >
            {step === TOTAL_STEPS - 1 ? "Finish ✓" : "Next →"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
