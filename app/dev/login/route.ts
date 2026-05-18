import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Dev-only quick sign-in. Bypasses the magic-link email step.
 *
 * Usage:  http://localhost:3000/dev/login?email=cam@overlandbuilders.com.au
 *
 * - Hard-blocks in production (NODE_ENV check)
 * - Uses admin.generateLink to mint a one-time OTP for the email
 * - Verifies the OTP via the user-scoped client, which writes the auth
 *   cookies to the response — same session state as a normal magic link
 * - Redirects to /team
 *
 * Safe to leave in the repo; route returns 404 in prod.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available in production", { status: 404 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) {
    return new NextResponse(
      'Pass ?email=you@example.com — e.g. /dev/login?email=cam@overlandbuilders.com.au',
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkErr || !linkData?.properties?.email_otp) {
    return new NextResponse(
      `Failed to generate sign-in token: ${linkErr?.message ?? "no email_otp returned"}`,
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "email",
  });

  if (verifyErr) {
    return new NextResponse(
      `verifyOtp failed: ${verifyErr.message}`,
      { status: 500 },
    );
  }

  return NextResponse.redirect(new URL("/team", url.origin));
}
