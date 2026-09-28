import type { ServiceIntake } from '../../types'
import { damageOptions } from './serviceIntake'

export function ServiceIntakeFields({ value, onChange, service, device, concerns, acknowledged, onAcknowledge }: {
  value: ServiceIntake
  onChange: (value: ServiceIntake) => void
  service: string
  device: string
  concerns: string
  acknowledged: boolean
  onAcknowledge: (value: boolean) => void
}) {
  function update<K extends keyof ServiceIntake>(key: K, next: ServiceIntake[K]) {
    onChange({ ...value, [key]: next })
  }
  function toggleDamage(option: string) {
    const visibleDamage = value.visibleDamage.includes(option)
      ? value.visibleDamage.filter((item) => item !== option)
      : option === 'No visible damage'
        ? [option]
        : [...value.visibleDamage.filter((item) => item !== 'No visible damage'), option]
    update('visibleDamage', visibleDamage)
  }
  const detailFields = [
    ['CPU', 'cpu'], ['GPU', 'gpu'], ['RAM', 'ram'], ['Storage', 'storage'],
    ['Motherboard', 'motherboard'], ['PSU / charger', 'psuOrCharger'], ['Cooling', 'cooling'],
  ] as const
  return (
    <div className="home-intake-fields">
      <div className="booking-section-heading">
        <span className="eyebrow">STEP 03 · CUSTOMER INTAKE</span>
        <h3>Tell us about your device</h3>
        <p>Complete what you know now. At your visit, JBC will review the condition and collect your signature on the printed authorization before work starts.</p>
      </div>
      <div className="home-intake-group">
        <h4>A. Customer information</h4>
        <div className="portal-form-grid">
          <label>Customer name
            <input required maxLength={120} autoComplete="name" value={value.customerName} onChange={(e) => update('customerName', e.target.value)} />
          </label>
          <label>Mobile number
            <input required type="tel" maxLength={60} autoComplete="tel" value={value.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
          </label>
          <label>Facebook / Instagram (optional)
            <input maxLength={160} value={value.socialHandle} onChange={(e) => update('socialHandle', e.target.value)} />
          </label>
        </div>
      </div>
      <div className="home-intake-group">
        <h4>B. Device information</h4>
        <p className="home-intake-selected">Brand / model: <strong>{device}</strong></p>
        <div className="portal-form-grid">
          <label>Device type
            <select value={value.deviceType} onChange={(e) => update('deviceType', e.target.value as ServiceIntake['deviceType'])}>
              <option>Desktop PC</option><option>Laptop</option>
            </select>
          </label>
          <label>Serial number / asset tag (optional)
            <input maxLength={120} value={value.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} />
          </label>
          {detailFields.map(([label, key]) => (
            <label key={key}>{label} (if known)
              <input maxLength={160} value={value[key]} onChange={(e) => update(key, e.target.value)} />
            </label>
          ))}
          <label>Accessories brought with device
            <input maxLength={500} value={value.accessories} onChange={(e) => update('accessories', e.target.value)} placeholder="Charger, mouse, cables…" />
          </label>
        </div>
      </div>
      <div className="home-intake-group">
        <h4>C. Requested service</h4>
        <p className="home-intake-selected"><strong>{service}</strong></p>
        <p className="home-intake-selected">Customer concern / request: {concerns || 'None added'}</p>
      </div>
      <div className="home-intake-group">
        <h4>D. Initial condition & existing issues</h4>
        <fieldset className="home-intake-condition-list">
          <legend>Visible condition (select everything you have noticed)</legend>
          <div>
            {damageOptions.map((option) => (
              <label className="check-row" key={option}>
                <input type="checkbox" checked={value.visibleDamage.includes(option)} onChange={() => toggleDamage(option)} />{option}
              </label>
            ))}
          </div>
        </fieldset>
        <label>Other visible damage (optional)
          <input maxLength={300} value={value.otherDamage} onChange={(e) => update('otherDamage', e.target.value)} />
        </label>
        <label>Describe visible condition or wear
          <textarea required rows={2} maxLength={1200} value={value.visibleCondition} onChange={(e) => update('visibleCondition', e.target.value)} placeholder="Include details or write ‘None noticed’." />
        </label>
        <div className="portal-form-grid">
          <label>Power status
            <select value={value.powerStatus} onChange={(e) => update('powerStatus', e.target.value as ServiceIntake['powerStatus'])}>
              <option>Powers on</option><option>Intermittent</option><option>Does not power on</option><option>Not tested</option>
            </select>
          </label>
          <label>Signs of liquid exposure
            <select value={value.liquidExposure} onChange={(e) => update('liquidExposure', e.target.value as ServiceIntake['liquidExposure'])}>
              <option>Unsure</option><option>Yes</option><option>No</option>
            </select>
          </label>
        </div>
        <label>Existing hardware or performance issues
          <textarea required rows={2} maxLength={1200} value={value.reportedIssues} onChange={(e) => update('reportedIssues', e.target.value)} placeholder="Describe the symptoms or write ‘None reported’." />
        </label>
        <label>Condition and issue history
          <textarea required rows={2} maxLength={1200} value={value.issueHistory} onChange={(e) => update('issueHistory', e.target.value)} placeholder="When issues began; spills, drops, power events or changes. Write ‘No known history’ if applicable." />
        </label>
        <label>Previous repairs or cleaning (if known)
          <textarea rows={2} maxLength={800} value={value.previousRepairs} onChange={(e) => update('previousRepairs', e.target.value)} />
        </label>
        <label>Important files backed up?
          <select value={value.backupStatus} onChange={(e) => update('backupStatus', e.target.value as ServiceIntake['backupStatus'])}>
            <option>Unsure</option><option>Backed up</option><option>Not backed up</option><option>Not applicable</option>
          </select>
        </label>
      </div>
      <div className="home-intake-group">
        <h4>E. Before-service documentation</h4>
        <p className="home-intake-note">The technician will record before-service photos and review the condition with you on the printed form before work starts.</p>
        <p className="home-intake-note">Do not enter device passwords or private files here.</p>
      </div>
      <div className="home-intake-group">
        <h4>F. Customer authorization</h4>
        <p className="home-intake-note">JBC may perform only your approved service. Any additional work or charges require your approval. Existing faults may remain or become apparent during testing. Please back up important data. JBC will only access personal files when required for approved troubleshooting and with your authorization.</p>
        <label className="check-row home-intake-acknowledgement">
          <input type="checkbox" required checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} />
          I understand the printed intake and service authorization will be reviewed and signed with JBC before work begins. This booking does not replace my paper signature.
        </label>
      </div>
    </div>
  )
}
