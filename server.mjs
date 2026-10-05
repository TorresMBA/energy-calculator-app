import express from 'express';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(root, 'data');
const dataFile = path.join(dataDirectory, 'billing-records.json');
const app = express();
const configuredWindow = Number(process.env.RECORD_EDIT_WINDOW_DAYS);
const editWindowDays =
	Number.isFinite(configuredWindow) && configuredWindow >= 0 ? configuredWindow : 14;
const whatsappChatId = process.env.WHATSAPP_CHAT_ID?.trim();
const remindersApiUrl = process.env.REMINDERS_API_URL || 'http://localhost:3000/api/reminders';
const reminderIntervalPattern = /^cada\s+([1-9]|[1-5]\d|60)min$/i;
const reminderTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function readRecords() {
	try {
		const contents = await readFile(dataFile, 'utf8');
		const records = JSON.parse(contents);
		return Array.isArray(records) ? records : [];
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}
}

async function writeRecords(records) {
	await mkdir(dataDirectory, { recursive: true });
	const temporaryFile = `${dataFile}.tmp`;
	await writeFile(temporaryFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
	await rename(temporaryFile, dataFile);
}

function isValidRecord(record) {
	return (
		record &&
		typeof record.supplyNumber === 'string' &&
		Number.isInteger(record.billedMonth) &&
		Number.isInteger(record.billedYear) &&
		typeof record.totalBill === 'number' &&
		typeof record.billedConsumption === 'number' &&
		Array.isArray(record.meters)
	);
}

function keyOf(record) {
	return `${record.supplyNumber.trim()}-${record.billedYear}-${record.billedMonth}`;
}

function isEditable(record) {
	if (!record.createdAt) return true;
	const createdAt = Date.parse(record.createdAt);
	return (
		Number.isFinite(createdAt) &&
		Date.now() - createdAt <= editWindowDays * 24 * 60 * 60 * 1000
	);
}

function sortRecords(records) {
	return [...records].sort(
		(left, right) =>
			right.billedYear - left.billedYear ||
			right.billedMonth - left.billedMonth ||
			String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
	);
}

function reminderValidationError({ mensaje, veces, horario } = {}) {
	if (typeof mensaje !== 'string' || !mensaje.trim()) return 'El mensaje del recordatorio es obligatorio.';
	if (!Number.isInteger(veces) || veces < 1)
		return 'La cantidad de envios debe ser un numero entero mayor que cero.';
	if (typeof horario !== 'string') return 'El horario es obligatorio.';
	const schedule = horario.trim();
	if (reminderIntervalPattern.test(schedule)) return null;
	const times = schedule.split(',').map((time) => time.trim());
	if (times.every((time) => reminderTimePattern.test(time)) && times.length === veces)
		return null;
	return 'Usa "cada 1min" a "cada 60min", o horas HH:mm separadas por comas que coincidan con la cantidad de envios.';
}

app.use(express.json());

app.get('/api/settings', (_request, response) => response.json({ editWindowDays }));

app.post('/api/reminders', async (request, response, next) => {
	try {
		if (!whatsappChatId)
			return response.status(500).json({ message: 'Falta configurar WHATSAPP_CHAT_ID en el archivo .env.' });
		const validationError = reminderValidationError(request.body);
		if (validationError) return response.status(400).json({ message: validationError });

		const reminderResponse = await fetch(remindersApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chatId: whatsappChatId,
				mensaje: request.body.mensaje.trim(),
				veces: request.body.veces,
				horario: request.body.horario.trim(),
			}),
		});
		const contentType = reminderResponse.headers.get('content-type') || '';
		const body = contentType.includes('application/json')
			? await reminderResponse.json()
			: await reminderResponse.text();
		if (!reminderResponse.ok)
			return response.status(502).json({
				message: 'El servicio de WhatsApp rechazo el recordatorio.',
			});
		response.status(200).json(body || { ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/records', async (_request, response, next) => {
	try {
		response.json(sortRecords(await readRecords()));
	} catch (error) {
		next(error);
	}
});

app.put('/api/records/:key', async (request, response, next) => {
	try {
		if (!isValidRecord(request.body) || keyOf(request.body) !== request.params.key)
			return response.status(400).json({ message: 'Registro invalido.' });
		const records = await readRecords();
		const existing = records.find((record) => keyOf(record) === request.params.key);
		if (existing && !isEditable(existing))
			return response
				.status(403)
				.json({
					message: `Este periodo esta bloqueado: solo se puede editar durante ${editWindowDays} dias desde su creacion.`,
				});
		const storedRecord = {
			...request.body,
			createdAt: existing?.createdAt || new Date().toISOString(),
		};
		const nextRecords = sortRecords([
			...records.filter((record) => keyOf(record) !== request.params.key),
			storedRecord,
		]);
		await writeRecords(nextRecords);
		response.json(nextRecords);
	} catch (error) {
		next(error);
	}
});

app.delete('/api/records/:key', async (request, response, next) => {
	try {
		const records = await readRecords();
		const existing = records.find((record) => keyOf(record) === request.params.key);
		if (!existing)
			return response.status(404).json({ message: 'No se encontro el registro.' });
		if (!isEditable(existing))
			return response
				.status(403)
				.json({
					message: `Este periodo esta bloqueado: solo se puede eliminar durante ${editWindowDays} dias desde su creacion.`,
				});
		const nextRecords = records.filter(
			(record) => keyOf(record) !== request.params.key
		);
		await writeRecords(nextRecords);
		response.json(nextRecords);
	} catch (error) {
		next(error);
	}
});

app.use((error, _request, response, _next) => {
	console.error(error);
	response.status(500).json({ message: 'No fue posible guardar los registros.' });
});

if (process.env.NODE_ENV === 'production') {
	app.use(express.static(path.join(root, 'dist')));
	app.get('/{*splat}', (_request, response) =>
		response.sendFile(path.join(root, 'dist', 'index.html'))
	);
} else {
	const vite = await createViteServer({
		root,
		server: { middlewareMode: true },
		appType: 'spa',
	});
	app.use(vite.middlewares);
}

const port = Number(process.env.PORT) || 5173;
app.listen(port, () => console.log(`Aplicacion disponible en http://localhost:${port}`));
