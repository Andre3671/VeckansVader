# Deploy till Unraid

Veckans Väder körs som en enda Docker-container (Node 22 alpine, ~285 MB
färdigbyggd). En reverse proxy framför containern sköter SSL + 80/443.

## TL;DR — automatiskt via GitHub Actions

`git push` till `main` triggar deploy automatiskt. Workflowen
(`.github/workflows/deploy.yml`) kör på den självhostade runnern
**VeckansVaderRunner** på Unraid och gör:

1. Checkout av repot
2. Stoppar gamla containern, bygger ny image
3. Startar containern (med persistent volume för besökar-räknaren)
4. Väntar tills servern svarar (max 30s)
5. Kör smoke-tester mot `/api/estimate`, `/vader/stockholm`, `/sitemap.xml`, `/robots.txt`
6. Prunar dangling images så disken inte fylls

Du kan också trigga manuellt: GitHub → **Actions** → "Deploy" → **Run workflow**.

Konfig ligger som env-variabler överst i workflowen (`HOST_PORT`, `NETWORK`,
`DATA_DIR`). Ändra dem om något flyttar sig.

### Förutsättningar för att CI ska funka

- Runnern **VeckansVaderRunner** måste vara igång på Unraid
- Runner-användaren måste vara i `docker`-gruppen (kolla med `docker ps` som
  den användaren)
- Docker-nätverket `authentik_network` måste finnas (`docker network ls`)

---

## TL;DR — manuellt med `npm run deploy`

För när du inte vill committa, eller om GitHub Actions är nere. Allt i ett
kommando från Windows:

```powershell
npm run deploy
```

Scriptet (`scripts/deploy.ps1`) gör:
1. Dödar lokala `node`-processer (släpper file locks)
2. Rensar `node_modules`, `.next`, `out`, build-artefakter
3. SCPar projektet + dot-filer till Unraid
4. Stoppar gammal container, bygger ny image, startar
5. Kör smoke-tester

Varianter:
- `npm run deploy:fast` — hoppar över clean
- `pwsh scripts/deploy.ps1 -SkipBuild` — bara starta om container utan rebuild

Editera **`scripts/deploy.ps1`** överst om Unraid-IP, port eller nätverk
ändras. Default: `root@192.168.0.6`, port `8090`, nätverk `authentik_network`.

---

## Manuellt — om scriptet failar

När du har gjort kodändringar lokalt och vill rulla ut dem.

### På Windows-datorn (PowerShell)

```powershell
# 1. Stoppa allt som håller filer öppna lokalt
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# 2. Rensa byggartefakter så vi inte SCP:ar 500MB onödigt
cd C:\Users\babyb\Desktop\Projekt\WeatherCompare
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .api-backup -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .vader-backup -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android/app/build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android/.gradle -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android/build -ErrorAction SilentlyContinue
Remove-Item -Force .sitemap.ts.bak,.robots.ts.bak -ErrorAction SilentlyContinue

# 3. SCP till Unraid (~30 sek)
scp -r * root@192.168.0.6:/mnt/user/appdata/veckansvader/

# 4. Dot-filer (följer inte med `*` i PowerShell)
scp .dockerignore .gitignore root@192.168.0.6:/mnt/user/appdata/veckansvader/
```

### På Unraid (SSH)

```bash
ssh root@192.168.0.6
```

```bash
cd /mnt/user/appdata/veckansvader

# Stoppa nuvarande container
docker stop veckansvader 2>/dev/null
docker rm veckansvader 2>/dev/null

# Bygg ny image (3–5 min, snabbare därefter med layer-cache)
docker build -t veckansvader:latest .

# Starta — samma settings som tidigare
# Volymen håller besökar-räknaren (lib/visitors.ts) över omstart.
docker run -d \
  --name veckansvader \
  --restart unless-stopped \
  --network authentik_network \
  --dns 1.1.1.1 --dns 8.8.8.8 \
  -p 8090:3000 \
  -e NODE_ENV=production \
  -e VISITOR_DATA_DIR=/app/data \
  -v /mnt/user/appdata/veckansvader-data:/app/data \
  veckansvader:latest

# Följ loggen tills "Ready in ..." → Ctrl+C
docker logs -f veckansvader
```

### Smoke-test efter deploy

```bash
curl -s "http://localhost:8090/api/estimate?place=Stockholm" | head -c 150
curl -s -o /dev/null -w "vader/stockholm: %{http_code}\n" http://localhost:8090/vader/stockholm
curl -s -o /dev/null -w "vader (index): %{http_code}\n" http://localhost:8090/vader
curl -s http://localhost:8090/robots.txt
```

Förväntat: JSON med Stockholm-data, två `200`-koder, och en robots.txt med
`User-Agent: *` + sitemap-URL.

---

## Förstagångs-setup

Bara aktuellt om du sätter upp från noll. Hoppa över om containern redan
existerar.

### 1. Få SSH till Unraid

I Unraid-GUI: **Settings → Management Access → Use SSH: Yes**. Sätt även
ett root-lösenord via **Users → root**.

### 2. Få in koden första gången

Antingen via SCP (samma som "rutinmässig redeploy" ovan) eller via Git:

```bash
cd /mnt/user/appdata
git clone <din-repo> veckansvader
cd veckansvader
```

### 3. Bygg och starta containern

Se "På Unraid (SSH)" ovan. Den första `docker build` tar 3–5 min eftersom
alla bas-images måste laddas hem.

### 4. Reverse proxy + SSL

Containern lyssnar på host-port `8090`. Du behöver en reverse proxy framför
för att exponera den på 80/443 med riktiga TLS-cert.

Två vanliga vägar:

#### A) NginxProxyManager (på `authentik_network`)

I NPM webbgränssnitt → **Proxy Hosts → Add**:

| Fält | Värde |
| --- | --- |
| Domain Names | `veckansvader.se`, `www.veckansvader.se` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.0.6` (Unraid-IP) |
| Forward Port | `8090` |
| Block Common Exploits | ✓ |
| Websockets Support | ✓ |

**SSL-tabben:** Request a new SSL certificate (Let's Encrypt). Force SSL ✓,
HTTP/2 ✓.

NPM lyssnar internt på `8443` för HTTPS (Unraids egen GUI tar 443 på
localhost). Routern måste alltså forwarda extern **443 → 192.168.0.6:8443**
för att Let's Encrypt och Cloudflare ska nå NPM.

#### B) Cloudflare Tunnel (om ISP blockerar inkommande 443)

Många svenska bostads-ISPs blockerar 443. Lösning: Cloudflare Tunnel —
inga öppna portar behövs. Se separat guide hos Cloudflare Zero Trust.

### 5. DNS

Hos din .se-registrar, lägg två A-records mot din publika IP
(`curl -s ifconfig.me` på Unraid visar den):

```
@        A    <din-publika-ip>
www      A    <din-publika-ip>
```

Om du använder Cloudflare som proxy framför: orange moln tar över SSL och
döljer din publika IP. Sätt **SSL/TLS-läget till "Full"** så snart NPM:s
Let's Encrypt-cert har utfärdats (kolla under SSL Certificates i NPM).
"Flexible" funkar men HTTP mellan Cloudflare och din server går då i
klartext över internet.

### 6. Port forwarding (för Let's Encrypt + direkt access)

Om du **inte** kör Cloudflare Tunnel: forwarda i hemma-routern:

| Extern port | Mål |
| --- | --- |
| 80  | `192.168.0.6:80`   |
| 443 | `192.168.0.6:8443` |

Verifiera utifrån att portarna är öppna via
https://www.yougetsignal.com/tools/open-ports/.

---

## Felsökning

**Container startar inte:**
```bash
docker logs veckansvader
```
Vanliga orsaker:
- Network `authentik_network` finns inte → `docker network create authentik_network`
- Port `8090` används redan → ändra första talet i `-p 8090:3000`

**Bygget fail-ar på `npm ci`:** glömt SCP:a `.dockerignore` eller
`package-lock.json`. Kör SCP-stegen igen.

**Cloudflare visar 521:** NPM lyssnar inte på den port routern forwardar till.
Verifiera med `docker ps | grep -i nginx` att NPM-containerns 443 → host
port är **8443**, och att routern forwardar extern 443 → `192.168.0.6:8443`.

**Cloudflare visar 522:** port 443 (eller 8443) är inte öppen utåt.
Vanligaste orsaken: ISP blockerar inkommande 443. Använd Cloudflare Tunnel.

**Cloudflare visar 525 i Full-läge:** NPM:s Let's Encrypt-cert är inte
utfärdat ännu (kolla NPM → SSL Certificates → status ska vara "In Use", inte
"Pending"). Vänta 1–2 min och retry.

**`Open-Meteo: fetch failed ← ... EAI_AGAIN` (eller annan provider):**
Containern kan inte slå upp DNS för en extern host (Open-Meteo ligger på
Hetzner; SMHI/DMI på andra nät så de kan funka medan Open-Meteo failar).
`docker run` ska ha `--dns 1.1.1.1 --dns 8.8.8.8` så att Dockers inbyggda
resolver på `authentik_network` får pålitliga uppströms-servrar. Verifiera
inifrån containern:
```bash
docker exec veckansvader node -e "fetch('https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.07&hourly=temperature_2m&forecast_days=1').then(r=>console.log('OK',r.status)).catch(e=>console.log('FAIL',e.cause||e))"
```

**`Failed to fetch` i Android-appen:** API-routerna saknar CORS-headers.
`middleware.ts` ska finnas i rotmappen och `capacitor.config.ts` ska ha
`CapacitorHttp.enabled: true`. Bygg om APK efter ändringar.

**SCP frågar om lösenord varje gång:** lägg in din SSH-key på Unraid:
```powershell
type ~/.ssh/id_rsa.pub | ssh root@192.168.0.6 "cat >> ~/.ssh/authorized_keys"
```
(`ssh-keygen` om du inte har en nyckel än.)

---

## Bygga lokalt och pusha image (alternativ till SCP+build på Unraid)

Om din Windows-dator har Docker Desktop installerat:

```powershell
cd C:\Users\babyb\Desktop\Projekt\WeatherCompare
docker build -t veckansvader:latest .
docker save veckansvader:latest | ssh root@192.168.0.6 "docker load"
```

Sen på Unraid:
```bash
docker stop veckansvader && docker rm veckansvader
docker run -d --name veckansvader --restart unless-stopped \
  --network authentik_network --dns 1.1.1.1 --dns 8.8.8.8 -p 8090:3000 \
  -e NODE_ENV=production veckansvader:latest
```

Lite snabbare om Unraid har klent CPU; lite långsammare på image-overföringen
(~280 MB). Välj det som passar bäst.
