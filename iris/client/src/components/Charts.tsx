export function DonutChart({ data, size = 140, thickness = 16, center }: {
  data: { value: number; color: string; label: string }[]
  size?: number; thickness?: number; center?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = size / 2
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  let acc = 0

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(100,80,160,0.1)" strokeWidth={thickness} />
        {total > 0 && data.filter(d => d.value > 0).map((d, i) => {
          const arc = (d.value / total) * circumference
          const startAngle = (acc / circumference) * 360 - 90
          const el = (
            <circle key={i} cx={cx} cy={cx} r={r} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${arc} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(${startAngle} ${cx} ${cx})`}
            />
          )
          acc += arc
          return el
        })}
      </svg>
      {center && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: Math.round(size * 0.16), fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1 }}>{center}</div>
        </div>
      )}
    </div>
  )
}
