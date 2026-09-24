import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  ShieldCheck,
  ArrowRight,
  Users2,
  Check,
  TrendingUp,
  FileText,
  Link2,
  MessageSquare,
  Package,
  Receipt,
  PieChart,
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500;1,600;1,700;1,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .lp-root {
          min-height: 100vh;
          background: ${isLight
          ? 'radial-gradient(circle at 50% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
          : 'radial-gradient(circle at 50% 0%, rgba(147,51,234,0.06) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Inter', 'Geist', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* ── Navbar ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; height: 72px;
          background: ${isLight ? 'rgba(244,244,245,0.75)' : 'rgba(9,9,11,0.75)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.07)'};
          z-index: 100; display: flex; align-items: center; justify-content: center;
          box-shadow: ${isLight ? '0 4px 30px rgba(0,0,0,0.02)' : '0 4px 30px rgba(0,0,0,0.25)'};
        }
        .lp-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 24px;
          display: flex; align-items: center; justify-content: space-between;
          position: relative;
        }
        .lp-nav-logo { height: 52px; cursor: pointer; }
        .lp-nav-links {
          position: absolute; left: 50%; transform: translateX(-50%);
          display: flex; gap: 28px;
        }
        .lp-nav-link {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .lp-nav-link:hover { color: var(--text-primary); }
        .lp-nav-actions { display: flex; gap: 12px; align-items: center; }
        .lp-login-btn {
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; color: var(--text-primary); font-size: 14px;
          font-weight: 600; padding: 8px 18px; border-radius: var(--radius-md);
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.2)' : 'rgba(255,255,255,0.2)'};
          background: transparent;
          transition: all 0.2s;
        }
        .lp-login-btn:hover {
          border-color: ${isLight ? 'rgba(9,9,11,0.4)' : 'rgba(255,255,255,0.4)'};
          background: ${isLight ? 'rgba(9,9,11,0.04)' : 'rgba(255,255,255,0.06)'};
        }
        .lp-signup-btn {
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed, #3b82f6, var(--accent-primary));
          background-size: 300% auto;
          color: #fff; font-size: 14px; font-weight: 700;
          padding: 9px 22px; border-radius: var(--radius-md);
          display: flex; align-items: center;
          box-shadow: 0 4px 14px rgba(147, 51, 234, 0.25);
          transition: background-position 0.6s ease, transform 0.2s;
        }
        .lp-signup-btn:hover {
          background-position: right center;
          transform: scale(1.03) translateY(-1px);
        }

        /* ── Hero ── */
        .lp-hero {
          padding-top: 130px; padding-bottom: 90px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          position: relative; z-index: 1;
          overflow: hidden;
          background: ${isLight
          ? 'radial-gradient(circle at 50% 30%, rgba(147,51,234,0.05), transparent 70%), #f8f9fa'
          : 'radial-gradient(circle at 50% 30%, rgba(147,51,234,0.1), transparent 70%), #09090b'};
        }
        .lp-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
            linear-gradient(${isLight ? 'rgba(9,9,11,0.04)' : 'rgba(255,255,255,0.035)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isLight ? 'rgba(9,9,11,0.04)' : 'rgba(255,255,255,0.035)'} 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(circle at 50% 45%, black 60%, transparent 90%);
          -webkit-mask-image: radial-gradient(circle at 50% 45%, black 60%, transparent 90%);
          pointer-events: none;
          z-index: 0;
        }
        .lp-hero-inner {
          max-width: 1040px; width: 100%; padding: 0 20px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          position: relative; z-index: 1;
        }
        .lp-hero-left {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding-left: 0; width: 100%; max-width: 900px;
        }
        .lp-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px;
          background: ${isLight ? 'rgba(9,9,11,0.04)' : 'rgba(255,255,255,0.04)'};
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.12)' : 'rgba(255,255,255,0.12)'};
          border-radius: 100px; margin-bottom: 28px;
          cursor: default; backdrop-filter: blur(12px);
        }
        .lp-badge-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulseDot 2s infinite;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .lp-hero-badge-text {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          letter-spacing: 0.2px; font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lp-h1 {
          font-size: clamp(38px, 6vw, 80px);
          font-weight: 600; line-height: 1.12; margin-bottom: 24px;
          letter-spacing: -0.02em; font-family: 'Playfair Display', 'Georgia', serif;
          color: var(--text-primary); text-align: center;
        }
        @keyframes textGradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .lp-h1-italic {
          font-family: 'Playfair Display', 'Georgia', serif;
          font-style: italic; font-weight: 500;
          background: linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #10b981);
          background-size: 300% auto;
          animation: textGradientShift 7s ease infinite;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-hero-sub {
          font-size: clamp(16px, 2vw, 20px); color: var(--text-secondary);
          line-height: 1.65; margin: 0 auto 36px; max-width: 720px; text-align: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lp-cta-row { display: flex; gap: 16px; justify-content: center; align-items: center; flex-wrap: wrap; margin-bottom: 40px; }
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
          background: transparent;
          color: var(--text-primary); border: 1px solid ${isLight ? 'rgba(9,9,11,0.2)' : 'rgba(255,255,255,0.2)'};
          padding: 14px 28px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s;
          backdrop-filter: blur(10px);
        }
        .lp-cta-secondary:hover {
          background: ${isLight ? 'rgba(9,9,11,0.05)' : 'rgba(255,255,255,0.05)'};
          border-color: ${isLight ? 'rgba(9,9,11,0.4)' : 'rgba(255,255,255,0.4)'};
        }
        .lp-cta-whatsapp-signup {
          text-decoration: none;
          background: linear-gradient(135deg, #25D366, #128C7E);
          background-size: 200% auto;
          color: #fff; padding: 14px 28px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); display: flex; align-items: center;
          gap: 10px; transition: background-position 0.6s ease, transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.25);
        }
        .lp-cta-whatsapp-signup:hover {
          background-position: right center;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 25px rgba(37, 211, 102, 0.35);
        }
        .lp-trust-badges { display: flex; gap: 24px; justify-content: center; margin-bottom: 48px; flex-wrap: wrap; }
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

        /* ── 4-Row Horizontal Marquee Carousel ── */
        .lp-marquee-section {
          padding: 90px 0;
          position: relative;
          overflow: hidden;
          background: #090314;
          border-top: 1px solid rgba(168, 85, 247, 0.15);
          border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          display: flex;
          flex-direction: column;
          gap: 20px;
          z-index: 1;
        }
        .lp-marquee-mask {
          width: 100%;
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 92%, transparent 100%);
        }
        .lp-marquee-track {
          display: flex;
          gap: 20px;
          width: max-content;
        }
        .lp-marquee-track.track-left-1 {
          animation: marqueeScrollLeft 34s linear infinite;
        }
        .lp-marquee-track.track-right-1 {
          animation: marqueeScrollRight 44s linear infinite;
        }
        .lp-marquee-track.track-left-2 {
          animation: marqueeScrollLeft 28s linear infinite;
        }
        .lp-marquee-track.track-right-2 {
          animation: marqueeScrollRight 38s linear infinite;
        }
        .lp-marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marqueeScrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeScrollRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .lp-marquee-card {
          flex-shrink: 0;
          width: 360px;
          padding: 26px 30px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(168, 85, 247, 0.18);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 135px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .lp-marquee-card:hover {
          transform: translateY(-4px);
          border-color: rgba(168, 85, 247, 0.45);
          box-shadow: 0 12px 30px rgba(168, 85, 247, 0.2);
        }
        .lp-marquee-quote {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: #a855f7;
          line-height: 1;
          margin-bottom: 10px;
        }
        .lp-marquee-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.25;
          letter-spacing: 0.02em;
        }

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
        /* ── Features Section Split Header CSS ── */
        .lp-features-header-split {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 40px;
          margin-bottom: 56px;
          flex-wrap: wrap;
        }
        .lp-features-header-left {
          max-width: 600px;
        }
        .lp-features-badge-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px;
          background: rgba(168, 85, 247, 0.12);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 100px; margin-bottom: 18px;
          font-size: 11px; font-weight: 700; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 1.5px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lp-features-h2-title {
          font-size: clamp(34px, 4.5vw, 54px);
          font-weight: 600; line-height: 1.15; letter-spacing: -0.02em;
          font-family: 'Playfair Display', 'Georgia', serif;
          color: #ffffff;
        }
        .lp-features-h2-italic {
          font-family: 'Playfair Display', 'Georgia', serif;
          font-style: italic; font-weight: 500;
          background: linear-gradient(135deg, #a855f7, #3b82f6, #ec4899);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-features-header-right {
          max-width: 440px;
          font-size: 15px; color: var(--text-secondary); line-height: 1.65;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding-bottom: 6px;
        }

        .lp-features-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
        }
        .lp-feature-card {
          padding: 0; border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(168, 85, 247, 0.15);
          overflow: hidden;
          backdrop-filter: blur(20px); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          cursor: default; display: flex; flex-direction: column;
        }
        .lp-features .lp-feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(168, 85, 247, 0.15);
        }
        .lp-feature-card:hover {
          transform: translateY(-5px);
          border-color: rgba(168, 85, 247, 0.4);
          box-shadow: 0 12px 30px rgba(168, 85, 247, 0.15);
        }
        .lp-feature-card-image-wrap {
          position: relative;
          width: 100%;
          height: 200px;
          background: #0d0618;
          overflow: hidden;
        }
        .lp-feature-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0.85;
          transition: transform 0.4s ease, opacity 0.4s ease;
        }
        .lp-feature-card:hover .lp-feature-card-img {
          transform: scale(1.04);
          opacity: 1;
        }
        .lp-feature-card-number {
          position: absolute;
          top: 14px;
          left: 16px;
          font-family: 'Playfair Display', serif;
          font-size: 26px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 2px 8px rgba(0,0,0,0.6);
          z-index: 2;
        }
        .lp-feature-card-tag {
          position: absolute;
          top: 14px;
          right: 16px;
          padding: 4px 10px;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          z-index: 2;
        }
        .lp-feature-card-lock {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          z-index: 2;
        }
        .lp-feature-card-body {
          padding: 22px 24px 26px 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
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
          height: 800px;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
          transform-style: preserve-3d;
          margin-top: 10px;
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
          width: 760px;
          height: 760px;
          pointer-events: none;
        }

        .orbit-badge {
          position: absolute;
          left: 360px;
          top: 0;
          background: ${isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,15,18,0.88)'};
          backdrop-filter: blur(12px);
          border: 1.5px solid var(--badge-color, ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'});
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, ${isLight ? '0.08' : '0.2'}), 
            0 0 ${isLight ? '28px' : '20px'} var(--badge-color-dim, rgba(255,255,255,0)), 
            ${isLight ? '0 0 48px var(--badge-color-dim, rgba(255,255,255,0)),' : ''}
            inset 0 1px 0 rgba(255,255,255,0.05);
          border-radius: 50%;
          width: 100px;
          height: 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
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
          font-size: 10.5px;
          font-weight: 700;
          color: var(--badge-color, ${isLight ? '#71717a' : '#a1a1aa'});
          text-transform: uppercase;
          letter-spacing: 0.6px;
          transition: color 0.3s;
        }
        .orbit-badge:hover .orbit-label {
          color: #ffffff !important;
        }

        .orbit-badge-right-1 { --badge-color: #10b981; --badge-color-dim: rgba(16, 185, 129, ${isLight ? '0.45' : '0.25'}); }
        .orbit-badge-right-2 { --badge-color: #ef4444; --badge-color-dim: rgba(239, 68, 68, ${isLight ? '0.45' : '0.25'}); }
        .orbit-badge-right-3 { --badge-color: #3b82f6; --badge-color-dim: rgba(59, 130, 246, ${isLight ? '0.45' : '0.25'}); }
        .orbit-badge-left-1  { --badge-color: #0ea5e9; --badge-color-dim: rgba(14, 165, 233, ${isLight ? '0.45' : '0.25'}); }
        .orbit-badge-left-2  { --badge-color: #f59e0b; --badge-color-dim: rgba(245, 158, 11, ${isLight ? '0.45' : '0.25'}); }
        .orbit-badge-left-3  { --badge-color: #a855f7; --badge-color-dim: rgba(168, 85, 247, ${isLight ? '0.45' : '0.25'}); }

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
        /* ── WhatsApp 2-Column Split Showcase CSS ── */
        .showcase-split-stage {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 64px;
          align-items: center;
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .showcase-phone-frame-left {
          width: 320px;
          max-width: 90vw;
          background: #0b141a;
          border: 2px solid ${isLight ? 'rgba(9,9,11,0.15)' : 'rgba(255,255,255,0.15)'};
          border-radius: 42px;
          padding: 8px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          position: relative;
          z-index: 2;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .showcase-phone-frame-left:hover {
          transform: translateY(-6px) scale(1.01);
        }
        .showcase-phone-inner-left {
          width: 100%;
          border-radius: 34px;
          overflow: hidden;
          background: #0b141a;
          position: relative;
        }
        .showcase-phone-inner-left img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          border-radius: 34px;
        }

        .showcase-content-right {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .showcase-badge-right {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px;
          background: rgba(37, 211, 102, 0.1);
          border: 1px solid rgba(37, 211, 102, 0.3);
          border-radius: 100px; margin-bottom: 20px;
          font-size: 12px; font-weight: 700; color: #25D366;
          text-transform: uppercase; letter-spacing: 1.5px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .showcase-h2-right {
          font-size: clamp(32px, 4.2vw, 54px);
          font-weight: 600; line-height: 1.15;
          letter-spacing: -0.02em;
          font-family: 'Playfair Display', 'Georgia', serif;
          color: #ffffff;
          margin-bottom: 20px;
        }
        .showcase-h2-accent {
          background: linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #10b981);
          background-size: 300% auto;
          animation: textGradientShift 7s ease infinite;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          font-style: italic;
        }
        .showcase-desc-right {
          font-size: 16px; color: #ffffff;
          line-height: 1.65; margin-bottom: 32px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .showcase-features-list {
          display: flex; flex-direction: column; gap: 16px; margin-bottom: 36px; width: 100%;
        }
        .showcase-feature-item {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 14px;
          backdrop-filter: blur(10px);
          transition: border-color 0.2s, background 0.2s;
        }
        .showcase-feature-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(168, 85, 247, 0.4);
        }
        .showcase-feature-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 18px;
        }
        .showcase-feature-title {
          font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 2px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .showcase-feature-text {
          font-size: 12.5px; color: #ffffff; line-height: 1.5; opacity: 0.95;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        @media (max-width: 900px) {
          .showcase-split-stage {
            grid-template-columns: 1fr;
            gap: 40px;
            text-align: center;
          }
          .showcase-content-right { align-items: center; text-align: center; }
          .showcase-phone-frame-left { margin: 0 auto; width: 280px; }
        }

        @media (max-width: 900px) {
          .showcase-stage { flex-direction: column; gap: 40px; }
          .showcase-flank-left, .showcase-flank-right {
            transform: none !important;
            width: 100%;
            max-width: 340px;
          }
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
            {/* Centered Hero Content */}
            <div className="lp-hero-left animate-scaleIn">
              <div className="lp-hero-badge">
                <span className="lp-badge-dot"></span>
                <span className="lp-hero-badge-text">24/7 active accounting workflows right now</span>
              </div>

              <h1 className="lp-h1">
                The numbers are complicated. <br />
                <span className="lp-h1-italic">Running your business</span> <br />
                shouldn't be.
              </h1>

              <p className="lp-hero-sub">
                Send voice notes 🎙️, receipt photos 📷, or text messages 💬 directly to ROVA on WhatsApp. Automatically log expenses, issue client invoices, and track bank accounts in real time — or walk away with total clarity.
              </p>

              <div className="lp-cta-row">
                <a
                  href="https://wa.me/2349132957881?text=Hello%20ROVA!%20I%20want%20to%20start%20logging%20my%20transactions."
                  target="_blank"
                  rel="noreferrer"
                  className="lp-cta-primary"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Chat on WhatsApp AI</span> <ArrowRight size={17} />
                </a>
                <Link to="/signup" style={{ textDecoration: 'none' }}>
                  <button className="lp-cta-secondary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Get Started</button>
                </Link>
              </div>

              <div className="lp-trust-badges">
                {['Manage business on WhatsApp', 'Direct connection to bank', 'Automated tax filing'].map(label => (
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
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradRight1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradRight1)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-1">
                    <TrendingUp size={28} />
                    <span className="orbit-label">Ledger</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-right-2">
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradRight2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradRight2)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-2">
                    <ShieldCheck size={28} />
                    <span className="orbit-label">Tax Hub</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-right-3">
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradRight3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradRight3)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-right-3">
                    <FileText size={28} />
                    <span className="orbit-label">Invoices</span>
                  </div>
                </div>
              </div>

              {/* Orbit Ring Left (Tilted 30 degrees left) */}
              <div className="orbit-ring-left">
                <div className="orbit-wrapper orbit-wrapper-left-1">
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradLeft1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradLeft1)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-1">
                    <Link2 size={28} />
                    <span className="orbit-label">Bank Sync</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-left-2">
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradLeft2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradLeft2)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-2">
                    <Users2 size={28} />
                    <span className="orbit-label">Payroll</span>
                  </div>
                </div>

                <div className="orbit-wrapper orbit-wrapper-left-3">
                  <svg className="orbit-trace" viewBox="-380 -380 760 760">
                    <defs>
                      <linearGradient id="traceGradLeft3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={isLight ? 0.8 : 0.45} />
                      </linearGradient>
                    </defs>
                    <path d="M 0 -360 A 360 360 0 0 1 360 0" fill="none" stroke="url(#traceGradLeft3)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                  <div className="orbit-badge orbit-badge-left-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
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

        {/* ── WhatsApp Showcase Section ── */}
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
            <div className="showcase-split-stage">
              {/* ── Left: WhatsApp Mobile Phone Frame ── */}
              <div className="showcase-phone-frame-left">
                <div className="showcase-phone-inner-left">
                  <img src="/whatsapp_showcase.png" alt="ROVA WhatsApp AI Accounting Chat" />
                </div>
              </div>

              {/* ── Right: Text Content & Features ── */}
              <div className="showcase-content-right">
                <div className="showcase-badge-right">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', boxShadow: '0 0 10px #25D366' }} />
                  WhatsApp AI Assistant
                </div>

                <h2 className="showcase-h2-right">
                  Manage your business <br />
                  <span className="showcase-h2-accent">directly from your WhatsApp.</span>
                </h2>

                <p className="showcase-desc-right">
                  No need to open complex accounting software. Message ROVA on WhatsApp to log sales, record expenses, issue invoices, and keep your business audit-ready 24/7.
                </p>

                <div className="showcase-features-list">
                  <div className="showcase-feature-item">
                    <div className="showcase-feature-icon">🎙️</div>
                    <div>
                      <div className="showcase-feature-title">Voice Note Bookkeeping</div>
                      <div className="showcase-feature-text">Send audio messages like "Paid ₦13,000 for electricity to IKEDC". ROVA transcribes & logs the expense automatically.</div>
                    </div>
                  </div>

                  <div className="showcase-feature-item">
                    <div className="showcase-feature-icon">📷</div>
                    <div>
                      <div className="showcase-feature-title">Instant OCR Receipt Scanner</div>
                      <div className="showcase-feature-text">Snap photos of physical paper receipts. ROVA extracts amounts, vendor names, and tax details instantly.</div>
                    </div>
                  </div>

                  <div className="showcase-feature-item">
                    <div className="showcase-feature-icon">⚡</div>
                    <div>
                      <div className="showcase-feature-title">Real-Time Financial Reports</div>
                      <div className="showcase-feature-text">Ask ROVA for your current cash balance, net profit margin, or FIRS tax reserves anytime in chat.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4-Row Horizontal Marquee Carousel Section ── */}
        <section id="marquee-section" className="lp-marquee-section">
          {[
            {
              trackClass: 'track-left-1',
              items: [
                'Track income and expenses.',
                'Record sales and purchases.',
                'Create invoices.',
                'Track income and expenses.',
                'Record sales and purchases.',
                'Create invoices.'
              ]
            },
            {
              trackClass: 'track-right-1',
              items: [
                'Generate receipts.',
                'Monitor inventory.',
                'Connect bank accounts.',
                'Generate receipts.',
                'Monitor inventory.',
                'Connect bank accounts.'
              ]
            },
            {
              trackClass: 'track-left-2',
              items: [
                'Track cash flow.',
                'Calculate profit and loss.',
                'Manage staff payments.',
                'Track cash flow.',
                'Calculate profit and loss.',
                'Manage staff payments.'
              ]
            },
            {
              trackClass: 'track-right-2',
              items: [
                'Organize business records.',
                'Track tax obligations.',
                'File your taxes.',
                'Organize business records.',
                'Track tax obligations.',
                'File your taxes.'
              ]
            }
          ].map((row, rIdx) => (
            <div key={rIdx} className="lp-marquee-mask">
              <div className={`lp-marquee-track ${row.trackClass}`}>
                {[...row.items, ...row.items].map((text, cIdx) => (
                  <div key={cIdx} className="lp-marquee-card">
                    <div className="lp-marquee-text">{text}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            <div className="lp-features-header-split">
              <div className="lp-features-header-left">
                <div className="lp-features-badge-pill">
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }}></span>
                  Platform Features
                </div>
                <h2 className="lp-features-h2-title">
                  Built for clarity. <br />
                  <span className="lp-features-h2-italic">Designed for growth.</span>
                </h2>
              </div>
              <div className="lp-features-header-right">
                Everything you need to automate your business bookkeeping, track real-time profit, manage inventory, and file taxes with confidence.
              </div>
            </div>

            <div className="lp-features-grid">
              {[
                {
                  num: '#01',
                  tag: 'Bookkeeping',
                  img: '/feature_sale_expense.jpg',
                  title: 'Track Every Sale & Expense',
                  desc: 'Record money coming in and going out without spreadsheets or complicated bookkeeping.',
                  icon: <FileText size={20} color="#a855f7" />
                },
                {
                  num: '#02',
                  tag: 'WhatsApp AI',
                  img: '/feature_whatsapp.jpg',
                  title: 'WhatsApp AI Assistant',
                  desc: 'Send ROVA a text, voice note, or photo on WhatsApp and let it turn your business activity into organized records.',
                  icon: <MessageSquare size={20} color="#25D366" />
                },
                {
                  num: '#03',
                  tag: 'Analytics',
                  img: '/feature_profit.jpg',
                  title: 'Know Your Profit',
                  desc: 'See how much your business is actually making after tracking your income and expenses.',
                  icon: <PieChart size={20} color="#3b82f6" />
                },
                {
                  num: '#04',
                  tag: 'Inventory',
                  img: '/feature_inventory.jpg',
                  title: 'Manage Your Inventory',
                  desc: 'Keep track of what you have, what you’ve sold, and what you need to restock.',
                  icon: <Package size={20} color="#eab308" />
                },
                {
                  num: '#05',
                  tag: 'Billing',
                  img: '/feature_invoice.png',
                  title: 'Invoices & Receipts',
                  desc: 'Create professional invoices and receipts for customers without having to design them yourself.',
                  icon: <Receipt size={20} color="#ec4899" />
                },
                {
                  num: '#06',
                  tag: 'Compliance',
                  img: '/feature_tax.jpg',
                  title: 'Tax & Financial Records',
                  desc: 'Keep financial information organized and get help with your tax records and filing when needed.',
                  icon: <ShieldCheck size={20} color="#10b981" />
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
                  <div className="lp-feature-card-image-wrap">
                    <span className="lp-feature-card-number" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{f.num}</span>
                    <span className="lp-feature-card-tag" style={{ fontFamily: "'Noto Sans JP', sans-serif", letterSpacing: '0.05em' }}>{f.tag}</span>
                    <img src={f.img} alt={f.title} className="lp-feature-card-img" />
                  </div>
                  <div className="lp-feature-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {f.icon}
                      <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif", color: '#ffffff' }}>{f.title}</h3>
                    </div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.6, fontSize: 13.5, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 400, margin: 0 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
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
                  ROVA SOFTWARE LIMITED — The financial management platform for businesses.
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
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA SOFTWARE LIMITED. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
