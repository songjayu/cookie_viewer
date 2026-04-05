"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CookieInfo {
  name: string;
  value: string;
  httpOnly?: boolean;
}

interface Petal {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  drift: number;
  opacity: number;
}

interface BurstPetal {
  id: string;
  bx: number;
  by: number;
  br: number;
  delay: number;
}

interface BurstPos {
  x: number;
  y: number;
  id: number;
}

interface FallingCookie {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  rotation: number;
  type: "normal" | "bomb" | "golden" | "fast";
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

type Mode = "stealth" | "transparent";
type GameState = "idle" | "playing" | "dead";

const PETALS: Petal[] = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  x: (i * 2.94) % 100,
  size: 8 + ((i * 0.51) % 16),
  duration: 6 + ((i * 0.29) % 10),
  delay: (i * 0.37) % 12,
  rotation: (i * 10.3) % 360,
  drift: ((i * 7.3) % 250) - 125,
  opacity: 0.3 + ((i * 0.014) % 0.5),
}));

const COOKIE_TYPES = {
  normal: { emoji: "🍪", points: 0, color: "#c4607a" },
  bomb: { emoji: "💣", points: -10, color: "#e85454" },
  golden: { emoji: "✨", points: 10, color: "#e8a838" },
  fast: { emoji: "🍩", points: 0, color: "#9b59b6" },
};

export default function Home() {
  const [cookies, setCookies] = useState<CookieInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingCookie, setDeletingCookie] = useState<string | null>(null);
  const [justSet, setJustSet] = useState(false);
  const [hoveredCookie, setHoveredCookie] = useState<string | null>(null);
  const [expandedCookie, setExpandedCookie] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [petalBurst, setPetalBurst] = useState<BurstPos | null>(null);
  const [burstPetals, setBurstPetals] = useState<BurstPetal[]>([]);
  const [mode, setMode] = useState<Mode>("stealth");

  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerX, setPlayerX] = useState(50);
  const [fallingCookies, setFallingCookies] = useState<FallingCookie[]>([]);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [isInvincible, setIsInvincible] = useState(false);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [shaking, setShaking] = useState(false);
  const [level, setLevel] = useState(1);

  const burstCounter = useRef(0);
  const stealthDone = useRef(false);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cookieIdRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const playerXRef = useRef(50);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const isInvincibleRef = useRef(false);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatIdRef = useRef(0);

  const fetchCookies = async (): Promise<void> => {
    const jsCookies = document.cookie
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c !== "")
      .map((c) => {
        const [name, ...rest] = c.split("=");
        return {
          name: name.trim(),
          value: rest.join("=").trim(),
          httpOnly: false,
        };
      });

    const res = await fetch("/api/check-cookies");
    const data = await res.json();
    const jsNames = new Set(jsCookies.map((c: CookieInfo) => c.name));
    const httpOnlyCookies = data.cookies
      .filter((c: CookieInfo) => !jsNames.has(c.name))
      .map((c: CookieInfo) => ({ ...c, httpOnly: true }));

    setCookies([...jsCookies, ...httpOnlyCookies]);
  };

  const deleteAllCookies = async (): Promise<void> => {
    const allCookies = document.cookie
      .split(";")
      .map((c) => c.trim().split("=")[0].trim())
      .filter(Boolean);
    await Promise.all(
      allCookies.map((name) =>
        fetch(`/api/delete-cookie?name=${encodeURIComponent(name)}`, {
          method: "DELETE",
        }),
      ),
    );
    await fetchCookies();
  };

  useEffect(() => {
    const init = async () => {
      await fetchCookies();
      if (mode === "stealth" && !stealthDone.current) {
        stealthDone.current = true;
        await fetch("/api/set-cookies");
        await fetchCookies();
      }
    };
    init();

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(5, Math.min(95, relX));
        setPlayerX(clamped);
        playerXRef.current = clamped;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const addFloatingScore = (
    x: number,
    y: number,
    text: string,
    color: string,
  ) => {
    floatIdRef.current += 1;
    const id = floatIdRef.current;
    setFloatingScores((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFloatingScores((prev) => prev.filter((f) => f.id !== id));
    }, 800);
  };

  const startGame = useCallback(() => {
    setGameState("playing");
    setScore(0);
    setLives(3);
    setFallingCookies([]);
    setPlayerX(50);
    setCombo(0);
    setLevel(1);
    setIsInvincible(false);
    scoreRef.current = 0;
    livesRef.current = 3;
    playerXRef.current = 50;
    isInvincibleRef.current = false;
    comboRef.current = 0;

    gameLoopRef.current = setInterval(() => {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setLevel(Math.floor(scoreRef.current / 100) + 1);

      const spawnChance = 0.035 + scoreRef.current * 0.00015;
      if (Math.random() < spawnChance) {
        cookieIdRef.current += 1;

        // 쿠키 타입 결정
        const rand = Math.random();
        let type: FallingCookie["type"] = "normal";
        if (rand < 0.08) type = "golden";
        else if (rand < 0.18) type = "bomb";
        else if (rand < 0.28) type = "fast";

        const baseSpeed = 0.4 + scoreRef.current * 0.002;
        const newCookie: FallingCookie = {
          id: cookieIdRef.current,
          x: ((cookieIdRef.current * 17.3) % 90) + 5,
          y: -5,
          speed:
            type === "fast" ? baseSpeed * 2.5 : baseSpeed + Math.random() * 0.8,
          size: type === "golden" ? 32 : 22 + ((cookieIdRef.current * 3) % 16),
          rotation: (cookieIdRef.current * 37) % 360,
          type,
        };
        setFallingCookies((prev) => [...prev, newCookie]);
      }

      setFallingCookies((prev) => {
        const toRemove = new Set<number>();

        const updated = prev.map((c) => ({
          ...c,
          y: c.y + c.speed,
          rotation: c.rotation + (c.type === "fast" ? 6 : 2),
        }));

        updated.forEach((c) => {
          if (c.y > 82 && c.y < 96) {
            const dist = Math.abs(c.x - playerXRef.current);
            if (dist < 7) {
              toRemove.add(c.id);

              if (c.type === "golden") {
                // 황금 쿠키: 점수 +10
                comboRef.current += 1;
                setCombo(comboRef.current);
                scoreRef.current += 10 + comboRef.current * 2;
                setScore(scoreRef.current);
                addFloatingScore(
                  c.x,
                  80,
                  `+${10 + comboRef.current * 2} ✨`,
                  "#e8a838",
                );
                if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
                comboTimerRef.current = setTimeout(() => {
                  comboRef.current = 0;
                  setCombo(0);
                }, 2000);
              } else if (c.type === "bomb") {
                // 폭탄: 무적 중이면 무시
                if (!isInvincibleRef.current) {
                  isInvincibleRef.current = true;
                  setIsInvincible(true);
                  livesRef.current -= 1;
                  setLives(livesRef.current);
                  setShaking(true);
                  setTimeout(() => setShaking(false), 400);
                  addFloatingScore(c.x, 80, "-1 💣", "#e85454");
                  comboRef.current = 0;
                  setCombo(0);
                  setTimeout(() => {
                    isInvincibleRef.current = false;
                    setIsInvincible(false);
                  }, 1500);
                  if (livesRef.current <= 0) {
                    setGameState("dead");
                    setHighScore((h) => Math.max(h, scoreRef.current));
                    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
                  }
                }
              } else {
                // 일반/빠른 쿠키: 목숨 깎임
                if (!isInvincibleRef.current) {
                  isInvincibleRef.current = true;
                  setIsInvincible(true);
                  livesRef.current -= 1;
                  setLives(livesRef.current);
                  setShaking(true);
                  setTimeout(() => setShaking(false), 400);
                  addFloatingScore(
                    c.x,
                    80,
                    c.type === "fast" ? "-1 💨" : "-1 🍪",
                    "#e85454",
                  );
                  comboRef.current = 0;
                  setCombo(0);
                  setTimeout(() => {
                    isInvincibleRef.current = false;
                    setIsInvincible(false);
                  }, 1500);
                  if (livesRef.current <= 0) {
                    setGameState("dead");
                    setHighScore((h) => Math.max(h, scoreRef.current));
                    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
                  }
                }
              }
            }
          }
        });

        return updated.filter((c) => c.y < 110 && !toRemove.has(c.id));
      });
    }, 16);
  }, []);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, []);

  const handleModeChange = async (newMode: Mode) => {
    setMode(newMode);
    if (newMode === "transparent") {
      // 스텔스 → 투명: 쿠키 전부 삭제
      await deleteAllCookies();
      setGameState("idle");
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      setFallingCookies([]);
    }
    if (newMode === "stealth" && !stealthDone.current) {
      stealthDone.current = true;
      await fetch("/api/set-cookies");
      await fetchCookies();
    }
  };

  const setCookiesFn = async (e: React.MouseEvent): Promise<void> => {
    burstCounter.current += 1;
    const id = burstCounter.current;
    const newBurstPetals: BurstPetal[] = Array.from({ length: 12 }).map(
      (_, i) => {
        const angle = (i / 12) * 360;
        const dist = 60 + ((i * 7.3) % 120);
        return {
          id: `${id}-${i}`,
          bx: Math.cos((angle * Math.PI) / 180) * dist,
          by: Math.sin((angle * Math.PI) / 180) * dist,
          br: (i * 60) % 720,
          delay: i * 0.008,
        };
      },
    );
    setPetalBurst({ x: e.clientX, y: e.clientY, id });
    setBurstPetals(newBurstPetals);
    setTimeout(() => {
      setPetalBurst(null);
      setBurstPetals([]);
    }, 1000);
    setIsLoading(true);
    await fetch("/api/set-cookies");
    await fetchCookies();
    setIsLoading(false);
    setJustSet(true);
    setTimeout(() => setJustSet(false), 2500);
  };

  const deleteCookie = async (name: string): Promise<void> => {
    setDeletingCookie(name);
    await fetch(`/api/delete-cookie?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    setTimeout(async () => {
      await fetchCookies();
      setDeletingCookie(null);
    }, 500);
  };

  const getRiskLevel = (cookie: CookieInfo): "safe" | "warn" | "danger" => {
    const name = cookie.name.toLowerCase();
    if (cookie.httpOnly) return "safe";
    if (
      name.includes("track") ||
      name.includes("analytics") ||
      name.includes("session_wink")
    )
      return "danger";
    if (
      name.includes("xqz") ||
      name.includes("suspicious") ||
      name.includes("friendly")
    )
      return "warn";
    return "safe";
  };

  const riskConfig = {
    safe: {
      label: "안전",
      color: "#4caf8a",
      bg: "rgba(76,175,138,0.1)",
      border: "rgba(76,175,138,0.3)",
      emoji: "✅",
    },
    warn: {
      label: "의심",
      color: "#e8a838",
      bg: "rgba(232,168,56,0.1)",
      border: "rgba(232,168,56,0.3)",
      emoji: "⚠️",
    },
    danger: {
      label: "위험",
      color: "#e85454",
      bg: "rgba(232,84,84,0.1)",
      border: "rgba(232,84,84,0.3)",
      emoji: "🚨",
    },
  };

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

        .mode-toggle {
          position: fixed;
          top: 24px;
          right: 28px;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,182,193,0.3);
          border-radius: 100px;
          padding: 8px 16px;
          font-family: 'Noto Serif KR', serif;
          font-size: 12px;
          cursor: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(212,84,122,0.1);
        }

        .mode-toggle:hover { box-shadow: 0 6px 20px rgba(212,84,122,0.2); transform: translateY(-1px); }

        .toggle-track {
          width: 40px;
          height: 22px;
          border-radius: 100px;
          position: relative;
          transition: background 0.3s ease;
          flex-shrink: 0;
        }

        .toggle-thumb {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 3px;
          transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
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

        .btn-primary:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 14px 36px rgba(212,84,122,0.45); }
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

        .stats-bar { display: flex; gap: 12px; margin: 40px 0 24px; flex-wrap: wrap; }

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

        .divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(212,84,122,0.2), transparent); margin: 0 0 32px; }

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

        .cookie-card:hover { transform: translateX(6px) translateY(-2px); box-shadow: 0 8px 28px rgba(212,84,122,0.12); }
        .cookie-card.deleting { opacity: 0; transform: translateX(30px) scale(0.94); transition: all 0.5s ease; }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        .cookie-main { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }

        .cookie-icon {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .cookie-card:hover .cookie-icon { transform: rotate(-8deg) scale(1.1); }
        .cookie-info { flex: 1; min-width: 0; }

        .cookie-name {
          font-family: 'Playfair Display', serif;
          font-size: 13px; font-weight: 600; color: #2d1a22;
          margin-bottom: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }

        .cookie-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
        .cookie-value { font-family: 'Noto Serif KR', serif; font-size: 11px; color: #b89aa5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cookie-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .btn-expand {
          background: rgba(212,84,122,0.08); border: 1px solid rgba(212,84,122,0.15);
          color: #c4607a; border-radius: 100px; padding: 5px 12px;
          font-family: 'Noto Serif KR', serif; font-size: 11px; cursor: none; transition: all 0.2s ease;
        }

        .btn-expand:hover { background: rgba(212,84,122,0.15); }

        .btn-delete {
          background: rgba(232,84,84,0.08); border: 1px solid rgba(232,84,84,0.2);
          color: #e85454; border-radius: 100px; padding: 5px 12px;
          font-family: 'Noto Serif KR', serif; font-size: 11px; cursor: none; transition: all 0.2s ease;
        }

        .btn-delete:hover { background: rgba(232,84,84,0.15); transform: scale(1.05); }
        .btn-delete:disabled { opacity: 0.5; }

        .cookie-detail { overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; max-height: 0; opacity: 0; }
        .cookie-detail.open { max-height: 220px; opacity: 1; }
        .cookie-detail-inner { padding: 14px 20px 16px; border-top: 1px solid rgba(255,182,193,0.2); }

        .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }

        .detail-item { background: rgba(255,246,249,0.8); border-radius: 10px; padding: 8px 12px; }
        .detail-label { font-family: 'Noto Serif KR', serif; font-size: 10px; color: #b89aa5; margin-bottom: 2px; letter-spacing: 0.05em; }
        .detail-value { font-family: 'Playfair Display', serif; font-size: 12px; color: #2d1a22; font-weight: 600; word-break: break-all; }

        .risk-badge { font-size: 10px; padding: 2px 8px; border-radius: 100px; border: 1px solid; font-family: 'Noto Serif KR', serif; white-space: nowrap; flex-shrink: 0; }
        .httponly-badge { font-size: 10px; padding: 2px 8px; border-radius: 100px; background: rgba(100,130,212,0.1); border: 1px solid rgba(100,130,212,0.3); color: #6482d4; font-family: 'Noto Serif KR', serif; white-space: nowrap; flex-shrink: 0; }

        .empty-state { text-align: center; padding: 70px 20px; font-family: 'Noto Serif KR', serif; color: #c4a0b0; font-size: 14px; font-weight: 300; line-height: 2.2; }
        .empty-state .big-emoji { font-size: 52px; display: block; margin-bottom: 16px; animation: float 3s ease-in-out infinite; }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

        .loading-dots { display: inline-flex; gap: 4px; }
        .loading-dots span { width: 5px; height: 5px; background: white; border-radius: 50%; animation: bounce 0.8s ease infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }

        .progress-bar { height: 4px; background: rgba(212,84,122,0.1); border-radius: 100px; margin-bottom: 32px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg, #4caf8a, #e8a838, #e85454); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

        /* 게임 */
        .game-container {
          position: relative;
          width: 100%;
          height: 520px;
          border-radius: 24px;
          border: 1px solid rgba(255,182,193,0.3);
          overflow: hidden;
          animation: fadeDown 0.5s ease both;
          background: linear-gradient(180deg, #1a0a12 0%, #2d1a22 40%, #1a0a12 100%);
        }

        .game-container.shaking { animation: gameShake 0.3s ease; }

        @keyframes gameShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }

        .game-bg-star {
          position: absolute;
          background: white;
          border-radius: 50%;
          pointer-events: none;
          animation: twinkle linear infinite;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }

        .game-hud {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 10;
          background: linear-gradient(180deg, rgba(0,0,0,0.4), transparent);
        }

        .game-score-main {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 600;
          color: white;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }

        .game-level {
          font-family: 'Noto Serif KR', serif;
          font-size: 11px;
          color: rgba(255,182,193,0.8);
          margin-top: 2px;
        }

        .game-lives-display {
          font-size: 22px;
          letter-spacing: 4px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        .game-high-display {
          font-family: 'Noto Serif KR', serif;
          font-size: 11px;
          color: rgba(255,182,193,0.7);
          text-align: right;
        }

        .combo-display {
          position: absolute;
          top: 70px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          color: #e8a838;
          text-shadow: 0 0 12px rgba(232,168,56,0.8);
          animation: comboPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          white-space: nowrap;
          z-index: 10;
        }

        @keyframes comboPop {
          from { opacity: 0; transform: translateX(-50%) scale(0.5); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }

        .falling-cookie {
          position: absolute;
          pointer-events: none;
          user-select: none;
          line-height: 1;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
        }

        .player {
          position: absolute;
          bottom: 50px;
          transform: translateX(-50%);
          font-size: 40px;
          z-index: 5;
          filter: drop-shadow(0 0 12px rgba(255,182,193,0.8));
          transition: left 0.04s linear;
        }

        .player.invincible {
          animation: invincibleBlink 0.2s ease infinite;
        }

        @keyframes invincibleBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .ground-glow {
          position: absolute;
          bottom: 44px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,182,193,0.4), transparent);
        }

        .floating-score {
          position: absolute;
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 600;
          pointer-events: none;
          z-index: 20;
          animation: floatUp 0.8s ease-out forwards;
          text-shadow: 0 2px 8px rgba(0,0,0,0.6);
          white-space: nowrap;
        }

        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) translateX(-50%); }
          100% { opacity: 0; transform: translateY(-60px) translateX(-50%); }
        }

        .game-legend {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 16px;
          font-family: 'Noto Serif KR', serif;
          font-size: 10px;
          color: rgba(255,182,193,0.5);
          white-space: nowrap;
          z-index: 10;
        }

        .game-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(26,10,18,0.92);
          backdrop-filter: blur(8px);
          z-index: 20;
          gap: 14px;
          text-align: center;
          padding: 32px;
        }

        .game-overlay h2 {
          font-family: 'Playfair Display', serif;
          font-size: 2.2rem;
          color: white;
          font-weight: 600;
        }

        .game-overlay h2 em { font-style: italic; color: #ffb3c6; }

        .game-overlay p {
          font-family: 'Noto Serif KR', serif;
          font-size: 13px;
          color: rgba(255,182,193,0.7);
          line-height: 2;
        }

        .score-display {
          font-family: 'Playfair Display', serif;
          font-size: 4rem;
          font-weight: 600;
          color: #ffb3c6;
          text-shadow: 0 0 32px rgba(255,179,198,0.5);
          line-height: 1;
        }

        .btn-game {
          background: linear-gradient(135deg, #e8708a, #d4547a);
          color: white;
          border: none;
          border-radius: 100px;
          padding: 14px 36px;
          font-family: 'Noto Serif KR', serif;
          font-size: 14px;
          cursor: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 8px 24px rgba(212,84,122,0.4);
        }

        .btn-game:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 14px 36px rgba(212,84,122,0.6); }

        .legend-item { display: flex; align-items: center; gap: 4px; }

        .new-record {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          color: #e8a838;
          font-style: italic;
          text-shadow: 0 0 12px rgba(232,168,56,0.6);
          animation: pulse 1s ease infinite;
        }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* 커스텀 커서 */}
      <div
        style={{
          position: "fixed",
          left: mousePos.x - 10,
          top: mousePos.y - 10,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22">
          <ellipse cx="12" cy="8" rx="4" ry="7" fill="#ffb3c6" opacity="0.9" />
          <ellipse
            cx="12"
            cy="16"
            rx="4"
            ry="7"
            fill="#ffc8d8"
            opacity="0.9"
            transform="rotate(72 12 12)"
          />
          <ellipse
            cx="12"
            cy="8"
            rx="4"
            ry="7"
            fill="#ffd6e0"
            opacity="0.9"
            transform="rotate(144 12 12)"
          />
          <ellipse
            cx="12"
            cy="8"
            rx="4"
            ry="7"
            fill="#ffe0ec"
            opacity="0.9"
            transform="rotate(216 12 12)"
          />
          <ellipse
            cx="12"
            cy="8"
            rx="4"
            ry="7"
            fill="#ffb3c6"
            opacity="0.9"
            transform="rotate(288 12 12)"
          />
        </svg>
      </div>

      {/* 모드 토글 */}
      <div
        className="mode-toggle"
        onClick={() =>
          handleModeChange(mode === "stealth" ? "transparent" : "stealth")
        }
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            color: mode === "stealth" ? "#e85454" : "#4caf8a",
            fontSize: "12px",
            whiteSpace: "nowrap",
          }}
        >
          {mode === "stealth" ? "🕵️ 스텔스" : "👀 투명"}
        </span>
        <div
          className="toggle-track"
          style={{
            background:
              mode === "stealth"
                ? "rgba(232,84,84,0.3)"
                : "rgba(76,175,138,0.3)",
          }}
        >
          <div
            className="toggle-thumb"
            style={{ left: mode === "stealth" ? "3px" : "21px" }}
          />
        </div>
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            color: "#b89aa5",
            fontSize: "11px",
          }}
        >
          모드
        </span>
      </div>

      {/* 벚꽃 */}
      {PETALS.map((petal) => (
        <div
          key={petal.id}
          className="petal"
          style={{
            left: `${petal.x}%`,
            animationDuration: `${petal.duration}s`,
            animationDelay: `${petal.delay}s`,
            ["--drift" as string]: `${petal.drift}px`,
          }}
        >
          <svg
            width={petal.size}
            height={petal.size}
            viewBox="0 0 24 24"
            style={{
              opacity: petal.opacity,
              animationDuration: `${petal.duration * 0.7}s`,
            }}
          >
            <ellipse
              cx="12"
              cy="8"
              rx="5"
              ry="8"
              fill="#ffb3c6"
              transform={`rotate(${petal.rotation} 12 12)`}
            />
            <ellipse
              cx="12"
              cy="16"
              rx="5"
              ry="8"
              fill="#ffc8d8"
              transform={`rotate(${petal.rotation + 72} 12 12)`}
            />
            <ellipse
              cx="18"
              cy="12"
              rx="5"
              ry="8"
              fill="#ffd6e0"
              transform={`rotate(${petal.rotation + 144} 12 12)`}
            />
            <ellipse
              cx="15"
              cy="5"
              rx="5"
              ry="8"
              fill="#ffe0ec"
              transform={`rotate(${petal.rotation + 216} 12 12)`}
            />
            <ellipse
              cx="6"
              cy="5"
              rx="5"
              ry="8"
              fill="#ffb3c6"
              transform={`rotate(${petal.rotation + 288} 12 12)`}
            />
          </svg>
        </div>
      ))}

      {/* 꽃잎 폭발 */}
      {petalBurst &&
        burstPetals.map((petal) => (
          <div
            key={petal.id}
            className="burst-petal"
            style={{
              left: petalBurst.x,
              top: petalBurst.y,
              ["--bx" as string]: `${petal.bx}px`,
              ["--by" as string]: `${petal.by}px`,
              ["--br" as string]: `${petal.br}deg`,
              animationDelay: `${petal.delay}s`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <ellipse cx="12" cy="8" rx="5" ry="8" fill="#ffb3c6" />
              <ellipse
                cx="12"
                cy="16"
                rx="5"
                ry="8"
                fill="#ffc8d8"
                transform="rotate(72 12 12)"
              />
            </svg>
          </div>
        ))}

      <div className="scene">
        <div className="content">
          <div className="badge">🌸 실험용 쿠키 사이트</div>
          <h1>
            완전 합법적인
            <br />
            <em>사이트</em>입니다
          </h1>
          <p className="subtitle">
            {mode === "stealth"
              ? "즐거운 시간 보내세요 😇"
              : "버튼을 눌러야 쿠키가 심어져요. 투명하게 알려드립니다. 👀"}
          </p>

          {/* 스텔스 모드: 게임 */}
          {mode === "stealth" && (
            <div
              className={`game-container ${shaking ? "shaking" : ""}`}
              ref={gameAreaRef}
            >
              {/* 별 배경 */}
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="game-bg-star"
                  style={{
                    width: `${1 + ((i * 0.3) % 2)}px`,
                    height: `${1 + ((i * 0.3) % 2)}px`,
                    left: `${(i * 5.3) % 100}%`,
                    top: `${(i * 7.1) % 80}%`,
                    animationDuration: `${2 + ((i * 0.4) % 3)}s`,
                    animationDelay: `${(i * 0.3) % 2}s`,
                  }}
                />
              ))}

              {/* HUD */}
              {gameState === "playing" && (
                <div className="game-hud">
                  <div>
                    <div className="game-score-main">
                      {score.toLocaleString()}
                    </div>
                    <div className="game-level">
                      Lv.{level} — 점점 빨라지고 있어요
                    </div>
                  </div>
                  <div className="game-lives-display">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          opacity: i < lives ? 1 : 0.15,
                          filter:
                            i < lives
                              ? "drop-shadow(0 0 6px rgba(255,182,193,0.8))"
                              : "none",
                        }}
                      >
                        🌸
                      </span>
                    ))}
                  </div>
                  <div className="game-high-display">
                    <div
                      style={{
                        color: "rgba(255,182,193,0.5)",
                        fontSize: "10px",
                      }}
                    >
                      최고
                    </div>
                    <div
                      style={{
                        color: "white",
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "16px",
                      }}
                    >
                      {highScore.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* 콤보 */}
              {gameState === "playing" && combo >= 2 && (
                <div className="combo-display">
                  ✨ {combo} COMBO! +{combo * 2} bonus
                </div>
              )}

              {/* 플로팅 점수 */}
              {floatingScores.map((f) => (
                <div
                  key={f.id}
                  className="floating-score"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}
                >
                  {f.text}
                </div>
              ))}

              {/* 떨어지는 쿠키 */}
              {gameState === "playing" &&
                fallingCookies.map((c) => (
                  <div
                    key={c.id}
                    className="falling-cookie"
                    style={{
                      left: `${c.x}%`,
                      top: `${c.y}%`,
                      fontSize: `${c.size}px`,
                      transform: `rotate(${c.rotation}deg) translateX(-50%)`,
                      filter:
                        c.type === "golden"
                          ? "drop-shadow(0 0 12px rgba(232,168,56,0.9))"
                          : c.type === "bomb"
                            ? "drop-shadow(0 0 8px rgba(232,84,84,0.8))"
                            : "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                    }}
                  >
                    {COOKIE_TYPES[c.type].emoji}
                  </div>
                ))}

              {/* 플레이어 */}
              {gameState === "playing" && (
                <div
                  className={`player ${isInvincible ? "invincible" : ""}`}
                  style={{ left: `${playerX}%` }}
                >
                  🌸
                </div>
              )}

              <div className="ground-glow" />

              {/* 범례 */}
              {gameState === "playing" && (
                <div className="game-legend">
                  <div className="legend-item">🍪 피하기</div>
                  <div className="legend-item">🍩 빠름</div>
                  <div className="legend-item">💣 -1</div>
                  <div className="legend-item">✨ 먹으면 +점수</div>
                </div>
              )}

              {/* 오버레이 */}
              {gameState !== "playing" && (
                <div className="game-overlay">
                  {gameState === "idle" ? (
                    <>
                      <h2>
                        🍪 쿠키를 <em>피하세요</em>
                      </h2>
                      <p>
                        마우스로 🌸 를 움직여 쿠키를 피하세요
                        <br />
                        💣 폭탄은 목숨 -1 · ✨ 황금은 먹으면 점수
                        <br />
                        🍩 도넛은 엄청 빠릅니다
                      </p>
                      <button className="btn-game" onClick={startGame}>
                        🌸 게임 시작
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>
                        쿠키에 <em>잡혔어요</em> 🍪
                      </h2>
                      <div className="score-display">
                        {score.toLocaleString()}
                      </div>
                      {score > 0 && score >= highScore && (
                        <div className="new-record">🎉 새 최고 기록!</div>
                      )}
                      <p>
                        최고 기록: {highScore.toLocaleString()}점<br />
                        도달한 레벨: Lv.{level}
                      </p>
                      <button className="btn-game" onClick={startGame}>
                        🍪 다시 도전
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 투명 모드 */}
          {mode === "transparent" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <button
                  className="btn-primary"
                  onClick={setCookiesFn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      심는 중{" "}
                      <div className="loading-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                    </>
                  ) : (
                    <>🍪 쿠키 받기 (동의 후 심기)</>
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
                        width: `${(cookies.filter((c) => getRiskLevel(c) === "danger").length / cookies.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="stats-bar">
                    {(["safe", "warn", "danger"] as const).map((level, i) => {
                      const count = cookies.filter(
                        (c) => getRiskLevel(c) === level,
                      ).length;
                      const cfg = riskConfig[level];
                      return (
                        <div
                          key={level}
                          className="stat-chip"
                          style={{
                            background: cfg.bg,
                            borderColor: cfg.border,
                            color: cfg.color,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        >
                          {cfg.emoji} {cfg.label} {count}개
                        </div>
                      );
                    })}
                    <div
                      className="stat-chip"
                      style={{
                        background: "rgba(100,130,212,0.1)",
                        borderColor: "rgba(100,130,212,0.3)",
                        color: "#6482d4",
                      }}
                    >
                      🔒 HttpOnly {cookies.filter((c) => c.httpOnly).length}개
                    </div>
                  </div>
                  <div className="divider" />
                </>
              )}

              {cookies.length > 0 ? (
                <div className="cookie-list">
                  {cookies.map((cookie, i) => {
                    const risk = getRiskLevel(cookie);
                    const cfg = riskConfig[risk];
                    const isExpanded = expandedCookie === cookie.name;
                    const isDeleting = deletingCookie === cookie.name;
                    return (
                      <div
                        key={cookie.name}
                        className={`cookie-card ${isDeleting ? "deleting" : ""}`}
                        style={{
                          animationDelay: `${i * 0.06}s`,
                          borderColor:
                            hoveredCookie === cookie.name
                              ? cfg.border
                              : "rgba(255,182,193,0.25)",
                          background:
                            hoveredCookie === cookie.name
                              ? `linear-gradient(135deg, rgba(255,255,255,0.95), ${cfg.bg})`
                              : "rgba(255,255,255,0.85)",
                        }}
                        onMouseEnter={() => setHoveredCookie(cookie.name)}
                        onMouseLeave={() => setHoveredCookie(null)}
                      >
                        <div className="cookie-main">
                          <div
                            className="cookie-icon"
                            style={{
                              background: `linear-gradient(135deg, ${cfg.bg}, rgba(255,255,255,0.5))`,
                              border: `1px solid ${cfg.border}`,
                            }}
                          >
                            {cfg.emoji}
                          </div>
                          <div className="cookie-info">
                            <div className="cookie-name">
                              <span className="cookie-name-text">
                                {cookie.name}
                              </span>
                              {cookie.httpOnly && (
                                <span className="httponly-badge">httpOnly</span>
                              )}
                              <span
                                className="risk-badge"
                                style={{
                                  background: cfg.bg,
                                  borderColor: cfg.border,
                                  color: cfg.color,
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
                              onClick={() =>
                                setExpandedCookie(
                                  isExpanded ? null : cookie.name,
                                )
                              }
                            >
                              {isExpanded ? "접기 ▲" : "상세 ▼"}
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => deleteCookie(cookie.name)}
                              disabled={!!deletingCookie}
                            >
                              {isDeleting ? "삭제 중..." : "삭제 🗑️"}
                            </button>
                          </div>
                        </div>
                        <div
                          className={`cookie-detail ${isExpanded ? "open" : ""}`}
                        >
                          <div className="cookie-detail-inner">
                            <div className="detail-grid">
                              <div className="detail-item">
                                <div className="detail-label">이름</div>
                                <div
                                  className="detail-value"
                                  style={{ fontSize: "11px" }}
                                >
                                  {cookie.name}
                                </div>
                              </div>
                              <div className="detail-item">
                                <div className="detail-label">값</div>
                                <div
                                  className="detail-value"
                                  style={{ fontSize: "11px" }}
                                >
                                  {cookie.value}
                                </div>
                              </div>
                              <div className="detail-item">
                                <div className="detail-label">
                                  JavaScript 접근
                                </div>
                                <div
                                  className="detail-value"
                                  style={{
                                    color: cookie.httpOnly
                                      ? "#4caf8a"
                                      : "#e85454",
                                  }}
                                >
                                  {cookie.httpOnly
                                    ? "불가 (안전)"
                                    : "가능 (주의)"}
                                </div>
                              </div>
                              <div className="detail-item">
                                <div className="detail-label">위험도</div>
                                <div
                                  className="detail-value"
                                  style={{ color: cfg.color }}
                                >
                                  {cfg.label}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="big-emoji">🌸</span>
                  아직 쿠키가 없어요
                  <br />위 버튼을 눌러 쿠키를 심어보세요
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
