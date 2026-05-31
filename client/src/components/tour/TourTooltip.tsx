import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useTourStore, TOTAL_STEPS } from "../../stores/tourStore";
import { TOUR_STEPS } from "./tourSteps";

interface TooltipPos {
  top: number;
  left: number;
  transform: string;
  arrowSide: "top" | "bottom" | "left" | "right";
}

function getPosition(el: Element, position: string): TooltipPos {
  const rect = el.getBoundingClientRect();
  const GAP = 16;
  const tooltipW = Math.min(320, window.innerWidth - 16);
  
  // Horizontally center with the element, but keep inside viewport boundaries
  const centerLeft = Math.min(
    Math.max(rect.left + rect.width / 2 - tooltipW / 2, 8),
    window.innerWidth - tooltipW - 8
  );
  const tooltipH = 200; // Estimated height

  // If the target element is massive (e.g. a long list), pin the tooltip in the viewport so it doesn't get lost
  if (rect.height > Math.max(window.innerHeight, 800)) {
    return {
      top: window.scrollY + 120, // 120px down from the top of the screen
      left: centerLeft,
      transform: "none",
      arrowSide: "top",
    };
  }

  let finalPosition = position;

  // Flip vertical positions if they overflow the viewport
  if (position === "top" && rect.top - GAP - tooltipH < 0) {
    finalPosition = "bottom";
  } else if (position === "bottom" && rect.bottom + GAP + tooltipH > window.innerHeight) {
    finalPosition = "top";
  }

  switch (finalPosition) {
    case "bottom":
      return {
        top: rect.bottom + GAP + window.scrollY,
        left: centerLeft,
        transform: "none",
        arrowSide: "top",
      };
    case "top":
      return {
        top: rect.top - GAP + window.scrollY,
        left: centerLeft,
        transform: "translateY(-100%)",
        arrowSide: "bottom",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 + window.scrollY,
        left: rect.right + GAP,
        transform: "translateY(-50%)",
        arrowSide: "left",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 + window.scrollY,
        left: rect.left - GAP,
        transform: "translate(-100%, -50%)",
        arrowSide: "right",
      };
    default:
      return { top: rect.bottom + GAP + window.scrollY, left: centerLeft, transform: "none", arrowSide: "top" };
  }
}

export default function TourTooltip() {
  const { active, step, next, skip } = useTourStore();
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const initStepRef = useRef<number>(-1);
  const navigate = useNavigate();
  const location = useLocation();

  const currentStep = TOUR_STEPS[step];
  console.log("[TourTooltip] Render. Active:", active, "Step:", step, "Pos:", pos);

  const reposition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.id}"]`);
    console.log("[TourTooltip] Repositioning step", currentStep.id, "Found element?", !!el);
    setTargetEl(el);
    if (el) {
      setPos(getPosition(el, currentStep.position));
      
      // Only scroll and focus once when the step first appears
      if (initStepRef.current !== step) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof (el as HTMLElement).focus === "function") {
          (el as HTMLElement).focus({ preventScroll: true });
        }
        initStepRef.current = step;
      }
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

  // Reposition after navigation settles and keep retrying if not found
  useEffect(() => {
    if (!active || !currentStep) return;
    
    // Initial attempt
    const t = setTimeout(reposition, 350);
    
    let attempts = 0;
    // Keep trying every 500ms
    const interval = setInterval(() => {
      const el = document.querySelector(`[data-tour="${currentStep.id}"]`);
      if (el) {
        reposition();
      } else {
        attempts++;
        if (attempts > 1) {
          console.log(`[TourTooltip] Step ${currentStep.id} not found after 0.5s. Auto-skipping.`);
          next();
        }
      }
    }, 500);
    
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [active, step, location.pathname, reposition, currentStep, next]);

  // Reposition on resize and scroll for perfectly smooth tracking
  useEffect(() => {
    if (!active) return;
    const observer = new ResizeObserver(reposition);
    observer.observe(document.body);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
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

  if (!active || !currentStep || !pos) {
    console.log("[TourTooltip] Returning null because:", { active, hasCurrentStep: !!currentStep, hasPos: !!pos });
    return null;
  }

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
        className="absolute z-[9999] bg-surface border border-purple/40 rounded-xl shadow-2xl p-5 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ 
          top: pos.top, 
          left: pos.left, 
          transform: pos.transform,
          width: "320px",
          maxWidth: "calc(100vw - 16px)"
        }}
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
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 bg-purple text-bg text-sm font-medium rounded-lg hover:bg-purple/80 transition-colors"
          >
            {step === TOTAL_STEPS - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
