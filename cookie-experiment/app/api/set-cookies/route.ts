import { NextResponse } from 'next/server'

export async function GET(): Promise<NextResponse> {
  const response = NextResponse.json({ 
    message: '쿠키 심었음 😇' 
  })

  // 2년짜리 장기 추적
  response.cookies.set('totally_not_tracking_you', 'user_xyz_12345', {
    maxAge: 60 * 60 * 24 * 365 * 2,
    sameSite: 'none',
    secure: true,
    httpOnly: false
  })

  // 400일 초과 cross-site
  response.cookies.set('just_a_friendly_cookie', 'ga_abc_9876', {
    maxAge: 60 * 60 * 24 * 400,
    sameSite: 'none',
    secure: true,
    httpOnly: false
  })

  // Secure 없는 불안전한 쿠키
  response.cookies.set('nothing_suspicious_here', 'sess_insecure_999', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: false,
    httpOnly: false
  })

  // 그나마 안전한 쿠키
  response.cookies.set('i_pinky_promise_im_necessary', 'tok_server_only_777', {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'strict',
    secure: true,
    httpOnly: true
  })

  // 이름 패턴 없는 의심 쿠키
  response.cookies.set('xqz_a7f2k9_definitely_functional', 'rnd_8472930', {
    maxAge: 60 * 60 * 24 * 365 * 2,
    sameSite: 'none',
    secure: true,
    httpOnly: false
  })

  // 세션인 척하는 장기 쿠키
  response.cookies.set('session_wink_wink', 'not_really_a_session', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'none',
    secure: true,
    httpOnly: false
  })

  return response
}