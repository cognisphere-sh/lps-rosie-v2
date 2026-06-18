import Link from "next/link";

// One app, multiple persona surfaces. Each is a route segment under app/;
// they share lib/ (harness client + data hooks) and components/.
const SURFACES = [
  { href: "/supplier/austin-plant-supply", label: "Supplier", note: "Austin Plant Supply — inventory, orders, customers", ready: true },
  { href: "/customer", label: "Customer", note: "Buyer-facing — quotes & orders", ready: false },
  { href: "/sourcer", label: "Sourcer", note: "Supplier sourcing", ready: false },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-xl font-semibold">LPS · Rosie</h1>
      <div className="grid gap-3">
        {SURFACES.map((s) =>
          s.ready ? (
            <Link
              key={s.href}
              href={s.href}
              className="rounded border border-neutral-200 bg-white p-4 hover:border-blue-400"
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-sm text-neutral-500">{s.note}</div>
            </Link>
          ) : (
            <div
              key={s.href}
              className="rounded border border-dashed border-neutral-200 p-4 text-neutral-400"
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-sm">{s.note} · coming soon</div>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
