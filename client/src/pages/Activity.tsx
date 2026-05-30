import React from "react";
import { ActivityFeed } from "../components/ActivityFeed";

export default function Activity() {
  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Global Activity Feed</h1>
        <p className="text-base-content/70">
          Real-time logs of the automated crank executing triggers and moving
          funds across protocols.
        </p>
      </div>

      <div className="bg-base-100 shadow-xl rounded-box p-6 border border-base-300">
        <ActivityFeed />
      </div>
    </div>
  );
}
