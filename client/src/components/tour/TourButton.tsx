import { useTourStore } from "../../stores/tourStore";

export default function TourButton() {
  const { active, reset } = useTourStore();

  if (active) return null;

  return (
    <button
      onClick={reset}
      title="Replay tour"
      className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-surface border border-border text-secondary hover:text-primary hover:border-purple/50 shadow-lg transition-all duration-200 flex items-center justify-center text-lg font-semibold hover:scale-110"
    >
      ?
    </button>
  );
}
