type IconProps = {
  className?: string;
};

export const VideoIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
    <path
      d="M8 17.5h32v22H8v-22Zm0 0L4.5 9H11l5 8.5L12.5 9H20l5 8.5L21.5 9H29l5 8.5L30.5 9H40v8.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.5"
    />
  </svg>
);

export const ImageIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
    <rect
      height="34"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="3.5"
      width="34"
      x="7"
      y="7"
    />
    <path d="m12 35 9.5-10 6 6 4.5-5 4 9H12Z" fill="currentColor" />
  </svg>
);

export const CarIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32">
    <path
      d="m6.5 14.5 2.2-6h14.6l2.2 6M5 16.5h22v8H5v-8Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path d="M8 23v3M24 23v3" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="10" cy="19.5" fill="currentColor" r="1.5" />
    <circle cx="22" cy="19.5" fill="currentColor" r="1.5" />
  </svg>
);

export const UploadIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M5 3h10l4 4v14H5V3Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path d="M15 3v5h4M12 17V10m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const HelpIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M9.8 9.3a2.3 2.3 0 0 1 4.5.7c0 1.8-2.3 2.1-2.3 3.7M12 17h.01"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
);

export const TrashIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const PlayIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="m9 7 8 5-8 5V7Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
    />
  </svg>
);

export const BackIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="m14.5 6-6 6 6 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const ScanIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4M7 12h10"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </svg>
);

export const AnalyzingIcon = ({ className = "h-12 w-12" }: IconProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
    <circle cx="20" cy="22" r="12" stroke="currentColor" strokeWidth="3" />
    <path
      d="m29 31 9 9M8 23h6l3-7 5 14 4-9h6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    />
  </svg>
);
