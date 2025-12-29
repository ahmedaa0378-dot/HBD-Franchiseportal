interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const Logo = ({ size = 'md' }: LogoProps) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20'
  };
  
  return (
    <img 
      src="/logo.png" 
      alt="Half Billion Dollar" 
      className={`${sizes[size]} object-contain`}
    />
  );
};

export default Logo;