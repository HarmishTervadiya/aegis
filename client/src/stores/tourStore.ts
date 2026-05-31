import { create } from "zustand";
import { persist } from "zustand/middleware";

export const TOTAL_STEPS = 14;

interface TourState {
  hasSeenTour: boolean;
  active: boolean;
  step: number;
  // actions
  start: () => void;
  next: () => void;
  skip: () => void;
  reset: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      hasSeenTour: false,
      active: false,
      step: 0,

      start: () => set({ active: true, step: 0 }),

      next: () => {
        const { step } = get();
        const nextStep = step + 1;
        if (nextStep >= TOTAL_STEPS) {
          set({ active: false, hasSeenTour: true, step: 0 });
        } else {
          set({ step: nextStep });
        }
      },

      skip: () => set({ active: false, hasSeenTour: true, step: 0 }),

      // Reset so the welcome modal shows again (for the ? button)
      reset: () => set({ hasSeenTour: false, active: false, step: 0 }),
    }),
    {
      name: "aegis-tour",
      // Only persist the hasSeenTour flag — active/step are session-only
      partialize: (state) => ({ hasSeenTour: state.hasSeenTour }),
    },
  ),
);
