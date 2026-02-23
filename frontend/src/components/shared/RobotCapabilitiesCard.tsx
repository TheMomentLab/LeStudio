import type { RobotCapabilities } from '../../lib/types'

interface RobotCapabilitiesCardProps {
  capabilities: RobotCapabilities | null
  compatibleTeleops: string[]
}

function CapBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="cap-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: active
          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
          : 'color-mix(in srgb, var(--text2) 8%, transparent)',
        color: active ? 'var(--accent)' : 'var(--text2)',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 25%, var(--border))' : 'var(--border)'}`,
        opacity: active ? 1 : 0.5,
      }}
    >
      <span style={{ fontSize: 10 }}>{active ? '\u2713' : '\u2717'}</span>
      {label}
    </span>
  )
}

export function RobotCapabilitiesCard({ capabilities, compatibleTeleops }: RobotCapabilitiesCardProps) {
  if (!capabilities) return null

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent) 5%, var(--bg2))',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        marginTop: 8,
        marginBottom: 4,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
        {capabilities.display_name || 'Robot Info'}
      </div>
      {capabilities.description && (
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4 }}>
          {capabilities.description}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: compatibleTeleops.length ? 8 : 0 }}>
        <CapBadge label={`Arm${capabilities.arm_count > 1 ? ` \u00d7${capabilities.arm_count}` : ''}`} active={capabilities.has_arm} />
        <CapBadge label="Mobile Base" active={capabilities.has_mobile_base} />
        <CapBadge label="Cameras" active={capabilities.has_cameras} />
        <CapBadge label="Remote" active={capabilities.is_remote} />
        <CapBadge label="Keyboard" active={capabilities.has_keyboard_teleop} />
        <CapBadge label={capabilities.connection_type.toUpperCase()} active={true} />
      </div>
      {compatibleTeleops.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
          <span style={{ fontWeight: 500 }}>Compatible teleops:</span>{' '}
          {compatibleTeleops.join(', ')}
        </div>
      )}
    </div>
  )
}