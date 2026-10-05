import { useEffect, useMemo, useState } from 'react';
import { MeterRow } from './components/MeterRow';
import { createEmptyRecord, recordKey } from './data/meterStorage';
import {
	deletePersistedRecord,
	fetchRecords,
	fetchRecordSettings,
	persistRecord,
	sendReminder,
} from './data/recordRepository';
import { calculateBill, reconciliationTolerance } from './domain/calculateBill';
import type { BillingRecord } from './domain/meter';
import { defaultEditWindowDays, isRecordEditable } from './domain/recordEditability';
import {
	createReminderMessage,
	reminderSettingsOf,
	validateReminderSettings,
} from './domain/reminder';

const months = [
	'Enero',
	'Febrero',
	'Marzo',
	'Abril',
	'Mayo',
	'Junio',
	'Julio',
	'Agosto',
	'Septiembre',
	'Octubre',
	'Noviembre',
	'Diciembre',
];
const currency = (value: number) =>
	new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
const numberValue = (value: string) => Number(value) || 0;

function hasRecordChanged(existing: BillingRecord | undefined, next: BillingRecord) {
	if (!existing) return true;
	return (
		JSON.stringify({ ...existing, createdAt: undefined, ...reminderSettingsOf(existing) }) !==
		JSON.stringify({ ...next, createdAt: undefined, ...reminderSettingsOf(next) })
	);
}

export default function App() {
	const [records, setRecords] = useState<BillingRecord[]>([]);
	const [record, setRecord] = useState<BillingRecord>(createEmptyRecord);
	const [storageMessage, setStorageMessage] = useState('Cargando registros...');
	const [notification, setNotification] = useState<{
		message: string;
		type: 'success' | 'error';
	} | null>(null);
	const [editWindowDays, setEditWindowDays] = useState(defaultEditWindowDays);
	const result = useMemo(
		() => calculateBill(record.meters, record.totalBill, record.billedConsumption),
		[record]
	);
	const selectedKey = records.some((item) => recordKey(item) === recordKey(record))
		? recordKey(record)
		: '';
	const isLocked =
		Boolean(record.createdAt) && !isRecordEditable(record.createdAt, editWindowDays);
	const isReadyToSave =
		!isLocked &&
		record.supplyNumber.trim().length > 0 &&
		record.totalBill > 0 &&
		result.isReconciled;
	const reminderSettings = reminderSettingsOf(record);
	const reminderError = validateReminderSettings(reminderSettings);
	const reminderMessagePreview = createReminderMessage(
		record.supplyNumber,
		`${months[record.billedMonth - 1]} ${record.billedYear}`,
		result.meters,
		reminderSettings.reminderMessage
	);

	useEffect(() => {
		Promise.all([fetchRecords(), fetchRecordSettings()])
			.then(([items, settings]) => {
				setRecords(items);
				setEditWindowDays(settings.editWindowDays);
				setStorageMessage(
					items.length
						? `${items.length} registro(s) disponible(s).`
						: 'Aun no hay registros guardados.'
				);
			})
			.catch(() =>
				setStorageMessage(
					'No se pudo conectar con el archivo JSON. Inicia la aplicacion con npm run dev.'
				)
			);
	}, []);

	useEffect(() => {
		if (!notification) return;
		const timeout = window.setTimeout(() => setNotification(null), 6000);
		return () => window.clearTimeout(timeout);
	}, [notification]);

	function showNotification(message: string, type: 'success' | 'error') {
		setNotification({ message, type });
	}

	function updateRecord(
		field: 'supplyNumber' | 'billedMonth' | 'billedYear' | 'totalBill' | 'billedConsumption',
		value: string
	) {
		setRecord((item) => ({
			...item,
			[field]: field === 'supplyNumber' ? value : numberValue(value),
		}));
	}

	function updateReminder(field: keyof typeof reminderSettings, value: string) {
		setRecord((item) => ({
			...item,
			[field]: field === 'reminderTimes' ? numberValue(value) : value,
		}));
	}

	function updateMeter(
		id: string,
		field: 'name' | 'previousReading' | 'currentReading',
		value: string
	) {
		setRecord((item) => ({
			...item,
			meters: item.meters.map((meter) => {
				if (meter.id !== id) return meter;
				return field === 'name'
					? { ...meter, name: value }
					: { ...meter, [field]: numberValue(value) };
			}),
		}));
	}

	function addMeter() {
		setRecord((item) => ({
			...item,
			meters: [
				...item.meters,
				{
					id: crypto.randomUUID(),
					name: `Local ${item.meters.length}`,
					previousReading: 0,
					currentReading: 0,
				},
			],
		}));
	}

	async function saveRecord() {
		if (!isReadyToSave) return;
		if (reminderError) {
			setStorageMessage(reminderError);
			showNotification(reminderError, 'error');
			return;
		}

		try {
			const existing = records.find((item) => recordKey(item) === recordKey(record));
			const shouldSendReminder = hasRecordChanged(existing, record);
			const nextRecords = await persistRecord(record);
			setRecords(nextRecords);
			setRecord(
				nextRecords.find((item) => recordKey(item) === recordKey(record)) ??
					record
			);
			if (shouldSendReminder) {
				try {
					await sendReminder({
						mensaje: reminderMessagePreview,
						veces: reminderSettings.reminderTimes,
						horario: reminderSettings.reminderSchedule,
					});
					setStorageMessage('Periodo guardado y recordatorio de WhatsApp programado.');
					showNotification('Recordatorio de WhatsApp programado correctamente.', 'success');
				} catch (error) {
					const message =
						error instanceof Error
							? `Periodo guardado, pero no se envio el recordatorio: ${error.message}`
							: 'Periodo guardado, pero no se pudo enviar el recordatorio.';
					setStorageMessage(message);
					showNotification(message, 'error');
				}
			} else {
				setStorageMessage('No hubo cambios: el recordatorio no se envio nuevamente.');
			}
		} catch (error) {
			setStorageMessage(
				error instanceof Error ? error.message : 'No se pudo guardar el registro - App.tsx.'
			);
		}
	}

	async function deleteRecord() {
		if (!selectedKey) return;
		try {
			setRecords(await deletePersistedRecord(selectedKey));
			setRecord(createEmptyRecord());
			setStorageMessage('Registro eliminado del archivo JSON.');
		} catch (error) {
			setStorageMessage(
				error instanceof Error
					? error.message
					: 'No se pudo eliminar el registro.'
			);
		}
	}

	return (
		<main className="page-shell">
			{notification && (
				<div
					className={`notification notification-${notification.type}`}
					role={notification.type === 'error' ? 'alert' : 'status'}
				>
					<span>{notification.message}</span>
					<button type="button" onClick={() => setNotification(null)} aria-label="Cerrar notificacion">
						×
					</button>
				</div>
			)}
			<header className="hero">
				<p className="eyebrow">CONTROL MENSUAL</p>
				<h1>Reparte tu recibo de luz con claridad.</h1>
				<p>
					Registra cada suministro y periodo facturado. El reparto se habilita
					solo cuando las lecturas de tus medidores coinciden con el consumo del
					recibo.
				</p>
			</header>
			<section className="record-toolbar" aria-label="Registros guardados">
				<label>
					<span>Registros guardados</span>
					<select
						value={selectedKey}
						onChange={(event) => {
							const selected = records.find(
								(item) => recordKey(item) === event.target.value
							);
							if (selected) setRecord(selected);
						}}
					>
						<option value="">Nuevo registro</option>
						{records.map((item) => (
							<option key={recordKey(item)} value={recordKey(item)}>
								Suministro {item.supplyNumber} -{' '}
								{months[item.billedMonth - 1]} {item.billedYear}
							</option>
						))}
					</select>
				</label>
				<div className="record-actions">
					<button
						className="secondary-button"
						type="button"
						onClick={() => setRecord(createEmptyRecord())}
					>
						+ Nuevo
					</button>
					{selectedKey && !isLocked && (
						<button
							className="text-button danger"
							type="button"
							onClick={deleteRecord}
						>
							Eliminar
						</button>
					)}
				</div>
				<small className="storage-status">{storageMessage}</small>
			</section>
			{record.createdAt && (
				<section
					className={`lock-status ${isLocked ? 'is-locked' : 'is-editable'}`}
				>
					<strong>{isLocked ? 'Periodo bloqueado' : 'Periodo editable'}</strong>
					<span>
						Creado el{' '}
						{new Intl.DateTimeFormat('es-PE', {
							dateStyle: 'medium',
							timeStyle: 'short',
						}).format(new Date(record.createdAt))}
						.{' '}
						{isLocked
							? 'El plazo de edicion termino.'
							: `Puedes editarlo durante ${editWindowDays} dias desde su creacion.`}
					</span>
				</section>
			)}
			<section className="receipt-card" aria-labelledby="receipt-title">
				<div className="receipt-title">
					<p className="eyebrow">DATOS DEL RECIBO</p>
					<h2 id="receipt-title">Periodo y consumo facturado</h2>
				</div>
				<div className="receipt-fields">
					<label>
						<span>N.o de suministro</span>
						<input
							disabled={isLocked}
							value={record.supplyNumber}
							inputMode="numeric"
							placeholder="Ej. 1313210"
							onChange={(event) =>
								updateRecord('supplyNumber', event.target.value)
							}
						/>
					</label>
					<label>
						<span>Mes facturado</span>
						<select
							disabled={isLocked}
							value={record.billedMonth}
							onChange={(event) =>
								updateRecord('billedMonth', event.target.value)
							}
						>
							{months.map((month, index) => (
								<option key={month} value={index + 1}>
									{month}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>Anio facturado</span>
						<input
							disabled={isLocked}
							type="number"
							min="2000"
							value={record.billedYear}
							onChange={(event) =>
								updateRecord('billedYear', event.target.value)
							}
						/>
					</label>
					<label>
						<span>Total a pagar (S/)</span>
						<input
							disabled={isLocked}
							type="number"
							min="0"
							step="0.01"
							value={record.totalBill}
							onChange={(event) =>
								updateRecord('totalBill', event.target.value)
							}
						/>
					</label>
					<label>
						<span>Consumo del recibo (kWh)</span>
						<input
							disabled={isLocked}
							type="number"
							min="0"
							step="0.01"
							value={record.billedConsumption}
							onChange={(event) =>
								updateRecord('billedConsumption', event.target.value)
							}
						/>
					</label>
				</div>
			</section>
			<section
				className={`reconciliation ${result.isReconciled ? 'is-valid' : 'is-invalid'}`}
				aria-live="polite"
			>
				<div>
					<span>Consumo de medidores</span>
					<strong>{result.totalConsumption.toFixed(2)} kWh</strong>
				</div>
				<div>
					<span>Consumo del recibo</span>
					<strong>{result.billedConsumption.toFixed(2)} kWh</strong>
				</div>
				<div>
					<span>Diferencia</span>
					<strong>{result.consumptionDifference.toFixed(2)} kWh</strong>
				</div>
				<p>
					{result.isReconciled
						? `Consumos conciliados (tolerancia maxima: ${reconciliationTolerance.toFixed(2)} kWh). El reparto esta habilitado.`
						: `Ajusta las lecturas: la diferencia maxima permitida es ${reconciliationTolerance.toFixed(2)} kWh.`}
				</p>
			</section>
			<section className="meters" aria-labelledby="meters-title">
				<div className="section-heading">
					<div>
						<p className="eyebrow">LECTURAS</p>
						<h2 id="meters-title">Medidores</h2>
					</div>
					<button
						className="secondary-button"
						disabled={isLocked}
						type="button"
						onClick={addMeter}
					>
						+ Agregar medidor
					</button>
				</div>
				<p className="formula">
					Consumo = lectura actual - lectura anterior. Pago = consumo individual
					/ consumo total x recibo.
				</p>
				<div className="meter-list">
					{result.meters.map((meter) => (
						<MeterRow
							key={meter.id}
							meter={meter}
							canRemove={result.meters.length > 1}
							isLocked={isLocked}
							onChange={updateMeter}
							onRemove={(id) =>
								setRecord((item) => ({
									...item,
									meters: item.meters.filter(
										(meter) => meter.id !== id
									),
								}))
							}
						/>
					))}
				</div>
			</section>
			<section className="summary">
				<div>
					<span>Consumo total</span>
					<strong>{result.totalConsumption.toFixed(2)} kWh</strong>
				</div>
				<div>
					<span>Monto distribuido</span>
					<strong>
						{result.isReconciled
							? currency(result.assignedAmount)
							: 'Pendiente de conciliar'}
					</strong>
				</div>
				<div className="summary-total">
					<span>Total del recibo</span>
					<strong>{currency(result.totalBill)}</strong>
				</div>
			</section>
			<section className="receipt-card reminders" aria-labelledby="reminders-title">
				<div className="receipt-title">
					<p className="eyebrow">WHATSAPP</p>
					<h2 id="reminders-title">Recordatorio de cobro</h2>
					<p>Se enviara a la dueña al registrar el periodo o al guardar cambios.</p>
				</div>
				<div className="reminder-fields">
					<label>
						<span>Mensaje</span>
						<textarea
							disabled={isLocked}
							value={reminderSettings.reminderMessage}
							onChange={(event) => updateReminder('reminderMessage', event.target.value)}
						/>
					</label>
					<label>
						<span>Veces</span>
						<input
							disabled={isLocked}
							type="number"
							min="1"
							step="1"
							value={reminderSettings.reminderTimes}
							onChange={(event) => updateReminder('reminderTimes', event.target.value)}
						/>
					</label>
					<label>
						<span>Horario</span>
						<input
							disabled={isLocked}
							value={reminderSettings.reminderSchedule}
							placeholder="cada 1min o 09:00, 18:00"
							onChange={(event) => updateReminder('reminderSchedule', event.target.value)}
						/>
					</label>
				</div>
				<div className="reminder-preview">
					<span>Vista previa del mensaje</span>
					<pre>{reminderMessagePreview}</pre>
				</div>
				{reminderError && <small className="reminder-error">{reminderError}</small>}
			</section>
			<section className="formula-explanation" aria-labelledby="formula-title">
				<p className="eyebrow">COMO SE CALCULA</p>
				<h2 id="formula-title">Formula de reparto</h2>
				<ol>
					<li>
						<strong>Consumo por local:</strong> lectura actual menos lectura
						anterior.
					</li>
					<li>
						<strong>Porcentaje:</strong> consumo del local dividido entre el
						consumo total de medidores.
					</li>
					<li>
						<strong>Pago:</strong> porcentaje del local multiplicado por el
						total a pagar del recibo.
					</li>
				</ol>
				<p>
					Ejemplo: si un local consume 20 kWh de 100 kWh, asume el 20% del
					recibo. Con un recibo de S/ 300, pagaria S/ 60.
				</p>
			</section>
			<footer className="save-bar">
				<p>
					{isLocked
						? `Este periodo es historico y ya no admite cambios.`
						: isReadyToSave
							? 'Listo para guardar este periodo en el archivo JSON.'
							: 'Completa el suministro y concilia los kWh para guardar el registro.'}
				</p>
				<button
					className="primary-button"
					type="button"
					disabled={!isReadyToSave}
					onClick={saveRecord}
				>
					Guardar periodo facturado
				</button>
			</footer>
		</main>
	);
}
