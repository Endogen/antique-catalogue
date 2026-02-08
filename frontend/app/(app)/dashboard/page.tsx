import Link from "next/link";

import { Button } from "@/components/ui/button";

const insights = [
  {
    title: "Collections",
    value: "0",
    detail: "Drafted but unpublished"
  },
  {
    title: "Items",
    value: "0",
    detail: "Awaiting first upload"
  },
  {
    title: "Images",
    value: "0",
    detail: "Ready for camera capture"
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
          Getting started
        </p>
        <h1 className="font-display mt-4 text-3xl text-stone-900">
          Your archive is ready for its first collection.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          Create a collection to define your metadata schema, then begin adding
          items and imagery. Everything stays organized in one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/collections/new">Create collection</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/explore">Browse public collections</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {insights.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-stone-200 bg-white/70 p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              {item.title}
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {item.value}
            </p>
            <p className="mt-2 text-sm text-stone-500">{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            Next steps
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            Shape your schema, then invite the team.
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Define the fields that matter most for your collection. Once you are
            ready, share access with collaborators and start capturing items.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <Link href="/collections/new">Build a schema</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/settings">Configure profile</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Studio checklist
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Sketch your first collection story.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Prepare a lighting setup for mobile photos.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Invite a collaborator when you are ready.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
