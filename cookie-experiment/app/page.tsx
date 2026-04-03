'use client'

import { useState, useEffect, useRef } from 'react'

interface CookieInfo {
  name: string
  value: string
  httpOnly?: boolean
}

interface Petal {
  id: number
  x: number
  size: number
  duration: number
  delay: number
  rotation: number
  drift: number
  opacity: number
}

interface BurstPetal {
  id: string
  bx: number
  by: number
  br: number
  delay: number
}

interface BurstPos {
  x: number
  y: number
  id: number
}

const PETALS: Petal[] = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  x: (i * 2.94) % 100,
  size: 8 + (i * 0.51) % 16,
  duration: 6 + (i * 0.29) % 10,
  delay: (i * 0.37) % 12,
  rotation: (i * 10.3) % 360,
  drift: ((i * 7.3) % 250) - 125,
  opacity: 0.3 + (i * 0.014) % 0.5,
}))

export default function Home() {
  const [cookies, setCookies] = useState<CookieInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingCookie, setDeletingCookie] = useState<string | null>(null)
  const [justSet, setJustSet] = useState(false)
  const [hoveredCookie, setHoveredCookie] = useState<string | null>(null)
  const [expandedCookie, setExpandedCookie] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [petalBurst, setPetalBurst] = useState<BurstPos | null>(null)
  const [burstPetals, setBurstPetals] = useState<BurstPetal[]>([])
  const burstCounter = useRef(0)
  const fetchCookies = async (): Promise<void> => {
  const jsCookies = document.cookie
    .split(';')
    .map(c => c.trim())
    .filter(c => c !== '')
    .map(c => {
      const [name, ...rest] = c.split('=')
      return { name: name.trim(), value: rest.join('=').trim(), httpOnly: false }
    })

  const res = await fetch('/api/check-cookies')
  const data = await res.json()
  const jsNames = new Set(jsCookies.map((c: CookieInfo) => c.name))
  const httpOnlyCookies = data.cookies
    .filter((c: CookieInfo) => !jsNames.has(c.name))
    .map((c: CookieInfo) => ({ ...c, httpOnly: true }))

  setCookies([...jsCookies, ...httpOnlyCookies])
}

useEffect(() => {
  const init = async () => {
    await fetchCookies()
  }
  init()

  const handleMouseMove = (e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }
  window.addEventListener('mousemove', handleMouseMove)
  return () => window.removeEventListener('mousemove', handleMouseMove)
}, [])


  const setCookiesFn = async (e: React.MouseEvent): Promise<void> => {
    burstCounter.current += 1
    const id = burstCounter.current

    const newBurstPetals: BurstPetal[] = Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * 360
      const dist = 60 + (i * 7.3) % 120
      return {
        id: `${id}-${i}`,
        bx: Math.cos(angle * Math.PI / 180) * dist,
        by: Math.sin(angle * Math.PI / 180) * dist,
        br: (i * 60) % 720,
        delay: (i * 0.008),
      }
    })

    setPetalBurst({ x: e.clientX, y: e.clientY, id })
    setBurstPetals(newBurstPetals)
    setTimeout(() => {
      setPetalBurst(null)
      setBurstPetals([])
    }, 1000)

    setIsLoading(true)
    await fetch('/api/set-cookies')
    await fetchCookies()
    setIsLoading(false)
    setJustSet(true)
    setTimeout(() => setJustSet(false), 2500)
  }

  const deleteCookie = async (name: string): Promise<void> => {
    setDeletingCookie(name)
    await fetch(`/api/delete-cookie?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    setTimeout(async () => {
      await fetchCookies()
      setDeletingCookie(null)
    }, 500)
  }

  const getRiskLevel = (cookie: CookieInfo): 'safe' | 'warn' | 'danger' => {
    const name = cookie.name.toLowerCase()
    if (cookie.httpOnly) return 'safe'
    if (name.includes('track') || name.includes('analytics') || name.includes('session_wink')) return 'danger'
    if (name.includes('xqz') || name.includes('suspicious') || name.includes('friendly')) return 'warn'
    return 'safe'
  }

  const riskConfig = {
    safe: { label: '안전', color: '#4caf8a', bg: 'rgba(76,175,138,0.1)', border: 'rgba(76,175,138,0.3)', emoji: '✅' },
    warn: { label: '의심', color: '#e8a838', bg: 'rgba(232,168,56,0.1)', border: 'rgba(232,168,56,0.3)', emoji: '⚠️' },
    danger: { label: '위험', color: '#e85454', bg: 'rgba(232,84,84,0.1)', border: 'rgba(232,84,84,0.3)', emoji: '🚨' },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Noto+Serif+KR:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #fdf6f0;
          min-height: 100vh;
          overflow-x: hidden;
          cursor: none;
        }

        .scene {
          min-height: 100vh;
          background: linear-gradient(160deg, #fff5f7 0%, #fdeef5 30%, #fdf0e8 60%, #fef9f0 100%);
          position: relative;
          overflow: hidden;
        }

        .petal {
          position: fixed;
          top: -60px;
          pointer-events: none;
          z-index: 0;
          animation: falling linear infinite;
        }

        .petal svg { animation: spin linear infinite; }

        @keyframes falling {
          0% { transform: translateY(-60px) translateX(0px); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 0.7; }
          100% { transform: translateY(110vh) translateX(var(--drift)); opacity: 0; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .burst-petal {
          position: fixed;
          pointer-events: none;
          z-index: 9998;
          animation: burst 1s ease-out forwards;
        }

        @keyframes burst {
          0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--bx), var(--by)) scale(1) rotate(var(--br)); opacity: 0; }
        }

        .content {
          position: relative;
          z-index: 1;
          max-width: 740px;
          margin: 0 auto;
          padding: 80px 32px 120px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,182,193,0.3);
          border: 1px solid rgba(255,150,170,0.3);
          border-radius: 100px;
          padding: 6px 16px;
          font-family: 'Noto Serif KR', serif;
          font-size: 12px;
          color: #c4607a;
          letter-spacing: 0.05em;
          margin-bottom: 28px;
          animation: fadeDown 0.6s ease both;
        }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          font-weight: 600;
          color: #2d1a22;
          line-height: 1.2;
          margin-bottom: 12px;
          animation: fadeDown 0.6s 0.1s ease both;
        }

        h1 em { font-style: italic; color: #c4607a; }

        .subtitle {
          font-family: 'Noto Serif KR', serif;
          font-weight: 300;
          font-size: 14px;
          color: #9a7a85;
          margin-bottom: 48px;
          line-height: 1.9;
          animation: fadeDown 0.6s 0.2s ease both;
        }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #e8708a 0%, #d4547a 100%);
          color: white;
          border: none;
          border-radius: 100px;
          padding: 16px 36px;
          font-family: 'Noto Serif KR', serif;
          font-size: 14px;
          cursor: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 8px 24px rgba(212,84,122,0.3);
          animation: fadeDown 0.6s 0.3s ease both;
        }

        .btn-primary:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 14px 36px rgba(212,84,122,0.45);
        }

        .btn-primary:active { transform: translateY(0) scale(0.97); }
        .btn-primary:disabled { opacity: 0.7; cursor: none; transform: none; }

        .success-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(76,175,138,0.12);
          border: 1px solid rgba(76,175,138,0.3);
          border-radius: 100px;
          padding: 8px 18px;
          font-family: 'Noto Serif KR', serif;
          font-size: 12px;
          color: #4caf8a;
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }

        .stats-bar {
          display: flex;
          gap: 12px;
          margin: 40px 0 24px;
          flex-wrap: wrap;
        }

        .stat-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 100px;
          font-family: 'Noto Serif KR', serif;
          font-size: 12px;
          border: 1px solid;
          animation: fadeDown 0.4s ease both;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,84,122,0.2), transparent);
          margin: 0 0 32px;
        }

        .cookie-list { display: flex; flex-direction: column; gap: 10px; }

        .cookie-card {
          background: rgba(255,255,255,0.85);
          border-radius: 18px;
          backdrop-filter: blur(16px);
          transition: all 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
          animation: slideIn 0.4s cubic-bezier(0.34, 1.3, 0.64, 1) both;
          overflow: hidden;
          border: 1px solid rgba(255,182,193,0.25);
          cursor: none;
        }

        .cookie-card:hover {
          transform: translateX(6px) translateY(-2px);
          box-shadow: 0 8px 28px rgba(212,84,122,0.12);
        }

        .cookie-card.deleting {
          opacity: 0;
          transform: translateX(30px) scale(0.94);
          transition: all 0.5s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        .cookie-main {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
        }

        .cookie-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .cookie-card:hover .cookie-icon { transform: rotate(-8deg) scale(1.1); }

        .cookie-info { flex: 1; min-width: 0; }

        .cookie-name {
          font-family: 'Playfair Display', serif;
          font-size: 13px;
          font-weight: 600;
          color: #2d1a22;
          margin-bottom: 3px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .cookie-name-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 180px;
        }

        .cookie-value {
          font-family: 'Noto Serif KR', serif;
          font-size: 11px;
          color: #b89aa5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cookie-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .btn-expand {
          background: rgba(212,84,122,0.08);
          border: 1px solid rgba(212,84,122,0.15);
          color: #c4607a;
          border-radius: 100px;
          padding: 5px 12px;
          font-family: 'Noto Serif KR', serif;
          font-size: 11px;
          cursor: none;
          transition: all 0.2s ease;
        }

        .btn-expand:hover { background: rgba(212,84,122,0.15); }

        .btn-delete {
          background: rgba(232,84,84,0.08);
          border: 1px solid rgba(232,84,84,0.2);
          color: #e85454;
          border-radius: 100px;
          padding: 5px 12px;
          font-family: 'Noto Serif KR', serif;
          font-size: 11px;
          cursor: none;
          transition: all 0.2s ease;
        }

        .btn-delete:hover { background: rgba(232,84,84,0.15); transform: scale(1.05); }
        .btn-delete:disabled { opacity: 0.5; }

        .cookie-detail {
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
          max-height: 0;
          opacity: 0;
        }

        .cookie-detail.open { max-height: 220px; opacity: 1; }

        .cookie-detail-inner {
          padding: 14px 20px 16px;
          border-top: 1px solid rgba(255,182,193,0.2);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 8px;
        }

        .detail-item {
          background: rgba(255,246,249,0.8);
          border-radius: 10px;
          padding: 8px 12px;
        }

        .detail-label {
          font-family: 'Noto Serif KR', serif;
          font-size: 10px;
          color: #b89aa5;
          margin-bottom: 2px;
          letter-spacing: 0.05em;
        }

        .detail-value {
          font-family: 'Playfair Display', serif;
          font-size: 12px;
          color: #2d1a22;
          font-weight: 600;
          word-break: break-all;
        }

        .risk-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 100px;
          border: 1px solid;
          font-family: 'Noto Serif KR', serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .httponly-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 100px;
          background: rgba(100,130,212,0.1);
          border: 1px solid rgba(100,130,212,0.3);
          color: #6482d4;
          font-family: 'Noto Serif KR', serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .empty-state {
          text-align: center;
          padding: 70px 20px;
          font-family: 'Noto Serif KR', serif;
          color: #c4a0b0;
          font-size: 14px;
          font-weight: 300;
          line-height: 2.2;
        }

        .empty-state .big-emoji {
          font-size: 52px;
          display: block;
          margin-bottom: 16px;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .loading-dots { display: inline-flex; gap: 4px; }

        .loading-dots span {
          width: 5px;
          height: 5px;
          background: white;
          border-radius: 50%;
          animation: bounce 0.8s ease infinite;
        }

        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        .progress-bar {
          height: 4px;
          background: rgba(212,84,122,0.1);
          border-radius: 100px;
          margin-bottom: 32px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 100px;
          background: linear-gradient(90deg, #4caf8a, #e8a838, #e85454);
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* 커스텀 커서 */}
      <div
        style={{
          position: 'fixed',
          left: mousePos.x - 10,
          top: mousePos.y - 10,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22">
          <ellipse cx="12" cy="8" rx="4" ry="7" fill="#ffb3c6" opacity="0.9" />
          <ellipse cx="12" cy="16" rx="4" ry="7" fill="#ffc8d8" opacity="0.9" transform="rotate(72 12 12)" />
          <ellipse cx="12" cy="8" rx="4" ry="7" fill="#ffd6e0" opacity="0.9" transform="rotate(144 12 12)" />
          <ellipse cx="12" cy="8" rx="4" ry="7" fill="#ffe0ec" opacity="0.9" transform="rotate(216 12 12)" />
          <ellipse cx="12" cy="8" rx="4" ry="7" fill="#ffb3c6" opacity="0.9" transform="rotate(288 12 12)" />
        </svg>
      </div>

      {/* 벚꽃 떨어지기 */}
      {PETALS.map(petal => (
        <div
          key={petal.id}
          className="petal"
          style={{
            left: `${petal.x}%`,
            animationDuration: `${petal.duration}s`,
            animationDelay: `${petal.delay}s`,
            ['--drift' as string]: `${petal.drift}px`,
          }}
        >
          <svg
            width={petal.size}
            height={petal.size}
            viewBox="0 0 24 24"
            style={{ opacity: petal.opacity, animationDuration: `${petal.duration * 0.7}s` }}
          >
            <ellipse cx="12" cy="8" rx="5" ry="8" fill="#ffb3c6" transform={`rotate(${petal.rotation} 12 12)`} />
            <ellipse cx="12" cy="16" rx="5" ry="8" fill="#ffc8d8" transform={`rotate(${petal.rotation + 72} 12 12)`} />
            <ellipse cx="18" cy="12" rx="5" ry="8" fill="#ffd6e0" transform={`rotate(${petal.rotation + 144} 12 12)`} />
            <ellipse cx="15" cy="5" rx="5" ry="8" fill="#ffe0ec" transform={`rotate(${petal.rotation + 216} 12 12)`} />
            <ellipse cx="6" cy="5" rx="5" ry="8" fill="#ffb3c6" transform={`rotate(${petal.rotation + 288} 12 12)`} />
          </svg>
        </div>
      ))}

      {/* 버튼 클릭 시 꽃잎 폭발 */}
      {petalBurst && burstPetals.map((petal) => (
        <div
          key={petal.id}
          className="burst-petal"
          style={{
            left: petalBurst.x,
            top: petalBurst.y,
            ['--bx' as string]: `${petal.bx}px`,
            ['--by' as string]: `${petal.by}px`,
            ['--br' as string]: `${petal.br}deg`,
            animationDelay: `${petal.delay}s`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24">
            <ellipse cx="12" cy="8" rx="5" ry="8" fill="#ffb3c6" />
            <ellipse cx="12" cy="16" rx="5" ry="8" fill="#ffc8d8" transform="rotate(72 12 12)" />
          </svg>
        </div>
      ))}

      <div className="scene">
        <div className="content">
          <div className="badge">🌸 실험용 쿠키 사이트</div>

          <h1>완전 합법적인<br /><em>사이트</em>입니다</h1>

          <p className="subtitle">
            아무 쿠키도 안 심어요. 진짜로요. 😇<br />
            버튼을 누르면 어떤 일이 벌어지는지는... 모르겠네요.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <button
              className="btn-primary"
              onClick={setCookiesFn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>심는 중 <div className="loading-dots"><span /><span /><span /></div></>
              ) : (
                <>🍪 쿠키 받기 (완전 안전함)</>
              )}
            </button>

            {justSet && (
              <div className="success-pill">✨ 쿠키 6개 심었어요!</div>
            )}
          </div>

          {cookies.length > 0 && (
            <>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(cookies.filter(c => getRiskLevel(c) === 'danger').length / cookies.length) * 100}%`
                  }}
                />
              </div>

              <div className="stats-bar">
                {(['safe', 'warn', 'danger'] as const).map((level, i) => {
                  const count = cookies.filter(c => getRiskLevel(c) === level).length
                  const cfg = riskConfig[level]
                  return (
                    <div
                      key={level}
                      className="stat-chip"
                      style={{
                        background: cfg.bg,
                        borderColor: cfg.border,
                        color: cfg.color,
                        animationDelay: `${i * 0.1}s`
                      }}
                    >
                      {cfg.emoji} {cfg.label} {count}개
                    </div>
                  )
                })}
                <div
                  className="stat-chip"
                  style={{
                    background: 'rgba(100,130,212,0.1)',
                    borderColor: 'rgba(100,130,212,0.3)',
                    color: '#6482d4',
                  }}
                >
                  🔒 HttpOnly {cookies.filter(c => c.httpOnly).length}개
                </div>
              </div>

              <div className="divider" />
            </>
          )}

          {cookies.length > 0 ? (
            <div className="cookie-list">
              {cookies.map((cookie, i) => {
                const risk = getRiskLevel(cookie)
                const cfg = riskConfig[risk]
                const isExpanded = expandedCookie === cookie.name
                const isDeleting = deletingCookie === cookie.name

                return (
                  <div
                    key={cookie.name}
                    className={`cookie-card ${isDeleting ? 'deleting' : ''}`}
                    style={{
                      animationDelay: `${i * 0.06}s`,
                      borderColor: hoveredCookie === cookie.name ? cfg.border : 'rgba(255,182,193,0.25)',
                      background: hoveredCookie === cookie.name
                        ? `linear-gradient(135deg, rgba(255,255,255,0.95), ${cfg.bg})`
                        : 'rgba(255,255,255,0.85)',
                    }}
                    onMouseEnter={() => setHoveredCookie(cookie.name)}
                    onMouseLeave={() => setHoveredCookie(null)}
                  >
                    <div className="cookie-main">
                      <div
                        className="cookie-icon"
                        style={{
                          background: `linear-gradient(135deg, ${cfg.bg}, rgba(255,255,255,0.5))`,
                          border: `1px solid ${cfg.border}`
                        }}
                      >
                        {cfg.emoji}
                      </div>

                      <div className="cookie-info">
                        <div className="cookie-name">
                          <span className="cookie-name-text">{cookie.name}</span>
                          {cookie.httpOnly && <span className="httponly-badge">httpOnly</span>}
                          <span
                            className="risk-badge"
                            style={{
                              background: cfg.bg,
                              borderColor: cfg.border,
                              color: cfg.color
                            }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div className="cookie-value">{cookie.value}</div>
                      </div>

                      <div className="cookie-actions">
                        <button
                          className="btn-expand"
                          onClick={() => setExpandedCookie(isExpanded ? null : cookie.name)}
                        >
                          {isExpanded ? '접기 ▲' : '상세 ▼'}
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => deleteCookie(cookie.name)}
                          disabled={!!deletingCookie}
                        >
                          {isDeleting ? '삭제 중...' : '삭제 🗑️'}
                        </button>
                      </div>
                    </div>

                    <div className={`cookie-detail ${isExpanded ? 'open' : ''}`}>
                      <div className="cookie-detail-inner">
                        <div className="detail-grid">
                          <div className="detail-item">
                            <div className="detail-label">이름</div>
                            <div className="detail-value" style={{ fontSize: '11px' }}>{cookie.name}</div>
                          </div>
                          <div className="detail-item">
                            <div className="detail-label">값</div>
                            <div className="detail-value" style={{ fontSize: '11px' }}>{cookie.value}</div>
                          </div>
                          <div className="detail-item">
                            <div className="detail-label">JavaScript 접근</div>
                            <div className="detail-value" style={{ color: cookie.httpOnly ? '#4caf8a' : '#e85454' }}>
                              {cookie.httpOnly ? '불가 (안전)' : '가능 (주의)'}
                            </div>
                          </div>
                          <div className="detail-item">
                            <div className="detail-label">위험도</div>
                            <div className="detail-value" style={{ color: cfg.color }}>{cfg.label}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span className="big-emoji">🌸</span>
              아직 쿠키가 없어요<br />
              위 버튼을 눌러 쿠키를 심어보세요
            </div>
          )}
        </div>
      </div>
    </>
  )
};