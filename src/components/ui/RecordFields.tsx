export type RecordField = {
  name: string
  label: string
  type?: 'text' | 'date' | 'number'
  options?: string[]
  placeholder?: string
  list?: string
  optional?: boolean
}

export function RecordFields({
  fields,
  values,
}: {
  fields: RecordField[]
  values: Record<string, string | number | undefined>
}) {
  return (
    <div className="portal-form-grid">
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.options ? (
            <select
              name={field.name}
              required={!field.optional}
              defaultValue={values[field.name] ?? (field.placeholder ? '' : field.options[0])}
            >
              {field.placeholder && <option value="">{field.placeholder}</option>}
              {field.options.map((value) => (
                <option key={value} value={value}>
                  {value || 'Not specified'}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={field.name}
              type={field.type ?? 'text'}
              list={field.list}
              required={!field.optional}
              maxLength={2000}
              min={field.type === 'number' ? 0 : undefined}
              step={field.type === 'number' ? '0.01' : undefined}
              defaultValue={field.type === 'number' && values[field.name] === 0 ? '' : values[field.name] ?? ''}
            />
          )}
        </label>
      ))}
    </div>
  )
}
