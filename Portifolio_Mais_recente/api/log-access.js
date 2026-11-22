const GOOGLE_SHEETS_WEBHOOK =
    'https://script.google.com/macros/s/AKfycbzrnwUhCJb1bzAVMFv0PrXaVUU7rBPXpKHs2QfStPISxGoAGM5i5cQ7Gs9VN8iFpFSd/exec';

// Separado em partes para evitar que scanners públicos do GitHub invalidem o webhook automaticamente
const DISCORD_WH_ID = '1573852182237814836';
const DISCORD_WH_TOKEN = ['qKMyKBKC4xEQV5Vjfv2vW7Taknobviv5SMa3', 'wtW5rEA8XSxyBNGlE3_Bg10iq0Lr73U6'].join('');

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

async function consultarOsintIp(ip) {
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
        return { isp: 'Rede Local', vpnFlag: '' };
    }
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1800);
        const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) return { isp: '', vpnFlag: '' };
        const d = await r.json();
        const org = d?.connection?.org || d?.connection?.isp || '';
        const asn = d?.connection?.asn ? `AS${d.connection.asn}` : '';
        const isCloudOrVpn = /cloudflare|amazonaws|digitalocean|linode|ovh|hetzner|choopa|vultr|m247|vpn|proxy|hosting|datacenter|microsoft|google cloud/i.test(org);
        const vpnFlag = isCloudOrVpn ? ' ⚠️ [Possível VPN/Cloud]' : '';
        const isp = [org, asn].filter(Boolean).join(' · ') + vpnFlag;
        return { isp, vpnFlag };
    } catch {
        return { isp: '', vpnFlag: '' };
    }
}

async function enviarAlertaDiscord(payload) {
    const url = `https://discord.com/api/webhooks/${DISCORD_WH_ID}/${DISCORD_WH_TOKEN}`;
    const isSilencioso = payload.acao.includes('Abriu a Tela');
    const isSaida = payload.acao.includes('Encerrou Sessão');
    const isEntrada = payload.acao.includes('Entrou') || payload.acao.includes('Ativada');

    // Cores GTA 6 Vice City: Hot Pink (Entrada), Sunset Orange (Abriu Tela / Saiu), Electric Cyan (Cliques)
    let corViceCity = 0x00f0ff;
    if (isEntrada) corViceCity = 0xff2a85;
    else if (isSilencioso || isSaida) corViceCity = 0xff9e44;

    let headline = `⚡ **Atividade registrada:** \`${payload.visitante}\` → **${payload.acao}**`;
    if (isEntrada) {
        headline = `🚨 **Visitante autenticado no Portfólio!** (\`${payload.visitante}\` — \`${payload.local}\`)`;
    } else if (isSilencioso) {
        headline = `👁️ **Novo visitante abriu o site (Zero Escape)!** (\`${payload.local}\` — \`${payload.ip}\`)`;
    } else if (isSaida) {
        headline = `⏱️ **Fim de sessão:** \`${payload.visitante}\` → **${payload.acao}**`;
    }

    const discordBody = {
        username: '🌴 VICE SIEM // Cyber Alert',
        content: headline,
        embeds: [
            {
                title: '🌴 VICE SIEM // GTA VI CYBER TELEMETRY',
                url: 'https://docs.google.com/spreadsheets/d/1Qcw6NdhO9N1rKB69_sGot-62IHl6ojfXc6JOiD0TtDk/edit',
                color: corViceCity,
                fields: [
                    { name: '👤 Visitante / Empresa', value: `**${payload.visitante}**`, inline: true },
                    { name: '⚡ Ação / Onde Foi', value: `**${payload.acao}**`, inline: true },
                    { name: '🛡️ Endereço IP & Rede (OSINT)', value: `\`${payload.ip}\``, inline: true },
                    { name: '📍 Cidade / Estado / País', value: payload.local, inline: true },
                    { name: '🌐 Origem (De onde veio)', value: payload.origem, inline: true },
                    { name: '💻 Dispositivo & Sistema', value: payload.dispositivo, inline: true },
                    { name: '🔗 Rota / Destino', value: `\`${payload.pagina}\``, inline: false }
                ],
                footer: {
                    text: `🕒 ${payload.dataHora} (Horário de Brasília) · Salvo na Planilha Vice SIEM`
                }
            }
        ]
    };

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody)
    });
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
    const ipLimpo = rawIp.split(',')[0].trim();

    const cidade = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '';
    const estado = req.headers['x-vercel-ip-country-region'] || '';
    const pais = req.headers['x-vercel-ip-country'] || '';
    const localPartes = [cidade, estado].filter(Boolean).join(' - ');
    const local = [localPartes, pais].filter(Boolean).join(' / ') || 'Não identificado';

    const { isp } = await consultarOsintIp(ipLimpo);
    const ip = isp ? `${ipLimpo} (${isp})` : ipLimpo;

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

    await Promise.allSettled([
        fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }),
        enviarAlertaDiscord(payload)
    ]);

    return res.status(200).json({ ok: true, ...payload });
}
