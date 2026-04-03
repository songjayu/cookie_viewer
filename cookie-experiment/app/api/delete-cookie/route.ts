import { NextResponse } from 'next/server'

export async function DELETE(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const cookieName = searchParams.get('name')

  if (!cookieName) {
    return NextResponse.json({ message: '쿠키 이름 없음' }, { status: 400 })
  }

  const response = NextResponse.json({ 
    message: `${cookieName} 삭제했음` 
  })

  response.cookies.set(cookieName, '', {
    maxAge: 0,
    expires: new Date(0)
  })

  return response
}