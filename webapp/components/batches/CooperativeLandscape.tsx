import { useId } from 'react'

/** A decorative illustration, not a geographic map or a representation of real facilities. */
export function CooperativeLandscape({ code }: { code: string }) {
  const id = useId().replace(/:/g, '')
  const palette =
    code === 'DM'
      ? {
          sky: '#f4ecd9',
          sun: '#dba15b',
          far: '#c1b48a',
          middle: '#989d6e',
          field: '#77855c',
          foreground: '#536a4b',
          roof: '#9e633f',
        }
      : code === 'KN'
        ? {
            sky: '#e6eef0',
            sun: '#dfc18d',
            far: '#adc4bd',
            middle: '#83a99b',
            field: '#609184',
            foreground: '#356a60',
            roof: '#607c86',
          }
        : {
            sky: '#e9efe0',
            sun: '#e4bd70',
            far: '#b5c49a',
            middle: '#8fa87d',
            field: '#668d65',
            foreground: '#3f6f50',
            roof: '#a86d49',
          }

  return (
    <svg
      viewBox="0 0 400 158"
      fill="none"
      className="block h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-sky`}
          x1="200"
          y1="0"
          x2="200"
          y2="158"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={palette.sky} />
          <stop offset="1" stopColor="#fffdf6" />
        </linearGradient>
        <clipPath id={`${id}-field`}>
          <path d="M0 113C104 74 212 97 400 131V158H0Z" />
        </clipPath>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h400v158H0z" />
      <circle
        cx={code === 'DM' ? 80 : 318}
        cy="35"
        r="21"
        fill={palette.sun}
        opacity=".8"
      />
      <path
        d="M0 82 72 34 144 79 202 43 284 87 341 54 400 83V158H0Z"
        fill={palette.far}
      />
      <path
        d="M0 110C62 64 137 70 208 99S333 65 400 90V158H0Z"
        fill={palette.middle}
      />
      <path d="M0 113C104 74 212 97 400 131V158H0Z" fill={palette.field} />
      <g
        clipPath={`url(#${id}-field)`}
        stroke="#e6edcc"
        strokeWidth="2"
        opacity=".3"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
          <path
            key={row}
            d={`M${-110 + row * 46} 164Q${30 + row * 42} 104 ${175 + row * 30} 101`}
          />
        ))}
      </g>
      <path
        d="M225 103C217 114 256 119 261 130S238 149 230 158H272C292 140 294 125 274 117S238 113 237 103Z"
        fill="#e5d8b9"
      />
      <g
        transform={
          code === 'DM'
            ? 'translate(38 6)'
            : code === 'KN'
              ? 'translate(-25 1)'
              : 'translate(0 0)'
        }
      >
        <path d="M214 81h51v28h-51z" fill="#fff5de" />
        <path d="m205 82 35-23 35 23Z" fill={palette.roof} />
        <path d="M235 91h12v18h-12z" fill="#6d6752" />
        <path d="M219 89h8v8h-8zm36 0h7v8h-7z" fill="#b6c5b2" />
        <path d="M272 88h30v21h-30z" fill="#e9dfc5" />
        <path d="m268 88 19-14 20 14Z" fill={palette.roof} />
      </g>
      <g fill={palette.foreground}>
        {[30, 70, 111, 337, 370].map((x, i) => (
          <g
            key={x}
            transform={`translate(${x} ${i < 3 ? 103 + (i % 2) * 7 : 120})`}
          >
            <path d="M-1-22h3v28h-3z" fill="#766b48" />
            <ellipse cy="-24" rx="10" ry="14" />
            <ellipse cx="-6" cy="-17" rx="10" ry="9" />
            <ellipse cx="6" cy="-16" rx="10" ry="10" />
          </g>
        ))}
        <path d="M0 144c31-17 49-12 73 0s45 9 72 14H0Z" />
        <path d="M306 158c25-20 65-27 94-12v12Z" />
      </g>
      <g fill="#c78554">
        <circle cx="25" cy="139" r="2.5" />
        <circle cx="38" cy="144" r="2.5" />
        <circle cx="352" cy="145" r="2.5" />
      </g>
      <path
        d="M104 28h20m-10-4h19M264 26h13"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".65"
      />
    </svg>
  )
}
