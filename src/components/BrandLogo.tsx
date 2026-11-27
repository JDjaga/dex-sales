import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Places logo1 (Colakin) cleanly above and logo2 (DeX) closely below it.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => {
  const logo1H = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6';
  const logo2H = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9';

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`}>
      <img
        src="/assets/aistudio/logo1_16846f13.png"
        alt="Colakin"
        referrerPolicy="no-referrer"
        className={`${logo1H} w-auto object-contain`}
      />
      <img
        src="/assets/aistudio/logo2_d19b648c.svg"
        alt="DeX Sales"
        referrerPolicy="no-referrer"
        className={`${logo2H} w-auto object-contain mt-1`}
      />
    </div>
  );
};

/**
 * Compact icon showing logo2 as requested ("in icon logo2 want to be shown").
 */
export const BrandIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-auto' }) => (
  <img
    src="/assets/aistudio/logo2_d19b648c.svg"
    alt="DeX"
    referrerPolicy="no-referrer"
    className={`${className} object-contain shrink-0`}
  />
);
