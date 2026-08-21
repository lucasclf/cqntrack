---
name: android-release
description: Builda, assina, testa em emulador e publica o app Android (Capacitor) do cqntrack — apps/cqntrack_mobile. Use ao preparar uma nova versão do APK, ao verificar que uma mudança do frontend web chegou corretamente no build mobile, ou ao depurar um problema específico do app Android via emulador/logcat.
---

# Build e release do app Android (Capacitor)

`apps/cqntrack_mobile` empacota `apps/cqntrack_fe` via Capacitor — **é um WebView, não código nativo
próprio** (o único Java no projeto é o `MainActivity.java` padrão do Capacitor, sem lógica
customizada). Isso é o estado atual; se você está lendo isso já durante a migração para um app
Kotlin nativo, esta skill descreve o app Capacitor **antigo** — útil como referência de UX/paridade
de feature e para comparação lado a lado no emulador, não como base para o app novo. Ver skill
`mobile-api-contract` para o que o app novo precisa saber sobre o backend.

## 1. Rebuild do bundle web + sync

```bash
cd "g:/projetos/cqntrack"
pnpm --filter @cqntrack/frontend run build:mobile   # gera apps/cqntrack_fe/dist-mobile
cd apps/cqntrack_mobile && npx cap sync android      # copia dist-mobile pro projeto Android
```

Depois de qualquer mudança no frontend web, confira se ela se aplica ao mobile antes de considerar
a tarefa concluída (regra do CLAUDE.md) — exceção deliberada: telas de importação de dado de rede
social (Filmow/tvtime/Cinopsys) ficam de fora do build mobile de propósito
(`import.meta.env.VITE_TARGET !== "mobile"`, ver `Account.tsx`).

## 2. JDK correto

O projeto já teve problemas de JDK incompatível/certificado ausente. Use um destes, na ordem de
preferência já validada nesta máquina:

```bash
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6"
# ou: JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
```

Se `assembleDebug`/`assembleRelease` falhar por certificado SSL ausente no keystore do JDK, foi
resolvido antes copiando `cacerts`/`tzdb.dat` do JDK Eclipse Adoptium para o Corretto — não repita
esse debug do zero, cheque primeiro se `JAVA_HOME=".../corretto-21.0.6"` já funciona direto.

## 3. Build

```bash
cd apps/cqntrack_mobile/android
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6" ./gradlew assembleDebug --no-daemon
# release (assinado, minificado — precisa de app/keystore.properties, gitignored, não existe
# recém-clonado; sem ele o assembleRelease roda mas gera um APK não assinado):
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6" ./gradlew assembleRelease --no-daemon
```

APK sai em `android/app/build/outputs/apk/debug/` ou `.../release/`.

## 4. Testar no emulador

```bash
SDK="/c/Users/lucas/AppData/Local/Android/Sdk"
"$SDK/emulator/emulator.exe" -list-avds
nohup "$SDK/emulator/emulator.exe" -avd Galaxy_S24 -no-snapshot-load &
"$SDK/platform-tools/adb.exe" devices   # espera aparecer "device" (não "offline")

"$SDK/platform-tools/adb.exe" install -r android/app/build/outputs/apk/debug/app-debug.apk
# ou, pra testar upgrade: uninstall antes se mudou o keystore de assinatura
"$SDK/platform-tools/adb.exe" uninstall xyz.cqn.cqntrack
```

Screenshot do emulador (nomeie o arquivo remoto por passo do teste, para não sobrescrever):

```bash
MSYS_NO_PATHCONV=1 "$SDK/platform-tools/adb.exe" shell screencap -p /sdcard/screen.png
MSYS_NO_PATHCONV=1 "$SDK/platform-tools/adb.exe" pull /sdcard/screen.png <scratchpad>/screen.png
```

`MSYS_NO_PATHCONV=1` é necessário no Git Bash — sem isso, o path `/sdcard/...` é reescrito para um
path Windows antes de chegar no `adb`. Logs: `adb.exe logcat` (filtre por `Capacitor` ou pelo nome
do pacote `xyz.cqn.cqntrack` para reduzir ruído).

## 5. Publicar (GitHub Releases)

O link de download no site (`AuthLayout`/`Account.tsx`, "Baixar APK") é fixo:
`github.com/lucasclf/cqntrack/releases/latest/download/cqntrack.apk` — **o asset publicado precisa
se chamar exatamente `cqntrack.apk`**, senão o link do site quebra silenciosamente até a próxima
edição do release.

```bash
gh release create v0.X.X apps/cqntrack_mobile/android/app/build/outputs/apk/release/app-release.apk#cqntrack.apk \
  --title "v0.X.X" --notes "..."
```

**Isto é publicação pública, tratar como deploy** — não faça sem confirmação explícita do usuário,
mesmo que o build/teste local acima já esteja aprovado.

## Versão

`apps/cqntrack_mobile/package.json` não tem campo de versão visível ao usuário — a versão exibida
vem do `versionName`/`versionCode` em `android/app/build.gradle`. Sincronize com a tag do release
git (`git tag vX.X.X`) ao publicar.
