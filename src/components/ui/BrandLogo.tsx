type BrandLogoProps = {
  variant?: 'primary' | 'mark'
  decorative?: boolean
}

/** Displays the supplied artwork unchanged; the primary frame removes only outer whitespace. */
export function BrandLogo({ variant = 'primary', decorative = false }: BrandLogoProps) {
  return (
    <span className={`brand-artwork brand-artwork-${variant}`}>
      <img
        src={
          variant === 'primary'
            ? '/branding/jbc-primary-logo.png'
            : '/branding/jbc-profile-mark.png'
        }
        width={variant === 'primary' ? 1983 : 1254}
        height={variant === 'primary' ? 793 : 1254}
        alt={
          decorative
            ? ''
            : variant === 'primary'
              ? 'JBC RigWorks — PC & Laptop Care Done Right'
              : 'JBC RigWorks'
        }
        decoding="async"
      />
    </span>
  )
}
