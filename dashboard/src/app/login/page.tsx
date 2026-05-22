'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const PIN_LENGTH = 4;

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const shakeKey = useRef(0);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handleLogin(pin);
    }
  }, [pin]);

  const handleLogin = useCallback(async (enteredPin: string) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, pin, is_manager')
        .eq('pin', enteredPin)
        .eq('is_manager', true)
        .single();

      if (error || !data) {
        // Wrong PIN — shake and clear
        shakeKey.current += 1;
        setIsError(true);
        setErrorMsg('Incorrect PIN. Try again.');
        setTimeout(() => {
          setPin('');
          setIsError(false);
          setErrorMsg('');
        }, 600);
      } else {
        // Success — store session and redirect
        sessionStorage.setItem('dashboard_auth', JSON.stringify({ id: data.id, username: data.username }));
        router.push('/');
      }
    } catch {
      setIsError(true);
      setErrorMsg('Connection error. Please try again.');
      setTimeout(() => { setPin(''); setIsError(false); }, 800);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleKeyPress = (digit: string) => {
    if (isLoading || isError) return;
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (isLoading || isError) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (!isLoading) setPin('');
  };

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin, isLoading, isError]);

  const shakeVariants = {
    idle: { x: 0 },
    shake: {
      x: [0, -18, 18, -14, 14, -8, 8, -4, 4, 0],
      transition: { duration: 0.5, ease: 'easeInOut' }
    }
  } as any;

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center select-none"
         style={{ background: 'linear-gradient(135deg, #070b19 0%, #0f172a 50%, #1e1b4b 100%)' }}>
      
      {/* Animated premium ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-25 animate-pulse"
             style={{ background: 'radial-gradient(circle, #2563eb, transparent)', top: '-10%', left: '-10%', animationDuration: '8s' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse"
             style={{ background: 'radial-gradient(circle, #db2777, transparent)', bottom: '-5%', right: '-5%', animationDelay: '2s', animationDuration: '10s' }} />
        <div className="absolute w-[450px] h-[450px] rounded-full blur-[100px] opacity-15 animate-pulse"
             style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', top: '25%', right: '20%', animationDelay: '4s', animationDuration: '12s' }} />
      </div>

      {/* Desktop Clock (Top Center, macOS Style) */}
      <div className="hidden md:block absolute top-16 text-center z-10 select-none">
        <h1 className="text-8xl font-thin text-white/90 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {time}
        </h1>
        <p className="text-lg text-white/55 mt-3 font-light tracking-wide">{date}</p>
      </div>

      {/* macOS-style frosted glass panel */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-10 py-12 rounded-[2.5rem] w-full max-w-[380px] md:max-w-[400px]"
           style={{
             background: 'rgba(255,255,255,0.03)',
             backdropFilter: 'blur(50px)',
             WebkitBackdropFilter: 'blur(50px)',
             border: '1px solid rgba(255,255,255,0.08)',
             boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
           }}>

        {/* Mobile Clock (Only visible inside panel on small screens) */}
        <div className="text-center md:hidden mb-2">
          <div className="text-5xl font-thin text-white tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {time}
          </div>
          <div className="text-sm text-white/40 mt-1 font-light tracking-wide">{date}</div>
        </div>


        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
               style={{
                 background: 'linear-gradient(145deg, rgba(79,142,247,0.3), rgba(168,85,247,0.2))',
                 border: '1.5px solid rgba(255,255,255,0.15)',
                 boxShadow: '0 8px 32px rgba(79,142,247,0.2)'
               }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="text-center">
            <div className="text-white font-medium text-lg tracking-wide">Nemu Dashboard</div>
            <div className="text-white/40 text-xs mt-0.5">Enter your PIN to continue</div>
          </div>
        </div>

        {/* PIN Dots — shakeable */}
        <motion.div
          key={shakeKey.current}
          variants={shakeVariants}
          animate={isError ? 'shake' : 'idle'}
          className="flex items-center gap-4"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <motion.div
                key={i}
                animate={{
                  scale: filled ? 1.15 : 1,
                  backgroundColor: isError ? '#f87171' : filled ? '#fff' : 'transparent',
                  boxShadow: isError
                    ? '0 0 12px rgba(248,113,113,0.8)'
                    : filled
                    ? '0 0 14px rgba(255,255,255,0.6)'
                    : 'none'
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="w-3.5 h-3.5 rounded-full"
                style={{ border: `1.5px solid ${isError ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.35)'}` }}
              />
            );
          })}
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {errorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-sm -mt-4 text-center"
            >
              {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(digit => (
            <KeyButton key={digit} label={digit} onClick={() => handleKeyPress(digit)} disabled={isLoading || isError} />
          ))}
          <KeyButton label="C" onClick={handleClear} disabled={isLoading} utility />
          <KeyButton label="0" onClick={() => handleKeyPress('0')} disabled={isLoading || isError} />
          <KeyButton label="⌫" onClick={handleBackspace} disabled={isLoading} utility />
        </div>

        {/* Loading state */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-white/50 text-sm -mt-2"
            >
              <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              <span>Authenticating…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      <p className="absolute bottom-6 text-white/20 text-xs tracking-widest uppercase z-10">
        Nemu Admin · Secure Access
      </p>
    </div>
  );
}

// ─── Reusable Key Button ───────────────────────────────────────────────────────
function KeyButton({
  label, onClick, disabled, utility = false
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  utility?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      animate={{ scale: pressed ? 0.88 : 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: utility
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.07)',
        border: `1px solid ${utility ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: utility ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
        fontSize: utility ? 18 : 26,
        fontWeight: utility ? 400 : 200,
        color: 'rgba(255,255,255,0.90)',
        letterSpacing: '-0.5px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {label}
    </motion.button>
  );
}
