const GOOGLE_SHEETS_WEBHOOK =
    'https://script.google.com/macros/s/AKfycbzrnwUhCJb1bzAVMFv0PrXaVUU7rBPXpKHs2QfStPISxGoAGM5i5cQ7Gs9VN8iFpFSd/exec';

function tratarDispositivo(ua = '') {
    const tipo = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Celular' : 'PC / Desktop';

    let so = 'SO Desconhecido';
    if (/Windows NT 10\.0/i.test(ua)) so = 'Windows 10/11';
    else if (/Windows/i.test(ua)) so = 'Windows';
    else if (/Android/i.test(ua)) so = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) so = 'iOS (iPhone/iPad)';
    else if (/Mac OS X/i.test(ua)) so = 'macOS';
    else if (/Linux/i.test(ua)) so = 'Linux';

    let nav = 'Navegador';
    if (/Edg\//i.test(ua)) nav = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) nav = 'Opera';
    else if (/Chrome\//i.test(ua)) nav = 'Chrome';
    else if (/Firefox\//i.test(ua)) nav = 'Firefox';
    else if (/Safari\//i.test(ua)) nav = 'Safari';

    return `${tipo} · ${so} · ${nav}`;
}

function tratarOrigem(ref = '') {
    if (!ref) return 'Acesso Direto (Digitou URL / Favorito)';
    const r = ref.toLowerCase();
    if (r.includes('linkedin.com') || r.includes('lnkd.in')) return 'LinkedIn';
    if (r.includes('github.com')) return 'GitHub';
    if (r.includes('instagram.com')) return 'Instagram';
    if (r.includes('whatsapp.com') || r.includes('wa.me')) return 'WhatsApp';
    if (r.includes('google.')) return 'Busca Google';
    if (r.includes('vercel.com')) return 'Painel Vercel';
    try {
        return `Link externo (${new URL(ref).hostname})`;
    } catch {
        return ref.slice(0, 60);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const visitante = (body.nome || 'Visitante').toString().slice(0, 80);
    const acao = (body.acao || '🔓 Entrou no Portfólio').toString().slice(0, 120);
    const pagina = (body.pagina || '/').toString().slice(0, 140);
    const referrer = (body.origem || req.headers['referer'] || '').toString();

    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ip = rawIp.split(',')[0].trim();

    const cidade = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '';
    const estado = req.headers['x-vercel-ip-country-region'] || '';
    const pais = req.headers['x-vercel-ip-country'] || '';
    const localPartes = [cidade, estado].filter(Boolean).join(' - ');
    const local = [localPartes, pais].filter(Boolean).join(' / ') || 'Não identificado';

    const ua = req.headers['user-agent'] || '';
    const dispositivo = tratarDispositivo(ua);
    const origem = tratarOrigem(referrer);
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const payload = {
        dataHora,
        visitante,
        acao,
        origem,
        local,
        ip,
        dispositivo,
        pagina
    };

    console.log(
        `[SIEM-ACCESS-LOG] Data: ${dataHora} | Visitante: "${visitante}" | Acao: "${acao}" | Origem: ${origem} | Local: ${local} | IP: ${ip} | Disp: ${dispositivo} | Rota: ${pagina}`
    );

    try {
        await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Erro ao enviar para Google Sheets:', err);
    }

    return res.status(200).json({ ok: true, ...payload });
}
