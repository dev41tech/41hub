import { useTheme } from "@/lib/theme-provider";

interface ThemeLogoProps {
  className?: string;
  alt?: string;
}

export function ThemeLogo({ className = "h-8 w-auto", alt = "41 Tech" }: ThemeLogoProps) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/41tech-logo-white.png" : "/41tech-logo.png";

  return (
    <img
      src={logoSrc}
      alt={alt}
      className={className}
    />
  );
}
