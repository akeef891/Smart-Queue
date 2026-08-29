import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "Smart Queue — Skip the physical line",
  description: "Digital queue management for clinics, salons, restaurants, banks and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      <html lang="en">
        <body className="antialiased bg-white text-slate-900">{children}</body>
      </html>
    </ClerkProvider>
  );
}
