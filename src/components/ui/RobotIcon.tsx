import type { CSSProperties } from 'react';

interface RobotIconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export default function RobotIcon({ size = 20, color = 'currentColor', style, className }: RobotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 92 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
    >
      {/* Top Antenna Ball */}
      <circle cx="46" cy="13" r="6.5" stroke={color} strokeWidth="5.5" fill="none" />
      {/* Antenna Stem */}
      <line x1="46" y1="19.5" x2="46" y2="28" stroke={color} strokeWidth="5.5" strokeLinecap="round" />

      {/* Left Ear */}
      <rect x="4" y="42" width="11" height="24" rx="5" stroke={color} strokeWidth="5.5" fill="none" />
      {/* Right Ear */}
      <rect x="77" y="42" width="11" height="24" rx="5" stroke={color} strokeWidth="5.5" fill="none" />

      {/* Main Head */}
      <rect x="15" y="27" width="62" height="54" rx="14" stroke={color} strokeWidth="5.5" fill="none" />

      {/* Eyes */}
      <circle cx="35" cy="49" r="4.5" fill={color} />
      <circle cx="57" cy="49" r="4.5" fill={color} />

      {/* Smile */}
      <path
        d="M34 63.5C37.5 68.5 42 71 46 71C50 71 54.5 68.5 58 63.5"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
