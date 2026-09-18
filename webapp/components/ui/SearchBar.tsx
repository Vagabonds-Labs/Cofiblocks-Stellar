// components/SearchBar.tsx
'use client'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder: string
}

export function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <div className="relative">
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input py-3 pl-11"
      />
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[rgba(90,103,96,0.8)]"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-4.35-4.35m0 0a7.5 7.5 0 1 0-10.6 0 7.5 7.5 0 0 0 10.6 0Z"
        />
      </svg>
    </div>
  )
}
