import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    httpOnly: true  // 서버에서만 읽히는 쿠키
  }))

  return NextResponse.json({ cookies: allCookies })
}