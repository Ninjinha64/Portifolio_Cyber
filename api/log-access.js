export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const nome = (body.nome || 'Visitante (Guest)').toString().slice(0, 80);
    const pagina = (body.pagina || '/').toString().slice(0, 120);

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const cidade = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : 'N/A';
    const pais = req.headers['x-vercel-ip-country'] || 'N/A';
    const ua = req.headers['user-agent'] || 'unknown';
    const dataBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Este console.log aparece em tempo real na aba "Logs" do painel da Vercel!
    console.log(
        `[SIEM-ACCESS-LOG] Data: ${dataBr} | Visitante: "${nome}" | Local: ${cidade}/${pais} | IP: ${ip} | Rota: ${pagina} | UA: ${ua}`
    );

    return res.status(200).json({
        ok: true,
        visitante: nome,
        timestamp: dataBr,
        local: `${cidade}/${pais}`
    });
}
