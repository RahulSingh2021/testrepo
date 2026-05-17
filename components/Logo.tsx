
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 1000 1000" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      width="40"
      height="40"
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    >
      {/* Outer Dark Ring */}
      <circle cx="500" cy="500" r="480" fill="#2d3748" stroke="#1a202c" strokeWidth="20" />
      
      {/* Red Ring Border */}
      <circle cx="500" cy="500" r="450" fill="none" stroke="#e53e3e" strokeWidth="5" />
      <circle cx="500" cy="500" r="400" fill="none" stroke="#e53e3e" strokeWidth="3" />

      {/* HACCP PRO Text (Top Arc) */}
      <defs>
        <path id="topArc" d="M 200,500 A 300,300 0 1,1 800,500" fill="none" />
        <path id="bottomArc" d="M 800,500 A 300,300 0 1,1 200,500" fill="none" />
      </defs>
      
      <text fill="white" fontSize="90" fontWeight="900" fontFamily="Inter, sans-serif">
        <textPath xlinkHref="#topArc" startOffset="50%" textAnchor="middle">
          HACCP PRO
        </textPath>
      </text>

      {/* FOOD SAFETY Text (Bottom Arc) */}
      <text fill="#ecc94b" fontSize="85" fontWeight="900" fontFamily="Inter, sans-serif">
        <textPath xlinkHref="#bottomArc" startOffset="50%" textAnchor="middle">
          FOOD SAFETY
        </textPath>
      </text>

      {/* Stars */}
      <polygon points="150,580 165,540 130,515 170,515 185,475 200,515 240,515 205,540 220,580 185,555" fill="#e53e3e" />
      <polygon points="850,580 835,540 870,515 830,515 815,475 800,515 760,515 795,540 780,580 815,555" fill="#e53e3e" />

      {/* Central White Graphic */}
      <circle cx="500" cy="480" r="160" fill="white" />
      
      {/* Fork Graphic */}
      <path d="M 460,430 L 460,500 L 475,500 L 475,430 M 485,430 L 485,500 L 500,500 L 500,430 M 510,430 L 510,500 L 525,500 L 525,430 M 535,430 L 535,500 L 550,500 L 550,430" fill="#2d3748" />
      <path d="M 470,500 Q 505,580 540,500 L 525,500 L 525,550 L 485,550 L 485,500 Z" fill="#2d3748" />

      {/* Hands Graphic */}
      <path d="M 330,450 Q 280,450 285,520 L 285,600 Q 285,720 480,720 L 520,720 Q 715,720 715,600 L 715,520 Q 720,450 670,450 L 670,550 Q 670,640 500,640 Q 330,640 330,550 Z" fill="white" />
      
      {/* Apple Leaves */}
      <path d="M 500,320 Q 470,280 520,280 Q 520,320 500,320 Z" fill="white" />
      <path d="M 500,320 Q 530,280 480,280 Q 480,320 500,320 Z" fill="white" />
    </svg>
  );
};

export default Logo;
