import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: marketing site, auth pages, the guest join/track flow, and
// the Clerk webhook (which authenticates via svix signature, not a session).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join(.*)",
  "/track(.*)",
  "/businesses(.*)/queues(.*)/join(.*)",
  "/businesses(.*)/queues(.*)/ticket(.*)",
  "/businesses(.*)/queues(.*)/display(.*)",
  "/api/join(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
