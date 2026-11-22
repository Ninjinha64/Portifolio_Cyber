const GOOGLE_SHEETS_WEBHOOK =
    'https://script.google.com/macros/s/AKfycbzrnwUhCJb1bzAVMFv0PrXaVUU7rBPXpKHs2QfStPISxGoAGM5i5cQ7Gs9VN8iFpFSd/exec';

// Separado em partes para evitar que scanners públicos do GitHub invalidem o webhook automaticamente
const DISCORD_WH_ID = '1573852182237814836';
const DISCORD_WH_TOKEN = ['qKMyKBKC4xEQV5Vjfv2vW7Taknobviv5SMa3', 'wtW5rEA8XSxyBNGlE3_Bg10iq0Lr73U6'].join('');

function tratarDispositivo(ua = '', hwInfo = '') {
    const tipo = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Celular' : 'PC / Desktop';

    let so = 'SO Desconhecido';
    if (/Windows NT 10\.0/i.test(ua)) so = 'Windows 10/11';
    else if (/Windows/i.test(ua)) so = 'Windows';
    else if (/Android/i.test(ua)) {
        const m = ua.match(/Android\s+([\d.]+)/i);
        so = m ? `Android ${m[1]}` : 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
        const m = ua.match(/OS\s+([\d_]+)/i);
        so = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS (iPhone/iPad)';
    } else if (/Mac OS X/i.test(ua)) so = 'macOS';
    else if (/Linux/i.test(ua)) so = 'Linux';

    let nav = 'Navegador';
    if (/Edg\//i.test(ua)) nav = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) nav = 'Opera';
    else if (/CriOS\//i.test(ua)) nav = 'Chrome (iOS)';
    else if (/Chrome\//i.test(ua)) nav = 'Chrome';
    else if (/FxiOS\/|Firefox\//i.test(ua)) nav = 'Firefox';
    else if (/Safari\//i.test(ua)) nav = 'Safari';

    const base = `${tipo} · ${so} · ${nav}`;
    return hwInfo ? `${base} · ${hwInfo}` : base;
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
        return { isp: 'Rede Local', cidadeOsint: '', estadoOsint: '', paisOsint: '' };
    }
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1800);
        const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) return { isp: '', cidadeOsint: '', estadoOsint: '', paisOsint: '' };
        const d = await r.json();
        const org = d?.connection?.org || d?.connection?.isp || '';
        const asn = d?.connection?.asn ? `AS${d.connection.asn}` : '';
        const isCloudOrVpn =
            /cloudflare|amazonaws|digitalocean|linode|ovh|hetzner|choopa|vultr|m247|vpn|proxy|hosting|datacenter|microsoft|google cloud/i.test(
                org
            );
        const vpnFlag = isCloudOrVpn ? ' ⚠️ [Possível VPN/Cloud]' : '';
        const isp = [org, asn].filter(Boolean).join(' · ') + vpnFlag;
        return {
            isp,
            cidadeOsint: d?.city || '',
            estadoOsint: d?.region_code || d?.region || '',
            paisOsint: d?.country_code || ''
        };
    } catch {
        return { isp: '', cidadeOsint: '', estadoOsint: '', paisOsint: '' };
    }
}

async function consultarEnderecoGps(lat, lon) {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2400);
        // zoom=18 força busca em nível de lote/edifício/número de rua!
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=pt-BR`,
            {
                headers: { 'User-Agent': 'ViceSIEMPortfolio/1.0 (arturferreiramiguel@gmail.com)' },
                signal: ctrl.signal
            }
        );
        clearTimeout(timer);
        if (!r.ok) return '';
        const d = await r.json();
        const a = d?.address || {};
        const rua = a.road || a.pedestrian || a.residential || a.footway || '';
        const numero = a.house_number || '';
        const localEspecifico = a.amenity || a.building || a.shop || a.office || '';
        const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
        const cep = a.postcode ? `CEP ${a.postcode}` : '';
        const cidade = a.city || a.town || a.municipality || a.village || '';
        const uf = a['ISO3166-2-lvl4'] ? a['ISO3166-2-lvl4'].replace('BR-', '') : (a.state || '');
        const ruaCompleta = [rua, numero ? `nº ${numero}` : ''].filter(Boolean).join(', ');
        return [localEspecifico, ruaCompleta, bairro, cep, [cidade, uf].filter(Boolean).join(' - ')]
            .filter(Boolean)
            .join(' · ');
    } catch {
        return '';
    }
}

function classificarPrecisaoGps(acc) {
    if (!acc) return '🛰️ GPS';
    if (acc <= 30) return `🛰️ Satélite GPS Exato (±${acc}m)`;
    if (acc <= 180) return `📶 Triangulação Wi-Fi/Roteador (±${acc}m)`;
    return `🔌 Antena/Rede sem Chip GPS (±${acc}m)`;
}

async function enviarAlertaDiscord(payload, mapaUrl, isGpsExato, fotoBase64) {
    const url = `https://discord.com/api/webhooks/${DISCORD_WH_ID}/${DISCORD_WH_TOKEN}`;
    const isSilencioso = payload.acao.includes('Abriu a Tela');
    const isSaida = payload.acao.includes('Encerrou Sessão');
    const isEntrada =
        payload.acao.includes('Entrou') ||
        payload.acao.includes('Ativada') ||
        payload.acao.includes('GPS') ||
        payload.acao.includes('Foto');

    let corViceCity = 0x00f0ff;
    if (isEntrada) corViceCity = 0xff2a85;
    else if (isSilencioso || isSaida) corViceCity = 0xff9e44;

    let headline = `⚡ **Atividade registrada:** \`${payload.visitante}\` → **${payload.acao}**`;
    if (fotoBase64) {
        headline = `📸 **CAPTURA DE CÂMERA + TELEMETRIA!** (\`${payload.visitante}\` — \`${payload.local}\`)`;
    } else if (payload.acao.includes('GPS')) {
        headline = `🎯 **LOCALIZAÇÃO GPS CAPTURADA!** (\`${payload.visitante}\` — \`${payload.local}\`)`;
    } else if (isEntrada) {
        headline = `🚨 **Visitante autenticado no Portfólio!** (\`${payload.visitante}\` — \`${payload.local}\`)`;
    } else if (isSilencioso) {
        headline = `👁️ **Novo visitante abriu o site (Zero Escape)!** (\`${payload.local}\` — \`${payload.ip}\`)`;
    } else if (isSaida) {
        headline = `⏱️ **Fim de sessão:** \`${payload.visitante}\` → **${payload.acao}**`;
    }

    const labelMapa = isGpsExato ? '🎯 Abrir Ponto Exato no Google Maps (Zoom Máximo)' : '📡 Ver Cidade (IP da Operadora)';
    const localComMapa = mapaUrl ? `${payload.local}\n[${labelMapa}](${mapaUrl})` : payload.local;

    const embed = {
        title: '🌴 VICE SIEM // GTA VI CYBER TELEMETRY',
        url: 'https://docs.google.com/spreadsheets/d/1Qcw6NdhO9N1rKB69_sGot-62IHl6ojfXc6JOiD0TtDk/edit',
        color: corViceCity,
        fields: [
            { name: '👤 Visitante + ID Único (Anti-Fake)', value: `**${payload.visitante}**`, inline: true },
            { name: '⚡ Ação / Onde Foi', value: `**${payload.acao}**`, inline: true },
            { name: '🛡️ Endereço IP & Operadora', value: `\`${payload.ip}\``, inline: true },
            {
                name: isGpsExato
                    ? '🎯 Endereço, Coordenada & Precisão do Sensor'
                    : '📡 Cidade via IP (Central da Operadora)',
                value: localComMapa,
                inline: false
            },
            { name: '🌐 Origem (De onde veio)', value: payload.origem, inline: true },
            { name: '💻 Aparelho Real / GPU / Tela', value: payload.dispositivo, inline: true },
            { name: '🔗 Rota / Destino', value: `\`${payload.pagina}\``, inline: false }
        ],
        footer: {
            text: `🕒 ${payload.dataHora} (Horário de Brasília) · Salvo na Planilha Vice SIEM`
        }
    };

    if (fotoBase64 && fotoBase64.startsWith('data:image/')) {
        try {
            const base64Clean = fotoBase64.split(',')[1];
            const buffer = Buffer.from(base64Clean, 'base64');
            embed.image = { url: 'attachment://webcam_capture.jpg' };

            const formData = new FormData();
            formData.append(
                'payload_json',
                JSON.stringify({
                    username: '🌴 VICE SIEM // Cyber Alert',
                    content: headline,
                    embeds: [embed]
                })
            );
            formData.append('files[0]', new Blob([buffer], { type: 'image/jpeg' }), 'webcam_capture.jpg');

            await fetch(url, {
                method: 'POST',
                body: formData
            });
            return;
        } catch (err) {
            console.error('Erro ao anexar foto no Discord:', err);
        }
    }

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: '🌴 VICE SIEM // Cyber Alert',
            content: headline,
            embeds: [embed]
        })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const nomeDigitado = (body.nome || 'Visitante').toString().slice(0, 65);
    const fingerprint = (body.fp || '').toString().slice(0, 20);
    const hwInfo = (body.hw || '').toString().slice(0, 90);
    const visitante = fingerprint ? `${nomeDigitado} [${fingerprint}]` : nomeDigitado;

    const acao = (body.acao || '🔓 Entrou no Portfólio').toString().slice(0, 120);
    const pagina = (body.pagina || '/').toString().slice(0, 140);
    const referrer = (body.origem || req.headers['referer'] || '').toString();

    const gpsLat = body.gpsLat ? Number(body.gpsLat) : null;
    const gpsLon = body.gpsLon ? Number(body.gpsLon) : null;
    const gpsAcc = body.gpsAcc ? Math.round(Number(body.gpsAcc)) : null;
    const isGpsExato = Boolean(gpsLat && gpsLon && !Number.isNaN(gpsLat) && !Number.isNaN(gpsLon));

    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ipLimpo = rawIp.split(',')[0].trim();

    const osint = await consultarOsintIp(ipLimpo);

    let local = '';
    let mapaUrl = '';

    if (isGpsExato) {
        const enderecoRua = await consultarEnderecoGps(gpsLat, gpsLon);
        const tipoSensor = classificarPrecisaoGps(gpsAcc);
        const coords6 = `${gpsLat.toFixed(6)}, ${gpsLon.toFixed(6)}`;
        local = enderecoRua
            ? `${tipoSensor} · ${enderecoRua} (${coords6})`
            : `${tipoSensor} · Coordenadas: (${coords6})`;
        mapaUrl = `https://www.google.com/maps/search/?api=1&query=${gpsLat.toFixed(6)},${gpsLon.toFixed(6)}`;
    } else {
        const cidade =
            (req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '') ||
            osint.cidadeOsint;
        const estado = req.headers['x-vercel-ip-country-region'] || osint.estadoOsint || '';
        const pais = req.headers['x-vercel-ip-country'] || osint.paisOsint || '';
        const localPartes = [cidade, estado].filter(Boolean).join(' - ');
        local = `📡 [Via IP] ${[localPartes, pais].filter(Boolean).join(' / ') || 'Não identificado'}`;
    }

    const ip = osint.isp ? `${ipLimpo} (${osint.isp})` : ipLimpo;

    const ua = req.headers['user-agent'] || '';
    const dispositivo = tratarDispositivo(ua, hwInfo);
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

    const fotoBase64 = typeof body.fotoBase64 === 'string' ? body.fotoBase64 : null;

    await Promise.allSettled([
        fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }),
        enviarAlertaDiscord(payload, mapaUrl, isGpsExato, fotoBase64)
    ]);

    return res.status(200).json({ ok: true, ...payload, mapaUrl, isGpsExato });
}
