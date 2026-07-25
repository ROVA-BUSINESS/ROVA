import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  ShieldCheck,
  ArrowRight,
  Globe,
  Users2,
  CheckCircle2,
  ArrowUpRight,
  Check,
  TrendingUp,
  FileText,
  Link2,
  UserCheck,
  Zap,
  BarChart3,
} from 'lucide-react';
import Button from '../components/ui/Button';

const STAR_COORDINATES = [
  { top: '10%', left: '5%', delay: '0.1s', dur: '2.5s' },
  { top: '15%', left: '45%', delay: '0.4s', dur: '3.0s' },
  { top: '8%', left: '88%', delay: '0.7s', dur: '2.7s' },
  { top: '22%', left: '20%', delay: '1.2s', dur: '3.5s' },
  { top: '28%', left: '75%', delay: '0.2s', dur: '2.8s' },
  { top: '35%', left: '12%', delay: '1.5s', dur: '3.1s' },
  { top: '42%', left: '92%', delay: '0.9s', dur: '2.6s' },
  { top: '48%', left: '55%', delay: '1.8s', dur: '3.3s' },
  { top: '55%', left: '8%', delay: '0.3s', dur: '2.9s' },
  { top: '62%', left: '82%', delay: '1.1s', dur: '3.2s' },
  { top: '68%', left: '25%', delay: '0.5s', dur: '3.6s' },
  { top: '75%', left: '65%', delay: '1.4s', dur: '2.8s' },
  { top: '82%', left: '15%', delay: '0.8s', dur: '3.0s' },
  { top: '88%', left: '90%', delay: '1.6s', dur: '3.4s' },
  { top: '92%', left: '42%', delay: '0.2s', dur: '2.5s' },
  { top: '5%', left: '30%', delay: '1.0s', dur: '3.2s' },
  { top: '18%', left: '60%', delay: '0.6s', dur: '2.7s' },
  { top: '30%', left: '35%', delay: '1.3s', dur: '3.1s' },
  { top: '50%', left: '2%', delay: '0.5s', dur: '2.9s' },
  { top: '58%', left: '96%', delay: '1.7s', dur: '3.5s' },
  { top: '70%', left: '48%', delay: '1.1s', dur: '2.8s' },
  { top: '80%', left: '78%', delay: '0.4s', dur: '3.3s' },
  { top: '85%', left: '3%', delay: '1.2s', dur: '3.0s' },
  { top: '95%', left: '70%', delay: '0.9s', dur: '2.6s' },
];

export default function LandingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [compVisible, setCompVisible] = useState(false);
  const [devicesVisible, setDevicesVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDevicesVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    const element = document.getElementById('devices-section');
    if (element) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCompVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    const element = document.getElementById('comparison-section');
    if (element) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFeaturesVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    const element = document.getElementById('features');
    if (element) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);



  return (
    <>
      {/* ── Global landing page responsive styles ── */}
      <style>{`
        .lp-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Inter', 'Geist', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* ── Navbar ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          z-index: 100; display: flex; align-items: center; justify-content: center;
          box-shadow: ${isLight ? '0 4px 30px rgba(0,0,0,0.02)' : '0 4px 30px rgba(0,0,0,0.2)'};
        }
        .lp-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-nav-logo { height: 58px; cursor: pointer; }
        .lp-nav-links { display: flex; gap: 24px; }
        .lp-nav-link {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .lp-nav-link:hover { color: var(--text-primary); }
        .lp-nav-actions { display: flex; gap: 10px; align-items: center; }
        .lp-login-btn {
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; color: var(--text-primary); font-size: 14px;
          font-weight: 600; padding: 8px 16px; border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .lp-signup-btn {
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed, #3b82f6, var(--accent-primary));
          background-size: 300% auto;
          color: #fff; font-size: 14px; font-weight: 700;
          padding: 9px 20px; border-radius: var(--radius-md);
          display: flex; align-items: center;
          transition: background-position 0.6s ease, transform 0.2s;
        }
        .lp-signup-btn:hover {
          background-position: right center;
          transform: scale(1.03) translateY(-1px);
        }

        /* ── Hero ── */
        .lp-hero {
          padding-top: 110px; padding-bottom: 120px;
          display: flex; flex-direction: column; align-items: center;
          position: relative; z-index: 1;
          overflow: hidden;
          background: ${isLight
            ? 'radial-gradient(circle at 20% 20%, rgba(147,51,234,0.06), transparent 50%), radial-gradient(circle at 80% 50%, rgba(59,130,246,0.04), transparent 50%)'
            : 'radial-gradient(circle at 20% 20%, rgba(147,51,234,0.12), transparent 50%), radial-gradient(circle at 80% 50%, rgba(59,130,246,0.08), transparent 50%)'};
          background-size: 200% 200%;
          animation: meshMove 20s ease infinite alternate;
        }
        .lp-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
            linear-gradient(${isLight ? 'rgba(9,9,11,0.03)' : 'rgba(255,255,255,0.015)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isLight ? 'rgba(9,9,11,0.03)' : 'rgba(255,255,255,0.015)'} 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at 50% 50%, black 45%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, black 45%, transparent 80%);
          pointer-events: none;
          z-index: 0;
        }
        @keyframes meshMove {
          0% { background-position: 0% 0%; }
          50% { background-position: 50% 50%; }
          100% { background-position: 100% 100%; }
        }
        .lp-hero-inner {
          max-width: 1200px; width: 100%; padding: 0 20px;
          display: grid; grid-template-columns: 1.15fr 0.85fr;
          gap: 48px; align-items: center;
          position: relative; z-index: 1;
        }
        .lp-hero-left {
          padding-left: 60px;
        }
        .lp-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25); cursor: default;
        }
        .lp-hero-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lp-h1 {
          font-size: clamp(32px, 4.5vw, 64px);
          font-weight: 500; line-height: 1.1; margin-bottom: 20px;
          letter-spacing: -0.01em; font-family: 'Geist', 'Inter', sans-serif;
        }
        .lp-h1-grad {
          background: linear-gradient(135deg, #a855f7, #3b82f6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-hero-sub {
          font-size: clamp(15px, 1.8vw, 19px); color: var(--text-secondary);
          line-height: 1.65; margin-bottom: 36px; max-width: 560px;
        }
        .lp-cta-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .lp-cta-primary {
          text-decoration: none;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed, #3b82f6, var(--accent-primary));
          background-size: 300% auto;
          color: #fff; padding: 14px 32px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); display: flex; align-items: center;
          gap: 10px; transition: background-position 0.6s ease, transform 0.2s, box-shadow 0.2s;
        }
        .lp-cta-primary:hover {
          background-position: right center;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 25px rgba(147, 51, 234, 0.25);
        }
        .lp-cta-secondary {
          background: ${isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.02)'};
          color: var(--text-primary); border: 1px solid ${isLight ? 'rgba(9,9,11,0.1)' : 'rgba(255,255,255,0.1)'};
          padding: 14px 28px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s;
          backdrop-filter: blur(10px);
        }
        .lp-cta-secondary:hover { background: var(--bg-hover); }
        .lp-trust-badges { display: flex; gap: 20px; margin-top: 36px; flex-wrap: wrap; }
        .lp-trust-badge { display: flex; align-items: center; gap: 8px; }
        .lp-trust-dot {
          display: flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(34,197,94,0.1); color: #22c55e; flex-shrink: 0;
        }
        .lp-trust-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

        /* ── AI Simulator Card ── */
        .lp-simulator {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.08)'};
          border-radius: var(--radius-xl); padding: 20px;
          box-shadow: var(--shadow-lg);
          position: relative; overflow: hidden;
        }
        .lp-sim-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--bg-border); padding-bottom: 14px;
        }
        .lp-sim-chat { display: flex; flex-direction: column; gap: 12px; min-height: 180px; }
        .lp-sim-buttons { margin-top: 18px; }
        .lp-sim-btn-label {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .lp-sim-btn-list { display: flex; flex-direction: column; gap: 7px; }

        /* ── Stats Bar ── */
        .lp-stats {
          padding: 50px 20px;
          background: ${isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.01)'};
          border-top: 1px solid var(--bg-border);
          border-bottom: 1px solid var(--bg-border);
          position: relative; z-index: 1;
        }
        .lp-stats-grid {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        }
        .lp-stat-card {
          text-align: center; padding: 22px 16px; border-radius: var(--radius-lg);
          background: ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.3)'};
          border: 1px solid var(--bg-border); backdrop-filter: blur(10px);
        }
        .lp-stat-value {
          font-size: clamp(22px, 3vw, 36px); font-weight: 500;
          background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 4px; font-family: 'Geist', 'Inter', sans-serif;
        }
        .lp-stat-label { font-size: 12px; font-weight: 700; color: var(--accent-light); margin-bottom: 6px; }
        .lp-stat-sub { font-size: 10px; color: var(--text-muted); line-height: 1.4; }

        /* ── Features ── */
        .lp-features {
          padding: 100px 20px;
          display: flex;
          justify-content: center;
          position: relative;
          z-index: 1;
          background: #110426;
          border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          
          /* Muted purple-theme variables for dark purple background */
          --text-primary: #ffffff;
          --text-secondary: #ffffff;
          --text-muted: #ffffff;
          --bg-border: rgba(168, 85, 247, 0.2);
        }
        .lp-features-inner { max-width: 1200px; width: 100%; }
        .lp-section-title {
          text-align: center; margin-bottom: 64px;
        }
        .lp-h2 {
          font-size: clamp(26px, 4vw, 42px); font-weight: 500; margin-bottom: 14px;
          font-family: 'Geist', 'Inter', sans-serif;
        }
        .lp-h2-sub { font-size: 15px; color: var(--text-secondary); max-width: 560px; margin-inline: auto; line-height: 1.6; }
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .lp-feature-card {
          padding: 28px; border-radius: var(--radius-xl);
          background: ${isLight ? 'rgba(255,255,255,0.4)' : 'rgba(20,20,24,0.3)'};
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.06)' : 'rgba(255,255,255,0.06)'};
          backdrop-filter: blur(20px); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          cursor: default; display: flex; flex-direction: column; gap: 14px;
        }
        .lp-features .lp-feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(168, 85, 247, 0.15);
        }
        .lp-feature-card:hover {
          transform: translateY(-5px);
          border-color: var(--accent-border);
          box-shadow: var(--shadow-md);
        }

        /* ── Financials Overview ── */
        .lp-overview { padding: 80px 20px; position: relative; overflow: hidden; z-index: 1; }
        .lp-overview-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
        }
        .lp-overview-panel {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,24,0.4)'};
          border: 1px solid var(--bg-border); border-radius: var(--radius-xl);
          padding: 24px; backdrop-filter: blur(20px); box-shadow: var(--shadow-lg);
        }

        /* ── CTA ── */
        .lp-cta-section { padding: 60px 20px; position: relative; z-index: 1; }
        .lp-cta-inner {
          max-width: 1200px; margin: 0 auto; padding: 60px 32px;
          background: ${isLight
            ? 'linear-gradient(135deg, #9d5bd3 0%, #7d3cae 50%, #662d91 100%)'
            : 'linear-gradient(135deg, #662d91 0%, #4c1a72 50%, #2e0947 100%)'};
          border-radius: 28px; position: relative; overflow: hidden;
          text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        }

        /* ── Footer ── */
        .lp-footer {
          padding: 64px 20px;
          border-top: 1px solid var(--bg-border);
          background: ${isLight ? '#ffffff' : '#000000'};
          position: relative; z-index: 1;
        }
        .lp-footer-inner { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
        .lp-footer-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 48px; }
        .lp-footer-links { display: flex; gap: 48px; flex-wrap: wrap; }

        /* ═══════════════════════════
           RESPONSIVE BREAKPOINTS
        ═══════════════════════════ */

        /* Tablet / small laptop */
        @media (max-width: 968px) {
          .lp-hero-inner { grid-template-columns: 1fr; gap: 40px; }
          .lp-hero-left { text-align: center; padding-left: 0; }
          .lp-hero-sub { margin-inline: auto; }
          .lp-trust-badges { justify-content: center; }
          .lp-cta-row { justify-content: center; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .lp-overview-inner { grid-template-columns: 1fr; gap: 40px; }
          .lp-nav-links { display: none; }
          .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .lp-nav { height: 60px; }
          .lp-nav-logo { height: 46px; }
          .lp-login-btn { display: none; }
          .lp-signup-btn { padding: 8px 14px; font-size: 13px; }

          .lp-hero { padding-top: 86px; padding-bottom: 40px; }
          .lp-hero-inner { padding: 0 16px; }
          .lp-h1 { font-size: clamp(28px, 8vw, 40px); letter-spacing: -1px; }
          .lp-hero-badge { padding: 6px 14px; }
          .lp-hero-badge-text { font-size: 10px; letter-spacing: 1.5px; }
          .lp-hero-sub { font-size: 14px; margin-bottom: 28px; }
          .lp-cta-primary { padding: 13px 24px; font-size: 14px; width: 100%; justify-content: center; }
          .lp-cta-secondary { padding: 13px 24px; font-size: 14px; width: 100%; }
          .lp-cta-row { flex-direction: column; }

          .lp-simulator { padding: 16px; }
          .lp-sim-chat { min-height: 150px; }

          .lp-stats { padding: 36px 16px; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .lp-stat-card { padding: 16px 12px; }
          .lp-stat-value { font-size: clamp(20px, 6vw, 28px); }
          .lp-stat-sub { font-size: 9px; }

          .lp-features { padding: 60px 16px; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-section-title { margin-bottom: 40px; }
          .lp-h2 { font-size: clamp(22px, 6vw, 32px); }

          .lp-overview { padding: 50px 16px; }
          .lp-overview-inner { gap: 28px; }
          .lp-overview-panel { padding: 16px; }

          .lp-cta-section { padding: 40px 16px; }
          .lp-cta-inner { padding: 40px 20px; border-radius: 20px; }

          .lp-footer { padding: 48px 16px; }
          .lp-footer-top { flex-direction: column; gap: 32px; }
          .lp-footer-links { gap: 32px; }
        }

        /* Extra small (< 380px) */
        @media (max-width: 380px) {
          .lp-stats-grid { grid-template-columns: 1fr; }
          .lp-h1 { font-size: 26px; }
          .lp-stat-value { font-size: 22px; }
        }

        /* ── Hero Orbits (No Globe) ── */
        .lp-hero-globe-container {
          position: relative;
          width: 100%;
          height: 620px;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
          transform-style: preserve-3d;
        }

        /* Orbiting icon system (Tilted 30 degrees right and left) */
        .orbit-ring-right, .orbit-ring-left {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transform-style: preserve-3d;
        }

        .orbit-ring-right { transform: rotateX(75deg) rotateY(30deg); }
        .orbit-ring-left { transform: rotateX(75deg) rotateY(-30deg); }

        /* Orbit Wrapper (contains static trace & unspinning badge) */
        .orbit-wrapper {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          transform-style: preserve-3d;
          pointer-events: none;
        }

        .orbit-wrapper-right-1 { animation: wrapper-spin-right-1 30s linear infinite; }
        .orbit-wrapper-right-2 { animation: wrapper-spin-right-2 30s linear infinite; }
        .orbit-wrapper-right-3 { animation: wrapper-spin-right-3 30s linear infinite; }
        .orbit-wrapper-left-1 { animation: wrapper-spin-left-1 30s linear infinite; }
        .orbit-wrapper-left-2 { animation: wrapper-spin-left-2 30s linear infinite; }
        .orbit-wrapper-left-3 { animation: wrapper-spin-left-3 30s linear infinite; }

        /* The disappearing trace trail SVG */
        .orbit-trace {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 520px;
          height: 520px;
          pointer-events: none;
        }

        .orbit-badge {
          position: absolute;
          left: 240px;
          top: 0;
          background: ${isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,15,18,0.88)'};
          backdrop-filter: blur(12px);
          border: 1.5px solid var(--badge-color, ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'});
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.2), 
            0 0 15px var(--badge-color-dim, rgba(255,255,255,0)), 
            inset 0 1px 0 rgba(255,255,255,0.05);
          border-radius: 50%;
          width: 76px;
          height: 76px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: var(--badge-color, ${isLight ? '#27272a' : '#fafafa'});
          transform-style: preserve-3d;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
          cursor: pointer;
        }
        .orbit-badge:hover {
          background: var(--badge-color);
          border-color: var(--badge-color);
          color: #ffffff !important;
          box-shadow: 
            0 12px 40px var(--badge-color-dim), 
            0 0 25px var(--badge-color);
        }
        .orbit-label {
          font-size: 8px;
          font-weight: 700;
          color: var(--badge-color, ${isLight ? '#71717a' : '#a1a1aa'});
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: color 0.3s;
        }
        .orbit-badge:hover .orbit-label {
          color: #ffffff !important;
        }

        .orbit-badge-right-1 { --badge-color: #10b981; --badge-color-dim: rgba(16, 185, 129, 0.25); }
        .orbit-badge-right-2 { --badge-color: #ef4444; --badge-color-dim: rgba(239, 68, 68, 0.25); }
        .orbit-badge-right-3 { --badge-color: #3b82f6; --badge-color-dim: rgba(59, 130, 246, 0.25); }
        .orbit-badge-left-1  { --badge-color: #0ea5e9; --badge-color-dim: rgba(14, 165, 233, 0.25); }
        .orbit-badge-left-2  { --badge-color: #f59e0b; --badge-color-dim: rgba(245, 158, 11, 0.25); }
        .orbit-badge-left-3  { --badge-color: #a855f7; --badge-color-dim: rgba(168, 85, 247, 0.25); }

        .orbit-badge-right-1 { animation: badge-unspin-right-1 30s linear infinite; }
        .orbit-badge-right-2 { animation: badge-unspin-right-2 30s linear infinite; }
        .orbit-badge-right-3 { animation: badge-unspin-right-3 30s linear infinite; }
        .orbit-badge-left-1 { animation: badge-unspin-left-1 30s linear infinite; }
        .orbit-badge-left-2 { animation: badge-unspin-left-2 30s linear infinite; }
        .orbit-badge-left-3 { animation: badge-unspin-left-3 30s linear infinite; }

        /* Wrapper animations */
        @keyframes wrapper-spin-right-1 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wrapper-spin-right-2 {
          0% { transform: rotate(120deg); }
          100% { transform: rotate(480deg); }
        }
        @keyframes wrapper-spin-right-3 {
          0% { transform: rotate(240deg); }
          100% { transform: rotate(600deg); }
        }
        @keyframes wrapper-spin-left-1 {
          0% { transform: rotate(60deg); }
          100% { transform: rotate(420deg); }
        }
        @keyframes wrapper-spin-left-2 {
          0% { transform: rotate(180deg); }
          100% { transform: rotate(540deg); }
        }
        @keyframes wrapper-spin-left-3 {
          0% { transform: rotate(300deg); }
          100% { transform: rotate(660deg); }
        }

        /* Badge unspin animations */
        @keyframes badge-unspin-right-1 {
          0% { transform: translate(-50%, -50%) rotate(0deg) rotateY(-30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg) rotateY(-30deg) rotateX(-75deg); }
        }
        @keyframes badge-unspin-right-2 {
          0% { transform: translate(-50%, -50%) rotate(-120deg) rotateY(-30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-480deg) rotateY(-30deg) rotateX(-75deg); }
        }
        @keyframes badge-unspin-right-3 {
          0% { transform: translate(-50%, -50%) rotate(-240deg) rotateY(-30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-600deg) rotateY(-30deg) rotateX(-75deg); }
        }
        @keyframes badge-unspin-left-1 {
          0% { transform: translate(-50%, -50%) rotate(-60deg) rotateY(30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-420deg) rotateY(30deg) rotateX(-75deg); }
        }
        @keyframes badge-unspin-left-2 {
          0% { transform: translate(-50%, -50%) rotate(-180deg) rotateY(30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-540deg) rotateY(30deg) rotateX(-75deg); }
        }
        @keyframes badge-unspin-left-3 {
          0% { transform: translate(-50%, -50%) rotate(-300deg) rotateY(30deg) rotateX(-75deg); }
          100% { transform: translate(-50%, -50%) rotate(-660deg) rotateY(30deg) rotateX(-75deg); }
        }

        /* ── Devices Showcase Section ── */
        .lp-devices-showcase {
          padding: 120px 20px;
          background: #110426;
          border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          position: relative;
          z-index: 1;
          overflow: hidden;
          
          /* Muted purple-theme variables for dark purple background */
          --text-primary: #fafafa;
          --text-secondary: #d8b4fe;
          --text-muted: #a78bfa;
          --bg-border: rgba(168, 85, 247, 0.2);
        }
        .devices-glow-bg {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .lp-devices-showcase::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 50% 30%, rgba(147, 51, 234, 0.04) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
        .lp-devices-showcase-inner {
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
          position: relative;
          z-index: 1;
        }
        .lp-devices-title {
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 500;
          text-align: center;
          font-family: 'Geist', 'Inter', sans-serif;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 30%, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1.2s cubic-bezier(0.16,1,0.3,1), transform 1.2s cubic-bezier(0.16,1,0.3,1);
        }
        .lp-devices-showcase.is-visible .lp-devices-title {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-hero-fade-bridge {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 150px;
          background: linear-gradient(to bottom, transparent, #110426);
          pointer-events: none;
          z-index: 2;
        }
        .lp-floating-divider {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(139, 92, 246, 0.1) 20%,
            rgba(139, 92, 246, 1) 50%,
            rgba(139, 92, 246, 0.1) 80%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: lp-glow-trail 4s linear infinite;
          z-index: 10;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
        }
        .lp-floating-divider::before {
          content: '';
          position: absolute;
          top: -3px;
          left: 0;
          right: 0;
          height: 8px;
          background: inherit;
          background-size: inherit;
          animation: inherit;
          filter: blur(5px);
          opacity: 0.95;
          z-index: -1;
        }
        @keyframes lp-glow-trail {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .lp-devices-grid {
          display: flex;
          flex-direction: row;
          gap: 56px;
          width: 100%;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
        }

        /* ── Shared entrance animation ── */
        .device-mockup-enter {
          opacity: 0;
          transform: translateY(70px) scale(1.15);
          transition: opacity 2.5s cubic-bezier(0.16,1,0.3,1), transform 2.5s cubic-bezier(0.16,1,0.3,1);
          display: inline-block;
        }
        .device-mockup-enter.visible { opacity: 1; transform: translateY(0) scale(1); }
        .device-mockup-enter.delay { transition-delay: 0.4s; }

        /* ── Tablet frame (landscape iPad style) ── */
        .tablet-frame-outer {
          position: relative;
          width: 620px;
          max-width: 90vw;
          background: #1c1c1e;
          border-radius: 26px;
          padding: 18px 18px 30px;
          box-shadow:
            0 0 0 1.5px #3a3a3c,
            0 40px 100px rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: float-slow 9s ease-in-out infinite 0.4s;
        }
        .tablet-frame-camera {
          position: absolute;
          top: 50%;
          left: 9px;
          transform: translateY(-50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2c2c2e;
          border: 1.5px solid #3a3a3c;
        }
        .tablet-frame-camera::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #0a84ff22;
        }
        .tablet-frame-home {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.18);
        }
        .tablet-screen-inner {
          width: 100%;
          aspect-ratio: 1024/576;
          border-radius: 10px;
          overflow: hidden;
          background: #000;
          display: block;
        }
        .tablet-screen-inner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: left top;
          display: block;
        }

        /* ── Phone frame (iPhone dynamic island style) ── */
        .phone-frame-outer {
          position: relative;
          width: 260px;
          background: #1c1c1e;
          border-radius: 48px;
          padding: 14px 10px;
          box-shadow:
            0 0 0 1.5px #3a3a3c,
            0 40px 100px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: float-slow 7s ease-in-out infinite 1.2s;
        }
        .phone-frame-island {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 88px;
          height: 28px;
          background: #000;
          border-radius: 20px;
          z-index: 10;
        }
        .phone-side-btn {
          position: absolute;
          background: #2c2c2e;
          border-radius: 2px;
        }
        .phone-btn-power {
          right: -3px;
          top: 100px;
          width: 3px;
          height: 60px;
        }
        .phone-btn-vol1 {
          left: -3px;
          top: 80px;
          width: 3px;
          height: 36px;
        }
        .phone-btn-vol2 {
          left: -3px;
          top: 126px;
          width: 3px;
          height: 36px;
        }
        .phone-btn-mute {
          left: -3px;
          top: 58px;
          width: 3px;
          height: 18px;
        }
        .phone-home-bar {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 90px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
          z-index: 10;
        }
        .phone-screen-inner {
          width: 100%;
          aspect-ratio: 390/844;
          border-radius: 38px;
          overflow: hidden;
          background: #000;
          display: block;
        }
        .phone-screen-inner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top;
          display: block;
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @media (max-width: 900px) {
          .lp-devices-grid { flex-direction: column; gap: 40px; }
          .tablet-frame-outer { width: 100%; }
          .phone-frame-outer { width: 220px; }
        }

        /* ── Comparison Column Glow Highlight ── */
        .lp-comp-table-wrapper {
          position: relative;
        }
        .rova-column-glow-overlay {
          position: absolute;
          left: 82%;
          right: 1px;
          top: 1px;
          bottom: 1px;
          pointer-events: none;
          z-index: 5;
          overflow: visible;
        }
        .glow-rect-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .glow-rect-path {
          stroke-dasharray: 180 820;
          stroke-dashoffset: 0;
          animation: stroke-move 5s linear infinite;
        }
        @keyframes stroke-move {
          to {
            stroke-dashoffset: -1000;
          }
        }

        /* ── Comparison Section ── */
        .lp-comparison {
          padding: 100px 20px;
          background: ${isLight ? '#ffffff' : '#030303'};
          position: relative;
          z-index: 1;
          border-bottom: 1px solid var(--bg-border);
        }
        .lp-comparison-inner {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .lp-comparison .lp-section-title {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-comparison.is-visible .lp-section-title {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-comp-table-wrapper {
          overflow: hidden; /* Hide all scrollbars */
          border-radius: 16px;
          border: 1px solid var(--bg-border);
          background: ${isLight ? 'rgba(255,255,255,0.4)' : 'rgba(20,20,24,0.3)'};
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          opacity: 0;
          transform: translateY(40px) scale(0.97);
          transition: opacity 1.3s cubic-bezier(0.16, 1, 0.3, 1), transform 1.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-comparison.is-visible .lp-comp-table-wrapper {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .lp-comp-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          table-layout: fixed; /* Force fixed column widths to fit layout */
        }
        .lp-comp-table th,
        .lp-comp-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--bg-border);
          font-size: 13px;
        }
        .lp-comp-table th {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          color: var(--text-primary);
          background: ${isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.01)'};
        }
        .lp-comp-table tr {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .lp-comp-table.is-visible tr {
          opacity: 1;
          transform: translateY(0);
        }
        /* Highlight ROVA Column */
        .lp-comp-header-rova {
          color: #10b981 !important;
          font-weight: 800 !important;
          background: ${isLight ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.1)'} !important;
        }
        .lp-comp-cell-rova {
          font-weight: 600;
        }
        .lp-comp-highlight-box {
          position: absolute;
          left: 82%;
          right: 1px;
          top: 1px;
          bottom: 1px;
          pointer-events: none;
          z-index: 5;
          border: 2.5px solid #10b981;
          border-radius: 0 14px 14px 0;
        }
        .lp-comp-check {
          color: #10b981;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(16,185,129,0.1);
        }
        .lp-comp-cross {
          color: #ef4444;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(239,68,68,0.1);
        }
        .lp-comp-badge-qb {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .lp-comparison {
            padding: 60px 16px;
          }
          .lp-comp-table-wrapper {
            border-radius: 12px;
          }
          .lp-comp-table th,
          .lp-comp-table td {
            padding: 10px 4px !important;
            font-size: 10px !important;
          }
          .lp-comp-badge-qb {
            padding: 2px 4px !important;
            font-size: 8px !important;
            display: inline-block;
          }
          .lp-comp-check, .lp-comp-cross {
            width: 15px !important;
            height: 15px !important;
            font-size: 8px !important;
          }
        }

        /* ── Features Scroll Animations & Dividers ── */
        .lp-section-divider-top {
          position: absolute;
          top: -49px;
          left: 0;
          right: 0;
          height: 50px;
          overflow: hidden;
          z-index: 10;
        }
        .lp-section-divider-bottom {
          position: absolute;
          bottom: -49px;
          left: 0;
          right: 0;
          height: 50px;
          overflow: hidden;
          z-index: 10;
        }
        .lp-section-divider-top svg path,
        .lp-section-divider-bottom svg path {
          fill: #110426;
        }

        .features-glow-bg {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .sparkling-star {
          position: absolute;
          width: 2px;
          height: 2px;
          background: #ffffff;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
          animation: starTwinkle 3s ease-in-out infinite;
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 6px 1.5px rgba(255, 255, 255, 0.9); }
        }
        .features-glow-blob-1 {
          position: absolute;
          top: -10%; left: 10%; width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(147, 51, 234, 0.07) 0%, transparent 70%);
          animation: rotateBlob 20s linear infinite;
        }
        .features-glow-blob-2 {
          position: absolute;
          bottom: -10%; right: 10%; width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
          animation: rotateBlob 25s linear infinite reverse;
        }

        @keyframes rotateBlob {
          0% { transform: rotate(0deg) translate(0px, 0px); }
          50% { transform: rotate(180deg) translate(15px, -15px); }
          100% { transform: rotate(360deg) translate(0px, 0px); }
        }

        @keyframes featureCardReveal {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 640px) {
          .lp-devices-showcase { padding: 60px 16px; }
        }
      `}</style>

      <div className="lp-root">

        {/* ── Navbar ── */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="lp-nav-logo" />
            <div className="lp-nav-links">
              <Link to="/features" className="lp-nav-link">Features</Link>
              <Link to="/solutions" className="lp-nav-link">Solutions</Link>
              <Link to="/pricing" className="lp-nav-link">Pricing</Link>
              <Link to="/company" className="lp-nav-link">Company</Link>
            </div>
            <div className="lp-nav-actions">
              <Link to="/login" className="lp-login-btn">Login</Link>
              <Link to="/signup" className="lp-signup-btn">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <header className="lp-hero">
          <div className="lp-hero-inner">
            {/* Left: Value Proposition */}
            <div className="lp-hero-left animate-scaleIn">
              <h1 className="lp-h1" style={{ fontFamily: "'Geist', 'Inter', sans-serif", fontWeight: 500 }}>
                All your banking <br />
                and bookkeeping, <span className="lp-h1-grad" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>automated.</span>
              </h1>

              <p className="lp-hero-sub" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>
                Connect commercial bank accounts, automate double-entry bookkeeping, and manage corporate compliance in a secure workspace built for scale.
              </p>

              <div className="lp-cta-row">
                <Link to="/signup" className="lp-cta-primary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Start for Free <ArrowRight size={17} />
                </Link>
                <a href="#features" style={{ textDecoration: 'none' }}>
                  <button className="lp-cta-secondary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Explore Platform</button>
                </a>
              </div>

              <div className="lp-trust-badges">
                {['GAAP-Compliant Ledger', 'Direct Bank Sync', 'FIRS Tax Readiness'].map(label => (
                  <div key={label} className="lp-trust-badge">
                    <div className="lp-trust-dot"><Check size={13} /></div>
                    <span className="lp-trust-label" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 3D Orbiting Feature Badges with Disappearing Trace Trails */}
            <div className="lp-hero-globe-container animate-scaleIn">
              {/* Orbit Ring Right (Tilted 30 degrees right) */}
              <div className="orbit-ring-right">
                <div className="orbit-wrapper orbit-wrapper-right-1">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradRight1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradRight1)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-1">
                    <TrendingUp size={22} />
                    <span className="orbit-label">Ledger</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-right-2">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradRight2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradRight2)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-2">
                    <ShieldCheck size={22} />
                    <span className="orbit-label">Tax Hub</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-right-3">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradRight3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradRight3)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-3">
                    <FileText size={22} />
                    <span className="orbit-label">Invoices</span>
                  </div>
                </div>
              </div>

              {/* Orbit Ring Left (Tilted 30 degrees left) */}
              <div className="orbit-ring-left">
                <div className="orbit-wrapper orbit-wrapper-left-1">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradLeft1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradLeft1)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-1">
                    <Link2 size={22} />
                    <span className="orbit-label">Bank Sync</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-left-2">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradLeft2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradLeft2)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-2">
                    <Users2 size={22} />
                    <span className="orbit-label">Payroll</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-left-3">
                  <svg className="orbit-trace" viewBox="-260 -260 520 520">
                    <defs>
                      <linearGradient id="traceGradLeft3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -240 A 240 240 0 0 1 240 0" fill="none" stroke="url(#traceGradLeft3)" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M 13 0 Q 13 5 18 5 Q 13 5 13 10 Q 13 5 8 5 Q 13 5 13 0" />
                      <path d="M 20 0 Q 20 2.5 22.5 2.5 Q 20 2.5 20 5 Q 20 2.5 17.5 2.5 Q 20 2.5 20 0" />
                      <path d="M 21.5 6 Q 21.5 8.5 24 8.5 Q 21.5 8.5 21.5 11 Q 21.5 8.5 19 8.5 Q 21.5 8.5 21.5 6" />
                      <text x="0" y="21" fontFamily="'Inter', 'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="13" letterSpacing="-0.5">AI</text>
                    </svg>
                    <span className="orbit-label">Assistant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lp-hero-fade-bridge" />
        </header>

        {/* ── Devices Showcase Section ── */}
        <section id="devices-section" className={`lp-devices-showcase ${devicesVisible ? 'is-visible' : ''}`}>
          <div className="devices-glow-bg">
            {STAR_COORDINATES.map((star, idx) => (
              <div
                key={idx}
                className="sparkling-star"
                style={{
                  top: star.top,
                  left: star.left,
                  animationDelay: star.delay,
                  animationDuration: star.dur
                }}
              />
            ))}
          </div>
          <div className="lp-devices-showcase-inner">
            <h2 className="lp-devices-title">Unified across every workspace.</h2>
            
            <div className="lp-devices-grid">
              {/* ── Tablet mockup (Dashboard screenshot) ── */}
              <div className={`device-mockup-enter ${devicesVisible ? 'visible' : ''}`}>
                <div className="tablet-frame-outer">
                  <div className="tablet-frame-camera" />
                  <div className="tablet-screen-inner">
                    <img src="/tablet_screenshot.png" alt="ROVA Dashboard" />
                  </div>
                  <div className="tablet-frame-home" />
                </div>
              </div>

              {/* ── Phone mockup (Tax & Compliance screenshot) ── */}
              <div className={`device-mockup-enter delay ${devicesVisible ? 'visible' : ''}`}>
                <div className="phone-frame-outer">
                  <div className="phone-frame-island" />
                  <div className="phone-side-btn phone-btn-mute" />
                  <div className="phone-side-btn phone-btn-vol1" />
                  <div className="phone-side-btn phone-btn-vol2" />
                  <div className="phone-side-btn phone-btn-power" />
                  <div className="phone-screen-inner">
                    <img src="/phone_screenshot.png?v=2" alt="ROVA Chat" />
                  </div>
                  <div className="phone-home-bar" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison Section (ROVA vs The Alternatives) ── */}
        <section id="comparison-section" className={`lp-comparison ${compVisible ? 'is-visible' : ''}`}>
          <div className="lp-floating-divider" />
          <div className="lp-comparison-inner">
            <div className="lp-section-title">
              <h2 className="lp-h2">ROVA vs The Alternatives.</h2>
              <p className="lp-h2-sub">
                ROVA is the only solution that combines automation, inventory, AI, and Africa-native design.
              </p>
            </div>

            <div className="lp-comp-table-wrapper">
              <div style={{ position: 'relative', width: '100%' }}>
                <table className={`lp-comp-table ${compVisible ? 'is-visible' : ''}`}>
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Feature / Capability</th>
                      <th style={{ width: '18%' }}>QuickBooks</th>
                      <th style={{ width: '18%' }}>Excel</th>
                      <th style={{ width: '18%' }}>Moniepoint</th>
                      <th style={{ width: '18%' }} className="lp-comp-header-rova">ROVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        feat: 'Live automatic tracking',
                        qb: <span className="lp-comp-badge-qb">✗ Not in Nigeria</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      },
                      {
                        feat: 'AI automated bookkeeping',
                        qb: <span className="lp-comp-badge-qb">✗ Manual entry</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      },
                      {
                        feat: 'WhatsApp AI chatbot',
                        qb: <span className="lp-comp-cross">✗</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      },
                      {
                        feat: 'Local tax compliance',
                        qb: <span className="lp-comp-cross">✗</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      },
                      {
                        feat: 'Real-time inventory sync',
                        qb: <span className="lp-comp-check">✓</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      },
                      {
                        feat: 'Multi-user collaboration',
                        qb: <span className="lp-comp-check">✓</span>,
                        ex: <span className="lp-comp-cross">✗</span>,
                        mp: <span className="lp-comp-cross">✗</span>,
                        rv: <span className="lp-comp-check">✓</span>
                      }
                    ].map((row, idx) => {
                      const isLast = idx === 5;
                      const cellClass = `lp-comp-cell-rova ${isLast ? 'lp-comp-cell-rova-last' : ''}`;
                      return (
                        <tr key={idx} style={{ transitionDelay: `${idx * 80}ms` }}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.feat}</td>
                          <td>{row.qb}</td>
                          <td>{row.ex}</td>
                          <td>{row.mp}</td>
                          <td className={cellClass}>{row.rv}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="lp-comp-highlight-box">
                  <svg className="glow-rect-svg">
                    <defs>
                      <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="14"
                      ry="14"
                      fill="none"
                      stroke="url(#glowGrad)"
                      strokeWidth="2.5"
                      filter="url(#glowBlur)"
                      pathLength="1000"
                      className="glow-rect-path"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className={`lp-features ${featuresVisible ? 'is-visible' : ''}`}>
          <div className="lp-section-divider-top">
            <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ width: '100%', height: '50px', display: 'block', pointerEvents: 'none' }}>
              <path d="M0,0 Q720,100 1440,0 L1440,100 L0,100 Z" />
            </svg>
          </div>
          <div className="lp-section-divider-bottom">
            <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ width: '100%', height: '50px', display: 'block', transform: 'rotate(180deg)', pointerEvents: 'none' }}>
              <path d="M0,0 Q720,100 1440,0 L1440,100 L0,100 Z" />
            </svg>
          </div>
          <div className="features-glow-bg">
            <div className="features-glow-blob-1" />
            <div className="features-glow-blob-2" />
            {STAR_COORDINATES.map((star, idx) => (
              <div
                key={idx}
                className="sparkling-star"
                style={{
                  top: star.top,
                  left: star.left,
                  animationDelay: star.delay,
                  animationDuration: star.dur
                }}
              />
            ))}
          </div>
          <div className="lp-features-inner">
            <div className="lp-section-title">
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 12 }}>Platform Features</span>
              <h2 className="lp-h2">Features engineered for <br />massive operations</h2>
            </div>

            <div className="lp-features-grid">
              {[
                {
                  title: 'Live Bank Sync',
                  desc: 'Connect multiple Nigerian bank accounts in real-time. Automatically ingest statements and sync transaction feeds in a single dashboard.',
                  icon: <Globe size={22} color="#3b82f6" />
                },
                {
                  title: 'AI Bookkeeper',
                  desc: 'Instantly categorize transaction intent, post details to a double-entry ledger, and update reports with zero manual data entry.',
                  icon: <Zap size={22} color="#ec4899" />
                },
                {
                  title: 'Expense & Outflows',
                  desc: 'Track paid bills, upload and store receipts securely, and automatically link documents to your business expenses.',
                  icon: <FileText size={22} color="#a855f7" />
                },
                {
                  title: 'VAT & PAYE Compliance',
                  desc: 'Stay audit-ready for FIRS. Automatically compute local tax liabilities, VAT at 7.5%, WHT, and progressive PAYE tax brackets.',
                  icon: <ShieldCheck size={22} color="#10b981" />
                },
                {
                  title: 'Automated Inventory',
                  desc: 'Track product stock levels in real-time. Automatically deduct inventory quantities on invoices and calculate dynamic Cost of Goods Sold (COGS).',
                  icon: <BarChart3 size={22} color="#eab308" />
                },
                {
                  title: 'WhatsApp AI Assistant',
                  desc: 'Manage your books from your favorite chat app. Message our AI bot to log invoices, check balances, and generate instant financial reports.',
                  icon: <UserCheck size={22} color="#ef4444" />
                }
              ].map((f, i) => (
                <div
                  key={i}
                  className="lp-feature-card"
                  style={{
                    opacity: 0,
                    animation: featuresVisible ? 'featureCardReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
                    animationDelay: `${i * 80}ms`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {f.icon}
                    <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Geist', 'Inter', sans-serif" }}>{f.title}</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 13.5 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Financials Overview ── */}
        <section className="lp-overview">
          <div className="lp-overview-inner">
            <div className="lp-overview-panel animate-float">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Real-time Profit &amp; Loss Ledger</span>
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                  <ArrowUpRight size={13} /> +12.4% Net Margin
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Asset Class Accounts Inflow', val: '₦4,850,000', prc: 85, color: '#10b981' },
                  { label: 'Operational Salaries & COGS Outflow', val: '₦1,240,000', prc: 32, color: '#ef4444' },
                  { label: 'Statutory FIRS Tax Reserve', val: '₦363,750', prc: 18, color: '#3b82f6' }
                ].map((stat, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                      <span>{stat.label}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{stat.val}</strong>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${stat.prc}%`, height: '100%', background: stat.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 500, marginBottom: 20, lineHeight: 1.15, fontFamily: "'Geist', 'Inter', sans-serif" }}>
                Consolidated financials. <br />
                <span style={{ background: 'linear-gradient(135deg, var(--accent-light), #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Geist', 'Inter', sans-serif" }}>
                  Zero guesswork.
                </span>
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 28 }}>
                Connecting bank APIs or transaction emails automatically updates the double-entry accounting lines, managing statements, inventory logs, and FIRS tax files autonomously.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Unified multi-bank accounts tracking in one centralised hub',
                  'FIRS tax filing compliance records (VAT, PIT/PAYE, CIT)',
                  'AI Intent Handler: updates catalogs, payroll runs and invoices',
                  'Designed for rapid, zero-overhead business scale'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                    <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0 }} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta-section">
          <div className="lp-cta-inner">
            <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', filter: 'blur(30px)' }} />
            <div style={{ position: 'absolute', bottom: -120, left: -120, width: 380, height: 380, background: 'rgba(0,0,0,0.12)', borderRadius: '50%', filter: 'blur(35px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 'clamp(26px, 5vw, 52px)', fontWeight: 500, color: '#fff', marginBottom: 16, lineHeight: 1.1, letterSpacing: '-1px', fontFamily: "'Geist', 'Inter', sans-serif" }}>
                Scale your business financials today.
              </h2>
              <p style={{ fontSize: 'clamp(14px, 1.6vw, 18px)', color: 'rgba(255,255,255,0.92)', marginBottom: 36, maxWidth: 580, marginInline: 'auto', fontWeight: 500, lineHeight: 1.65 }}>
                Join forward-thinking businesses and founders driving scale on ROVA. Connect banking APIs and automate your financial records.
              </p>
              <Link to="/signup" style={{
                textDecoration: 'none', background: '#fff', color: '#7c3aed',
                padding: '14px 40px', fontSize: 15, fontWeight: 800, borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Get Started for Free
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-top">
              <div style={{ maxWidth: 340 }}>
                <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 52, marginBottom: 18 }} />
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14, marginBottom: 20 }}>
                  The intelligent financial operating system for African SMEs.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="email"
                    placeholder="Join our newsletter"
                    style={{
                      flex: 1, padding: '10px 13px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--bg-border)',
                      background: isLight ? '#f9f9f9' : 'rgba(255,255,255,0.02)',
                      color: 'var(--text-primary)', fontSize: 13, minWidth: 0
                    }}
                  />
                  <Button variant="primary" style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: 13, flexShrink: 0 }}>Join</Button>
                </div>
              </div>

              <div className="lp-footer-links">
                {[
                  { title: 'Solutions', items: ['Banking', 'Accounting', 'Payroll', 'Invoicing', 'Tax Compliance'] },
                  { title: 'Resources', items: ['Documentation', 'Help Center', 'Blog', 'API Status', 'Security'] },
                  { title: 'Company', items: ['About Us', 'Contact', 'Privacy', 'Terms'] },
                ].map(col => (
                  <div key={col.title}>
                    <h4 style={{ fontWeight: 800, marginBottom: 20, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.title}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {col.items.map(item => {
                        const isRouterLink = item === 'Privacy' || item === 'Terms' || item === 'About Us' || col.title === 'Solutions';
                        let path = '#';
                        if (item === 'Privacy') path = '/privacy';
                        else if (item === 'Terms') path = '/terms';
                        else if (item === 'About Us') path = '/company';
                        else if (col.title === 'Solutions') path = '/solutions';

                        return (
                          <li key={item}>
                            {isRouterLink
                              ? <Link to={path} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{item}</Link>
                              : <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{item}</a>
                            }
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 28, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA Business. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
