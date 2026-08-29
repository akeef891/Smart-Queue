import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";

const businesses = [
  "Clinics",
  "Hospitals",
  "Salons",
  "Restaurants",
  "Banks",
  "Government Offices",
  "Diagnostic Centers",
  "Tuition Centers",
];
        
export default function LandingPage() {
  return (
    <div>
      <nav className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">Smart Queue</span>
        <div className="flex gap-3 text-sm">
          <SignedOut>
            <SignInButton fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard">
              <button type="button" className="px-3 py-2">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard">
              <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-white">
                Get Started
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="rounded-md bg-slate-900 px-4 py-2 text-white">
              Dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
          Skip the physical line.
          <br /> Join the queue digitally.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Smart Queue replaces manual waiting lines with digital tokens, live position
          tracking, and real-time wait estimates — for any business that manages a queue.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <SignedOut>
            <SignUpButton fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard">
              <button type="button" className="rounded-md bg-slate-900 px-6 py-3 text-white">
                Get Started
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="rounded-md bg-slate-900 px-6 py-3 text-white">
              Go to Dashboard
            </Link>
          </SignedIn>
          <a href="#how-it-works" className="rounded-md border px-6 py-3">
            See How It Works
          </a>
        </div>
      </section>

      <section id="how-it-works" className="border-t bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold">How It Works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              ["Join", "Customer scans a QR code or link to join the queue."],
              ["Token", "A digital token and live position are issued instantly."],
              ["Track", "Customers track their status from their phone."],
              ["Serve", "Staff call, serve, and complete customers from one dashboard."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-lg border bg-white p-5">
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">Built for every waiting line</h2>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {businesses.map((b) => (
            <div key={b} className="rounded-md border px-4 py-3 text-center text-sm">
              {b}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Smart Queue
      </footer>
    </div>
  );
}
