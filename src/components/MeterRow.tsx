import type { MeterResult } from '../domain/meter'

interface MeterRowProps {
  meter: MeterResult
  canRemove: boolean
  isLocked: boolean
  onChange: (id: string, field: 'name' | 'previousReading' | 'currentReading', value: string) => void
  onRemove: (id: string) => void
}

const formatCurrency = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)

export function MeterRow({ meter, canRemove, isLocked, onChange, onRemove }: MeterRowProps) {
  const invalidReading = meter.currentReading < meter.previousReading
  return (
    <article className="meter-row">
      <div className="meter-input name"><label>Medidor / local</label><input disabled={isLocked} value={meter.name} onChange={(event) => onChange(meter.id, 'name', event.target.value)} placeholder="Ej. Local 3" /></div>
      <div className="meter-input"><label>Lectura anterior</label><input disabled={isLocked} type="number" min="0" value={meter.previousReading} onChange={(event) => onChange(meter.id, 'previousReading', event.target.value)} /></div>
      <div className="meter-input"><label>Lectura actual</label><input disabled={isLocked} type="number" min="0" value={meter.currentReading} onChange={(event) => onChange(meter.id, 'currentReading', event.target.value)} /></div>
      <div className="result"><span>Consumo</span><strong>{meter.consumption.toFixed(2)} kWh</strong>{invalidReading && <small>La lectura actual es menor</small>}</div>
      <div className="result"><span>Participación</span><strong>{(meter.share * 100).toFixed(2)}%</strong></div>
      <div className="result payment"><span>Debe pagar</span><strong>{formatCurrency(meter.payment)}</strong></div>
      {canRemove && <button className="icon-button" disabled={isLocked} type="button" onClick={() => onRemove(meter.id)} aria-label={`Eliminar ${meter.name || 'medidor'}`}>×</button>}
    </article>
  )
}
