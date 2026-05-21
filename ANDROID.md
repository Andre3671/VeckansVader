# Veckans Väder — Android-appen

Appen kör frontend i en Capacitor-shell och anropar `https://veckansvader.se`
för väderdata. Inga Google-tjänster, inget Firebase, inget Android Studio.

## Vad du behöver installera (engångs-setup, ~600 MB)

### 1. JDK 21 (Java Development Kit)

Capacitor 8 / Gradle 8 vill ha **JDK 21**.

**Windows:**
- Ladda hem **OpenJDK 21** från https://adoptium.net/temurin/releases/?package=jdk&version=21
- Välj `.msi`-installern, kör den. Bocka i "Set JAVA_HOME variable" under setup.
- Verifiera i ett **nytt** PowerShell-fönster:
  ```powershell
  java -version
  # ska visa "openjdk version 21..."
  ```

### 2. Android SDK Command-Line Tools (utan IDE)

- Ladda hem från https://developer.android.com/studio#command-line-tools-only
- Välj **"Command line tools only"**, Windows-versionen (~150 MB)
- Packa upp till `C:\Users\babyb\AppData\Local\Android\Sdk\cmdline-tools\latest\`
  (den måste ligga i undermappen `latest`, annars hittar Android sdkmanager
  inte sig själv)

### 3. Miljövariabler

Öppna **Sök → "Edit the system environment variables"** → **Environment
Variables…** → under **User variables**:

| Variabel | Värde |
| --- | --- |
| `ANDROID_HOME` | `C:\Users\babyb\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | (sätts automatiskt av JDK-installern) |

Lägg dessutom till i din **PATH**-variabel:
```
%ANDROID_HOME%\cmdline-tools\latest\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

Öppna ett **nytt** PowerShell-fönster (gamla har gammal PATH) och verifiera:
```powershell
sdkmanager --version
```

### 4. Installera SDK-paketen (engångs)

```powershell
# Acceptera alla licenser
sdkmanager --licenses

# Installera nödvändiga paket
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Detta tar några minuter och ~500 MB.

## Bygg APK:n

I projektroten:

```powershell
# 1. Bygg static frontend + sync till android-projektet
npm run app:sync

# 2. Bygg debug-APK
cd android
.\gradlew assembleDebug
```

APK landar i:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

Första bygget tar 5–10 minuter (Gradle laddar hem dependencies). Påföljande
bygg tar ~30 sek.

## Installera på telefon

### Via USB (`adb`)

1. Aktivera USB-debugging på telefonen:
   - **Inställningar → Om telefonen → Tryck 7 ggr på "Build number"** → utvecklarläge på
   - **Inställningar → Utvecklaralternativ → USB-debugging på**
2. Anslut telefonen via USB, godkänn debugging-prompten
3. ```powershell
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```

### Via filöverföring

Kopiera APK:n till telefonen (USB, Bluetooth, Drive, vad som helst). Öppna
filen i telefonens Filer-app → "Installera". Telefonen kan fråga om
"Installera från okända källor" — tillåt.

## Bygg release-AAB för Play Store

Se `PLAYSTORE.md` (kommer separat när vi når dit).

Quick version:
```powershell
# Generera signing key (engångs — säkerhetskopiera den!)
keytool -genkey -v -keystore release.keystore -alias veckansvader `
        -keyalg RSA -keysize 2048 -validity 10000

# Lägg in keystore-config i android\app\build.gradle (vi gör det när vi
# kommer dit)

cd android
.\gradlew bundleRelease
# AAB landar i: android\app\build\outputs\bundle\release\app-release.aab
```

## Daily workflow (efter setup är klar)

Efter att du ändrat frontend-kod:

```powershell
npm run app:sync
cd android
.\gradlew assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

`-r` = reinstall över existerande version, behåller data.

## Arkitektur

- **API-bas**: `NEXT_PUBLIC_API_BASE=https://veckansvader.se` bakas in i
  static-bundeln vid build (se `scripts/build-app.js`)
- **Static export**: `app/api/`-mappen flyttas undan under app-bygget för att
  Next.js inte ska klaga, återställs sen
- **Geolocation**: `lib/platform.ts` väljer Capacitor-plugin på Android, 
  `navigator.geolocation` i webben
- **Notiser**: helt lokala. `lib/notifications.ts` schemaläggar väderalarm
  (regn, snö, vind, frost) när appen är öppen. Android håller dem
  scheduled tills de fyrar — kräver att appen öppnas då och då för att
  hålla scheduleringen färsk
- **Inga Google-tjänster**: inget Firebase, inget Cloud Messaging, ingen
  Play Services-beroende

## När frontend-koden ändras

Appen läser bundlade web-assets, **inte** live-webben. Server-API-ändringar
är automatiska för appen, men UI-ändringar kräver ny build + APK-release.

## Felsökning

**`'sdkmanager' is not recognized`**: PATH inte uppdaterad → öppna nytt PowerShell.

**Gradle hänger på "Configuration on demand"**: första bygget laddar hem
~300 MB dependencies. Ge det 5–10 min och titta på `gradlew --info`.

**`SDK location not found`**: skapa `android/local.properties`:
```
sdk.dir=C:\\Users\\babyb\\AppData\\Local\\Android\\Sdk
```

**`Java version 17 ... but found 21`**: skadat. Verifiera `JAVA_HOME` pekar
på JDK 21, inte 17.
