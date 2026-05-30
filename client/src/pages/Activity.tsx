import { ActivityFeed } from "../components/ActivityFeed";

export default function Activity() {
  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 transition-opacity duration-200">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Global Activity Feed
        </h1>
        <p className="text-secondary text-sm">
          Real-time logs of the automated crank executing triggers and moving
          funds across protocols.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <ActivityFeed />
      </div>
    </div>
  );
}
