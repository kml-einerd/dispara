import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0';
  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';

  try {
    // Log the click and get the redirect URL
    const res = await fetch(`${API_BASE}/links/${code}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip,
        user_agent: userAgent,
        referer,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.redirect_url) {
        return NextResponse.redirect(data.redirect_url, 302);
      }
    }

    // If click logging failed, try to get the link directly for redirect
    const fallback = await fetch(`${API_BASE}/links/${code}`);
    if (fallback.ok) {
      const { link } = await fallback.json();
      if (link?.affiliate_url) {
        return NextResponse.redirect(link.affiliate_url, 302);
      }
    }
  } catch (err) {
    console.error(`[LinkSpot] Error redirecting code=${code}:`, err);
  }

  // Ultimate fallback: 404
  return new NextResponse('Link not found', { status: 404 });
}
