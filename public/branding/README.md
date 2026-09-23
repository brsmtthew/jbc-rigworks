# JBC RigWorks brand assets

Original supplied PNG files, copied without modification:

- `jbc-primary-logo.png`: horizontal logo and “PC & Laptop Care Done Right” tagline.
- `jbc-profile-mark.png`: four-tile computer, tools, gear, and processor mark.
- `jbc-brand-guide.png`: supplied palette and typography reference.

Core colors: navy `#022753`, blue `#0466D3`, gray `#686B72`, mist `#F3F6FA`, white `#FFFFFF`.
Headings use locally hosted Montserrat ExtraBold; body text uses locally hosted Inter.

`src/components/ui/BrandLogo.tsx` renders the supplied artwork. CSS frames the horizontal
PNG's outer whitespace while retaining the complete logo and tagline. A white backing
keeps the navy lettering visible in the sidebar. Do not replace the wordmark with typed text.

The browser icon uses the supplied square PNG. Teal and amber remain semantic UI indicators,
not additions to the primary brand palette.
