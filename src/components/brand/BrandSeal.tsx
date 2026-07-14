import { useId } from 'react'

type BrandSealProps = {
  className?: string
}

export function BrandSeal({ className }: BrandSealProps) {
  const id = useId()
  const topArcId = `${id}-top-arc`
  const bottomArcId = `${id}-bottom-arc`

  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      role="img"
      aria-label="Logo de Rayego POS Botica y Farmacia"
    >
      <defs>
        <path id={topArcId} d="M 58 98 A 102 102 0 0 1 262 98" />
        <path id={bottomArcId} d="M 70 238 A 90 90 0 0 0 250 238" />
      </defs>

      <circle cx="160" cy="160" r="146" fill="#F8FAFC" stroke="#1A4B6E" strokeWidth="6" />
      <circle cx="160" cy="160" r="108" fill="none" stroke="#1A4B6E" strokeWidth="4" />

      <path d="M 40 160 C 40 146 40 136 44 126" fill="none" stroke="#1A4B6E" strokeWidth="5" strokeLinecap="round" />
      <path d="M 280 160 C 280 146 280 136 276 126" fill="none" stroke="#1A4B6E" strokeWidth="5" strokeLinecap="round" />

      <text fill="#5C6B73" fontSize="24" fontWeight="700" letterSpacing="4">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
          RAYEGO POS
        </textPath>
      </text>
      <text fill="#5C6B73" fontSize="18" fontWeight="700" letterSpacing="2.5">
        <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
          BOTICA &amp; FARMACIA
        </textPath>
      </text>

      <path
        d="M 136 92 H 184 C 191 92 196 97 196 104 V 128 H 220 C 227 128 232 133 232 140 V 188 C 232 195 227 200 220 200 H 196 V 224 C 196 231 191 236 184 236 H 136 C 129 236 124 231 124 224 V 200 H 100 C 93 200 88 195 88 188 V 140 C 88 133 93 128 100 128 H 124 V 104 C 124 97 129 92 136 92 Z"
        fill="none"
        stroke="#1A4B6E"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      <path
        d="M 160 120 V 232 M 150 142 C 138 146 137 161 149 168 C 164 177 169 186 160 197 C 151 208 138 204 134 194 M 170 134 C 182 140 183 155 171 163 C 156 173 151 181 160 192 C 169 203 182 199 186 189"
        fill="none"
        stroke="#52B788"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="160" cy="118" r="6" fill="none" stroke="#52B788" strokeWidth="4" />
      <path
        d="M 163 150 C 176 143 188 144 198 152 C 190 164 178 170 164 166"
        fill="none"
        stroke="#52B788"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M 172 106 C 176 96 181 92 189 87 C 194 95 194 104 188 111 C 183 116 177 115 172 106 Z" fill="none" stroke="#1A4B6E" strokeWidth="3.5" strokeLinejoin="round" />

      <g fill="none" stroke="#52B788" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 104 214 C 88 220 78 236 76 248" />
        <path d="M 96 218 C 89 210 87 202 89 194" />
        <path d="M 112 224 C 107 215 106 207 109 199" />
        <path d="M 124 231 C 119 222 118 214 121 206" />
        <path d="M 130 242 C 122 242 115 239 110 232" />

        <path d="M 216 214 C 232 220 242 236 244 248" />
        <path d="M 224 218 C 231 210 233 202 231 194" />
        <path d="M 208 224 C 213 215 214 207 211 199" />
        <path d="M 196 231 C 201 222 202 214 199 206" />
        <path d="M 190 242 C 198 242 205 239 210 232" />
      </g>
    </svg>
  )
}

