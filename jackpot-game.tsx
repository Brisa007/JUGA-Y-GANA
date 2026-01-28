"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, VolumeX, Copy, Check, Sparkles, Star } from "lucide-react"
import Image from "next/image"

// Prize configuration - GRAND, MEGA, MAJOR NEVER win, only MAXI and MINI
const PRIZE_CONFIG = {
  grand: { label: "GRAND", amount: "$300.000", image: "/images/grand.png", canWin: false },
  mega: { label: "MEGA", amount: "$150.000", image: "/images/mega.png", canWin: false },
  major: { label: "MAJOR", amount: "$50.000", image: "/images/major.png", canWin: false },
  maxi: { label: "MAXI", amount: "50% EXTRA", image: "/images/maxi.png", canWin: true },
  mini: { label: "MINI", amount: "30% EXTRA", image: "/images/mini.png", canWin: true },
}

type PrizeKey = keyof typeof PRIZE_CONFIG

interface Chip {
  id: number
  prize: PrizeKey
  revealed: boolean
  isWinning: boolean
}

// Generate 15 chips - CRITICAL: GRAND, MEGA, MAJOR only have 1 each (IMPOSSIBLE to get 3)
// Only MAXI and MINI have 3+ chips so only they can win
function generateChips(): { chips: Chip[], winningPrize: PrizeKey } {
  const winnablePrizes: PrizeKey[] = ["maxi", "mini"]
  
  // Randomly select winning prize (ONLY MAXI or MINI)
  const winningPrize = winnablePrizes[Math.floor(Math.random() * winnablePrizes.length)]
  const otherWinnable = winningPrize === "maxi" ? "mini" : "maxi"
  
  const allPrizes: PrizeKey[] = []
  
  // CRITICAL: Only 1 of each NON-WINNABLE prize - ABSOLUTELY IMPOSSIBLE to get 3 matching
  allPrizes.push("grand")     // 1 GRAND - can NEVER match 3
  allPrizes.push("mega")      // 1 MEGA - can NEVER match 3  
  allPrizes.push("major")     // 1 MAJOR - can NEVER match 3
  
  // 5 of the winning prize (MAXI or MINI) - this WILL be found quickly
  allPrizes.push(winningPrize, winningPrize, winningPrize, winningPrize, winningPrize)
  
  // 2 of the other winnable prize - can never match 3
  allPrizes.push(otherWinnable, otherWinnable)
  
  // Fill remaining 5 spots with more winning prizes
  allPrizes.push(winningPrize, winningPrize, winningPrize, winningPrize, winningPrize)
  
  // Shuffle the prizes
  for (let i = allPrizes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPrizes[i], allPrizes[j]] = [allPrizes[j], allPrizes[i]]
  }
  
  // Create chip objects
  const chips: Chip[] = []
  for (let i = 0; i < 15; i++) {
    chips.push({
      id: i,
      prize: allPrizes[i],
      revealed: false,
      isWinning: allPrizes[i] === winningPrize,
    })
  }
  
  return { chips, winningPrize }
}

// Check if user can play (12 hour cooldown)
function canUserPlay(username: string): boolean {
  if (typeof window === "undefined") return true
  
  const deviceId = getDeviceId()
  const lastPlayKey = `gabibet_lastplay_${username}_${deviceId}`
  const lastPlay = localStorage.getItem(lastPlayKey)
  
  if (!lastPlay) return true
  
  const lastPlayTime = parseInt(lastPlay, 10)
  const now = Date.now()
  const twelveHours = 12 * 60 * 60 * 1000
  
  return now - lastPlayTime >= twelveHours
}

function getTimeUntilNextPlay(username: string): string {
  if (typeof window === "undefined") return ""
  
  const deviceId = getDeviceId()
  const lastPlayKey = `gabibet_lastplay_${username}_${deviceId}`
  const lastPlay = localStorage.getItem(lastPlayKey)
  
  if (!lastPlay) return ""
  
  const lastPlayTime = parseInt(lastPlay, 10)
  const now = Date.now()
  const twelveHours = 12 * 60 * 60 * 1000
  const timeLeft = twelveHours - (now - lastPlayTime)
  
  if (timeLeft <= 0) return ""
  
  const hours = Math.floor(timeLeft / (60 * 60 * 1000))
  const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000))
  
  return `${hours}h ${minutes}m`
}

function recordPlay(username: string): void {
  if (typeof window === "undefined") return
  
  const deviceId = getDeviceId()
  const lastPlayKey = `gabibet_lastplay_${username}_${deviceId}`
  localStorage.setItem(lastPlayKey, Date.now().toString())
}

function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  
  let deviceId = localStorage.getItem("gabibet_device_id")
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem("gabibet_device_id", deviceId)
  }
  return deviceId
}

// Generate coupon link for WhatsApp
function generateCouponLink(username: string, prize: PrizeKey): string {
  const prizeInfo = PRIZE_CONFIG[prize]
  const couponId = `GB${Date.now().toString(36).toUpperCase()}`
  const date = new Date().toLocaleDateString("es-AR")
  
  const message = encodeURIComponent(
    `CUPON GABI BET\n` +
    `----------------\n` +
    `Codigo: ${couponId}\n` +
    `Usuario: ${username}\n` +
    `Premio: ${prizeInfo.label}\n` +
    `Valor: ${prizeInfo.amount}\n` +
    `Fecha: ${date}\n` +
    `----------------\n` +
    `Validar con Gabi Bet`
  )
  
  return `https://wa.me/?text=${message}`
}

export default function JackpotGame() {
  const [gamePhase, setGamePhase] = useState<"login" | "playing" | "cooldown">("login")
  const [username, setUsername] = useState("")
  const [chips, setChips] = useState<Chip[]>([])
  const [winningPrize, setWinningPrize] = useState<PrizeKey>("mini")
  const [revealedCount, setRevealedCount] = useState(0)
  const [matchCounts, setMatchCounts] = useState<Record<PrizeKey, number>>({
    grand: 0, mega: 0, major: 0, maxi: 0, mini: 0
  })
  const [showWinModal, setShowWinModal] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [copied, setCopied] = useState(false)
  const [cooldownTime, setCooldownTime] = useState("")
  const [isPressed, setIsPressed] = useState<number | null>(null)
  const [gameEnded, setGameEnded] = useState(false)
  const [finalPrize, setFinalPrize] = useState<PrizeKey | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tapSoundRef = useRef<HTMLAudioElement | null>(null)
  const winSoundRef = useRef<HTMLAudioElement | null>(null)
  const revealSoundRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Background music - cheerful casino style like Joker's Jewels
      audioRef.current = new Audio("https://assets.mixkit.co/music/preview/mixkit-playful-happy-cartoon-111.mp3")
      audioRef.current.loop = true
      audioRef.current.volume = 0.4
      
      // Tap sound
      tapSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3")
      tapSoundRef.current.volume = 0.5
      
      // Win sound - more celebratory
      winSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3")
      winSoundRef.current.volume = 0.7
      
      // Reveal sound
      revealSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3")
      revealSoundRef.current.volume = 0.5
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Play/pause background music - NOW PLAYS THROUGHOUT ALL GAME PHASES
  useEffect(() => {
    if (audioRef.current) {
      if (soundEnabled) {
        audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
    }
  }, [soundEnabled, gamePhase])

  const playTapSound = useCallback(() => {
    if (soundEnabled && tapSoundRef.current) {
      tapSoundRef.current.currentTime = 0
      tapSoundRef.current.play().catch(() => {})
    }
  }, [soundEnabled])

  const playRevealSound = useCallback(() => {
    if (soundEnabled && revealSoundRef.current) {
      revealSoundRef.current.currentTime = 0
      revealSoundRef.current.play().catch(() => {})
    }
  }, [soundEnabled])

  const playWinSound = useCallback(() => {
    if (soundEnabled && winSoundRef.current) {
      winSoundRef.current.currentTime = 0
      winSoundRef.current.play().catch(() => {})
    }
  }, [soundEnabled])

  const handleLogin = useCallback(() => {
    if (!username.trim()) return
    
    playTapSound()
    
    if (!canUserPlay(username)) {
      setCooldownTime(getTimeUntilNextPlay(username))
      setGamePhase("cooldown")
      return
    }
    
    const { chips: newChips, winningPrize: newWinningPrize } = generateChips()
    setChips(newChips)
    setWinningPrize(newWinningPrize)
    setRevealedCount(0)
    setMatchCounts({ grand: 0, mega: 0, major: 0, maxi: 0, mini: 0 })
    setGameEnded(false)
    setFinalPrize(null)
    setGamePhase("playing")
  }, [username, playTapSound])

  const handleChipClick = useCallback((chipId: number) => {
    if (gameEnded) return
    
    const chip = chips.find(c => c.id === chipId)
    if (!chip || chip.revealed) return
    
    playTapSound()
    setIsPressed(chipId)
    
    setTimeout(() => {
      setIsPressed(null)
      playRevealSound()
      
      // Reveal the chip
      setChips(prev => prev.map(c => 
        c.id === chipId ? { ...c, revealed: true } : c
      ))
      
      const newRevealedCount = revealedCount + 1
      setRevealedCount(newRevealedCount)
      
      // Update match counts
      const newMatchCounts = { ...matchCounts }
      newMatchCounts[chip.prize] = (newMatchCounts[chip.prize] || 0) + 1
      setMatchCounts(newMatchCounts)
      
      // Check if any prize has 3 matches
      const winningPrizeKey = (Object.keys(newMatchCounts) as PrizeKey[]).find(
        key => newMatchCounts[key] >= 3
      )
      
      if (winningPrizeKey) {
        // Player found 3 matching!
        setGameEnded(true)
        setFinalPrize(winningPrizeKey)
        recordPlay(username)
        
        setTimeout(() => {
          playWinSound()
          setShowWinModal(true)
        }, 800)
      }
    }, 150)
  }, [chips, gameEnded, revealedCount, matchCounts, username, playTapSound, playRevealSound, playWinSound])

  const handleCopyLink = useCallback(() => {
    if (!finalPrize) return
    const link = generateCouponLink(username, finalPrize)
    navigator.clipboard.writeText(link.replace("https://wa.me/?text=", "").replace(/%0A/g, "\n").replace(/%20/g, " "))
    setCopied(true)
    playTapSound()
    setTimeout(() => setCopied(false), 2000)
  }, [username, finalPrize, playTapSound])

  const handleWhatsAppShare = useCallback(() => {
    if (!finalPrize) return
    playTapSound()
    const link = generateCouponLink(username, finalPrize)
    window.open(link, "_blank")
  }, [username, finalPrize, playTapSound])

  const toggleSound = useCallback(() => {
    playTapSound()
    setSoundEnabled(prev => !prev)
  }, [playTapSound])

  // Login Screen with Gabi Bet Logo - ELEGANT STYLE
  if (gamePhase === "login") {
    return (
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden" style={{ background: "linear-gradient(135deg, #701a75 0%, #9d174d 50%, #701a75 100%)" }}>
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/50 via-transparent to-fuchsia-900/50" />
          {/* Neon glow circles */}
          <motion.div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-500/30 rounded-full blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>
        
        {/* Animated sparkles/stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ 
                x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 400), 
                y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 800),
                opacity: 0 
              }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{ 
                duration: 2 + Math.random() * 2, 
                repeat: Infinity, 
                delay: Math.random() * 3 
              }}
            >
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            </motion.div>
          ))}
        </div>
        
        {/* Login Card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="relative z-10 w-full max-w-sm mx-auto"
        >
          {/* Neon border glow */}
          <motion.div
            className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-yellow-500 to-pink-500 rounded-3xl blur-md opacity-75"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <div className="relative bg-gradient-to-b from-fuchsia-900/80 to-pink-900/90 backdrop-blur-md rounded-3xl p-6 border border-pink-400/40 shadow-2xl">
            {/* Gabi Bet Logo with glow and animation */}
            <motion.div className="relative mb-4">
              {/* Soft glow effect behind logo */}
              <motion.div
                className="absolute inset-0 bg-pink-400/30 rounded-full blur-3xl"
                animate={{ 
                  scale: [1, 1.2, 1], 
                  opacity: [0.2, 0.5, 0.2] 
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              
              {/* Logo with pulse animation */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative"
              >
                <Image
                  src="/images/gabi-bet-logo.png"
                  alt="Gabi Bet"
                  width={300}
                  height={300}
                  className="mx-auto drop-shadow-[0_0_30px_rgba(236,72,153,0.8)]"
                  priority
                />
              </motion.div>
            </motion.div>
            
            {/* NEON Title */}
            <motion.div className="text-center mb-6">
              <motion.div
                className="flex items-center justify-center gap-3 mb-2"
                animate={{ 
                  textShadow: [
                    "0 0 10px #fbbf24, 0 0 20px #fbbf24, 0 0 40px #fbbf24",
                    "0 0 20px #fbbf24, 0 0 40px #fbbf24, 0 0 80px #fbbf24",
                    "0 0 10px #fbbf24, 0 0 20px #fbbf24, 0 0 40px #fbbf24"
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Star className="w-7 h-7 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_#fbbf24]" />
                </motion.div>
                <h1 className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_20px_#fbbf24]" style={{ textShadow: "0 0 20px #fbbf24, 0 0 40px #fbbf24" }}>
                  JUGA Y GANA
                </h1>
                <motion.div animate={{ rotate: [360, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Star className="w-7 h-7 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_#fbbf24]" />
                </motion.div>
              </motion.div>
              <p className="text-pink-400 text-lg font-bold drop-shadow-[0_0_10px_#ec4899]" style={{ textShadow: "0 0 10px #ec4899" }}>
                con Gabi Bet
              </p>
            </motion.div>
            
            {/* Username input */}
            <div className="space-y-4">
              <div className="relative">
                <motion.div
                  className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-2xl blur-sm"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Tu nombre de usuario"
                  className="relative w-full px-5 py-4 bg-fuchsia-950/70 border-2 border-pink-400/40 rounded-2xl text-white placeholder-pink-300/50 text-lg font-medium focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 transition-all"
                />
              </div>
              
              <motion.button
                onClick={handleLogin}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative w-full overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ filter: "blur(10px)" }}
                />
                <div className="relative py-4 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-black font-black text-xl rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                  ENTRAR A JUGAR
                </div>
              </motion.button>
            </div>
            
            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className="absolute top-4 right-4 p-2 rounded-full bg-pink-500/30 text-yellow-400 hover:bg-pink-500/50 transition-colors border border-yellow-500/30"
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Cooldown Screen
  if (gamePhase === "cooldown") {
    return (
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-b from-fuchsia-900 via-pink-800 to-fuchsia-900">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 w-full max-w-sm mx-auto"
        >
          <div className="bg-gradient-to-br from-fuchsia-900/90 to-pink-950/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border-2 border-yellow-500/50 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Image
                src="/images/gabi-bet-logo.png"
                alt="Gabi Bet"
                width={150}
                height={150}
                className="mx-auto mb-4 drop-shadow-2xl"
              />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">
              Ya jugaste hoy
            </h2>
            <p className="text-yellow-200/80 mb-2">
              Podes volver a jugar en:
            </p>
            <p className="text-4xl font-black text-yellow-300 mb-6">
              {cooldownTime}
            </p>
            
            <motion.button
              onClick={() => {
                playTapSound()
                setGamePhase("login")
                setUsername("")
              }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-fuchsia-800/80 text-yellow-200 font-bold rounded-xl border border-yellow-500/30"
            >
              Cambiar usuario
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Game Screen with background image - chips positioned INSIDE pink area
  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-start overflow-hidden">
      {/* Background Image Container - Centered */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-lg mx-auto" style={{ aspectRatio: "1/1.2" }}>
          {/* Background Image */}
          <Image
            src="/images/game-bg.png"
            alt="Game Background"
            fill
            className="object-contain"
            priority
          />
          
          {/* JACKPOT ASEGURADO Title - Below the banner on solid background */}
          <div 
            className="absolute w-full text-center"
            style={{ top: "88%", left: 0, right: 0 }}
          >
            <motion.div
              animate={{ 
                textShadow: [
                  "0 0 10px #fbbf24, 0 0 20px #fbbf24",
                  "0 0 20px #fbbf24, 0 0 40px #fbbf24, 0 0 60px #fbbf24",
                  "0 0 10px #fbbf24, 0 0 20px #fbbf24"
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <h2 
                className="text-2xl font-black text-yellow-400 tracking-wide"
                style={{ textShadow: "0 0 15px #fbbf24, 0 0 30px #fbbf24, 2px 2px 4px rgba(0,0,0,0.8)" }}
              >
                JACKPOT ASEGURADO
              </h2>
            </motion.div>
            <motion.p 
              className="text-lg font-bold text-pink-300 mt-1"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ textShadow: "0 0 10px #ec4899, 2px 2px 4px rgba(0,0,0,0.8)" }}
            >
              Mucha Suerte!
            </motion.p>
          </div>
          
          {/* Chips Grid - Positioned EXACTLY inside the pink rectangle */}
          {/* The pink area is roughly 75% width, centered vertically in the pink box */}
          <div 
            className="absolute flex items-center justify-center"
            style={{
              top: "38%",
              left: "12%",
              right: "12%",
              height: "34%",
            }}
          >
            <div className="grid grid-cols-5 gap-1 w-full h-full p-2">
              {chips.map((chip) => (
                <ChipButton
                  key={chip.id}
                  chip={chip}
                  onPress={handleChipClick}
                  isPressed={isPressed === chip.id}
                  disabled={gameEnded}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Sound Toggle */}
      <button
        onClick={toggleSound}
        className="absolute top-4 right-4 z-20 p-3 rounded-full bg-fuchsia-900/80 backdrop-blur-sm text-yellow-400 shadow-lg border border-yellow-500/30"
      >
        {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>
      
      {/* Username display */}
      <div className="absolute top-4 left-4 z-20 px-4 py-2 rounded-full bg-fuchsia-900/80 backdrop-blur-sm border border-yellow-500/30">
        <span className="text-yellow-300 font-bold text-sm">{username}</span>
      </div>
      
      {/* Match counter */}
      <div className="absolute top-16 left-4 z-20 px-3 py-1 rounded-lg bg-fuchsia-900/80 backdrop-blur-sm border border-yellow-500/30">
        <span className="text-yellow-200 text-xs">Encontra 3 iguales</span>
      </div>
      
      {/* Win Modal - NEON CELEBRATION with CONFETTI */}
      <AnimatePresence>
        {showWinModal && finalPrize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95"
          >
            {/* CONFETTI - Colorful falling pieces */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(60)].map((_, i) => (
                <motion.div
                  key={`confetti-${i}`}
                  className="absolute"
                  style={{ 
                    left: `${Math.random() * 100}%`,
                    width: `${8 + Math.random() * 8}px`,
                    height: `${8 + Math.random() * 8}px`,
                    background: ["#fbbf24", "#f59e0b", "#ec4899", "#f472b6", "#a855f7", "#22c55e", "#3b82f6", "#ef4444"][i % 8],
                    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{ 
                    y: typeof window !== "undefined" ? window.innerHeight + 50 : 900,
                    opacity: [1, 1, 0.8, 0],
                    rotate: Math.random() * 720 - 360,
                    x: [0, Math.random() * 100 - 50, Math.random() * 100 - 50]
                  }}
                  transition={{ 
                    duration: 3 + Math.random() * 2, 
                    delay: Math.random() * 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              ))}
            </div>
            
            {/* Animated light rays */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`ray-${i}`}
                  className="absolute top-1/2 left-1/2 w-4 origin-bottom"
                  style={{ 
                    height: "150vh",
                    background: "linear-gradient(to top, transparent, rgba(251,191,36,0.15), transparent)",
                    transform: `rotate(${i * 45}deg)`,
                  }}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            
            {/* Glowing orbs */}
            <motion.div
              className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-500/30 rounded-full blur-3xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-pink-500/30 rounded-full blur-3xl"
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            
            <motion.div
              initial={{ scale: 0.5, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.5, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="relative w-full max-w-sm"
            >
              {/* Neon glow border */}
              <motion.div
                className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-yellow-400 rounded-3xl blur-lg"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              
              {/* Card */}
              <div className="relative bg-gradient-to-b from-fuchsia-900 via-pink-900 to-fuchsia-950 rounded-3xl overflow-hidden border-2 border-yellow-400/50 shadow-[0_0_60px_rgba(251,191,36,0.3)]">
                {/* Top neon bar */}
                <motion.div 
                  className="h-1.5 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                
                <div className="p-5">
                  {/* Animated stars around the top */}
                  <div className="absolute top-4 left-0 right-0 flex justify-between px-4">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          scale: [1, 1.5, 1], 
                          rotate: [0, 180, 360],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      >
                        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_#fbbf24]" />
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Logo */}
                  <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="flex justify-center mt-6 mb-2"
                  >
                    <Image
                      src="/images/gabi-bet-logo.png"
                      alt="Gabi Bet"
                      width={100}
                      height={100}
                      className="drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]"
                    />
                  </motion.div>
                  
                  {/* NEON Title */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="text-center mb-3"
                  >
                    <motion.h2 
                      className="text-4xl font-black text-yellow-400"
                      style={{ textShadow: "0 0 20px #fbbf24, 0 0 40px #fbbf24, 0 0 60px #fbbf24" }}
                      animate={{ 
                        textShadow: [
                          "0 0 20px #fbbf24, 0 0 40px #fbbf24",
                          "0 0 30px #fbbf24, 0 0 60px #fbbf24, 0 0 80px #fbbf24",
                          "0 0 20px #fbbf24, 0 0 40px #fbbf24"
                        ]
                      }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      FELICIDADES!
                    </motion.h2>
                  </motion.div>
                  
                  {/* Prize image with intense glow */}
                  <motion.div
                    initial={{ scale: 0, rotateY: 180 }}
                    animate={{ scale: 1, rotateY: 0 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 150 }}
                    className="relative mb-3"
                  >
                    {/* Multiple glow layers */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        className="w-36 h-36 bg-yellow-400/50 rounded-full blur-2xl"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        className="w-28 h-28 bg-pink-500/40 rounded-full blur-xl"
                        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    
                    <div className="relative flex justify-center">
                      <motion.div
                        animate={{ 
                          y: [0, -12, 0],
                          scale: [1, 1.05, 1]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Image
                          src={PRIZE_CONFIG[finalPrize].image || "/placeholder.svg"}
                          alt={PRIZE_CONFIG[finalPrize].label}
                          width={140}
                          height={140}
                          className="drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]"
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                  
                  {/* Prize text with neon effect */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center mb-4"
                  >
                    <p className="text-pink-300 text-sm font-medium mb-1" style={{ textShadow: "0 0 10px #ec4899" }}>
                      Ganaste el premio
                    </p>
                    <motion.h3 
                      className="text-4xl font-black text-yellow-400 mb-1"
                      style={{ textShadow: "0 0 15px #fbbf24, 0 0 30px #fbbf24" }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {PRIZE_CONFIG[finalPrize].label}
                    </motion.h3>
                    <p className="text-2xl font-bold text-white" style={{ textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>
                      {PRIZE_CONFIG[finalPrize].amount}
                    </p>
                  </motion.div>
                  
                  {/* Action section with neon border */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="relative"
                  >
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-yellow-500 to-pink-500 rounded-2xl blur-sm"
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <div className="relative bg-fuchsia-950/90 rounded-2xl p-4 border border-pink-400/30">
                      <p className="text-pink-200 text-sm text-center mb-3 font-medium">
                        Copia tu cupon y envialo por WhatsApp
                      </p>
                      
                      <div className="flex gap-3">
                        <motion.button
                          onClick={handleCopyLink}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-pink-400/40"
                        >
                          {copied ? <Check size={18} /> : <Copy size={18} />}
                          {copied ? "Copiado!" : "Copiar"}
                        </motion.button>
                        
                        <motion.button
                          onClick={handleWhatsAppShare}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                        >
                          WhatsApp
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Footer */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-pink-300/60 text-xs text-center mt-4"
                  >
                    Usuario: {username} | Podes jugar de nuevo en 12hs
                  </motion.p>
                </div>
                
                {/* Bottom neon bar */}
                <motion.div 
                  className="h-1.5 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Chip Button Component
function ChipButton({ 
  chip, 
  onPress, 
  isPressed, 
  disabled 
}: { 
  chip: Chip
  onPress: (id: number) => void
  isPressed: boolean
  disabled: boolean
}) {
  const canClick = !disabled && !chip.revealed
  
  return (
    <motion.button
      onClick={() => canClick && onPress(chip.id)}
      disabled={!canClick}
      className="relative aspect-square w-full"
      whileHover={canClick ? { scale: 1.15, zIndex: 10 } : {}}
      whileTap={canClick ? { scale: 0.8 } : {}}
      animate={isPressed ? { 
        scale: [1, 0.75, 0.85], 
        rotate: [0, -10, 10, -5, 0],
      } : {}}
      transition={{ duration: 0.15 }}
    >
      <AnimatePresence mode="wait">
        {!chip.revealed ? (
          <motion.div
            key="covered"
            initial={{ rotateY: 0 }}
            exit={{ rotateY: 90, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full relative"
          >
            <Image
              src="/images/ficha.png"
              alt="Ficha cubierta"
              fill
              className={`object-contain drop-shadow-lg ${canClick ? "cursor-pointer" : ""}`}
              style={{
                filter: isPressed ? "brightness(0.7)" : "brightness(1)",
              }}
            />
            {/* Glow effect on hover */}
            {canClick && (
              <motion.div
                className="absolute inset-0 rounded-full bg-yellow-400/20"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ rotateY: -90, scale: 0.8 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ duration: 0.3, type: "spring" }}
            className="w-full h-full relative"
          >
            <Image
              src={PRIZE_CONFIG[chip.prize].image || "/placeholder.svg"}
              alt={PRIZE_CONFIG[chip.prize].label}
              fill
              className="object-contain drop-shadow-2xl"
            />
            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
